-- Preparación autorizada. No ejecuta correcciones ni movimientos históricos.
-- Requiere conciliación 20261018160000 y 20261018180000; instalar antes del cliente nuevo.
begin;
do $$ begin
  if to_regprocedure('public.vincular_recibo_detalle_planes_v3(uuid,jsonb)') is null
    or to_regprocedure('public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean)') is null
    or to_regclass('public.planes_pago_excedentes_monedero') is null then
    raise exception 'Faltan las funciones y bitácora de conciliación. Detén la instalación y verifica las migraciones previas.';
  end if;
end $$;

create table if not exists public.finanzas_operaciones_auditoria (
  id uuid primary key default gen_random_uuid(), creado_en timestamptz not null default now(),
  actor uuid not null, operacion text not null, entidad_id uuid not null, antes jsonb, despues jsonb
);
alter table public.finanzas_operaciones_auditoria enable row level security;
revoke all on public.finanzas_operaciones_auditoria from public, anon, authenticated;
grant select on public.finanzas_operaciones_auditoria to authenticated;
drop policy if exists finanzas_revision_operaciones on public.finanzas_operaciones_auditoria;
create policy finanzas_revision_operaciones on public.finanzas_operaciones_auditoria for select to authenticated
using (exists(select 1 from public.usuarios where auth_id=auth.uid() and activo is true)
  and (actor=auth.uid() or public.get_my_rol() in ('ADMINISTRADOR','COORDINADOR FINANCIERO')));

-- NULL significa revisión: nunca convierte un texto indeterminado en pago o deuda inventados.
create or replace function public.saldo_concepto_financiero_v1(p_cantidad numeric,p_estatus text)
returns numeric language plpgsql immutable set search_path=pg_catalog,public as $$
declare v_texto text:=regexp_replace(upper(btrim(coalesce(p_estatus,''))),'\s+',' ','g'); v_resta numeric; v_match text[];
begin
  if p_cantidad is null or p_cantidad<0 then return null; end if;
  v_match:=regexp_match(v_texto,'RESTA\s*\$\s*([0-9,]+(\.[0-9]{1,2})?)');
  if v_match is not null then
    v_resta:=replace(v_match[1],',','')::numeric;
    return case when v_resta<=p_cantidad then v_resta else null end;
  end if;
  if v_texto in ('','PENDIENTE','NO PAGADO') then return p_cantidad; end if;
  if v_texto ~ '\mPAGADO\M' and v_texto !~ '\m(NO\s+PAGADO|PENDIENTE|ABONO|CANCELADO|BAJA)\M' then return 0; end if;
  return null;
end $$;

create or replace function public.guardar_observacion_plan_v1(p_plan_id uuid,p_indice integer,p_original text,p_texto text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_plan public.planes_pago%rowtype; v_detalle public.planes_pago_detalles%rowtype;
  v_estado text; v_texto text:=coalesce(nullif(btrim(p_texto),''),'PENDIENTE'); v_tiene_detalles boolean;
begin
  if auth.uid() is null or not exists(select 1 from public.usuarios where auth_id=auth.uid() and activo is true)
    or coalesce(public.get_my_rol(),'') not in ('ADMINISTRADOR','CAJERO','COORDINADOR FINANCIERO','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO','COORDINADOR RECURSOS HUMANOS') then
    raise exception 'No tienes permiso para editar observaciones de pagos.' using errcode='42501';
  end if;
  if p_indice is null or p_indice not between 1 and 18 or length(v_texto)>2000 then raise exception 'Concepto o texto inválido.'; end if;
  select * into v_plan from public.planes_pago where id=p_plan_id for update;
  if not found then raise exception 'El plan ya no existe.'; end if;
  select exists(select 1 from public.planes_pago_detalles where plan_id=p_plan_id) into v_tiene_detalles;
  if v_tiene_detalles then
    if (select count(*) from public.planes_pago_detalles where plan_id=p_plan_id and indice_concepto=p_indice)<>1 then raise exception 'El concepto no existe o está duplicado. Actualiza el plan.'; end if;
    select * into v_detalle from public.planes_pago_detalles where plan_id=p_plan_id and indice_concepto=p_indice for update;
    v_estado:=coalesce(nullif(v_detalle.estatus,''),'PENDIENTE');
  else
    if nullif(btrim(to_jsonb(v_plan)->>('concepto_'||p_indice)),'') is null then raise exception 'El concepto no existe en el plan.'; end if;
    v_estado:=coalesce(nullif(to_jsonb(v_plan)->>('estatus_'||p_indice),''),'PENDIENTE');
  end if;
  if v_estado=v_texto then return jsonb_build_object('aplicado',true,'sin_cambios',true); end if;
  if v_estado is distinct from coalesce(p_original,'PENDIENTE') then raise exception 'Otra sesión cambió la observación. Tu texto se conserva; actualiza y revisa el valor actual.' using errcode='40001'; end if;
  if upper(v_texto) in ('PENDIENTE','NO PAGADO','CANCELADO','BAJA') and exists(select 1 from public.planes_pago_vinculos_recibo where plan_id=p_plan_id and indice_concepto=p_indice and anulado_en is null) then
    raise exception 'Hay un vínculo confirmado. No puede marcarse como pendiente ni anularse cambiando el texto.';
  end if;
  if upper(v_texto) in ('PENDIENTE','NO PAGADO','CANCELADO','BAJA') and exists(
    select 1 from public.recibos_detalles d join public.recibos r on r.id=d.recibo_id
    join public.ciclos_escolares origen on origen.id=r.ciclo_id
    join public.ciclos_escolares destino on destino.id=v_plan.ciclo_id and destino.nombre=origen.nombre
    where r.alumno_id=v_plan.alumno_id and r.estatus='ACTIVO' and d.indice_concepto_plan=p_indice
      and not exists(select 1 from public.planes_pago_vinculos_recibo v where v.recibo_detalle_id=d.id and v.anulado_en is null)
  ) then raise exception 'Hay una referencia histórica sin plan comprobado. Revisa su asociación antes de marcar pendiente.'; end if;
  -- Coordinada con el trigger existente; la segunda actualización solo escribe si aún difiere.
  if to_jsonb(v_plan) ? ('estatus_'||p_indice) then
    execute format('update public.planes_pago set %I=$1 where id=$2','estatus_'||p_indice) using v_texto,p_plan_id;
  end if;
  if v_tiene_detalles then update public.planes_pago_detalles set estatus=v_texto where id=v_detalle.id and estatus is distinct from v_texto; end if;
  insert into public.finanzas_operaciones_auditoria(actor,operacion,entidad_id,antes,despues)
    values(auth.uid(),'OBSERVACION',p_plan_id,jsonb_build_object('indice',p_indice,'estatus',v_estado),jsonb_build_object('indice',p_indice,'estatus',v_texto));
  return jsonb_build_object('aplicado',true,'estatus',v_texto,'indice',p_indice);
end $$;

create or replace function public.vinculacion_financiera_v1(p_detalle_id uuid,p_destinos jsonb,p_modo text,p_confirmar boolean default false,p_revision text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_detalle public.recibos_detalles%rowtype; v_recibo public.recibos%rowtype; v_plan public.planes_pago%rowtype;
  v_item jsonb; v_concepto public.planes_pago_detalles%rowtype; v_idx integer; v_cantidad numeric; v_estado text;
  v_saldo numeric; v_aplicar numeric; v_pendiente numeric; v_destinos jsonb:='[]'; v_validacion jsonb; v_resultado jsonb;
  v_snapshot text:=''; v_revision text; v_plan_id uuid; v_repetidos text[]:='{}';
begin
  if auth.uid() is null or not exists(select 1 from public.usuarios where auth_id=auth.uid() and activo is true)
    or coalesce(public.get_my_rol(),'') not in ('ADMINISTRADOR','COORDINADOR FINANCIERO','CAJERO') then raise exception 'No tienes permiso para vincular recibos.' using errcode='42501'; end if;
  if p_modo not in ('aplicar','historico') or p_modo is null or jsonb_typeof(p_destinos) is distinct from 'array'
    or jsonb_array_length(p_destinos) not between 1 and 18 then raise exception 'Selecciona una operación y hasta 18 conceptos válidos.'; end if;
  if p_modo='historico' and (public.get_my_rol() not in ('ADMINISTRADOR','COORDINADOR FINANCIERO') or jsonb_array_length(p_destinos)<>1) then raise exception 'La conciliación histórica requiere Administración/Finanzas y un concepto por vez.' using errcode='42501'; end if;
  if p_confirmar then perform pg_advisory_xact_lock(hashtext('conciliar_detalle:'||p_detalle_id::text)); end if;
  if p_confirmar then select * into v_detalle from public.recibos_detalles where id=p_detalle_id for update;
  else select * into v_detalle from public.recibos_detalles where id=p_detalle_id; end if;
  if p_confirmar then select * into v_recibo from public.recibos where id=v_detalle.recibo_id for update;
  else select * into v_recibo from public.recibos where id=v_detalle.recibo_id; end if;
  if v_detalle.id is null or v_recibo.id is null or v_recibo.estatus<>'ACTIVO' then raise exception 'El recibo no está activo o ya no existe.'; end if;
  if p_confirmar then
    for v_plan_id in select distinct (x->>'plan_id')::uuid from jsonb_array_elements(p_destinos) x order by 1 loop
      perform id from public.planes_pago where id=v_plan_id for update;
    end loop;
  end if;
  v_saldo:=v_detalle.subtotal;
  if v_saldo is null or v_saldo<=0 or v_saldo<>round(v_saldo,2) then raise exception 'El detalle debe tener importe positivo con hasta dos decimales.'; end if;
  if p_modo='aplicar' and (v_detalle.indice_concepto_plan is not null
    or exists(select 1 from public.planes_pago_vinculos_recibo where recibo_detalle_id=p_detalle_id and anulado_en is null)
    or exists(select 1 from public.planes_pago_excedentes_monedero where recibo_detalle_id=p_detalle_id)
    or coalesce(v_detalle.observaciones,'') ~* '(excedente|monedero|saldo a favor|vinculad|abono)') then
    raise exception 'Este detalle tiene antecedentes de aplicación. Solicita revisión o registra el vínculo histórico sin mover monedero.';
  end if;
  v_snapshot:=to_jsonb(v_detalle)::text||to_jsonb(v_recibo)::text||p_destinos::text||p_modo;
  for v_item in select value from jsonb_array_elements(p_destinos) loop
    v_idx:=(v_item->>'indice')::integer; v_plan_id:=(v_item->>'plan_id')::uuid;
    if v_idx is null or v_idx not between 1 and 18 or v_plan_id is null then raise exception 'Destino inválido.'; end if;
    if (v_plan_id::text||'/'||v_idx)=any(v_repetidos) then raise exception 'La selección repite un concepto.'; end if;
    v_repetidos:=array_append(v_repetidos,v_plan_id::text||'/'||v_idx);
    select * into v_plan from public.planes_pago where id=v_plan_id;
    if v_plan.id is null or v_plan.alumno_id is distinct from v_recibo.alumno_id then raise exception 'El plan no pertenece al alumno del recibo.'; end if;
    v_snapshot:=v_snapshot||to_jsonb(v_plan)::text||coalesce((select jsonb_agg(to_jsonb(d) order by d.id)::text from public.planes_pago_detalles d where d.plan_id=v_plan_id),'[]');
    if p_modo='historico' then
      v_aplicar:=(v_item->>'importe')::numeric;
      if v_aplicar is null or v_aplicar<>round(v_aplicar,2) then raise exception 'El importe debe tener como máximo dos decimales.'; end if;
      v_validacion:=public.conciliar_recibo_detalle_plan(p_detalle_id,v_plan_id,v_idx,v_aplicar,false);
      if not coalesce((v_validacion->>'aplicable')::boolean,false) then return v_validacion; end if;
    else
      if v_plan.ciclo_id is distinct from v_recibo.ciclo_id then raise exception 'Aplicar un abono exige el ciclo exacto del recibo. Para un homónimo usa revisión histórica; otros periodos siguen restringidos.'; end if;
      v_concepto:=null;
      if exists(select 1 from public.planes_pago_detalles where plan_id=v_plan_id) then
        if (select count(*) from public.planes_pago_detalles where plan_id=v_plan_id and indice_concepto=v_idx)<>1 then raise exception 'El concepto no existe o está duplicado.'; end if;
        select * into v_concepto from public.planes_pago_detalles where plan_id=v_plan_id and indice_concepto=v_idx;
        v_cantidad:=v_concepto.cantidad; v_estado:=v_concepto.estatus;
      else
        if nullif(btrim(to_jsonb(v_plan)->>('concepto_'||v_idx)),'') is null then raise exception 'El concepto no existe.'; end if;
        v_cantidad:=(to_jsonb(v_plan)->>('cantidad_'||v_idx))::numeric; v_estado:=to_jsonb(v_plan)->>('estatus_'||v_idx);
      end if;
      v_pendiente:=public.saldo_concepto_financiero_v1(v_cantidad,v_estado);
      if v_pendiente is null then raise exception 'El saldo del concepto requiere revisión; no se infiere de un texto desconocido.'; end if;
      if v_pendiente<=0 then raise exception 'El concepto ya está pagado o no tiene saldo pendiente.'; end if;
      v_aplicar:=least(v_saldo,v_pendiente);
    end if;
    if v_aplicar<=0 then raise exception 'El importe se agotó antes del último concepto seleccionado. Ajusta la selección.'; end if;
    v_destinos:=v_destinos||jsonb_build_array(jsonb_build_object('plan_id',v_plan_id,'indice',v_idx,'importe',v_aplicar));
    v_saldo:=v_saldo-v_aplicar;
  end loop;
  v_snapshot:=v_snapshot||coalesce((select jsonb_agg(to_jsonb(v) order by v.id)::text from public.planes_pago_vinculos_recibo v where v.anulado_en is null and (v.recibo_detalle_id=p_detalle_id or v.plan_id::text in (select value->>'plan_id' from jsonb_array_elements(p_destinos)))),'[]');
  v_revision:=md5(v_snapshot);
  if p_confirmar then
    if p_revision is distinct from v_revision then raise exception 'Los datos cambiaron desde la revisión. Revisa nuevamente importes y destino.' using errcode='40001'; end if;
    if p_modo='historico' then
      v_item:=v_destinos->0;
      v_resultado:=public.conciliar_recibo_detalle_plan(p_detalle_id,(v_item->>'plan_id')::uuid,(v_item->>'indice')::integer,(v_item->>'importe')::numeric,true);
    else
      v_resultado:=public.vincular_recibo_detalle_planes_v3(p_detalle_id,p_destinos);
      if not coalesce((v_resultado->>'aplicado')::boolean,false) or abs(coalesce((v_resultado->>'excedente')::numeric,0)-v_saldo)>0.005 then raise exception 'La aplicación no coincide con la revisión. No se guardó el movimiento.'; end if;
    end if;
    insert into public.finanzas_operaciones_auditoria(actor,operacion,entidad_id,antes,despues)
      values(auth.uid(),case when p_modo='historico' then 'VINCULO_HISTORICO' else 'APLICAR_RECIBO' end,p_detalle_id,to_jsonb(v_detalle),jsonb_build_object('destinos',v_destinos,'remanente',v_saldo,'resultado',v_resultado));
  end if;
  return jsonb_build_object('aplicable',true,'aplicado',p_confirmar,'revision',v_revision,'destinos',v_destinos,'aplicado_total',v_detalle.subtotal-v_saldo,'remanente',v_saldo);
end $$;

revoke all on function public.saldo_concepto_financiero_v1(numeric,text) from public,anon;
revoke all on function public.guardar_observacion_plan_v1(uuid,integer,text,text) from public,anon;
revoke all on function public.vinculacion_financiera_v1(uuid,jsonb,text,boolean,text) from public,anon;
grant execute on function public.saldo_concepto_financiero_v1(numeric,text) to authenticated;
grant execute on function public.guardar_observacion_plan_v1(uuid,integer,text,text) to authenticated;
grant execute on function public.vinculacion_financiera_v1(uuid,jsonb,text,boolean,text) to authenticated;

-- La definición de v2 que sigue conserva su firma y las protecciones de v3.
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
    if v_concepto is null and exists(select 1 from public.planes_pago_detalles where plan_id=v_plan_id) then raise exception 'El concepto no existe en los detalles normalizados'; end if;
    if v_concepto is null then
      v_concepto := to_jsonb(v_plan) ->> ('concepto_' || v_indice);
      v_cantidad := (to_jsonb(v_plan) ->> ('cantidad_' || v_indice))::numeric;
      v_previo := to_jsonb(v_plan) ->> ('estatus_' || v_indice);
    end if;
    if nullif(btrim(v_concepto), '') is null or v_cantidad is null or v_cantidad <= 0 then
      raise exception 'El concepto seleccionado no tiene importe válido';
    end if;
    v_restante := public.saldo_concepto_financiero_v1(v_cantidad,v_previo);
    if v_restante is null then
      raise exception 'El estado del concepto % requiere revisión antes de aplicar otro recibo',v_indice;
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

revoke all on function public.vincular_recibo_detalle_planes_v2(uuid,jsonb) from public, anon, authenticated;
commit;
