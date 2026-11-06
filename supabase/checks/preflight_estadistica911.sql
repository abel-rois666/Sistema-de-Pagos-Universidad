-- SOLO LECTURA. Ejecutar ANTES de instalar. No se infiere calidad histórica por existencia de filas.
select current_database() base, current_user usuario, now() consultado_en;
select tabla, to_regclass('public.'||tabla) presente
from unnest(array['alumnos','alumno_programas','planes_estudio','ciclos_escolares','grupos','alumnos_grupos','asignaturas','inscripciones_academicas','empleados','docentes','ficha_titulacion','s911_expedientes']) tabla;
select table_name,column_name,data_type,is_nullable
from information_schema.columns where table_schema='public'
and table_name in('alumnos','alumno_programas','planes_estudio','ciclos_escolares','empleados','docentes','ficha_titulacion')
and column_name in('id','auth_id','alumno_id','plan_id','tipo_periodo','modalidad','fecha_inscripcion','fecha_nacimiento','sexo','es_vigente','estatus','fecha_examen','fecha_completado','fecha_egreso','fecha_titulacion') order by 1,2;
select p.tipo_periodo,p.modalidad,count(*) programas,count(distinct ap.alumno_id) alumnos,
 count(*) filter(where ap.fecha_inscripcion is null) sin_fecha_inscripcion
from public.alumno_programas ap join public.planes_estudio p on p.id=ap.plan_id group by 1,2;
-- COUNT(ia.id), no COUNT(*): el LEFT JOIN produce una fila aun sin inscripciones.
select c.id,c.nombre,c.tipo_periodo,count(distinct ia.alumno_id) alumnos_con_materias,count(ia.id) inscripciones_por_materia
from public.ciclos_escolares c left join public.inscripciones_academicas ia on ia.ciclo_id=c.id group by c.id,c.nombre,c.tipo_periodo order by c.nombre desc;
select 'No equivale a empleo único: revisar coincidencias docentes/RH y función principal' advertencia,
 (select count(*) from public.docentes) docentes,(select count(*) from public.empleados) empleados;
select public.get_my_rol() rol_actual, to_regprocedure('public.s911_guardar(uuid,integer,jsonb,jsonb)') guardar_instalado;
