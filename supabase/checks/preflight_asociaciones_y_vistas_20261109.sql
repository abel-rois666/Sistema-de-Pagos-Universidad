-- SOLO LECTURA. Metadatos; no modifica asociaciones, preferencias ni expedientes.
with requeridas(nombre) as(values('usuarios'),('alumnos'),('alumno_programas'),('planes_estudio'),
 ('asignaturas'),('inscripciones_academicas'),('grupos'),('alumnos_grupos'))
select nombre,to_regclass('public.'||nombre) tabla from requeridas order by nombre;

select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and (table_name in ('alumno_programas','usuarios')
 or (table_name in ('ficha_titulacion','ficha_certificacion') and column_name in ('id','alumno_id','alumno_programa_id','archivado_en')))
order by table_name,column_name;

select c.conrelid::regclass::text tabla,c.conname,pg_get_constraintdef(c.oid) definicion,
 cardinality(c.conkey)>1 relacion_compuesta_requiere_revision
from pg_constraint c where c.contype='f' and c.confrelid=to_regclass('public.alumno_programas')
order by tabla,c.conname;

select tgrelid::regclass::text tabla,tgname,pg_get_triggerdef(oid) definicion from pg_trigger
where not tgisinternal and tgrelid in(to_regclass('public.alumnos'),to_regclass('public.alumno_programas')) order by tabla,tgname;

select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('fn_recalcular_estatus_institucional_alumno','activar_programa_principal_v1',
 'ap_revisar_retiro_v1','ap_retirar_asociacion_v1','listado_vistas_consultar_v1','listado_vista_guardar_v1','listado_vista_eliminar_v1') order by p.proname;
