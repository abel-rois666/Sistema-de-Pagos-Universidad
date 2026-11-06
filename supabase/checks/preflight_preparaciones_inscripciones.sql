-- SOLO LECTURA. No incluye nombres, matrículas, importes ni calificaciones individuales.
with esperadas(tabla,columna) as(values
 ('alumno_programas','id'),('alumno_programas','alumno_id'),('alumno_programas','plan_id'),('alumno_programas','es_vigente'),('alumno_programas','estatus'),
 ('alumnos','id'),('alumnos','grado_actual'),('alumnos','ciclo_ultima_asignacion_grado'),
 ('planes_estudio','id'),('planes_estudio','modelo'),('planes_estudio','tipo_periodo'),('planes_estudio','total_periodos'),
 ('ciclos_escolares','id'),('ciclos_escolares','nombre'),('ciclos_escolares','tipo_periodo'),('ciclos_escolares','fecha_inicio'),
 ('asignaturas','id'),('asignaturas','plan_id'),('asignaturas','nombre'),('asignaturas','numero_periodo'),
 ('inscripciones_academicas','alumno_id'),('inscripciones_academicas','ciclo_id'),('inscripciones_academicas','asignatura_id'),
 ('inscripciones_academicas','calificacion_final'),('inscripciones_academicas','parcial_1'),('inscripciones_academicas','parcial_2'),('inscripciones_academicas','parcial_3'),('inscripciones_academicas','promedio_calculado'))
select e.tabla,coalesce(jsonb_agg(e.columna) filter(where c.column_name is null),'[]') faltantes
from esperadas e left join information_schema.columns c on c.table_schema='public' and c.table_name=e.tabla and c.column_name=e.columna group by e.tabla order by e.tabla;
select to_regprocedure('public.ic_autorizado()') autorizacion_base,
 to_regprocedure('public.ic_guardar_lote(uuid,jsonb)') guardar_base,
 to_regclass('public.inscripciones_ciclo_historial') bitacora_base,
 to_regclass('public.inscripciones_ciclo_preparaciones') preparaciones_preexistentes,
 to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)') promocion_original;
-- Para habilitar AVANCE se debe revisar también la guía y los checks de promoción existente.
select p.prosecdef promocion_es_definer,position('p_crear_plan' in pg_get_functiondef(p.oid))>0 acepta_conservar_plan
from pg_proc p where p.oid=to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)');
