-- Preparada, no ejecutada. Solo estructuras y funciones 911; no corrige alumnos ni calificaciones.
begin;
do $$ begin
 if to_regprocedure('public.s911_validar_perfil(jsonb,boolean)') is null then raise exception 'Instala primero la actualización del asistente 911';end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='inscripciones_academicas' and column_name='calificacion_final') then raise exception 'Revisa el preflight de historial académico';end if;
end $$;
alter table public.s911_inscripciones add column if not exists ingreso_procedencia jsonb not null default '{}'::jsonb;

create or replace function public.s911_candidatos_guiados(p_ciclo uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare resultado jsonb;
begin
 if not public.s911_autorizado(true) then raise exception 'Sin permiso para fuentes académicas';end if;
 if not exists(select 1 from public.ciclos_escolares where id=p_ciclo) then raise exception 'Ciclo inexistente';end if;
 with candidatos as (
  select ag.alumno_id,g.plan_id from public.alumnos_grupos ag join public.grupos g on g.id=ag.grupo_id where g.ciclo_id=p_ciclo
  union select ia.alumno_id,a.plan_id from public.inscripciones_academicas ia join public.asignaturas a on a.id=ia.asignatura_id where ia.ciclo_id=p_ciclo
  union select ap.alumno_id,ap.plan_id from public.s911_inscripciones si join public.alumno_programas ap on ap.id=si.alumno_programa_id where si.ciclo_id=p_ciclo
 ), filas as (
  select distinct ap.id alumno_programa_id,al.id alumno_id,al.matricula,
   coalesce(al.nombre_completo,concat_ws(' ',al.apellido_paterno,al.apellido_materno,al.nombres)) nombre,
   p.id plan_id,p.clave_legado||' · '||p.nombre programa,coalesce(si.grado_personal,al.grado_actual::text,'') grado,
   si.id fuente_id,si.actualizado_en,si.desde,si.hasta,si.evidencia,coalesce(si.tipo_ingreso,'DESCONOCIDO') tipo_ingreso,
   si.fecha_primer_ingreso,coalesce(si.ingreso_procedencia,'{}'::jsonb) ingreso_procedencia
  from candidatos c join public.alumno_programas ap on ap.alumno_id=c.alumno_id and ap.plan_id=c.plan_id
  join public.alumnos al on al.id=c.alumno_id join public.planes_estudio p on p.id=c.plan_id
  left join public.s911_inscripciones si on si.alumno_programa_id=ap.id and si.ciclo_id=p_ciclo
 ) select coalesce(jsonb_agg(to_jsonb(f) order by f.nombre,f.alumno_programa_id),'[]') into resultado from filas f;
 return resultado;
end $$;

create or replace function public.s911_inferir_ingreso(p_programas uuid[],p_ciclo uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare resultado jsonb;inicio_destino date;
begin
 if not public.s911_autorizado(true) then raise exception 'Sin permiso para historial académico';end if;
 if p_programas is null or cardinality(p_programas)>1000 then raise exception 'Selecciona como máximo 1000 programas';end if;
 select fecha_inicio into inicio_destino from public.ciclos_escolares where id=p_ciclo;
 if not found then raise exception 'Ciclo de inscripción inexistente';end if;
 with programas as (
  select id,alumno_id,plan_id from public.alumno_programas where id=any(p_programas)
 ), historial as (
  select ap.id alumno_programa_id,c.id ciclo_id,c.nombre,c.fecha_inicio,ia.id registro
  from programas ap join public.inscripciones_academicas ia on ia.alumno_id=ap.alumno_id
  join public.asignaturas a on a.id=ia.asignatura_id and a.plan_id=ap.plan_id
  join public.ciclos_escolares c on c.id=ia.ciclo_id
  where ia.calificacion_final is not null or ia.parcial_1 is not null or ia.parcial_2 is not null
   or ia.parcial_3 is not null or ia.promedio_calculado is not null
 ), resumen as (
  select ap.id, count(h.registro) registros,
   count(*) filter(where h.registro is not null and h.fecha_inicio is null) sin_fecha,min(h.fecha_inicio) primera_fecha
  from programas ap left join historial h on h.alumno_programa_id=ap.id group by ap.id
 ), salida as (
  select r.id alumno_programa_id,
   case when r.registros=0 then 'SIN_HISTORIAL' when r.sin_fecha>0 or inicio_destino is null then 'SIN_FECHA'
    when (select count(distinct h.ciclo_id) from historial h where h.alumno_programa_id=r.id and h.fecha_inicio=r.primera_fecha)>1 then 'AMBIGUA'
    when r.primera_fecha>inicio_destino then 'POSTERIOR' else 'PROPUESTA' end estado,
   primero.ciclo_id,primero.nombre ciclo,r.primera_fecha fecha,r.registros
  from resumen r left join lateral (select h.ciclo_id,h.nombre from historial h where h.alumno_programa_id=r.id and h.fecha_inicio=r.primera_fecha order by h.ciclo_id limit 1) primero on true
 ) select coalesce(jsonb_agg(to_jsonb(s) order by s.alumno_programa_id),'[]') into resultado from salida s;
 return resultado;
end $$;

create or replace function public.s911_guardar_lote_inscripciones(p_filas jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare fila jsonb; actual public.s911_inscripciones; programa public.alumno_programas;
 total integer=0;procedencia jsonb;inferida jsonb;inferencias jsonb;programas uuid[];ciclo uuid;
begin
 if not public.s911_autorizado(true) then raise exception 'Sin permiso para acreditar fuentes';end if;
 if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas)<1 or jsonb_array_length(p_filas)>1000 then raise exception 'Lote inválido: entre 1 y 1000 fuentes';end if;
 if (select count(distinct (value->>'alumno_programa_id',value->>'ciclo_id')) from jsonb_array_elements(p_filas))<>jsonb_array_length(p_filas) then raise exception 'Fuente duplicada dentro del lote';end if;
 if (select count(distinct value->>'ciclo_id') from jsonb_array_elements(p_filas))<>1 then raise exception 'El lote debe corresponder a un ciclo exacto';end if;
 ciclo=(p_filas->0->>'ciclo_id')::uuid;
 if not exists(select 1 from public.ciclos_escolares where id=ciclo) then raise exception 'Ciclo inexistente';end if;
 select array_agg((value->>'alumno_programa_id')::uuid) into programas from jsonb_array_elements(p_filas) where value#>>'{ingreso_procedencia,origen}'='CALIFICACIONES';
 if programas is not null then
  select jsonb_object_agg(value->>'alumno_programa_id',value) into inferencias from jsonb_array_elements(public.s911_inferir_ingreso(programas,ciclo));
 end if;
 for fila in select value from jsonb_array_elements(p_filas) order by value->>'alumno_programa_id' loop
  select * into programa from public.alumno_programas where id=(fila->>'alumno_programa_id')::uuid;
  if not found then raise exception 'Programa del alumno inexistente';end if;
  perform pg_advisory_xact_lock(hashtextextended(programa.id::text||':'||ciclo::text,911));
  select * into actual from public.s911_inscripciones where alumno_programa_id=programa.id and ciclo_id=ciclo for update;
  if found then
   if fila->>'fuente_id' is distinct from actual.id::text or (fila->>'actualizado_en')::timestamptz is distinct from actual.actualizado_en then raise exception 'Otra sesión modificó una fuente. Recarga el lote antes de guardar';end if;
  elsif nullif(fila->>'fuente_id','') is not null then raise exception 'La fuente fue retirada o cambió. Recarga el lote';end if;
  if coalesce(fila->>'tipo_ingreso','') not in('PRIMER_INGRESO','REINGRESO','DESCONOCIDO') then raise exception 'Tipo de ingreso inválido';end if;
  if nullif(trim(fila->>'evidencia'),'') is null or nullif(trim(fila->>'grado_personal'),'') is null or nullif(fila->>'desde','') is null then raise exception 'Completa vigencia, grado personal y evidencia';end if;
  procedencia=jsonb_build_object('origen','MANUAL');
  if fila#>>'{ingreso_procedencia,origen}'='CALIFICACIONES' then
   inferida=inferencias->programa.id::text;
   if inferida->>'estado' is distinct from 'PROPUESTA' or fila#>'{ingreso_procedencia,confirmada}' is distinct from 'true'::jsonb
    or fila#>>'{ingreso_procedencia,ciclo_id}' is distinct from inferida->>'ciclo_id'
    or fila->>'fecha_primer_ingreso' is distinct from inferida->>'fecha' then raise exception 'La propuesta de ingreso cambió o no es concluyente. Consulta nuevamente el historial';end if;
   procedencia=jsonb_build_object('origen','CALIFICACIONES','ciclo_id',inferida->>'ciclo_id','ciclo',inferida->>'ciclo','fecha',inferida->>'fecha','registros',inferida->'registros','confirmada',true,'advertencia','Inicio del ciclo con calificaciones más antiguo disponible; requiere revisión de integridad histórica');
  end if;
  if actual.id is null then
   -- INSERT sin UPSERT: una alta concurrente debe fallar, nunca sobrescribirse.
   insert into public.s911_inscripciones(alumno_programa_id,ciclo_id,desde,hasta,tipo_ingreso,fecha_primer_ingreso,grado_personal,situacion,confirmado,evidencia,ingreso_procedencia)
   values(programa.id,ciclo,(fila->>'desde')::date,nullif(fila->>'hasta','')::date,fila->>'tipo_ingreso',nullif(fila->>'fecha_primer_ingreso','')::date,fila->>'grado_personal','ACTIVO',true,fila->>'evidencia',procedencia);
  else
   update public.s911_inscripciones set desde=(fila->>'desde')::date,hasta=nullif(fila->>'hasta','')::date,
    tipo_ingreso=fila->>'tipo_ingreso',fecha_primer_ingreso=nullif(fila->>'fecha_primer_ingreso','')::date,grado_personal=fila->>'grado_personal',
    confirmado=true,evidencia=fila->>'evidencia',ingreso_procedencia=procedencia,actualizado_por=auth.uid(),actualizado_en=clock_timestamp()
   where id=actual.id;
  end if;
  total=total+1;
 end loop;
 insert into public.s911_auditoria(accion,datos) values('LOTE_INSCRIPCIONES_GUIADAS',jsonb_build_object('fuentes',total,'ciclo_id',ciclo));
 return total;
end $$;

-- Una edición individual desde clientes anteriores no conserva una procedencia inferida obsoleta.
create or replace function public.s911_limpiar_procedencia_ingreso() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if new.fecha_primer_ingreso is distinct from old.fecha_primer_ingreso and new.ingreso_procedencia is not distinct from old.ingreso_procedencia then new.ingreso_procedencia=jsonb_build_object('origen','MANUAL');end if;
 return new;
end $$;
create trigger s911_procedencia_ingreso before update on public.s911_inscripciones
for each row execute function public.s911_limpiar_procedencia_ingreso();
revoke all on function public.s911_limpiar_procedencia_ingreso() from public,anon,authenticated;
revoke all on function public.s911_candidatos_guiados(uuid),public.s911_inferir_ingreso(uuid[],uuid),public.s911_guardar_lote_inscripciones(jsonb) from public,anon;
grant execute on function public.s911_candidatos_guiados(uuid),public.s911_inferir_ingreso(uuid[],uuid),public.s911_guardar_lote_inscripciones(jsonb) to authenticated;
commit;
