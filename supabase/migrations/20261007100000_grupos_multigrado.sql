-- Preparar y revisar en el proyecto antes de aplicar. No modifica grupos existentes.
begin;

alter table public.grupos
  add column if not exists es_multigrado boolean not null default false,
  add column if not exists grado_inicio integer,
  add column if not exists grado_fin integer;

alter table public.grupos
  add constraint grupos_rango_multigrado_valido check (
    (es_multigrado = false and grado_inicio is null and grado_fin is null)
    or (es_multigrado = true and grado_inicio >= 1 and grado_fin >= grado_inicio)
  );

-- Impide que altas posteriores por la gestión de alumnos salten la regla del plan y rango.
create function public.validar_alumno_grupo_multigrado() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  v_grupo public.grupos%rowtype;
begin
  select * into v_grupo from public.grupos where id = new.grupo_id;
  if found and v_grupo.es_multigrado and not exists (
    select 1 from public.alumnos a
    join public.alumno_programas ap on ap.alumno_id = a.id
      and ap.plan_id = v_grupo.plan_id and ap.es_vigente
      and upper(coalesce(ap.estatus, '')) in ('CURSANDO', 'ACTIVO')
    where a.id = new.alumno_id and upper(coalesce(a.estatus, '')) = 'ACTIVO'
      and upper(btrim(coalesce(a.turno, ''))) = upper(v_grupo.turno)
      and substring(btrim(a.grado_actual) from '^[0-9]+')::integer
        between v_grupo.grado_inicio and v_grupo.grado_fin
  ) then
    raise exception 'El alumno no pertenece al plan, turno o rango del grupo multigrado';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_alumno_grupo_multigrado() from public;

create trigger trg_validar_alumno_grupo_multigrado
before insert or update of alumno_id, grupo_id on public.alumnos_grupos
for each row execute function public.validar_alumno_grupo_multigrado();

create function public.crear_grupo_multigrado_completo(
  p_grupo_id uuid,
  p_codigo text,
  p_ciclo_id uuid,
  p_plan_id uuid,
  p_grado integer,
  p_turno text,
  p_estatus text,
  p_asignatura_ids uuid[],
  p_alumno_ids uuid[],
  p_grado_inicio integer,
  p_grado_fin integer
) returns uuid
language plpgsql security invoker set search_path = pg_catalog, public, pg_temp as $$
declare
  v_grupo public.grupos%rowtype;
  v_codigo text := btrim(p_codigo);
  v_total_periodos integer;
begin
  if coalesce(public.get_my_rol(), '') not in ('ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR', 'COORDINADOR ACADEMICO') then
    raise exception 'No tiene permiso para crear grupos';
  end if;
  if p_grupo_id is null or p_ciclo_id is null or p_plan_id is null or v_codigo is null or v_codigo = ''
    or p_grado is null or p_grado < 1 or p_grado_inicio is null or p_grado_inicio < 1
    or p_grado_fin is null or p_grado_fin < p_grado_inicio
    or p_turno is null or p_turno not in ('Matutino', 'Vespertino', 'Mixto')
    or p_estatus is null or p_estatus not in ('activo', 'inactivo')
    or p_asignatura_ids is null or cardinality(p_asignatura_ids) = 0 or p_alumno_ids is null then
    raise exception 'Los datos del grupo multigrado están incompletos o son inválidos';
  end if;

  perform pg_advisory_xact_lock(hashtext('crear_grupo:' || p_ciclo_id::text || ':' || lower(v_codigo)));
  select * into v_grupo from public.grupos where id = p_grupo_id;
  if found then
    if v_grupo.ciclo_id = p_ciclo_id and v_grupo.plan_id = p_plan_id
      and btrim(v_grupo.codigo_grupo) = v_codigo and v_grupo.grado = p_grado
      and v_grupo.turno = p_turno and v_grupo.estatus = p_estatus
      and v_grupo.es_multigrado and v_grupo.grado_inicio = p_grado_inicio and v_grupo.grado_fin = p_grado_fin then
      return p_grupo_id;
    end if;
    raise exception 'El identificador del borrador ya pertenece a otro grupo';
  end if;

  if not exists (select 1 from public.ciclos_escolares where id = p_ciclo_id) then
    raise exception 'El ciclo escolar ya no existe';
  end if;
  select total_periodos into v_total_periodos from public.planes_estudio
    where id = p_plan_id and upper(coalesce(modelo, '')) = 'FLEXIBLE';
  if not found then raise exception 'El plan no existe o no es flexible'; end if;
  if v_total_periodos is not null and p_grado_fin > v_total_periodos then
    raise exception 'El rango supera los periodos del plan';
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
    raise exception 'El bloque no existe entre las materias activas del plan';
  end if;
  if (select count(distinct alumno.id) from unnest(p_alumno_ids) as alumno(id)) <> cardinality(p_alumno_ids)
    or (select count(*) from public.alumnos a
      join public.alumno_programas ap on ap.alumno_id = a.id and ap.plan_id = p_plan_id
        and ap.es_vigente and upper(coalesce(ap.estatus, '')) in ('CURSANDO', 'ACTIVO')
      where a.id = any(p_alumno_ids) and upper(coalesce(a.estatus, '')) = 'ACTIVO'
        and upper(btrim(coalesce(a.turno, ''))) = upper(p_turno)
        and substring(btrim(a.grado_actual) from '^[0-9]+')::integer between p_grado_inicio and p_grado_fin
    ) <> cardinality(p_alumno_ids) then
    raise exception 'Hay alumnos duplicados, inactivos o ajenos al plan, turno o rango';
  end if;

  insert into public.grupos (id, codigo_grupo, ciclo_id, plan_id, grado, turno, estatus, es_multigrado, grado_inicio, grado_fin)
  values (p_grupo_id, v_codigo, p_ciclo_id, p_plan_id, p_grado, p_turno, p_estatus, true, p_grado_inicio, p_grado_fin);

  insert into public.docentes_grupos_asignaturas (grupo_id, asignatura_id, docente_id)
  select p_grupo_id, materia.id, null::uuid from unnest(p_asignatura_ids) as materia(id);

  insert into public.alumnos_grupos (grupo_id, alumno_id, asignatura_id)
  select p_grupo_id, alumno.id, materia.id
  from unnest(p_alumno_ids) as alumno(id)
  cross join unnest(p_asignatura_ids) as materia(id);

  return p_grupo_id;
end;
$$;

revoke all on function public.crear_grupo_multigrado_completo(uuid,text,uuid,uuid,integer,text,text,uuid[],uuid[],integer,integer) from public;
grant execute on function public.crear_grupo_multigrado_completo(uuid,text,uuid,uuid,integer,text,text,uuid[],uuid[],integer,integer) to authenticated;

commit;
