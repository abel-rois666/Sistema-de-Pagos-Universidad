-- Preparada a partir del preflight comunicado por el usuario el 05/11/2026.
-- No ejecutar sin ensayo por rol y contraste con el cliente desplegado.
-- No borra datos ni sustituye las políticas existentes: las limita con políticas RESTRICTIVE.
begin;
do $preflight$
begin
  if to_regclass('public.inscripciones_academicas') is null or to_regclass('public.usuarios') is null
    or to_regprocedure('public.guardar_calificaciones_lote_v1(jsonb,jsonb,uuid[])') is null then
    raise exception 'Verifica el proyecto e instala primero la base y el guardado atómico.';
  end if;
end $preflight$;

create or replace function public.academico_usuario_activo_v1()
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null and exists(select 1 from public.usuarios where auth_id=auth.uid() and activo is true)
$$;

create or replace function public.academico_alcance_docente_v1(
  p_grupo uuid default null,p_alumno uuid default null,p_ciclo uuid default null,p_asignatura uuid default null,p_plan uuid default null
) returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select public.academico_usuario_activo_v1() and (
    coalesce(public.get_my_rol(),'')<>'DOCENTE' or exists (
      select 1 from public.usuarios u join public.docentes_grupos_asignaturas d on d.docente_id=u.docente_id
      join public.grupos g on g.id=d.grupo_id
      where u.auth_id=auth.uid() and u.activo is true
        and (p_grupo is null or g.id=p_grupo) and (p_ciclo is null or g.ciclo_id=p_ciclo)
        and (p_asignatura is null or d.asignatura_id=p_asignatura) and (p_plan is null or g.plan_id=p_plan)
        and (p_alumno is null or exists(select 1 from public.alumnos_grupos a where a.grupo_id=g.id and a.alumno_id=p_alumno))
    )
  )
$$;

-- Las lecturas de caja/finanzas se conservan; docentes ven únicamente su carga.
drop policy if exists guardia_grupos_lectura_v1 on public.grupos;
create policy guardia_grupos_lectura_v1 on public.grupos as restrictive for select to public
using (public.academico_alcance_docente_v1(id));
drop policy if exists guardia_relaciones_alumnos_lectura_v1 on public.alumnos_grupos;
create policy guardia_relaciones_alumnos_lectura_v1 on public.alumnos_grupos as restrictive for select to public
using (public.academico_alcance_docente_v1(grupo_id,alumno_id));
drop policy if exists guardia_cargas_lectura_v1 on public.docentes_grupos_asignaturas;
create policy guardia_cargas_lectura_v1 on public.docentes_grupos_asignaturas as restrictive for select to public
using (public.academico_alcance_docente_v1(grupo_id,null,null,asignatura_id)
  and (public.get_my_rol()<>'DOCENTE' or exists(select 1 from public.usuarios u where u.auth_id=auth.uid() and u.docente_id=docentes_grupos_asignaturas.docente_id)));
drop policy if exists guardia_programas_lectura_v1 on public.alumno_programas;
create policy guardia_programas_lectura_v1 on public.alumno_programas as restrictive for select to public
using (public.academico_alcance_docente_v1(null,alumno_id,null,null,plan_id));
drop policy if exists guardia_calificaciones_lectura_v1 on public.inscripciones_academicas;
create policy guardia_calificaciones_lectura_v1 on public.inscripciones_academicas as restrictive for select to public
using (public.academico_alcance_docente_v1(null,alumno_id,ciclo_id,asignatura_id));

do $politicas$
declare v_tabla text; v_roles text; v_rol_sql text;
begin
  foreach v_tabla in array array['grupos','alumnos_grupos','docentes_grupos_asignaturas','alumno_programas','inscripciones_academicas'] loop
    v_roles := case when v_tabla='alumno_programas' then '(''ADMINISTRADOR'',''COORDINADOR CONTROL ESCOLAR'')'
      when v_tabla='inscripciones_academicas' then '(''ADMINISTRADOR'',''COORDINADOR CONTROL ESCOLAR'',''COORDINADOR ACADEMICO'',''DOCENTE'')'
      else '(''ADMINISTRADOR'',''COORDINADOR CONTROL ESCOLAR'',''COORDINADOR ACADEMICO'')' end;
    -- Identificadores y valores proceden exclusivamente de la lista fija anterior.
    v_rol_sql := 'public.academico_usuario_activo_v1() and public.get_my_rol() in '||v_roles;
    execute format('drop policy if exists guardia_insertar_v1 on public.%I',v_tabla);
    execute format('create policy guardia_insertar_v1 on public.%I as restrictive for insert to public with check (%s)',v_tabla,v_rol_sql);
    execute format('drop policy if exists guardia_actualizar_v1 on public.%I',v_tabla);
    execute format('create policy guardia_actualizar_v1 on public.%I as restrictive for update to public using (%s) with check (%s)',v_tabla,v_rol_sql,v_rol_sql);
    execute format('drop policy if exists guardia_eliminar_v1 on public.%I',v_tabla);
    execute format('create policy guardia_eliminar_v1 on public.%I as restrictive for delete to public using (%s)',v_tabla,v_rol_sql);
  end loop;
end $politicas$;

create or replace function public.blindar_captura_docente_v1()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_campo text; v_bloqueo text; v_nota numeric; v_promedio numeric; v_cambio boolean;
begin
  if auth.role()='service_role' or (auth.uid() is null and session_user in ('postgres','supabase_admin')) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if not public.academico_usuario_activo_v1() then raise exception 'Se requiere un usuario activo.' using errcode='42501'; end if;
  if coalesce(public.get_my_rol(),'') not in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO','DOCENTE') then
    raise exception 'No tienes permiso para modificar calificaciones.' using errcode='42501';
  end if;
  if public.get_my_rol()<>'DOCENTE' then if tg_op='DELETE' then return old; else return new; end if; end if;
  if tg_op='DELETE' then raise exception 'Un docente no puede eliminar la inscripción del alumno. Usa el guardado de la captura.' using errcode='42501'; end if;
  if not public.academico_alcance_docente_v1(null,new.alumno_id,new.ciclo_id,new.asignatura_id) then raise exception 'La materia y el alumno no pertenecen a tu carga.' using errcode='42501'; end if;
  if tg_op='INSERT' and (new.id_observacion_certificacion is not null or new.ciclo_legado is not null) then
    raise exception 'La información de certificación e importación corresponde a Control Escolar.' using errcode='42501';
  end if;
  foreach v_campo in array array['parcial_1','parcial_2','parcial_3','calificacion_final','promedio_calculado'] loop
    v_nota := (to_jsonb(new)->>v_campo)::numeric;
    if v_nota is not null and v_nota<>-555 and not (v_nota between 0 and 10) then raise exception 'La calificación debe estar entre 0 y 10 o ser NP.'; end if;
  end loop;
  if new.modificada_manualmente is true and nullif(trim(new.observaciones),'') is null then
    raise exception 'Justifica la modificación de la calificación final.';
  end if;
  v_cambio := tg_op='INSERT';
  if tg_op='UPDATE' then
    v_cambio := row(new.parcial_1,new.parcial_2,new.parcial_3,new.calificacion_final,new.promedio_calculado)
      is distinct from row(old.parcial_1,old.parcial_2,old.parcial_3,old.calificacion_final,old.promedio_calculado);
  end if;
  if v_cambio and new.calificacion_final is not null and not coalesce(new.modificada_manualmente,false) then
    if new.parcial_1 is null or new.parcial_2 is null or new.parcial_3 is null then
      raise exception 'La final capturada directamente requiere modificación manual y justificación.';
    end if;
    v_promedio := case when new.parcial_1=-555 and new.parcial_2=-555 and new.parcial_3=-555 then -555 else
      ((case when new.parcial_1=-555 then 0 else new.parcial_1 end)
      +(case when new.parcial_2=-555 then 0 else new.parcial_2 end)
      +(case when new.parcial_3=-555 then 0 else new.parcial_3 end))/3 end;
    if new.calificacion_final is distinct from round(v_promedio)
      or new.promedio_calculado is distinct from round(v_promedio,2) then
      raise exception 'La final automática debe corresponder a sus parciales. Justifica una final manual.';
    end if;
  end if;
  if tg_op='UPDATE' then
    if (to_jsonb(new)-array['parcial_1','parcial_2','parcial_3','promedio_calculado','calificacion_final','modificada_manualmente','observaciones','estatus','tipo_evaluacion','bloqueo_p1','bloqueo_p2','bloqueo_p3','bloqueo_final','solicitud_p1','solicitud_p2','solicitud_p3','solicitud_final','updated_at'])
      is distinct from (to_jsonb(old)-array['parcial_1','parcial_2','parcial_3','promedio_calculado','calificacion_final','modificada_manualmente','observaciones','estatus','tipo_evaluacion','bloqueo_p1','bloqueo_p2','bloqueo_p3','bloqueo_final','solicitud_p1','solicitud_p2','solicitud_p3','solicitud_final','updated_at']) then
      raise exception 'No puedes modificar la identidad ni los datos institucionales de la inscripción.' using errcode='42501';
    end if;
    foreach v_campo in array array['parcial_1','parcial_2','parcial_3','calificacion_final'] loop
      v_bloqueo := case v_campo when 'parcial_1' then 'bloqueo_p1' when 'parcial_2' then 'bloqueo_p2' when 'parcial_3' then 'bloqueo_p3' else 'bloqueo_final' end;
      if coalesce((to_jsonb(old)->>v_bloqueo)::boolean,false) and (
        to_jsonb(old)->v_campo is distinct from to_jsonb(new)->v_campo or not coalesce((to_jsonb(new)->>v_bloqueo)::boolean,false)
      ) then raise exception 'Solicita autorización para corregir una calificación bloqueada.' using errcode='42501'; end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists guardia_captura_docente_v1 on public.inscripciones_academicas;
create trigger guardia_captura_docente_v1 before insert or update or delete on public.inscripciones_academicas
for each row execute function public.blindar_captura_docente_v1();

-- Login utiliza Auth y get_auth_email_by_username; no lee usuarios de forma anónima.
revoke select on public.usuarios from public, anon, authenticated;
revoke select (id,username,password,rol,created_at,preferencia_tema,ultimo_ciclo_id,auth_id,activo,docente_id)
  on public.usuarios from public,anon,authenticated;
grant select (id,username,rol,created_at,preferencia_tema,ultimo_ciclo_id,auth_id,activo,docente_id) on public.usuarios to authenticated;
create or replace function public.blindar_preferencias_usuario_v1()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.role()='service_role' or (auth.uid() is null and session_user in ('postgres','supabase_admin')) then return new; end if;
  if public.academico_usuario_activo_v1() and public.get_my_rol()='ADMINISTRADOR' then return new; end if;
  if public.academico_usuario_activo_v1() and old.auth_id=auth.uid()
    and (to_jsonb(new)-array['preferencia_tema','ultimo_ciclo_id'])=(to_jsonb(old)-array['preferencia_tema','ultimo_ciclo_id']) then return new; end if;
  raise exception 'Solo puedes cambiar tus preferencias. Roles y accesos requieren Administración.' using errcode='42501';
end $$;
drop trigger if exists guardia_preferencias_usuario_v1 on public.usuarios;
create trigger guardia_preferencias_usuario_v1 before update on public.usuarios for each row execute function public.blindar_preferencias_usuario_v1();
revoke all on function public.academico_usuario_activo_v1() from public,anon;
revoke all on function public.academico_alcance_docente_v1(uuid,uuid,uuid,uuid,uuid) from public,anon;
-- Las políticas necesitan evaluar la denegación también para anon (si existe un grant legado).
grant execute on function public.academico_usuario_activo_v1() to authenticated,anon;
grant execute on function public.academico_alcance_docente_v1(uuid,uuid,uuid,uuid,uuid) to authenticated,anon;
revoke all on function public.blindar_captura_docente_v1() from public,anon,authenticated;
revoke all on function public.blindar_preferencias_usuario_v1() from public,anon,authenticated;
commit;
