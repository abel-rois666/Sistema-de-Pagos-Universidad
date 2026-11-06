-- SOLO LECTURA. Complementa el preflight básico; no crea ni corrige datos.
-- No devuelve nombres, matrículas, CURP, RFC ni importes.

-- 1. Columnas utilizadas por la migración y el servicio que no cubría la revisión básica.
-- Todas las filas deben tener faltantes = {}.
with esperadas(tabla, columnas) as (values
 ('alumnos', array['id','matricula','nombre_completo','apellido_paterno','apellido_materno','nombres','fecha_nacimiento','sexo','grado_actual']),
 ('alumno_programas', array['id','alumno_id','plan_id','fecha_inscripcion','es_vigente','estatus']),
 ('planes_estudio', array['id','nombre','clave_legado','tipo_periodo','modalidad']),
 ('ciclos_escolares', array['id','nombre','tipo_periodo','fecha_inicio','fecha_termino']),
 ('grupos', array['id','ciclo_id','plan_id']),
 ('alumnos_grupos', array['alumno_id','grupo_id']),
 ('asignaturas', array['id','plan_id']),
 ('inscripciones_academicas', array['id','alumno_id','ciclo_id','asignatura_id']),
 ('docentes', array['id','nombre_completo','rfc','estatus']),
 ('empleados', array['id','nombres','apellido_paterno','apellido_materno','rfc','puesto','tipo_jornada','fecha_nacimiento','sexo','estatus']),
 ('usuarios', array['auth_id','rol'])
)
select e.tabla,
 array(select c from unnest(e.columnas) c where not exists(
  select 1 from information_schema.columns i
  where i.table_schema='public' and i.table_name=e.tabla and i.column_name=c
 )) faltantes
from esperadas e order by e.tabla;

-- 2. Tener fecha_inscripcion no demuestra que sea la fecha histórica de ingreso.
-- Las asociaciones sin alumno/plan válido no deben entrar a una confirmación 911.
select count(*) programas_total,
 count(distinct ap.alumno_id) alumnos_distintos_con_programa,
 count(*) filter(where ap.alumno_id is null) sin_alumno_id,
 count(*) filter(where ap.plan_id is null) sin_plan_id,
 count(*) filter(where ap.alumno_id is not null and a.id is null) alumno_no_encontrado,
 count(*) filter(where ap.plan_id is not null and p.id is null) plan_no_encontrado,
 count(*) filter(where ap.fecha_inscripcion is null) sin_fecha_inscripcion,
 min(ap.fecha_inscripcion) primera_fecha_registrada,
 max(ap.fecha_inscripcion) ultima_fecha_registrada
from public.alumno_programas ap
left join public.alumnos a on a.id=ap.alumno_id
left join public.planes_estudio p on p.id=ap.plan_id;

-- 3. Materias y grupos son fuentes distintas. No sumar ambas poblaciones.
-- Se cuentan alumnos únicos por ciclo y plan; un alumno puede cursar más de un programa.
-- Se incluyen homónimos 2027-1/2026 y cualquier ciclo cuyas fechas contengan el corte.
with ciclos as (
 select c.* from public.ciclos_escolares c
 where c.nombre like '2027-%' or c.nombre like '2026-%'
 or (c.fecha_inicio<=date '2026-09-30' and c.fecha_termino>=date '2026-09-30')
), materias as (
 select ia.ciclo_id,count(ia.id) filas,
 count(distinct ia.alumno_id) alumnos,
 count(*) filter(where ia.alumno_id is null) sin_alumno_id
 from public.inscripciones_academicas ia join ciclos c on c.id=ia.ciclo_id
 group by ia.ciclo_id
), grupos as (
 select g.ciclo_id,count(distinct g.id) grupos,
 count(ag.alumno_id) relaciones,
 count(distinct ag.alumno_id) alumnos
 from public.grupos g join ciclos c on c.id=g.ciclo_id
 left join public.alumnos_grupos ag on ag.grupo_id=g.id
 group by g.ciclo_id
), candidatos as (
 select ia.ciclo_id,ia.alumno_id,a.plan_id
 from public.inscripciones_academicas ia join public.asignaturas a on a.id=ia.asignatura_id
 join ciclos c on c.id=ia.ciclo_id
 union
 select g.ciclo_id,ag.alumno_id,g.plan_id
 from public.alumnos_grupos ag join public.grupos g on g.id=ag.grupo_id
 join ciclos c on c.id=g.ciclo_id
), resumen as (
 select ca.ciclo_id,count(*) parejas_alumno_plan,
 count(*) filter(where not exists(
  select 1 from public.alumno_programas ap
  where ap.alumno_id=ca.alumno_id and ap.plan_id=ca.plan_id
 )) sin_programa_correspondiente
 from candidatos ca where ca.alumno_id is not null and ca.plan_id is not null
 group by ca.ciclo_id
)
select c.id,c.nombre,c.tipo_periodo,c.fecha_inicio,c.fecha_termino,
 case when c.fecha_inicio is null or c.fecha_termino is null then 'FECHAS INCOMPLETAS'
      when c.fecha_inicio>c.fecha_termino then 'FECHAS INVERTIDAS'
      when c.fecha_inicio<=date '2026-09-30' and c.fecha_termino>=date '2026-09-30' then 'CONTIENE EL CORTE'
      else 'FUERA DEL CORTE' end relacion_con_corte,
 coalesce(m.filas,0) inscripciones_por_materia,
 coalesce(m.alumnos,0) alumnos_con_materias,
 coalesce(m.sin_alumno_id,0) materias_sin_alumno_id,
 coalesce(g.grupos,0) grupos,
 coalesce(g.relaciones,0) relaciones_en_grupos,
 coalesce(g.alumnos,0) alumnos_en_grupos,
 coalesce(r.parejas_alumno_plan,0) candidatos_alumno_plan,
 coalesce(r.sin_programa_correspondiente,0) candidatos_sin_programa
from ciclos c left join materias m on m.ciclo_id=c.id
left join grupos g on g.ciclo_id=c.id left join resumen r on r.ciclo_id=c.id
order by c.nombre desc,c.tipo_periodo,c.id;

-- 4. Disponibilidad de Auth/Storage y estado previo del espacio reservado.
-- rol_actual puede ser NULL en SQL Editor sin sesión JWT de la aplicación.
select auth.uid() usuario_auth, public.get_my_rol() rol_actual,
 to_regprocedure('public.get_my_rol()') helper_rol,
 to_regprocedure('storage.foldername(text)') helper_ruta_storage,
 to_regclass('storage.buckets') tabla_buckets,
 to_regclass('storage.objects') tabla_objetos;
select id,public,file_size_limit from storage.buckets where id='estadistica-911';
