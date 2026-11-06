-- SOLO LECTURA. Antes de preparar la instalación; no incluye nombres, matrículas ni importes.
with esperadas(tabla,columna) as(values
 ('alumno_programas','id'),('alumno_programas','alumno_id'),('alumno_programas','plan_id'),('alumno_programas','es_vigente'),('alumno_programas','estatus'),
 ('alumnos','id'),('alumnos','matricula'),('alumnos','nombre_completo'),('alumnos','apellido_paterno'),('alumnos','apellido_materno'),('alumnos','nombres'),('alumnos','grado_actual'),
 ('planes_estudio','id'),('planes_estudio','nombre'),('planes_estudio','clave_legado'),('planes_estudio','tipo_periodo'),('planes_estudio','modalidad'),('planes_estudio','total_periodos'),
 ('ciclos_escolares','id'),('ciclos_escolares','tipo_periodo'),('grupos','id'),('grupos','ciclo_id'),('grupos','plan_id'),('grupos','codigo_grupo'),
 ('alumnos_grupos','alumno_id'),('alumnos_grupos','grupo_id'),('inscripciones_academicas','alumno_id'),('inscripciones_academicas','ciclo_id'),('inscripciones_academicas','asignatura_id'),
 ('asignaturas','id'),('asignaturas','plan_id'),('planes_pago','alumno_id'),('planes_pago','ciclo_id'))
select e.tabla,coalesce(jsonb_agg(e.columna) filter(where c.column_name is null),'[]') faltantes from esperadas e
left join information_schema.columns c on c.table_schema='public' and c.table_name=e.tabla and c.column_name=e.columna group by e.tabla order by e.tabla;
select to_regprocedure('public.get_my_rol()') helper_rol,to_regclass('public.inscripciones_ciclo') tabla_preexistente,
 to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)') promocion_instalada,
 to_regclass('public.s911_inscripciones') base_911;
select upper(trim(p.tipo_periodo)) periodicidad,ap.es_vigente,ap.estatus,count(*) programas
from public.alumno_programas ap join public.planes_estudio p on p.id=ap.plan_id group by 1,2,3 order by 1,2 desc,3;
-- Antes de ACTIVAR la integración opcional, revisar la definición instalada con los checks de promoción.
select case when to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)') is null then false else
 position('p_crear_plan' in pg_get_functiondef(to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)')))>0 end promocion_con_conservacion_de_plan;
