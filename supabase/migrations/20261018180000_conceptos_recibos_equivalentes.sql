-- La conciliación histórica es una decisión manual sobre un detalle y un
-- concepto explícitos. El texto puede variar; alumno, periodo, índice e
-- importes continúan validados. Un cobro histórico ya emitido no vuelve a
-- acreditar el monedero. No modifica datos existentes al instalarse.
begin;

do $preflight$
begin
  if to_regprocedure('public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean)') is null
    or to_regprocedure('public.vincular_recibo_detalle_planes_v2(uuid,jsonb)') is null
    or to_regclass('public.planes_pago_vinculos_recibo') is null then
    raise exception 'Instala primero la migración de conciliación de planes y recibos';
  end if;
end;
$preflight$;

create or replace function public.conciliar_recibo_detalle_plan(
  p_detalle_id uuid, p_plan_id uuid, p_indice integer,
  p_importe numeric, p_aplicar boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_detalle public.recibos_detalles%rowtype;
  v_recibo public.recibos%rowtype;
  v_plan public.planes_pago%rowtype;
  v_usado numeric;
  v_plan_usado numeric;
  v_plan_cantidad numeric;
  v_remanente numeric;
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
    select cantidad into v_plan_cantidad from public.planes_pago_detalles
      where plan_id = p_plan_id and indice_concepto = p_indice limit 1;
    v_plan_cantidad := coalesce(v_plan_cantidad,
      (to_jsonb(v_plan) ->> ('cantidad_' || p_indice))::numeric);
    if not exists (select 1 from public.planes_pago_detalles d
        where d.plan_id = p_plan_id and d.indice_concepto = p_indice
          and nullif(btrim(d.concepto), '') is not null)
      and nullif(btrim(to_jsonb(v_plan) ->> ('concepto_' || p_indice)), '') is null then
      v_motivo := 'El concepto seleccionado no existe en el plan.';
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
    v_remanente := greatest(v_detalle.subtotal - v_usado - p_importe, 0);
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
    'indice_concepto', p_indice, 'importe', p_importe,
    'remanente_historico_sin_movimiento', v_remanente,
    'monedero_modificado', false);
end;
$$;
revoke all on function public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean) from public, anon;
grant execute on function public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean) to authenticated;

-- El cobro manual del mismo ID sí conserva la regla vigente: aplica abonos
-- parciales y acredita el sobrante al monedero. Esta bitácora impide volver a
-- acreditar ese mismo excedente tras desvincular y vincular de nuevo.
create table if not exists public.planes_pago_excedentes_monedero (
  recibo_detalle_id uuid primary key references public.recibos_detalles(id) on delete restrict,
  alumno_id uuid not null references public.alumnos(id) on delete restrict,
  importe numeric(12,2) not null check (importe > 0),
  actor_uid uuid not null,
  creado_en timestamptz not null default now()
);
alter table public.planes_pago_excedentes_monedero enable row level security;
revoke all on public.planes_pago_excedentes_monedero from public, anon, authenticated;
grant select on public.planes_pago_excedentes_monedero to authenticated;
drop policy if exists "finanzas: leer excedentes de recibos" on public.planes_pago_excedentes_monedero;
create policy "finanzas: leer excedentes de recibos"
  on public.planes_pago_excedentes_monedero for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    and exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true));

create or replace function public.vincular_recibo_detalle_planes_v3(
  p_detalle_id uuid, p_seleccion jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_detalle public.recibos_detalles%rowtype;
  v_alumno_id uuid;
  v_resultado jsonb;
  v_excedente numeric;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO', 'CAJERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para vincular recibos';
  end if;
  if p_detalle_id is null then raise exception 'Selecciona un detalle del recibo'; end if;
  perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
  select * into v_detalle from public.recibos_detalles where id = p_detalle_id for update;
  if not found then raise exception 'El detalle del recibo ya no existe'; end if;
  if exists (select 1 from public.planes_pago_excedentes_monedero e
      where e.recibo_detalle_id = p_detalle_id)
    or coalesce(v_detalle.observaciones, '') ~* 'excedente.*(monedero|saldo a favor)' then
    raise exception 'Este detalle ya generó un excedente de monedero; requiere revisión financiera antes de volver a vincular';
  end if;
  select alumno_id into v_alumno_id from public.recibos where id = v_detalle.recibo_id;
  v_resultado := public.vincular_recibo_detalle_planes_v2(p_detalle_id, p_seleccion);
  v_excedente := coalesce((v_resultado->>'excedente')::numeric, 0);
  if v_excedente > 0 then
    insert into public.planes_pago_excedentes_monedero
      (recibo_detalle_id, alumno_id, importe, actor_uid)
    values (p_detalle_id, v_alumno_id, v_excedente, auth.uid());
  end if;
  return v_resultado;
end;
$$;
revoke all on function public.vincular_recibo_detalle_planes_v2(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.vincular_recibo_detalle_planes_v3(uuid,jsonb) from public, anon;
grant execute on function public.vincular_recibo_detalle_planes_v3(uuid,jsonb) to authenticated;

-- Desvincular un recibo con excedente sin revertir primero el movimiento
-- duplicaría el monedero si se aplicara de nuevo. Se bloquea para revisión.
create or replace function public.desvincular_detalle_recibo_plan(p_detalle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_recibo_id uuid;
  v_observaciones text;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    or not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo is true) then
    raise exception 'No tienes permiso para desvincular recibos';
  end if;
  if p_detalle_id is null then raise exception 'Selecciona un detalle del recibo'; end if;
  perform pg_advisory_xact_lock(hashtext('conciliar_detalle:' || p_detalle_id::text));
  select recibo_id, observaciones into v_recibo_id, v_observaciones
    from public.recibos_detalles where id = p_detalle_id for update;
  if not found then raise exception 'El detalle del recibo ya no existe'; end if;
  if exists (select 1 from public.planes_pago_excedentes_monedero e
      where e.recibo_detalle_id = p_detalle_id)
    or coalesce(v_observaciones, '') ~* 'excedente.*(monedero|saldo a favor)' then
    raise exception 'Este detalle generó monedero; concilia el saldo antes de desvincularlo';
  end if;
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
commit;
