-- Alta de grupo en una sola llamada RPC. No modifica registros existentes.
-- Ejecutar únicamente después de revisar el preflight y el esquema real.
create function public.crear_grupo_completo(
  p_grupo_id uuid,
  p_codigo text,
  p_ciclo_id uuid,
  p_plan_id uuid,
  p_grado integer,
  p_turno text,
  p_estatus text,
  p_asignatura_ids uuid[],
  p_alumno_ids uuid[]
) returns uuid
language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  v_grupo public.grupos%rowtype;
  v_codigo text := btrim(p_codigo);
begin
  if coalesce(public.get_my_rol(), '') not in ('ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR', 'COORDINADOR ACADEMICO') then
    raise exception 'No tiene permiso para crear grupos';
  end if;
  if p_grupo_id is null or p_ciclo_id is null or p_plan_id is null or v_codigo is null or v_codigo = ''
    or p_grado is null or p_grado < 1 or p_turno is null or p_turno not in ('Matutino', 'Vespertino', 'Mixto')
    or p_estatus is null or p_estatus not in ('activo', 'inactivo') or p_asignatura_ids is null
    or cardinality(p_asignatura_ids) = 0 or p_alumno_ids is null then
    raise exception 'Los datos del grupo están incompletos o son inválidos';
  end if;

  -- Serializa altas con el mismo código y hace seguro reintentar un ID tras un corte de red.
  perform pg_advisory_xact_lock(hashtext('crear_grupo:' || p_ciclo_id::text || ':' || lower(v_codigo)));
  select * into v_grupo from public.grupos where id = p_grupo_id;
  if found then
    if v_grupo.ciclo_id = p_ciclo_id and v_grupo.plan_id = p_plan_id
      and btrim(v_grupo.codigo_grupo) = v_codigo and v_grupo.grado = p_grado
      and v_grupo.turno = p_turno and v_grupo.estatus = p_estatus then
      return p_grupo_id;
    end if;
    raise exception 'El identificador del borrador ya pertenece a otro grupo';
  end if;

  if not exists (select 1 from public.ciclos_escolares where id = p_ciclo_id)
    or not exists (select 1 from public.planes_estudio where id = p_plan_id) then
    raise exception 'El ciclo o el plan de estudios ya no existe';
  end if;
  if exists (select 1 from public.grupos where ciclo_id = p_ciclo_id and lower(btrim(codigo_grupo)) = lower(v_codigo)) then
    raise exception 'Ya existe un grupo con ese código en este ciclo';
  end if;
  if (select count(distinct materia.id) from unnest(p_asignatura_ids) as materia(id)) <> cardinality(p_asignatura_ids)
    or (select count(*) from public.asignaturas where id = any(p_asignatura_ids)
      and plan_id = p_plan_id and coalesce(activo, true)) <> cardinality(p_asignatura_ids) then
    raise exception 'Hay materias duplicadas, inactivas o ajenas al plan';
  end if;
  if not exists (select 1 from public.asignaturas where plan_id = p_plan_id
    and numero_periodo = p_grado and coalesce(activo, true)) then
    raise exception 'El grado no existe entre las materias activas del plan';
  end if;
  if (select count(distinct alumno.id) from unnest(p_alumno_ids) as alumno(id)) <> cardinality(p_alumno_ids)
    or (select count(*) from public.alumnos where id = any(p_alumno_ids)
      and upper(coalesce(estatus, '')) = 'ACTIVO') <> cardinality(p_alumno_ids) then
    raise exception 'Hay alumnos duplicados, inexistentes o que ya no están activos';
  end if;

  insert into public.grupos (id, codigo_grupo, ciclo_id, plan_id, grado, turno, estatus)
  values (p_grupo_id, v_codigo, p_ciclo_id, p_plan_id, p_grado, p_turno, p_estatus);

  insert into public.docentes_grupos_asignaturas (grupo_id, asignatura_id, docente_id)
  select p_grupo_id, materia.id, null::uuid from unnest(p_asignatura_ids) as materia(id);

  insert into public.alumnos_grupos (grupo_id, alumno_id, asignatura_id)
  select p_grupo_id, alumno.id, materia.id
  from unnest(p_alumno_ids) as alumno(id)
  cross join unnest(p_asignatura_ids) as materia(id);

  return p_grupo_id;
end;
$$;

revoke all on function public.crear_grupo_completo(uuid,text,uuid,uuid,integer,text,text,uuid[],uuid[]) from public;
grant execute on function public.crear_grupo_completo(uuid,text,uuid,uuid,integer,text,text,uuid[],uuid[]) to authenticated;
