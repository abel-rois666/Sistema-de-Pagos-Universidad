-- Preparación autorizada; requiere 20261105120000. No ejecuta correcciones históricas.
begin;
do $preflight$
begin
  if to_regclass('public.inscripciones_academicas') is null or to_regclass('public.operaciones_academicas_auditoria') is null then
    raise exception 'Falta el kardex o la base de operaciones atómicas. Verifica proyecto y migraciones antes de instalar.';
  end if;
end $preflight$;
create or replace function public.guardar_calificaciones_lote_v1(p_filas jsonb, p_originales jsonb, p_limpiar uuid[] default '{}')
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_rol text := coalesce(public.get_my_rol(),''); v_docente uuid; v_json jsonb; v_original jsonb;
  v_actual public.inscripciones_academicas%rowtype; v_nueva public.inscripciones_academicas%rowtype;
  v_alumno uuid; v_campo text; v_nota numeric; v_total integer := 0; v_claves text[] := '{}';
begin
  if auth.uid() is null or not exists (select 1 from public.usuarios where auth_id=auth.uid() and activo is true) or v_rol not in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO','DOCENTE') then
    raise exception 'No tienes permiso para guardar calificaciones.' using errcode='42501';
  end if;
  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_typeof(p_originales) is distinct from 'array'
    or jsonb_array_length(p_filas)+coalesce(cardinality(p_limpiar),0)>1000 then raise exception 'Lote inválido o demasiado grande.'; end if;
  select docente_id into v_docente from public.usuarios where auth_id=auth.uid();
  -- Serializa incluso altas aún sin ID; evita duplicados por capturas concurrentes.
  for v_alumno in select distinct alumno_id from (
    select (value->>'alumno_id')::uuid alumno_id from jsonb_array_elements(p_filas)
    union select alumno_id from public.inscripciones_academicas where id=any(p_limpiar)
  ) s order by alumno_id loop
    perform pg_advisory_xact_lock(hashtextextended(v_alumno::text,5112026));
  end loop;
  if (select count(*) from public.inscripciones_academicas where id=any(p_limpiar))<>coalesce(cardinality(p_limpiar),0) then
    raise exception 'La selección cambió. Actualiza las calificaciones antes de guardar.';
  end if;
  -- Limpiar una captura conserva la inscripción y su historial: nunca DELETE del kardex.
  for v_json in select value from jsonb_array_elements(p_filas)
    union all select to_jsonb(i)||jsonb_build_object('parcial_1',null,'parcial_2',null,'parcial_3',null,
      'promedio_calculado',null,'calificacion_final',null,'modificada_manualmente',false,
      'bloqueo_p1',false,'bloqueo_p2',false,'bloqueo_p3',false,'bloqueo_final',false,
      'solicitud_p1',false,'solicitud_p2',false,'solicitud_p3',false,'solicitud_final',false,'estatus',null)
      from public.inscripciones_academicas i where id=any(p_limpiar)
  loop
    v_nueva := jsonb_populate_record(null::public.inscripciones_academicas,v_json);
    if v_nueva.alumno_id is null or v_nueva.ciclo_id is null or v_nueva.asignatura_id is null then raise exception 'Faltan alumno, ciclo o materia.'; end if;
    if (v_nueva.alumno_id::text||'/'||v_nueva.ciclo_id::text||'/'||v_nueva.asignatura_id::text)=any(v_claves) then raise exception 'El lote repite una materia del alumno y ciclo.'; end if;
    v_claves := array_append(v_claves,v_nueva.alumno_id::text||'/'||v_nueva.ciclo_id::text||'/'||v_nueva.asignatura_id::text);
    if (select count(*) from public.inscripciones_academicas where alumno_id=v_nueva.alumno_id and ciclo_id=v_nueva.ciclo_id and asignatura_id=v_nueva.asignatura_id)>1 then
      raise exception 'Existen inscripciones duplicadas; requieren revisión sin sobrescribirlas.';
    end if;
    select * into v_actual from public.inscripciones_academicas where alumno_id=v_nueva.alumno_id and ciclo_id=v_nueva.ciclo_id and asignatura_id=v_nueva.asignatura_id for update;
    select value into v_original from jsonb_array_elements(p_originales) where value->>'id'=v_actual.id::text;
    if v_actual.id is not null and (v_original is null or not (to_jsonb(v_actual) @> v_original)) then
      raise exception 'Otra captura modificó las calificaciones. Conserva tus notas y actualiza antes de guardar.' using errcode='40001';
    end if;
    if v_nueva.id is not null and v_actual.id is distinct from v_nueva.id then raise exception 'El ID no corresponde al alumno, materia y ciclo.'; end if;
    if v_actual.id is null and v_json->>'id' is not null then raise exception 'La inscripción ya no existe; actualiza la consulta.'; end if;
    if v_rol='DOCENTE' then
      if v_docente is null or not exists (
        select 1 from public.docentes_grupos_asignaturas d join public.grupos g on g.id=d.grupo_id
        join public.alumnos_grupos a on a.grupo_id=g.id
        where d.docente_id=v_docente and d.asignatura_id=v_nueva.asignatura_id and a.alumno_id=v_nueva.alumno_id and g.ciclo_id=v_nueva.ciclo_id
      ) then raise exception 'La materia y el alumno no corresponden a tu carga en este ciclo.' using errcode='42501'; end if;
      foreach v_campo in array array['parcial_1','parcial_2','parcial_3','calificacion_final'] loop
        if coalesce((to_jsonb(v_actual)->>case v_campo when 'parcial_1' then 'bloqueo_p1' when 'parcial_2' then 'bloqueo_p2' when 'parcial_3' then 'bloqueo_p3' else 'bloqueo_final' end)::boolean,false)
          and ((to_jsonb(v_actual)->v_campo) is distinct from (to_jsonb(v_nueva)->v_campo)
            or not coalesce((to_jsonb(v_nueva)->>case v_campo when 'parcial_1' then 'bloqueo_p1' when 'parcial_2' then 'bloqueo_p2' when 'parcial_3' then 'bloqueo_p3' else 'bloqueo_final' end)::boolean,false)) then
          raise exception 'La calificación está bloqueada; solicita su corrección.' using errcode='42501';
        end if;
      end loop;
    end if;
    foreach v_campo in array array['parcial_1','parcial_2','parcial_3','calificacion_final','promedio_calculado'] loop
      v_nota := (to_jsonb(v_nueva)->>v_campo)::numeric;
      if v_nota is not null and v_nota<>-555 and not (v_nota between 0 and 10) then raise exception 'La calificación debe estar entre 0 y 10 o ser NP.'; end if;
    end loop;
    if coalesce(v_nueva.modificada_manualmente,false) and nullif(trim(v_nueva.observaciones),'') is null then raise exception 'Justifica la modificación de la calificación final.'; end if;
    if v_actual.id is null then
      v_nueva.id := gen_random_uuid();
      insert into public.inscripciones_academicas(id,alumno_id,ciclo_id,asignatura_id) values(v_nueva.id,v_nueva.alumno_id,v_nueva.ciclo_id,v_nueva.asignatura_id);
    else v_nueva.id := v_actual.id; end if;
    update public.inscripciones_academicas set parcial_1=v_nueva.parcial_1, parcial_2=v_nueva.parcial_2, parcial_3=v_nueva.parcial_3,
      promedio_calculado=v_nueva.promedio_calculado, calificacion_final=v_nueva.calificacion_final,
      modificada_manualmente=coalesce(v_nueva.modificada_manualmente,false), observaciones=v_nueva.observaciones,
      bloqueo_p1=coalesce(v_nueva.bloqueo_p1,false),bloqueo_p2=coalesce(v_nueva.bloqueo_p2,false),bloqueo_p3=coalesce(v_nueva.bloqueo_p3,false),bloqueo_final=coalesce(v_nueva.bloqueo_final,false),
      solicitud_p1=coalesce(v_nueva.solicitud_p1,false),solicitud_p2=coalesce(v_nueva.solicitud_p2,false),solicitud_p3=coalesce(v_nueva.solicitud_p3,false),solicitud_final=coalesce(v_nueva.solicitud_final,false),
      estatus=v_nueva.estatus,tipo_evaluacion=coalesce(v_nueva.tipo_evaluacion,'ORDINARIO'),updated_at=now() where id=v_nueva.id returning * into v_nueva;
    insert into public.operaciones_academicas_auditoria(actor,operacion,entidad_id,antes,despues)
      values(auth.uid(),'GUARDAR_CALIFICACION',v_nueva.id,case when v_actual.id is null then null else to_jsonb(v_actual) end,to_jsonb(v_nueva));
    v_total := v_total+1;
  end loop;
  return v_total;
end $$;
revoke all on function public.guardar_calificaciones_lote_v1(jsonb,jsonb,uuid[]) from public, anon;
grant execute on function public.guardar_calificaciones_lote_v1(jsonb,jsonb,uuid[]) to authenticated;
commit;
