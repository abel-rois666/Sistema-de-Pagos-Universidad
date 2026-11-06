-- Preparada, no aplicada. Instalar después de las migraciones de reasociación
-- 20261018120000 y 20261018133000. No modifica planes ni recibos existentes.
begin;
do $preflight$
begin
  if to_regclass('public.planes_pago_reasociaciones') is null
    or to_regprocedure('public.revisar_reasociacion_solo_plan_pago(uuid,uuid,boolean)') is null
    or to_regprocedure('public.registrar_pago_transaccional(jsonb,jsonb,uuid,jsonb,uuid,numeric)') is null then
    raise exception 'Instala primero las funciones de pagos y reasociación previas';
  end if;
end;
$preflight$;

-- Un detalle de recibo puede distribuirse entre varios conceptos. El índice
-- legado por sí solo no identifica el plan: este registro sí lo hace.
create table if not exists public.planes_pago_vinculos_recibo (
  id uuid primary key default gen_random_uuid(),
  recibo_detalle_id uuid not null references public.recibos_detalles(id) on delete cascade,
  plan_id uuid not null references public.planes_pago(id) on delete restrict,
  indice_concepto integer not null check (indice_concepto between 1 and 18),
  importe numeric(12,2) not null check (importe > 0),
  origen text not null check (origen in ('COBRO', 'CONCILIACION')),
  actor_uid uuid not null,
  creado_en timestamptz not null default now(),
  anulado_en timestamptz,
  anulado_por uuid
);
create index if not exists idx_vinculos_plan_pago on public.planes_pago_vinculos_recibo(plan_id, indice_concepto);
create index if not exists idx_vinculos_recibo_detalle on public.planes_pago_vinculos_recibo(recibo_detalle_id);
create unique index if not exists idx_vinculo_recibo_activo
  on public.planes_pago_vinculos_recibo(recibo_detalle_id, plan_id, indice_concepto)
  where anulado_en is null;
alter table public.planes_pago_vinculos_recibo enable row level security;
revoke all on public.planes_pago_vinculos_recibo from public, anon, authenticated;
grant select on public.planes_pago_vinculos_recibo to authenticated;
drop policy if exists "finanzas: leer vínculos de recibos" on public.planes_pago_vinculos_recibo;
create policy "finanzas: leer vínculos de recibos"
  on public.planes_pago_vinculos_recibo for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO',
      'COORDINADOR CONTROL ESCOLAR', 'COORDINADOR RECURSOS HUMANOS', 'COORDINADOR ACADEMICO')
    and exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true));

-- Una cancelación posterior no puede dejar vínculos vigentes a un recibo inactivo.
create or replace function public.anular_vinculos_recibo_cancelado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.estatus is distinct from new.estatus and new.estatus = 'CANCELADO' then
    update public.planes_pago_vinculos_recibo v
      set anulado_en = now(), anulado_por = auth.uid()
      where v.recibo_detalle_id in
        (select d.id from public.recibos_detalles d where d.recibo_id = new.id)
        and v.anulado_en is null;
  end if;
  return new;
end;
$$;
drop trigger if exists anular_vinculos_recibo_cancelado on public.recibos;
create trigger anular_vinculos_recibo_cancelado
  after update of estatus on public.recibos
  for each row execute function public.anular_vinculos_recibo_cancelado();
revoke all on function public.anular_vinculos_recibo_cancelado() from public, anon, authenticated;

-- Exige el vínculo explícito al finalizar la transacción de cualquier cobro
-- nuevo. Los detalles históricos existentes no se reescriben ni se validan
-- retroactivamente por instalar este disparador.
create or replace function public.validar_vinculo_explicito_detalle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Las correcciones de textos de detalles históricos no deben exigir una
  -- conciliación retroactiva si el índice no cambió.
  if TG_OP = 'UPDATE' and new.indice_concepto_plan is not distinct from old.indice_concepto_plan then
    return new;
  end if;
  if new.indice_concepto_plan is null then
    if exists (select 1 from public.planes_pago_vinculos_recibo v
      where v.recibo_detalle_id = new.id and v.anulado_en is null) then
      raise exception 'Desvincula el detalle con la función auditada antes de quitar su índice';
    end if;
  elsif not exists (select 1 from public.planes_pago_vinculos_recibo v
      where v.recibo_detalle_id = new.id and v.indice_concepto = new.indice_concepto_plan
        and v.anulado_en is null) then
    raise exception 'El detalle de un recibo vinculado requiere el ID explícito del plan';
  end if;
  return new;
end;
$$;
drop trigger if exists validar_vinculo_explicito_detalle on public.recibos_detalles;
create constraint trigger validar_vinculo_explicito_detalle
  after insert or update of indice_concepto_plan on public.recibos_detalles
  deferrable initially deferred for each row
  execute function public.validar_vinculo_explicito_detalle();
revoke all on function public.validar_vinculo_explicito_detalle() from public, anon, authenticated;

-- Corrige ID y tipo del plan sin cambiar ciclos, facturas, folios, importes,
-- estatus ni detalles de recibos. Los vínculos previos por índice se conservan
-- como dato legado y se concilian expresamente después.
create or replace function public.revisar_reasociacion_con_recibos(
  p_plan_id uuid, p_ciclo_destino_id uuid, p_aplicar boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.planes_pago%rowtype;
  v_origen public.ciclos_escolares%rowtype;
  v_destino public.ciclos_escolares%rowtype;
  v_tipo text;
  v_plan_academico uuid;
  v_grupos integer;
  v_programas integer;
  v_recibos uuid[] := '{}';
  v_folios integer[] := '{}';
  v_detalles_pendientes integer := 0;
  v_estados_cobrados integer := 0;
  v_indice integer;
  v_motivo text;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para revisar asociaciones de planes de pago';
  end if;
  if p_plan_id is null or p_ciclo_destino_id is null then
    raise exception 'Se requiere plan y ciclo de destino';
  end if;
  if p_aplicar then
    perform pg_advisory_xact_lock(hashtext('reasociar_plan_pago:' || p_plan_id::text));
    select * into v_plan from public.planes_pago where id = p_plan_id for update;
  else
    select * into v_plan from public.planes_pago where id = p_plan_id;
  end if;
  if not found then raise exception 'El plan de pagos ya no existe'; end if;
  select * into v_origen from public.ciclos_escolares where id = v_plan.ciclo_id;
  select * into v_destino from public.ciclos_escolares where id = p_ciclo_destino_id;
  v_tipo := lower(btrim(coalesce(v_destino.tipo_periodo, '')));
  if v_origen.id is null or v_destino.id is null or v_origen.id = v_destino.id
    or v_origen.nombre <> v_destino.nombre
    or v_tipo not in ('cuatrimestral', 'semestral')
    or lower(btrim(coalesce(v_plan.tipo_plan, ''))) not in ('cuatrimestral', 'semestral') then
    v_motivo := 'El destino debe ser otro ciclo ordinario con el mismo nombre.';
  end if;
  if v_motivo is null then
    select count(distinct g.plan_id), (array_agg(g.plan_id))[1]
      into v_grupos, v_plan_academico
      from public.alumnos_grupos ag join public.grupos g on g.id = ag.grupo_id
      where ag.alumno_id = v_plan.alumno_id and g.ciclo_id = v_destino.id;
    select count(*) into v_programas from public.alumno_programas ap
      join public.planes_estudio pe on pe.id = ap.plan_id
      where ap.alumno_id = v_plan.alumno_id and ap.es_vigente is true
        and ap.plan_id = v_plan_academico and lower(btrim(pe.tipo_periodo)) = v_tipo;
    if v_grupos <> 1 or v_programas <> 1
      or (select count(*) from public.alumno_programas ap
          where ap.alumno_id = v_plan.alumno_id and ap.es_vigente is true) <> 1 then
      v_motivo := 'El grupo y el programa vigente no prueban una asociación única con el destino.';
    elsif exists (select 1 from public.alumnos_grupos ag join public.grupos g on g.id = ag.grupo_id
      where ag.alumno_id = v_plan.alumno_id and g.ciclo_id = v_origen.id)
      or exists (select 1 from public.planes_pago pp where pp.alumno_id = v_plan.alumno_id
        and pp.id <> v_plan.id and pp.ciclo_id in (v_origen.id, v_destino.id)) then
      v_motivo := 'El alumno tiene otro grupo o plan en los ciclos involucrados.';
    end if;
  end if;
  if v_motivo is null then
    if p_aplicar then
      perform 1 from public.recibos where alumno_id = v_plan.alumno_id
        and ciclo_id in (v_origen.id, v_destino.id) for update;
    end if;
    select coalesce(array_agg(r.id order by r.folio), '{}'),
      coalesce(array_agg(r.folio order by r.folio), '{}')
      into v_recibos, v_folios from public.recibos r
      where r.alumno_id = v_plan.alumno_id and r.ciclo_id = v_origen.id;
    select count(*) into v_detalles_pendientes from public.recibos_detalles d
      where d.recibo_id = any(v_recibos) and d.indice_concepto_plan is not null
        and not exists (select 1 from public.planes_pago_vinculos_recibo v
          where v.recibo_detalle_id = d.id and v.plan_id = v_plan.id and v.anulado_en is null);
    for v_indice in 1..18 loop
      if upper(btrim(coalesce(to_jsonb(v_plan) ->> ('estatus_' || v_indice), 'PENDIENTE')))
        not in ('', 'PENDIENTE') then
        v_estados_cobrados := v_estados_cobrados + 1;
      end if;
    end loop;
    select greatest(v_estados_cobrados, count(*)::integer) into v_estados_cobrados
      from public.planes_pago_detalles d where d.plan_id = v_plan.id
        and upper(btrim(coalesce(d.estatus, 'PENDIENTE'))) not in ('', 'PENDIENTE');
  end if;
  if v_motivo is not null then
    if p_aplicar then raise exception '%', v_motivo; end if;
    return jsonb_build_object('aplicable', false, 'motivo', v_motivo,
      'plan_id', v_plan.id, 'recibos_en_origen', cardinality(v_recibos), 'folios', to_jsonb(v_folios));
  end if;
  if p_aplicar then
    update public.planes_pago set ciclo_id = v_destino.id, tipo_plan = initcap(v_tipo)
      where id = v_plan.id and ciclo_id = v_origen.id;
    if not found then raise exception 'El plan cambió durante la revisión'; end if;
    insert into public.planes_pago_reasociaciones
      (plan_pago_id, alumno_id, ciclo_origen_id, ciclo_destino_id,
       tipo_plan_anterior, tipo_plan_nuevo, recibos_ids, recibos_conservados_ids, actor_uid)
    values (v_plan.id, v_plan.alumno_id, v_origen.id, v_destino.id,
      v_plan.tipo_plan, initcap(v_tipo), '{}', v_recibos, auth.uid());
  end if;
  return jsonb_build_object('aplicable', true, 'aplicado', p_aplicar,
    'plan_id', v_plan.id, 'ciclo_origen_id', v_origen.id,
    'ciclo_destino_id', v_destino.id, 'tipo_plan_nuevo', initcap(v_tipo),
    'recibos_en_origen', cardinality(v_recibos), 'folios', to_jsonb(v_folios),
    'detalles_pendientes_conciliar', v_detalles_pendientes,
    'estados_cobrados_conservados', v_estados_cobrados);
end;
$$;
revoke all on function public.revisar_reasociacion_con_recibos(uuid,uuid,boolean) from public, anon;
grant execute on function public.revisar_reasociacion_con_recibos(uuid,uuid,boolean) to authenticated;

-- Un vínculo explícito no altera el documento fiscal ni el estado del plan.
-- Acepta un recibo de otro ID solamente si ambos ciclos tienen el mismo nombre.
create or replace function public.conciliar_recibo_detalle_plan(
  p_detalle_id uuid, p_plan_id uuid, p_indice integer,
  p_importe numeric, p_aplicar boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_detalle public.recibos_detalles%rowtype;
  v_recibo public.recibos%rowtype;
  v_plan public.planes_pago%rowtype;
  v_concepto text;
  v_usado numeric;
  v_plan_usado numeric;
  v_plan_cantidad numeric;
  v_motivo text;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para conciliar recibos';
  end if;
  if p_detalle_id is null or p_plan_id is null or p_indice is null or p_indice not between 1 and 18
    or p_importe is null or p_importe <= 0 then
    raise exception 'Se requiere detalle, plan, índice e importe positivo';
  end if;
  if p_aplicar then
    perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
    perform pg_advisory_xact_lock(hashtext('aplicar_plan:' || p_plan_id::text || ':' || p_indice::text));
    select * into v_detalle from public.recibos_detalles where id = p_detalle_id for update;
  else
    select * into v_detalle from public.recibos_detalles where id = p_detalle_id;
  end if;
  if p_aplicar then
    select * into v_recibo from public.recibos where id = v_detalle.recibo_id for update;
    select * into v_plan from public.planes_pago where id = p_plan_id for update;
  else
    select * into v_recibo from public.recibos where id = v_detalle.recibo_id;
    select * into v_plan from public.planes_pago where id = p_plan_id;
  end if;
  if v_detalle.id is null or v_recibo.id is null or v_plan.id is null then
    v_motivo := 'El detalle, recibo o plan ya no existe.';
  elsif v_recibo.alumno_id is distinct from v_plan.alumno_id or v_recibo.estatus <> 'ACTIVO' then
    v_motivo := 'El recibo no está activo o pertenece a otro alumno.';
  elsif not exists (select 1 from public.ciclos_escolares origen
    join public.ciclos_escolares destino on destino.id = v_plan.ciclo_id
    where origen.id = v_recibo.ciclo_id and origen.nombre = destino.nombre
      and lower(btrim(destino.tipo_periodo)) = lower(btrim(v_plan.tipo_plan))) then
    v_motivo := 'El recibo y el plan no pertenecen al mismo periodo nominal.';
  elsif not exists (select 1 from public.alumno_programas ap
    join public.planes_estudio pe on pe.id = ap.plan_id
    where ap.alumno_id = v_plan.alumno_id and ap.es_vigente is true
      and lower(btrim(pe.tipo_periodo)) = lower(btrim(v_plan.tipo_plan))) then
    v_motivo := 'El tipo del plan no coincide con el programa académico vigente.';
  elsif exists (select 1 from public.planes_pago_vinculos_recibo v
    where v.recibo_detalle_id = p_detalle_id and v.plan_id = p_plan_id
      and v.indice_concepto = p_indice and v.anulado_en is null) then
    v_motivo := 'Este vínculo ya está registrado.';
  end if;
  if v_motivo is null then
    select concepto into v_concepto from public.planes_pago_detalles
      where plan_id = p_plan_id and indice_concepto = p_indice limit 1;
    v_concepto := coalesce(v_concepto, to_jsonb(v_plan) ->> ('concepto_' || p_indice));
    select cantidad into v_plan_cantidad from public.planes_pago_detalles
      where plan_id = p_plan_id and indice_concepto = p_indice limit 1;
    v_plan_cantidad := coalesce(v_plan_cantidad,
      (to_jsonb(v_plan) ->> ('cantidad_' || p_indice))::numeric);
    if nullif(btrim(v_concepto), '') is null then
      v_motivo := 'El concepto del plan no existe.';
    elsif upper(btrim(regexp_replace(v_detalle.concepto,
      '\s*\(Plan [^)]*\)\s*$', '', 'i'))) <> upper(btrim(v_concepto)) then
      v_motivo := 'El concepto del recibo no coincide con el del plan.';
    end if;
  end if;
  if v_motivo is null then
    select coalesce(sum(v.importe), 0) into v_usado
      from public.planes_pago_vinculos_recibo v
      where v.recibo_detalle_id = p_detalle_id and v.anulado_en is null;
    select coalesce(sum(v.importe), 0) into v_plan_usado
      from public.planes_pago_vinculos_recibo v
      where v.plan_id = p_plan_id and v.indice_concepto = p_indice and v.anulado_en is null;
    if p_importe + v_usado > v_detalle.subtotal + 0.005 then
      v_motivo := 'La distribución supera el importe del detalle del recibo.';
    elsif v_plan_cantidad is null or p_importe + v_plan_usado > v_plan_cantidad + 0.005 then
      v_motivo := 'La distribución supera el importe del concepto del plan.';
    elsif v_detalle.indice_concepto_plan is not null
      and v_detalle.indice_concepto_plan <> p_indice then
      v_motivo := 'El índice legado apunta a otro concepto; requiere revisión individual.';
    end if;
  end if;
  if v_motivo is not null then
    if p_aplicar then raise exception '%', v_motivo; end if;
    return jsonb_build_object('aplicable', false, 'motivo', v_motivo);
  end if;
  if p_aplicar then
    insert into public.planes_pago_vinculos_recibo
      (recibo_detalle_id, plan_id, indice_concepto, importe, origen, actor_uid)
    values (p_detalle_id, p_plan_id, p_indice, p_importe, 'CONCILIACION', auth.uid());
    update public.recibos_detalles set indice_concepto_plan = p_indice
      where id = p_detalle_id and indice_concepto_plan is null;
  end if;
  return jsonb_build_object('aplicable', true, 'aplicado', p_aplicar,
    'recibo_detalle_id', p_detalle_id, 'plan_id', p_plan_id,
    'indice_concepto', p_indice, 'importe', p_importe);
end;
$$;
revoke all on function public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean) from public, anon;
grant execute on function public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean) to authenticated;

-- Desvincular no significa cancelar el cobro. Mantiene intactos el recibo,
-- la factura y el estatus histórico del plan; anota la anulación del vínculo.
create or replace function public.desvincular_detalle_recibo_plan(p_detalle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_recibo_id uuid;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para desvincular recibos';
  end if;
  perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
  select recibo_id into v_recibo_id from public.recibos_detalles where id = p_detalle_id for update;
  if not found then raise exception 'El detalle del recibo ya no existe'; end if;
  update public.planes_pago_vinculos_recibo
    set anulado_en = now(), anulado_por = auth.uid()
    where recibo_detalle_id = p_detalle_id and anulado_en is null;
  update public.recibos_detalles set indice_concepto_plan = null
    where id = p_detalle_id;
  return jsonb_build_object('aplicado', true, 'recibo_id', v_recibo_id);
end;
$$;
revoke all on function public.desvincular_detalle_recibo_plan(uuid) from public, anon;
grant execute on function public.desvincular_detalle_recibo_plan(uuid) to authenticated;

-- La misma operación de cobro existente permanece atómica; esta variante
-- registra además la identidad del plan por cada detalle cobrado.
create or replace function public.registrar_pago_transaccional_v2(
  p_recibo jsonb, p_detalles jsonb, p_plan_id uuid default null,
  p_plan_updates jsonb default null, p_alumno_id uuid default null,
  p_saldo_delta numeric default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.planes_pago%rowtype;
  v_tipo_ciclo text;
  v_resultado jsonb;
  v_detalle public.recibos_detalles%rowtype;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para registrar pagos';
  end if;
  if p_plan_id is not null then
    select * into v_plan from public.planes_pago where id = p_plan_id for update;
    if not found or v_plan.alumno_id is distinct from (p_recibo->>'alumno_id')::uuid
      or v_plan.ciclo_id is distinct from (p_recibo->>'ciclo_id')::uuid then
      raise exception 'El plan no pertenece al alumno y ciclo exactos del recibo';
    end if;
    select lower(btrim(tipo_periodo)) into v_tipo_ciclo
      from public.ciclos_escolares where id = v_plan.ciclo_id;
    if (lower(btrim(v_plan.tipo_plan)) like '%cuatrimestral%' and v_tipo_ciclo <> 'cuatrimestral')
      or (lower(btrim(v_plan.tipo_plan)) like '%semestral%' and v_tipo_ciclo <> 'semestral') then
      raise exception 'El tipo del plan no corresponde al ciclo exacto del recibo';
    end if;
  elsif exists (select 1 from jsonb_array_elements(p_detalles) d
    where nullif(d->>'indice_concepto_plan', '') is not null) then
    raise exception 'Un concepto del plan requiere identificar el plan por ID';
  end if;
  v_resultado := public.registrar_pago_transaccional(
    p_recibo, p_detalles, p_plan_id, p_plan_updates, p_alumno_id, p_saldo_delta);
  if p_plan_id is not null then
    for v_detalle in select * from public.recibos_detalles
      where recibo_id = (v_resultado->>'recibo_id')::uuid
        and indice_concepto_plan is not null loop
      if not exists (select 1 from public.planes_pago_detalles pd
        where pd.plan_id = p_plan_id and pd.indice_concepto = v_detalle.indice_concepto_plan)
        and nullif(btrim(to_jsonb(v_plan) ->> ('concepto_' || v_detalle.indice_concepto_plan)), '') is null then
        raise exception 'El concepto % no pertenece al plan identificado', v_detalle.indice_concepto_plan;
      end if;
      insert into public.planes_pago_vinculos_recibo
        (recibo_detalle_id, plan_id, indice_concepto, importe, origen, actor_uid)
      values (v_detalle.id, p_plan_id, v_detalle.indice_concepto_plan,
        v_detalle.subtotal, 'COBRO', auth.uid());
    end loop;
  end if;
  return v_resultado;
end;
$$;
revoke all on function public.registrar_pago_transaccional_v2(jsonb,jsonb,uuid,jsonb,uuid,numeric) from public, anon;
grant execute on function public.registrar_pago_transaccional_v2(jsonb,jsonb,uuid,jsonb,uuid,numeric) to authenticated;

-- Vinculación manual de un detalle con uno o varios conceptos del MISMO ID de
-- ciclo. Sustituye la secuencia de escrituras cliente sin transacción.
create or replace function public.vincular_recibo_detalle_planes_v2(
  p_detalle_id uuid, p_seleccion jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_detalle public.recibos_detalles%rowtype;
  v_recibo public.recibos%rowtype;
  v_plan public.planes_pago%rowtype;
  v_tipo_ciclo text;
  v_item jsonb;
  v_plan_id uuid;
  v_indice integer;
  v_primero integer;
  v_concepto text;
  v_cantidad numeric;
  v_previo text;
  v_restante numeric;
  v_abono numeric;
  v_acumulado numeric;
  v_saldo numeric;
  v_folios text;
  v_nuevo text;
  v_aplicaciones integer := 0;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para vincular recibos';
  end if;
  if p_detalle_id is null or p_seleccion is null or jsonb_typeof(p_seleccion) <> 'array'
    or jsonb_array_length(p_seleccion) = 0 then
    raise exception 'Selecciona al menos un concepto del plan';
  end if;
  perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
  select * into v_detalle from public.recibos_detalles where id = p_detalle_id for update;
  select * into v_recibo from public.recibos where id = v_detalle.recibo_id for update;
  if v_detalle.id is null or v_recibo.id is null or v_recibo.estatus <> 'ACTIVO'
    or v_detalle.indice_concepto_plan is not null
    or exists (select 1 from public.planes_pago_vinculos_recibo
      where recibo_detalle_id = p_detalle_id and anulado_en is null) then
    raise exception 'El detalle no está disponible para vincular';
  end if;
  v_saldo := v_detalle.subtotal;
  if v_saldo <= 0 then raise exception 'El detalle no tiene un importe positivo'; end if;
  for v_item in select value from jsonb_array_elements(p_seleccion) loop
    v_plan_id := (v_item->>'plan_id')::uuid;
    v_indice := (v_item->>'indice')::integer;
    if v_plan_id is null or v_indice is null or v_indice not between 1 and 18 then
      raise exception 'La selección contiene un plan o índice inválido';
    end if;
    select * into v_plan from public.planes_pago where id = v_plan_id for update;
    if v_plan.id is null or v_plan.alumno_id is distinct from v_recibo.alumno_id
      or v_plan.ciclo_id is distinct from v_recibo.ciclo_id then
      raise exception 'El plan no pertenece al alumno y ciclo exactos del recibo';
    end if;
    select lower(btrim(tipo_periodo)) into v_tipo_ciclo
      from public.ciclos_escolares where id = v_plan.ciclo_id;
    if (lower(btrim(v_plan.tipo_plan)) like '%cuatrimestral%' and v_tipo_ciclo <> 'cuatrimestral')
      or (lower(btrim(v_plan.tipo_plan)) like '%semestral%' and v_tipo_ciclo <> 'semestral') then
      raise exception 'El tipo del plan no corresponde al ciclo exacto del recibo';
    end if;
    if exists (select 1 from public.planes_pago_vinculos_recibo v
      where v.recibo_detalle_id = p_detalle_id and v.plan_id = v_plan_id
        and v.indice_concepto = v_indice and v.anulado_en is null) then
      raise exception 'La selección repite un concepto del plan';
    end if;
    select pd.concepto, pd.cantidad, pd.estatus
      into v_concepto, v_cantidad, v_previo from public.planes_pago_detalles pd
      where pd.plan_id = v_plan_id and pd.indice_concepto = v_indice limit 1;
    if v_concepto is null then
      v_concepto := to_jsonb(v_plan) ->> ('concepto_' || v_indice);
      v_cantidad := (to_jsonb(v_plan) ->> ('cantidad_' || v_indice))::numeric;
      v_previo := to_jsonb(v_plan) ->> ('estatus_' || v_indice);
    end if;
    if nullif(btrim(v_concepto), '') is null or v_cantidad is null or v_cantidad <= 0 then
      raise exception 'El concepto seleccionado no tiene importe válido';
    end if;
    if v_previo ~* 'Resta\s*\$[0-9,]+(\.[0-9]+)?' then
      v_restante := replace((regexp_match(v_previo, 'Resta\s*\$([0-9,]+(\.[0-9]+)?)', 'i'))[1], ',', '')::numeric;
    elsif upper(coalesce(v_previo, '')) like '%PAGADO%' then
      v_restante := 0;
    elsif upper(btrim(coalesce(v_previo, ''))) in ('', 'PENDIENTE') then
      v_restante := v_cantidad;
    else
      raise exception 'El estado del concepto % requiere revisión antes de aplicar otro recibo', v_indice;
    end if;
    if v_restante <= 0 then raise exception 'El concepto % ya está pagado', v_indice; end if;
    v_abono := least(v_saldo, v_restante);
    if v_abono <= 0 then exit; end if;
    v_acumulado := v_cantidad - v_restante + v_abono;
    select string_agg(m[1], '; ') into v_folios
      from regexp_matches(coalesce(v_previo, ''), '(R-[0-9]+|F-[A-Za-z0-9-]+)', 'g') m;
    if v_restante - v_abono <= 0.005 then
      v_nuevo := concat_ws('; ', nullif(v_folios, ''),
        'R-' || v_recibo.folio || ' (Pagado $' || to_char(v_acumulado, 'FM999999990.00') || ')');
    else
      v_nuevo := concat_ws('; ', nullif(v_folios, ''),
        'R-' || v_recibo.folio || ' (Abono $' || to_char(v_acumulado, 'FM999999990.00')
          || ', Resta $' || to_char(v_restante - v_abono, 'FM999999990.00') || ')');
    end if;
    execute format('update public.planes_pago set %I = $1 where id = $2', 'estatus_' || v_indice)
      using v_nuevo, v_plan_id;
    update public.planes_pago_detalles set estatus = v_nuevo
      where plan_id = v_plan_id and indice_concepto = v_indice;
    insert into public.planes_pago_vinculos_recibo
      (recibo_detalle_id, plan_id, indice_concepto, importe, origen, actor_uid)
    values (p_detalle_id, v_plan_id, v_indice, v_abono, 'CONCILIACION', auth.uid());
    v_primero := coalesce(v_primero, v_indice);
    v_saldo := v_saldo - v_abono;
    v_aplicaciones := v_aplicaciones + 1;
    if v_saldo <= 0.005 then exit; end if;
  end loop;
  if v_aplicaciones = 0 then raise exception 'No quedó importe aplicado a ningún concepto'; end if;
  update public.recibos_detalles set indice_concepto_plan = v_primero,
    observaciones = case when v_saldo > 0.005 then
      'Vinculación parcial; excedente enviado a saldo a favor'
      else 'Vinculado al plan de pagos' end
    where id = p_detalle_id;
  if v_saldo > 0.005 then
    update public.alumnos set saldo_a_favor = coalesce(saldo_a_favor, 0) + v_saldo
      where id = v_recibo.alumno_id;
  end if;
  return jsonb_build_object('aplicado', true, 'aplicaciones', v_aplicaciones,
    'excedente', greatest(v_saldo, 0));
end;
$$;
revoke all on function public.vincular_recibo_detalle_planes_v2(uuid,jsonb) from public, anon;
grant execute on function public.vincular_recibo_detalle_planes_v2(uuid,jsonb) to authenticated;
commit;
