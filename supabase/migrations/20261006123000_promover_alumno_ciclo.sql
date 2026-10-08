-- Promoción y egreso por alumno en una sola transacción. Esta migración crea o actualiza la función;
-- no actualiza alumnos ni planes existentes al instalarse.
-- Requiere public.get_my_rol(), alumno_programas y el disparador institucional vigentes.
-- Permite actualizar una instalación anterior de esta misma función sin tocar datos.
do $verificar_funcion$
declare
  v_cuerpo text;
begin
  select prosrc into v_cuerpo from pg_proc
    where oid = to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)');
  if v_cuerpo is not null and (
    position('promocion_alumnos_folio' in v_cuerpo) = 0 or
    position('El grado cambió desde la previsualización' in v_cuerpo) = 0
  ) then
    raise exception 'La función promover_alumno_ciclo existente tiene otra definición; revisar antes de reemplazarla';
  end if;
end;
$verificar_funcion$;

create or replace function public.promover_alumno_ciclo(
  p_alumno_id uuid,
  p_ciclo_id uuid,
  p_programa_id uuid,
  p_grado_esperado text,
  p_plan_pago_id uuid,
  p_copiar_conceptos boolean default false,
  p_crear_plan boolean default true
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  v_alumno public.alumnos%rowtype;
  v_programa public.alumno_programas%rowtype;
  v_ciclo public.ciclos_escolares%rowtype;
  v_plan_estudio public.planes_estudio%rowtype;
  v_plan_anterior public.planes_pago%rowtype;
  v_grado_texto text;
  v_grado integer;
  v_siguiente integer;
  v_digitos text;
  v_prefijo text;
  v_folio text;
  v_siguiente_folio bigint;
  v_indice integer;
  v_cantidad numeric;
  v_concepto text;
begin
  if coalesce(public.get_my_rol(), '') not in ('ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR') then
    raise exception 'No tiene permiso para promover alumnos';
  end if;
  if p_alumno_id is null or p_ciclo_id is null or p_programa_id is null or p_plan_pago_id is null then
    raise exception 'Falta el alumno, el ciclo, el programa o el identificador de operación';
  end if;

  select * into v_alumno from public.alumnos where id = p_alumno_id for update;
  if not found then raise exception 'El alumno ya no existe'; end if;
  select * into v_ciclo from public.ciclos_escolares where id = p_ciclo_id;
  if not found then raise exception 'El ciclo ya no existe'; end if;
  select * into v_programa from public.alumno_programas
    where alumno_id = p_alumno_id and es_vigente = true for update;
  if not found then raise exception 'El alumno no tiene un programa académico vigente'; end if;
  if exists (select 1 from public.alumno_programas
    where alumno_id = p_alumno_id and es_vigente = true and id <> v_programa.id) then
    raise exception 'El alumno tiene más de un programa vigente';
  end if;
  if v_programa.id <> p_programa_id then
    raise exception 'El programa vigente cambió desde la previsualización';
  end if;
  select * into v_plan_estudio from public.planes_estudio where id = v_programa.plan_id;
  if not found or v_plan_estudio.total_periodos is null or v_plan_estudio.total_periodos < 1 then
    raise exception 'El plan de estudios no define sus periodos';
  end if;

  -- La misma operación puede reintentarse si se perdió la respuesta de la red.
  if v_alumno.ciclo_ultima_asignacion_grado = p_ciclo_id then
    if v_programa.estatus = 'EGRESADO' then
      return jsonb_build_object('tipo', 'EGRESO', 'grado', v_alumno.grado_actual, 'plan_pago_id', null);
    end if;
    if exists (select 1 from public.planes_pago
      where id = p_plan_pago_id and alumno_id = p_alumno_id and ciclo_id = p_ciclo_id) then
      return jsonb_build_object('tipo', 'AVANCE', 'grado', v_alumno.grado_actual, 'plan_pago_id', p_plan_pago_id);
    end if;
    if not p_crear_plan and (
      not exists (select 1 from public.planes_pago
        where alumno_id = p_alumno_id and ciclo_id = p_ciclo_id)
      or exists (select 1 from public.planes_pago
        where id = p_plan_pago_id and alumno_id = p_alumno_id and ciclo_id = p_ciclo_id)
    ) then
      return jsonb_build_object('tipo', 'AVANCE', 'grado', v_alumno.grado_actual, 'plan_pago_id', null);
    end if;
    raise exception 'El grado ya fue asignado en este ciclo';
  end if;
  if coalesce(v_alumno.grado_actual, '') <> coalesce(p_grado_esperado, '') then
    raise exception 'El grado cambió desde la previsualización';
  end if;

  if upper(btrim(coalesce(v_alumno.estatus, ''))) <> 'ACTIVO'
    or upper(btrim(coalesce(v_programa.estatus, ''))) not in ('CURSANDO', 'ACTIVO') then
    raise exception 'El alumno y su programa vigente deben estar activos';
  end if;
  if exists (select 1 from public.planes_pago where alumno_id = p_alumno_id and ciclo_id = p_ciclo_id) then
    -- p_plan_pago_id identifica el plan que el usuario decidió conservar.
    if p_crear_plan then
      raise exception 'El alumno ya tiene un plan de pago en este ciclo';
    end if;
    if not exists (select 1 from public.planes_pago
      where id = p_plan_pago_id and alumno_id = p_alumno_id and ciclo_id = p_ciclo_id) then
      raise exception 'El plan de pago existente cambió desde la previsualización';
    end if;
  end if;
  if p_crear_plan and exists (select 1 from public.planes_pago where id = p_plan_pago_id) then
    raise exception 'El identificador del plan ya pertenece a otra operación';
  end if;

  v_grado_texto := upper(btrim(coalesce(v_alumno.grado_actual, '')));
  if v_grado_texto in ('', 'POR DEFINIR', '0') then
    v_grado := 0;
  elsif v_grado_texto ~ '^[0-9]+(ER|DO|TO|MO|VO|NO)?$' then
    v_grado := substring(v_grado_texto from '^[0-9]+')::integer;
  else
    raise exception 'El grado actual no se puede interpretar';
  end if;
  if v_grado < 0 or v_grado > v_plan_estudio.total_periodos then
    raise exception 'El grado actual no corresponde al plan de estudios vigente';
  end if;

  if v_grado = v_plan_estudio.total_periodos then
    -- El disparador institucional de alumno_programas cambia alumnos.estatus.
    update public.alumno_programas set estatus = 'EGRESADO', fecha_ultimo_cambio = now()
      where id = v_programa.id;
    update public.alumnos set ciclo_ultima_asignacion_grado = p_ciclo_id
      where id = p_alumno_id;
    return jsonb_build_object('tipo', 'EGRESO', 'grado', v_alumno.grado_actual, 'plan_pago_id', null);
  end if;

  v_siguiente := v_grado + 1;
  if not p_crear_plan then
    update public.alumnos set grado_actual = v_siguiente::text,
      ciclo_ultima_asignacion_grado = p_ciclo_id where id = p_alumno_id;
    return jsonb_build_object('tipo', 'AVANCE', 'grado', v_siguiente::text, 'plan_pago_id', null);
  end if;
  if p_copiar_conceptos then
    select * into v_plan_anterior from public.planes_pago
      where alumno_id = p_alumno_id order by created_at desc, id desc limit 1;
  end if;

  -- Serializa los folios de esta función. Otros flujos de alta conservan su comportamiento actual.
  perform pg_advisory_xact_lock(hashtext('promocion_alumnos_folio'));
  if exists (select 1 from public.planes_pago where alumno_id = p_alumno_id and ciclo_id = p_ciclo_id) then
    raise exception 'El alumno ya tiene un plan de pago en este ciclo';
  end if;
  select coalesce(max((substring(no_plan_pagos from '^[^-]+-([0-9]+)'))::bigint), 0) + 1
    into v_siguiente_folio
    from public.planes_pago where no_plan_pagos ~ '^[^-]+-[0-9]+';
  v_digitos := regexp_replace(v_ciclo.nombre, '[^0-9]', '', 'g');
  if length(v_digitos) >= 5 then v_prefijo := substring(v_digitos from 3 for 3);
  elsif length(v_digitos) = 4 then v_prefijo := substring(v_digitos from 3 for 2);
  else v_prefijo := upper(substring(regexp_replace(v_ciclo.nombre, '[^0-9A-Za-z]', '', 'g') from 1 for 3));
  end if;
  if coalesce(v_prefijo, '') = '' then v_prefijo := 'PP'; end if;
  v_folio := v_prefijo || '-' || lpad(v_siguiente_folio::text, 3, '0');

  insert into public.planes_pago (
    id, alumno_id, ciclo_id, no_plan_pagos, fecha_plan,
    beca_porcentaje, beca_tipo, tipo_plan, licenciatura,
    grado_turno_inscrito, grado, turno
  ) values (
    p_plan_pago_id, p_alumno_id, p_ciclo_id, v_folio,
    to_char((now() at time zone 'America/Mexico_City')::date, 'DD/MM/YYYY'),
    coalesce(v_plan_anterior.beca_porcentaje, '0%'), coalesce(v_plan_anterior.beca_tipo, 'NINGUNA'),
    coalesce(v_plan_anterior.tipo_plan, v_ciclo.tipo_periodo, 'Cuatrimestral'), v_alumno.licenciatura,
    v_siguiente::text || ' / ' || coalesce(v_alumno.turno, ''), v_siguiente::text, v_alumno.turno
  );

  if p_copiar_conceptos and v_plan_anterior.id is not null then
    if exists (select 1 from public.planes_pago_detalles where plan_id = v_plan_anterior.id) then
      insert into public.planes_pago_detalles (plan_id, indice_concepto, concepto, cantidad, fecha_vencimiento, estatus)
      select p_plan_pago_id, indice_concepto, concepto, cantidad, null, 'PENDIENTE'
      from public.planes_pago_detalles where plan_id = v_plan_anterior.id;
    else
      for v_indice in 1..18 loop
        v_concepto := to_jsonb(v_plan_anterior)->>('concepto_' || v_indice);
        v_cantidad := (to_jsonb(v_plan_anterior)->>('cantidad_' || v_indice))::numeric;
        if nullif(btrim(coalesce(v_concepto, '')), '') is not null or v_cantidad is not null then
          execute format('update public.planes_pago set %I = $1, %I = $2, %I = $3 where id = $4',
            'concepto_' || v_indice, 'cantidad_' || v_indice, 'estatus_' || v_indice)
            using v_concepto, v_cantidad, 'PENDIENTE', p_plan_pago_id;
        end if;
      end loop;
    end if;
  end if;

  update public.alumnos set grado_actual = v_siguiente::text,
    ciclo_ultima_asignacion_grado = p_ciclo_id where id = p_alumno_id;
  return jsonb_build_object('tipo', 'AVANCE', 'grado', v_siguiente::text, 'plan_pago_id', p_plan_pago_id);
end;
$$;

revoke all on function public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean) from public;
grant execute on function public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean) to authenticated;
