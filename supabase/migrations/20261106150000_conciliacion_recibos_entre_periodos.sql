-- Preparada con autorización. Instalar después de 20261106120000. No reasocia datos al instalar.
-- Nueva entrada exclusiva Administración/Finanzas: conserva las RPC anteriores y el ciclo del recibo.
begin;
do $$ begin
  if to_regprocedure('public.vinculacion_financiera_v1(uuid,jsonb,text,boolean,text)') is null
    or to_regclass('public.finanzas_operaciones_auditoria') is null
    or to_regclass('public.planes_pago_excedentes_monedero') is null then
    raise exception 'Instala y verifica primero 20261106120000 y sus dependencias.';
  end if;
end $$;

-- Las dos representaciones del mismo pago no se suman. El límite más conservador
-- evita que un vínculo histórico con texto PENDIENTE habilite otra aplicación completa.
create or replace function public.saldo_aplicable_concepto_v1(p_plan_id uuid,p_indice integer,p_cantidad numeric,p_estatus text)
returns numeric language sql stable set search_path=pg_catalog,public as $$
  select case when p_cantidad::text in ('NaN','Infinity','-Infinity') or public.saldo_concepto_financiero_v1(p_cantidad,p_estatus) is null or usado>p_cantidad then null
    else least(public.saldo_concepto_financiero_v1(p_cantidad,p_estatus),p_cantidad-usado) end
  from (select coalesce(sum(importe),0) usado from public.planes_pago_vinculos_recibo
    where plan_id=p_plan_id and indice_concepto=p_indice and anulado_en is null) v
$$;
revoke all on function public.saldo_aplicable_concepto_v1(uuid,integer,numeric,text) from public,anon,authenticated;

create or replace function public.conciliar_recibo_entre_periodos_v1(
  p_detalle_id uuid, p_plan_id uuid, p_indice integer, p_importe numeric,
  p_modo text, p_motivo text, p_evidencia text,
  p_confirmar boolean default false, p_revision text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_detalle public.recibos_detalles%rowtype; v_recibo public.recibos%rowtype;
  v_plan public.planes_pago%rowtype; v_concepto public.planes_pago_detalles%rowtype;
  v_origen public.ciclos_escolares%rowtype; v_destino public.ciclos_escolares%rowtype;
  v_nombre text; v_cantidad numeric; v_estado text; v_pendiente numeric;
  v_usado numeric; v_plan_usado numeric; v_excedente_previo numeric; v_disponible numeric;
  v_importe numeric; v_remanente numeric; v_excedente numeric:=0; v_antes jsonb;
  v_revision text; v_vinculos jsonb; v_excedentes jsonb; v_antecedentes jsonb;
  v_texto text; v_folios text; v_acumulado numeric; v_evidencia text:=btrim(coalesce(p_evidencia,''));
begin
  if auth.uid() is null or not exists(select 1 from public.usuarios where auth_id=auth.uid() and activo is true)
    or coalesce(public.get_my_rol(),'') not in ('ADMINISTRADOR','COORDINADOR FINANCIERO') then
    raise exception 'La conciliación entre periodos requiere Administración o Coordinación Financiera.' using errcode='42501';
  end if;
  if p_modo is null or p_modo not in ('historico','aplicar') or p_indice is null or p_indice not between 1 and 18 then
    raise exception 'Selecciona una operación y un concepto válido.';
  end if;
  if p_motivo is null or p_motivo not in ('PAGO_ANTICIPADO','CORRECCION_ASOCIACION','REGULARIZACION_HISTORICA','OTRO')
    or length(v_evidencia) not between 5 and 2000 then
    raise exception 'Selecciona el motivo y documenta el respaldo de la conciliación (5 a 2,000 caracteres).';
  end if;
  -- Misma exclusión que las funciones previas; nunca se adquiere el bloqueo de plan antes del de detalle.
  if p_confirmar then
    perform pg_advisory_xact_lock(hashtext('conciliar_detalle:'||p_detalle_id::text));
    select * into v_detalle from public.recibos_detalles where id=p_detalle_id for update;
    select * into v_recibo from public.recibos where id=v_detalle.recibo_id for update;
    select * into v_plan from public.planes_pago where id=p_plan_id for update;
    perform id from public.planes_pago_detalles where plan_id=p_plan_id order by id for update;
  else
    select * into v_detalle from public.recibos_detalles where id=p_detalle_id;
    select * into v_recibo from public.recibos where id=v_detalle.recibo_id;
    select * into v_plan from public.planes_pago where id=p_plan_id;
  end if;
  if v_detalle.id is null or v_recibo.id is null or v_plan.id is null then raise exception 'El recibo, su detalle o el plan ya no existe.'; end if;
  if v_recibo.estatus is distinct from 'ACTIVO' or v_recibo.alumno_id is null or v_recibo.alumno_id is distinct from v_plan.alumno_id then
    raise exception 'El recibo debe estar activo y pertenecer al mismo alumno del plan.';
  end if;
  if v_detalle.subtotal is null or v_detalle.subtotal::text in ('NaN','Infinity','-Infinity') or v_detalle.subtotal<=0 or v_detalle.subtotal<>round(v_detalle.subtotal,2) then
    raise exception 'El detalle debe tener importe positivo con hasta dos decimales.';
  end if;
  select * into v_origen from public.ciclos_escolares where id=v_recibo.ciclo_id;
  select * into v_destino from public.ciclos_escolares where id=v_plan.ciclo_id;
  if nullif(btrim(v_origen.nombre),'') is null or nullif(btrim(v_destino.nombre),'') is null then raise exception 'Falta identificar el ciclo del recibo o del plan.'; end if;
  if btrim(v_origen.nombre)=btrim(v_destino.nombre) then raise exception 'Estos ciclos comparten periodo; utiliza la vinculación habitual.'; end if;
  if lower(btrim(v_destino.tipo_periodo)) is distinct from lower(btrim(v_plan.tipo_plan)) then
    raise exception 'Corrige primero el tipo y la asociación del plan con su ciclo de destino.';
  end if;
  if exists(select 1 from public.planes_pago_detalles where plan_id=p_plan_id) then
    if (select count(*) from public.planes_pago_detalles where plan_id=p_plan_id and indice_concepto=p_indice)<>1 then
      raise exception 'El concepto del plan no existe o está duplicado.';
    end if;
    select * into v_concepto from public.planes_pago_detalles where plan_id=p_plan_id and indice_concepto=p_indice;
    v_nombre:=v_concepto.concepto; v_cantidad:=v_concepto.cantidad; v_estado:=v_concepto.estatus;
  else
    v_nombre:=to_jsonb(v_plan)->>('concepto_'||p_indice);
    v_cantidad:=(to_jsonb(v_plan)->>('cantidad_'||p_indice))::numeric;
    v_estado:=to_jsonb(v_plan)->>('estatus_'||p_indice);
  end if;
  if nullif(btrim(v_nombre),'') is null or v_cantidad is null or v_cantidad::text in ('NaN','Infinity','-Infinity') or v_cantidad<=0 or v_cantidad<>round(v_cantidad,2) then
    raise exception 'El concepto no tiene un importe válido.';
  end if;
  select coalesce(sum(importe),0) into v_usado from public.planes_pago_vinculos_recibo where recibo_detalle_id=p_detalle_id and anulado_en is null;
  select coalesce(sum(importe),0) into v_plan_usado from public.planes_pago_vinculos_recibo where plan_id=p_plan_id and indice_concepto=p_indice and anulado_en is null;
  select coalesce(sum(importe),0) into v_excedente_previo from public.planes_pago_excedentes_monedero where recibo_detalle_id=p_detalle_id;
  v_disponible:=v_detalle.subtotal-v_usado-v_excedente_previo;
  if v_disponible<0 then raise exception 'Los antecedentes superan el importe del recibo; requiere revisión financiera.'; end if;
  if exists(select 1 from public.planes_pago_vinculos_recibo where recibo_detalle_id=p_detalle_id and plan_id=p_plan_id and indice_concepto=p_indice and anulado_en is null) then
    raise exception 'Este vínculo ya está registrado. Actualiza la consulta; no se aplicó nuevamente.';
  end if;
  -- Antecedentes de toda la vida del detalle, incluso vínculos anulados: no se vuelve a crear dinero.
  select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') into v_antecedentes
    from public.finanzas_operaciones_auditoria a where entidad_id=p_detalle_id;
  if p_modo='aplicar' then
    if v_detalle.indice_concepto_plan is not null
      or exists(select 1 from public.planes_pago_vinculos_recibo where recibo_detalle_id=p_detalle_id)
      or v_excedente_previo>0 or jsonb_array_length(v_antecedentes)>0
      or coalesce(v_detalle.observaciones,'') ~* '(excedente|monedero|saldo a favor|vinculad|abono)' then
      raise exception 'Hay antecedentes de aplicación o monedero. Registra solo el vínculo histórico o usa el saldo desde el cobro con monedero; no se acreditará otra vez.';
    end if;
    v_pendiente:=public.saldo_concepto_financiero_v1(v_cantidad,v_estado);
    if v_pendiente is null then raise exception 'El saldo del concepto es ambiguo; requiere revisión financiera.'; end if;
    -- No sumar dos veces un abono reflejado tanto en el texto como en los vínculos.
    v_pendiente:=least(v_pendiente,v_cantidad-v_plan_usado);
    if v_pendiente<=0 then raise exception 'El concepto no tiene saldo pendiente disponible.'; end if;
    v_importe:=least(v_disponible,v_pendiente);
    v_excedente:=v_disponible-v_importe;
  else
    if v_excedente_previo=0 and coalesce(v_detalle.observaciones,'') ~* '(excedente.*(monedero|saldo a favor)|abonad.*monedero)' then
      raise exception 'Hay referencia a monedero sin importe verificable. Revisa ese antecedente antes de atribuir el pago histórico.';
    end if;
    if v_detalle.indice_concepto_plan is not null and v_detalle.indice_concepto_plan<>p_indice then
      raise exception 'La referencia histórica apunta a otro concepto; revisa y concilia ese antecedente antes de continuar.';
    end if;
    v_importe:=p_importe;
    if v_importe is null or v_importe<=0 or v_importe<>round(v_importe,2) then raise exception 'Indica un importe histórico positivo con hasta dos decimales.'; end if;
    if v_importe>v_disponible then raise exception 'El importe supera el disponible después de vínculos y excedentes registrados.'; end if;
    if v_importe+v_plan_usado>v_cantidad then raise exception 'La suma de vínculos supera el importe del concepto del plan.'; end if;
    -- Reconocer un pago histórico no recobra ni reescribe su observación; admite un concepto ya liquidado.
    v_pendiente:=v_cantidad-v_plan_usado;
  end if;
  if v_importe<=0 then raise exception 'No queda importe disponible para vincular.'; end if;
  v_remanente:=v_disponible-v_importe;
  select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]') into v_vinculos from public.planes_pago_vinculos_recibo v
    where v.recibo_detalle_id=p_detalle_id or (v.plan_id=p_plan_id and v.indice_concepto=p_indice);
  select coalesce(jsonb_agg(to_jsonb(e) order by e.recibo_detalle_id),'[]') into v_excedentes from public.planes_pago_excedentes_monedero e where recibo_detalle_id=p_detalle_id;
  v_antes:=jsonb_build_object('detalle',to_jsonb(v_detalle),'recibo',to_jsonb(v_recibo),'plan',to_jsonb(v_plan),
    'concepto',to_jsonb(v_concepto),'origen',to_jsonb(v_origen),'destino',to_jsonb(v_destino),
    'vinculos',v_vinculos,'excedentes',v_excedentes,'antecedentes',v_antecedentes,
    'modo',p_modo,'motivo',p_motivo,'evidencia',v_evidencia,'importe',v_importe);
  v_revision:=md5(v_antes::text);
  if p_confirmar then
    if p_revision is distinct from v_revision then raise exception 'Los datos o el respaldo cambiaron desde la revisión. Revisa nuevamente antes de confirmar.' using errcode='40001'; end if;
    insert into public.planes_pago_vinculos_recibo(recibo_detalle_id,plan_id,indice_concepto,importe,origen,actor_uid)
      values(p_detalle_id,p_plan_id,p_indice,v_importe,'CONCILIACION',auth.uid());
    if p_modo='aplicar' then
      v_acumulado:=v_cantidad-v_pendiente+v_importe;
      select string_agg(m[1],'; ') into v_folios from regexp_matches(coalesce(v_estado,''),'(R-[0-9]+|F-[A-Za-z0-9-]+)','g') m;
      v_texto:=concat_ws('; ',nullif(v_folios,''),'R-'||v_recibo.folio||case when v_pendiente-v_importe<=0 then
        ' (Pagado $'||to_char(v_acumulado,'FM999999990.00')||')' else
        ' (Abono $'||to_char(v_acumulado,'FM999999990.00')||', Resta $'||to_char(v_pendiente-v_importe,'FM999999990.00')||')' end);
      -- El trigger vigente sincroniza detalles; no se lo desactiva.
      execute format('update public.planes_pago set %I=$1 where id=$2','estatus_'||p_indice) using v_texto,p_plan_id;
      update public.planes_pago_detalles set estatus=v_texto where plan_id=p_plan_id and indice_concepto=p_indice and estatus is distinct from v_texto;
      update public.recibos_detalles set indice_concepto_plan=p_indice,
        observaciones=concat_ws(E'\n',nullif(observaciones,''),case when v_excedente>0 then 'Aplicación entre periodos; excedente enviado a monedero' else 'Vinculado al plan de otro periodo' end) where id=p_detalle_id;
      if v_excedente>0 then
        insert into public.planes_pago_excedentes_monedero(recibo_detalle_id,alumno_id,importe,actor_uid)
          values(p_detalle_id,v_recibo.alumno_id,v_excedente,auth.uid());
        update public.alumnos set saldo_a_favor=coalesce(saldo_a_favor,0)+v_excedente where id=v_recibo.alumno_id;
        if not found then raise exception 'No se encontró al alumno para registrar el excedente.'; end if;
      end if;
    end if;
    insert into public.finanzas_operaciones_auditoria(actor,operacion,entidad_id,antes,despues)
      values(auth.uid(),case when p_modo='historico' then 'VINCULO_HISTORICO_ENTRE_PERIODOS' else 'APLICAR_ANTICIPO_ENTRE_PERIODOS' end,p_detalle_id,v_antes,
        jsonb_build_object('plan_id',p_plan_id,'indice',p_indice,'importe',v_importe,'modo',p_modo,'motivo',p_motivo,'evidencia',v_evidencia,
          'ciclo_recibo_conservado',v_origen.id,'ciclo_plan',v_destino.id,'remanente_historico',case when p_modo='historico' then v_remanente else 0 end,
          'excedente_nuevo',v_excedente,'revision',v_revision));
  end if;
  return jsonb_build_object('aplicable',true,'aplicado',coalesce(p_confirmar,false),'revision',v_revision,
    'destinos',jsonb_build_array(jsonb_build_object('plan_id',p_plan_id,'indice',p_indice,'importe',v_importe)),
    'aplicado_total',v_importe,'remanente',v_remanente,'disponible_origen',v_disponible,'aplicado_previamente',v_usado,
    'excedente_previo',v_excedente_previo,'pendiente_destino',v_pendiente,'motivo_conciliacion',p_motivo,'evidencia',v_evidencia,
    'monedero_modificado',p_modo='aplicar' and v_excedente>0);
end $$;
revoke all on function public.conciliar_recibo_entre_periodos_v1(uuid,uuid,integer,numeric,text,text,text,boolean,text) from public,anon;
grant execute on function public.conciliar_recibo_entre_periodos_v1(uuid,uuid,integer,numeric,text,text,text,boolean,text) to authenticated;
-- Mismas firmas y reglas previas; se limita el saldo por vínculos estructurados.
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
    or exists(select 1 from public.finanzas_operaciones_auditoria where entidad_id=p_detalle_id)
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
      v_pendiente:=public.saldo_aplicable_concepto_v1(v_plan_id,v_idx,v_cantidad,v_estado);
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
  if exists(select 1 from public.finanzas_operaciones_auditoria where entidad_id=p_detalle_id) then
    raise exception 'Este detalle ya tiene una aplicación o conciliación auditada. Revisa el historial antes de volver a aplicar dinero.';
  end if;
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
    v_restante := public.saldo_aplicable_concepto_v1(v_plan_id,v_indice,v_cantidad,v_previo);
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

revoke all on function public.vincular_recibo_detalle_planes_v2(uuid,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
