-- Preparación autorizada. NO ejecutar sin revisar el preflight y ensayar en una copia.
-- Aditiva: no modifica políticas ni firmas existentes; clientes anteriores siguen operando.
begin;
do $preflight$
declare v_tabla text;
begin
  foreach v_tabla in array array['alumnos','usuarios','alumno_programas','planes_estudio','carreras','grupos','alumnos_grupos','docentes_grupos_asignaturas','inscripciones_academicas'] loop
    if to_regclass('public.'||v_tabla) is null then raise exception 'Falta public.%. Detén la instalación y verifica proyecto y esquema.',v_tabla; end if;
  end loop;
  if to_regprocedure('public.get_my_rol()') is null then raise exception 'Falta get_my_rol(); revisa el esquema antes de instalar.'; end if;
end $preflight$;

create table if not exists public.operaciones_academicas_auditoria (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  actor uuid not null,
  operacion text not null,
  entidad_id uuid not null,
  antes jsonb,
  despues jsonb
);
alter table public.operaciones_academicas_auditoria enable row level security;
revoke all on public.operaciones_academicas_auditoria from public, anon, authenticated;
grant select on public.operaciones_academicas_auditoria to authenticated;
drop policy if exists revision_academica on public.operaciones_academicas_auditoria;
create policy revision_academica on public.operaciones_academicas_auditoria for select to authenticated
using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR', 'COORDINADOR ACADEMICO')
  and exists (select 1 from public.usuarios where auth_id=auth.uid() and activo is true));

create or replace function public.eliminar_grupos_lote_v1(p_ids uuid[])
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_total integer; v_grupo public.grupos%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.usuarios where auth_id=auth.uid() and activo is true) or coalesce(public.get_my_rol(), '') not in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO') then
    raise exception 'No tienes permiso para eliminar grupos.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_ids),0) = 0 or cardinality(p_ids) > 500 or array_position(p_ids,null) is not null then
    raise exception 'Selecciona entre 1 y 500 grupos válidos.';
  end if;
  if (select count(distinct x) from unnest(p_ids) x) <> cardinality(p_ids) then raise exception 'Hay grupos repetidos.'; end if;
  perform id from public.grupos where id = any(p_ids) order by id for update;
  if (select count(*) from public.grupos where id = any(p_ids)) <> cardinality(p_ids) then raise exception 'La selección cambió; actualiza los grupos.'; end if;
  -- En el esquema instalado estas FK usan SET NULL. Evitar romper borradores/publicados.
  if to_regclass('public.horarios_cargas') is not null then
    if exists(select 1 from public.horarios_cargas where grupo_id=any(p_ids)) then raise exception 'Hay grupos usados en cargas de horarios. Revisa el horario antes de eliminarlos.'; end if;
  end if;
  if to_regclass('public.horarios_sesiones') is not null then
    if exists(select 1 from public.horarios_sesiones where grupo_id=any(p_ids)) then raise exception 'Hay grupos usados en sesiones de horarios. No se eliminaron los grupos.'; end if;
  end if;
  for v_grupo in select * from public.grupos where id = any(p_ids) order by id loop
    insert into public.operaciones_academicas_auditoria(actor,operacion,entidad_id,antes)
      values(auth.uid(),'ELIMINAR_GRUPO',v_grupo.id,jsonb_build_object('grupo',to_jsonb(v_grupo),
        'alumnos_grupos',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.alumnos_grupos a where grupo_id=v_grupo.id),
        'docentes_grupos_asignaturas',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from public.docentes_grupos_asignaturas d where grupo_id=v_grupo.id)));
  end loop;
  -- Únicamente relaciones del grupo: jamás alumnos, materias, kardex, recibos o planes.
  delete from public.docentes_grupos_asignaturas where grupo_id = any(p_ids);
  delete from public.alumnos_grupos where grupo_id = any(p_ids);
  delete from public.grupos where id = any(p_ids);
  get diagnostics v_total = row_count;
  return v_total;
end $$;

create or replace function public.activar_programa_principal_v1(p_alumno_id uuid, p_plan_id uuid)
returns public.alumno_programas language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_objetivo public.alumno_programas%rowtype; v_antes jsonb; v_carrera text;
begin
  if auth.uid() is null or not exists (select 1 from public.usuarios where auth_id=auth.uid() and activo is true) or coalesce(public.get_my_rol(),'') not in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR') then
    raise exception 'No tienes permiso para cambiar el programa principal.' using errcode='42501';
  end if;
  perform id from public.alumnos where id=p_alumno_id for update;
  if not found then raise exception 'Alumno no encontrado.'; end if;
  perform id from public.alumno_programas where alumno_id=p_alumno_id order by id for update;
  select * into v_objetivo from public.alumno_programas where alumno_id=p_alumno_id and plan_id=p_plan_id;
  if not found then raise exception 'El programa no pertenece al alumno.'; end if;
  select jsonb_agg(to_jsonb(ap)) into v_antes from public.alumno_programas ap where alumno_id=p_alumno_id;
  update public.alumno_programas set es_vigente=false, fecha_ultimo_cambio=now(),
    motivo_estatus=case when estatus in ('EGRESADO','TITULADO') then 'PLAN_CONCLUIDO'
      when motivo_estatus='CARRERA_SIMULTANEA' then motivo_estatus
      when estatus not in ('EGRESADO','TITULADO') and motivo_estatus is not null then 'CAMBIO_DE_CARRERA'
      else motivo_estatus end
    where alumno_id=p_alumno_id and plan_id<>p_plan_id;
  update public.alumno_programas set es_vigente=true, fecha_ultimo_cambio=now(),
    estatus=case when estatus in ('BAJA','BAJA_POR_CAMBIO') then 'CURSANDO' else coalesce(estatus,'CURSANDO') end,
    motivo_estatus=case when estatus in ('EGRESADO','TITULADO') then 'PLAN_CONCLUIDO'
      when estatus in ('BAJA','BAJA_POR_CAMBIO') then 'REINGRESO' else coalesce(motivo_estatus,'REGULAR') end,
    estatus_previo=case when estatus in ('BAJA','BAJA_POR_CAMBIO') then estatus else estatus_previo end
    where id=v_objetivo.id returning * into v_objetivo;
  select c.nombre into v_carrera from public.planes_estudio p join public.carreras c on c.id=p.carrera_id where p.id=p_plan_id;
  -- Mantiene las reglas actuales: logros concluidos y carreras simultáneas se conservan.
  update public.alumnos set licenciatura=coalesce(v_carrera,licenciatura),
    estatus=case when v_objetivo.estatus in ('CURSANDO','ACTIVO') then 'ACTIVO'
      when v_objetivo.estatus in ('BAJA','BAJA_POR_CAMBIO') then 'BAJA' else v_objetivo.estatus end
    where id=p_alumno_id and coalesce(estatus,'') not in ('PENDIENTE_APROBACION','RECHAZADO');
  insert into public.operaciones_academicas_auditoria(actor,operacion,entidad_id,antes,despues)
    values(auth.uid(),'PROGRAMA_PRINCIPAL',v_objetivo.id,v_antes,(select jsonb_agg(to_jsonb(ap)) from public.alumno_programas ap where alumno_id=p_alumno_id));
  return v_objetivo;
end $$;

revoke all on function public.eliminar_grupos_lote_v1(uuid[]) from public, anon;
revoke all on function public.activar_programa_principal_v1(uuid,uuid) from public, anon;
grant execute on function public.eliminar_grupos_lote_v1(uuid[]) to authenticated;
grant execute on function public.activar_programa_principal_v1(uuid,uuid) to authenticated;
commit;
