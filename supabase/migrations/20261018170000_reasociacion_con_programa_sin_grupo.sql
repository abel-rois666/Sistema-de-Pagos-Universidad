-- Preparada, no aplicada. Instalar después de 20261018160000.
-- Un grupo puede faltar aun cuando el programa vigente prueba la periodicidad.
-- No modifica planes ni recibos al instalarse.
begin;

do $preflight$
begin
  if to_regprocedure('public.revisar_reasociacion_con_recibos(uuid,uuid,boolean)') is null
    or to_regclass('public.planes_pago_reasociaciones') is null then
    raise exception 'Instala primero la migración de conciliación de planes y recibos';
  end if;
end;
$preflight$;

create or replace function public.revisar_reasociacion_con_recibos(
  p_plan_id uuid, p_ciclo_destino_id uuid, p_aplicar boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.planes_pago%rowtype;
  v_origen public.ciclos_escolares%rowtype;
  v_destino public.ciclos_escolares%rowtype;
  v_tipo text;
  v_programa_id uuid;
  v_programas integer;
  v_programa_tipo text;
  v_grupo_plan_id uuid;
  v_grupos integer;
  v_recibos uuid[] := '{}';
  v_folios integer[] := '{}';
  v_detalles_pendientes integer := 0;
  v_estados_cobrados integer := 0;
  v_indice integer;
  v_motivo text;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR FINANCIERO')
    or not exists (select 1 from public.usuarios u
      where u.auth_id = auth.uid() and u.activo is true) then
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
    select count(*), (array_agg(ap.plan_id))[1], min(lower(btrim(pe.tipo_periodo)))
      into v_programas, v_programa_id, v_programa_tipo
      from public.alumno_programas ap
      join public.planes_estudio pe on pe.id = ap.plan_id
      where ap.alumno_id = v_plan.alumno_id and ap.es_vigente is true;
    if v_programas <> 1 or v_programa_tipo is distinct from v_tipo then
      v_motivo := 'No existe un único programa vigente de la periodicidad destino; revisa la ficha académica.';
    end if;
  end if;

  if v_motivo is null then
    select count(distinct g.plan_id), (array_agg(g.plan_id))[1]
      into v_grupos, v_grupo_plan_id
      from public.alumnos_grupos ag
      join public.grupos g on g.id = ag.grupo_id
      where ag.alumno_id = v_plan.alumno_id and g.ciclo_id = v_destino.id;
    if v_grupos > 1 or (v_grupos = 1 and v_grupo_plan_id is distinct from v_programa_id) then
      v_motivo := 'El grupo del destino contradice el programa vigente; revisa la ficha académica.';
    elsif exists (select 1 from public.alumnos_grupos ag
      join public.grupos g on g.id = ag.grupo_id
      where ag.alumno_id = v_plan.alumno_id and g.ciclo_id = v_origen.id) then
      v_motivo := 'El alumno tiene un grupo en el ciclo de origen; requiere revisión individual.';
    elsif exists (select 1 from public.planes_pago pp
      where pp.alumno_id = v_plan.alumno_id and pp.id <> v_plan.id
        and pp.ciclo_id in (v_origen.id, v_destino.id)) then
      v_motivo := 'El alumno tiene otro plan en los ciclos involucrados.';
    end if;
  end if;

  if v_motivo is null then
    if p_aplicar then
      perform 1 from public.recibos where alumno_id = v_plan.alumno_id
        and ciclo_id in (v_origen.id, v_destino.id) for update;
    end if;
    select coalesce(array_agg(r.id order by r.folio), '{}'),
      coalesce(array_agg(r.folio order by r.folio), '{}')
      into v_recibos, v_folios
      from public.recibos r
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
      'plan_id', v_plan.id, 'recibos_en_origen', cardinality(v_recibos),
      'folios', to_jsonb(v_folios), 'programas_vigentes', v_programas,
      'grupos_destino', v_grupos);
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
    'criterio_asociacion', case when v_grupos = 0 then 'PROGRAMA_VIGENTE'
      else 'PROGRAMA_Y_GRUPO' end,
    'grupos_destino', v_grupos,
    'recibos_en_origen', cardinality(v_recibos), 'folios', to_jsonb(v_folios),
    'detalles_pendientes_conciliar', v_detalles_pendientes,
    'estados_cobrados_conservados', v_estados_cobrados);
end;
$$;

revoke all on function public.revisar_reasociacion_con_recibos(uuid,uuid,boolean) from public, anon;
grant execute on function public.revisar_reasociacion_con_recibos(uuid,uuid,boolean) to authenticated;
commit;
