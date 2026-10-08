-- Permite omitir únicamente asignaturas complementarias de una versión publicada.
-- Conserva sus asignaciones en docentes_grupos_asignaturas sin modificarlas.
-- Reemplaza la función de publicación anterior con la misma firma y validaciones.
create or replace function public.publicar_horario_academico(
  p_ciclo_id uuid,
  p_grupos uuid[],
  p_cargas jsonb,
  p_sesiones jsonb,
  p_max_hueco_grupo integer default 1,
  p_max_hueco_docente integer default 1
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare
  v_ciclo public.ciclos_escolares%rowtype;
  v_grupo public.grupos%rowtype;
  v_asignacion public.docentes_grupos_asignaturas%rowtype;
  v_asignatura public.asignaturas%rowtype;
  v_docente public.docentes%rowtype;
  v_config public.docente_configuraciones_horario%rowtype;
  v_carga record;
  v_sesion record;
  v_horario_id uuid;
  v_carga_id uuid;
  v_docente_id uuid;
  v_max_bloque integer;
  v_version integer;
  v_ids jsonb := '{}'::jsonb;
  v_turno text;
begin
  if coalesce(public.get_my_rol(), '') not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO') then
    raise exception 'No tiene permiso para publicar horarios';
  end if;
  if p_grupos is null or cardinality(p_grupos) = 0 or p_cargas is null or p_sesiones is null
    or jsonb_typeof(p_cargas) <> 'array' or jsonb_typeof(p_sesiones) <> 'array'
    or jsonb_array_length(p_cargas) = 0 or p_max_hueco_grupo is null
    or p_max_hueco_docente is null or p_max_hueco_grupo not between 0 and 8
    or p_max_hueco_docente not between 0 and 8 then
    raise exception 'El borrador del horario no es válido';
  end if;
  -- Serializa publicaciones de ciclos diferentes que podrían compartir docentes o aulas.
  perform pg_advisory_xact_lock(hashtext('horarios_academicos_publicacion'));
  if (select count(distinct g.grupo_id) from unnest(p_grupos) as g(grupo_id)) <> cardinality(p_grupos) then
    raise exception 'Hay grupos duplicados en el borrador';
  end if;
  select * into v_ciclo from public.ciclos_escolares where id = p_ciclo_id for update;
  if not found then raise exception 'No existe el ciclo escolar'; end if;
  if v_ciclo.fecha_inicio is null or v_ciclo.fecha_termino is null then
    raise exception 'Defina las fechas exactas del ciclo antes de publicar horarios';
  end if;
  if v_ciclo.fecha_inicio > v_ciclo.fecha_termino then
    raise exception 'Las fechas del ciclo no son válidas';
  end if;
  if exists (
    select 1 from public.grupos g where g.ciclo_id = p_ciclo_id
      and lower(coalesce(g.estatus, 'activo')) = 'activo' and not g.id = any(p_grupos)
  ) then raise exception 'Seleccione todos los grupos activos del ciclo para publicar una versión completa'; end if;
  if (select count(*) from public.grupos where id = any(p_grupos) and ciclo_id = p_ciclo_id
      and lower(coalesce(estatus, 'activo')) = 'activo') <> cardinality(p_grupos) then
    raise exception 'Un grupo no pertenece al ciclo o está inactivo';
  end if;
  if exists (
    select 1 from public.grupos g where g.id = any(p_grupos)
      and not exists (select 1 from public.docentes_grupos_asignaturas a where a.grupo_id = g.id)
  ) then raise exception 'Cada grupo seleccionado necesita al menos una materia asignada'; end if;
  if exists (
    select 1 from public.docentes_grupos_asignaturas a
    join public.asignaturas s on s.id = a.asignatura_id
    where a.grupo_id = any(p_grupos)
      and case when nullif(trim(s.clasificacion_clave), '') is not null
        then trim(s.clasificacion_clave) <> '266'
        else lower(trim(coalesce(s.clasificacion_nombre, ''))) <> 'complementaria' end
      and not exists (
        select 1 from jsonb_to_recordset(p_cargas)
          as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer)
        where c.id = a.id
      )
  ) then
    raise exception 'El borrador debe incluir cada materia no complementaria de los grupos seleccionados';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_cargas) as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer)
    group by c.id having count(*) > 1
  ) then raise exception 'Hay materias duplicadas en el borrador'; end if;
  if exists (
    select 1 from public.docentes_grupos_asignaturas
    where grupo_id = any(p_grupos)
    group by grupo_id, asignatura_id having count(*) > 1
  ) then raise exception 'Hay una asignatura duplicada dentro de un grupo'; end if;

  for v_carga in select * from jsonb_to_recordset(p_cargas)
    as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer)
  loop
    select * into v_asignacion from public.docentes_grupos_asignaturas where id = v_carga.id;
    if not found or not v_asignacion.grupo_id = any(p_grupos) then
      raise exception 'La asignación de una materia no pertenece a los grupos seleccionados';
    end if;
    select * into v_grupo from public.grupos where id = v_asignacion.grupo_id;
    select * into v_asignatura from public.asignaturas where id = v_asignacion.asignatura_id;
    select * into v_docente from public.docentes where id = v_carga.docente_id;
    select * into v_config from public.docente_configuraciones_horario
      where docente_id = v_carga.docente_id and ciclo_id = p_ciclo_id;
    if v_asignatura.id is null or v_asignatura.plan_id is distinct from v_grupo.plan_id
      or v_asignatura.horas_semanales is null or v_docente.id is null
      or lower(coalesce(v_docente.estatus, '')) <> 'activo' or v_config.docente_id is null then
      raise exception 'Faltan horas, plan o configuración de un docente para %', v_grupo.codigo_grupo;
    end if;
    if not v_grupo.plan_id = any(v_config.plan_ids)
      or v_grupo.id = any(v_config.grupo_ids_restringidos) then
      raise exception 'El docente no está habilitado para %', v_grupo.codigo_grupo;
    end if;
    if v_carga.max_bloque is null or v_carga.max_bloque not between 1 and 4 then
      raise exception 'El bloque máximo de % debe estar entre 1 y 4 horas', v_asignatura.nombre;
    end if;
    if v_carga.horas_presenciales is null or v_carga.horas_asincronas is null
      or v_carga.horas_presenciales < 0 or v_carga.horas_asincronas < 0
      or v_carga.horas_presenciales + v_carga.horas_asincronas <> v_asignatura.horas_semanales then
      raise exception 'El reparto de horas de % no coincide con su plan', v_asignatura.nombre;
    end if;
    v_turno := upper(trim(v_grupo.turno));
    if v_turno is null or v_turno not in ('MATUTINO', 'VESPERTINO', 'MIXTO') then
      raise exception 'El grupo % tiene un turno no reconocido', v_grupo.codigo_grupo;
    end if;
    if v_turno <> 'MIXTO' and v_carga.horas_asincronas <> 0 then
      raise exception 'Solo los grupos Mixtos admiten trabajo asíncrono';
    end if;
  end loop;

  if exists (
    select 1 from jsonb_to_recordset(p_cargas) as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer)
    join public.docentes_grupos_asignaturas a on a.id = c.id
    group by a.grupo_id, c.docente_id having count(distinct a.asignatura_id) > 3
  ) then raise exception 'Un docente tiene más de tres materias distintas en un grupo'; end if;
  if exists (
    select 1 from public.grupos g
    join public.docentes_grupos_asignaturas a on a.grupo_id = g.id
    join jsonb_to_recordset(p_cargas) as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer) on c.id = a.id
    where g.id = any(p_grupos)
    group by g.id, g.turno
    having sum(c.horas_presenciales) > case upper(trim(g.turno))
      when 'MATUTINO' then 30 when 'VESPERTINO' then 25 when 'MIXTO' then 8 else 0 end
  ) then raise exception 'Las horas presenciales superan la capacidad del turno'; end if;

  for v_sesion in select * from jsonb_to_recordset(p_sesiones)
    as s(carga_id uuid, dia integer, inicio integer, fin integer)
  loop
    select * into v_asignacion from public.docentes_grupos_asignaturas where id = v_sesion.carga_id;
    select * into v_grupo from public.grupos where id = v_asignacion.grupo_id;
    select c.docente_id, c.max_bloque into v_docente_id, v_max_bloque from jsonb_to_recordset(p_cargas)
      as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer)
      where c.id = v_sesion.carga_id;
    if v_asignacion.id is null or v_docente_id is null or v_sesion.inicio is null or v_sesion.fin is null
      or v_sesion.fin - v_sesion.inicio not between 1 and v_max_bloque then
      raise exception 'El borrador contiene una sesión inválida';
    end if;
    v_turno := upper(trim(v_grupo.turno));
    if not ((v_turno = 'MATUTINO' and v_sesion.dia between 1 and 5 and v_sesion.inicio >= 7 and v_sesion.fin <= 13)
      or (v_turno = 'VESPERTINO' and v_sesion.dia between 1 and 5 and v_sesion.inicio >= 16 and v_sesion.fin <= 21)
      or (v_turno = 'MIXTO' and v_sesion.dia = 6 and v_sesion.inicio >= 7 and v_sesion.fin <= 15)) then
      raise exception 'Una sesión está fuera del turno de su grupo';
    end if;
    select * into v_config from public.docente_configuraciones_horario
      where docente_id = v_docente_id and ciclo_id = p_ciclo_id;
    if not exists (
      select 1 from jsonb_to_recordset(v_config.disponibilidad)
        as d(dia integer, inicio integer, fin integer)
      where d.dia = v_sesion.dia and d.inicio <= v_sesion.inicio and d.fin >= v_sesion.fin
    ) then raise exception 'Una sesión queda fuera de la disponibilidad del docente'; end if;
    if exists (
      select 1 from public.horarios_sesiones hs
      join public.horarios_versiones hv on hv.id = hs.horario_id
      join public.ciclos_escolares c on c.id = hv.ciclo_id
      where hv.estado = 'publicado' and hv.ciclo_id <> p_ciclo_id
        and hs.docente_id = v_docente_id and hs.dia_semana = v_sesion.dia
        and hs.hora_inicio < v_sesion.fin and hs.hora_fin > v_sesion.inicio
        and (c.fecha_inicio is null or c.fecha_termino is null
          or (c.fecha_inicio <= v_ciclo.fecha_termino and c.fecha_termino >= v_ciclo.fecha_inicio))
    ) then raise exception 'El docente ya tiene clase en un ciclo que coincide o tiene fechas sin definir'; end if;
    if nullif(trim(v_grupo.aula), '') is not null and exists (
      select 1 from public.horarios_sesiones hs
      join public.horarios_versiones hv on hv.id = hs.horario_id
      join public.ciclos_escolares c on c.id = hv.ciclo_id
      where hv.estado = 'publicado' and hv.ciclo_id <> p_ciclo_id
        and lower(trim(hs.aula)) = lower(trim(v_grupo.aula))
        and lower(trim(coalesce(hs.sede, ''))) = lower(trim(coalesce(v_grupo.sede, '')))
        and hs.dia_semana = v_sesion.dia and hs.hora_inicio < v_sesion.fin and hs.hora_fin > v_sesion.inicio
        and (c.fecha_inicio is null or c.fecha_termino is null
          or (c.fecha_inicio <= v_ciclo.fecha_termino and c.fecha_termino >= v_ciclo.fecha_inicio))
    ) then raise exception 'El aula ya está ocupada en un ciclo coincidente'; end if;
  end loop;

  if exists (
    with s as (
      select ordinalidad, (valor->>'carga_id')::uuid as carga_id,
        (valor->>'dia')::integer as dia, (valor->>'inicio')::integer as inicio,
        (valor->>'fin')::integer as fin
      from jsonb_array_elements(p_sesiones) with ordinality as x(valor, ordinalidad)
    )
    select 1 from s a join s b on a.ordinalidad < b.ordinalidad and a.dia = b.dia
      and a.inicio < b.fin and b.inicio < a.fin
    join public.docentes_grupos_asignaturas aa on aa.id = a.carga_id
    join public.docentes_grupos_asignaturas ab on ab.id = b.carga_id
    join public.grupos ga on ga.id = aa.grupo_id
    join public.grupos gb on gb.id = ab.grupo_id
    join jsonb_to_recordset(p_cargas) as ca(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer) on ca.id = a.carga_id
    join jsonb_to_recordset(p_cargas) as cb(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer) on cb.id = b.carga_id
    where ga.id = gb.id or ca.docente_id = cb.docente_id
      or (nullif(trim(ga.aula), '') is not null and lower(trim(ga.aula)) = lower(trim(gb.aula))
        and lower(trim(coalesce(ga.sede, ''))) = lower(trim(coalesce(gb.sede, ''))))
  ) then raise exception 'Dos sesiones del borrador se empalman para un grupo, docente o aula'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_cargas) as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer)
    left join lateral (
      select coalesce(sum(s.fin - s.inicio), 0) as total
      from jsonb_to_recordset(p_sesiones) as s(carga_id uuid, dia integer, inicio integer, fin integer)
      where s.carga_id = c.id
    ) x on true
    where x.total <> c.horas_presenciales
  ) then raise exception 'Faltan o sobran horas presenciales en una materia'; end if;

  update public.horarios_versiones set estado = 'sustituido'
    where ciclo_id = p_ciclo_id and estado = 'publicado';
  select coalesce(max(version), 0) + 1 into v_version
    from public.horarios_versiones where ciclo_id = p_ciclo_id;
  insert into public.horarios_versiones(ciclo_id, version, grupos_id, max_hueco_grupo, max_hueco_docente)
    values (p_ciclo_id, v_version, p_grupos, p_max_hueco_grupo, p_max_hueco_docente)
    returning id into v_horario_id;
  for v_carga in select * from jsonb_to_recordset(p_cargas)
    as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer)
  loop
    select * into v_asignacion from public.docentes_grupos_asignaturas where id = v_carga.id;
    select * into v_grupo from public.grupos where id = v_asignacion.grupo_id;
    select * into v_asignatura from public.asignaturas where id = v_asignacion.asignatura_id;
    select * into v_docente from public.docentes where id = v_carga.docente_id;
    update public.docentes_grupos_asignaturas set docente_id = v_carga.docente_id,
      horas_presenciales = v_carga.horas_presenciales, horas_asincronas = v_carga.horas_asincronas
      where id = v_carga.id;
    insert into public.horarios_cargas(horario_id, asignacion_id, grupo_id, asignatura_id, docente_id,
      grupo_codigo, grupo_turno, asignatura_nombre, docente_nombre, horas_totales, horas_presenciales,
      horas_asincronas, max_bloque, aula, sede)
      values (v_horario_id, v_carga.id, v_grupo.id, v_asignatura.id, v_docente.id,
        v_grupo.codigo_grupo, v_grupo.turno, v_asignatura.nombre, v_docente.nombre_completo,
        v_asignatura.horas_semanales, v_carga.horas_presenciales, v_carga.horas_asincronas, v_carga.max_bloque,
        v_grupo.aula, v_grupo.sede)
      returning id into v_carga_id;
    v_ids := v_ids || jsonb_build_object(v_carga.id::text, v_carga_id::text);
  end loop;
  for v_sesion in select * from jsonb_to_recordset(p_sesiones)
    as s(carga_id uuid, dia integer, inicio integer, fin integer)
  loop
    select * into v_asignacion from public.docentes_grupos_asignaturas where id = v_sesion.carga_id;
    select * into v_grupo from public.grupos where id = v_asignacion.grupo_id;
    select c.docente_id into v_docente_id from jsonb_to_recordset(p_cargas)
      as c(id uuid, docente_id uuid, horas_presenciales integer, horas_asincronas integer, max_bloque integer)
      where c.id = v_sesion.carga_id;
    insert into public.horarios_sesiones(horario_id, carga_id, grupo_id, docente_id,
      dia_semana, hora_inicio, hora_fin, aula, sede)
      values (v_horario_id, (v_ids->>v_sesion.carga_id::text)::uuid, v_grupo.id,
        v_docente_id, v_sesion.dia, v_sesion.inicio, v_sesion.fin, v_grupo.aula, v_grupo.sede);
  end loop;
  return v_horario_id;
end;
$$;

revoke all on function public.publicar_horario_academico(uuid, uuid[], jsonb, jsonb, integer, integer) from public;
grant execute on function public.publicar_horario_academico(uuid, uuid[], jsonb, jsonb, integer, integer) to authenticated;
