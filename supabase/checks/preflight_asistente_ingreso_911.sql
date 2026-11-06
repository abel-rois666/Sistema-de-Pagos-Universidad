-- SOLO LECTURA. Revisar antes de las dos migraciones del asistente 27-10-2026.
with esperadas(tabla,columna) as (values
 ('inscripciones_academicas','alumno_id'),('inscripciones_academicas','asignatura_id'),('inscripciones_academicas','ciclo_id'),
 ('inscripciones_academicas','parcial_1'),('inscripciones_academicas','parcial_2'),('inscripciones_academicas','parcial_3'),
 ('inscripciones_academicas','promedio_calculado'),('inscripciones_academicas','calificacion_final'),
 ('alumno_programas','id'),('alumno_programas','alumno_id'),('alumno_programas','plan_id'),
 ('asignaturas','id'),('asignaturas','plan_id'),('carreras','nivel_educativo'),('planes_estudio','carrera_id'),('ciclos_escolares','id'),('ciclos_escolares','nombre'),('ciclos_escolares','fecha_inicio'),
 ('s911_inscripciones','actualizado_en'),('s911_inscripciones','fecha_primer_ingreso'))
select tabla,coalesce(jsonb_agg(columna) filter(where c.column_name is null),'[]') faltantes
from esperadas e left join information_schema.columns c on c.table_schema='public' and c.table_name=e.tabla and c.column_name=e.columna group by tabla order by tabla;
select to_regprocedure('public.s911_validar_corte(jsonb,boolean)') corte_personalizado_requerido,
 to_regprocedure('public.s911_guardar(uuid,integer,jsonb,jsonb)') guardar_base,
 to_regprocedure('public.s911_transicion(uuid,integer,text,text)') transicion_base;
select count(*) ciclos_con_calificaciones,
 count(*) filter(where c.fecha_inicio is null) ciclos_sin_fecha
from public.ciclos_escolares c where exists(select 1 from public.inscripciones_academicas ia where ia.ciclo_id=c.id and (ia.calificacion_final is not null or ia.parcial_1 is not null or ia.parcial_2 is not null or ia.parcial_3 is not null or ia.promedio_calculado is not null));
