-- SOLO LECTURA. Revisar resultados antes de instalar; no invoca borrados.
select nombre,to_regclass('public.'||nombre) tabla from (values
 ('alumno_programas'),('inscripciones_academicas'),('ficha_certificacion'),('certificacion_auditoria'),
 ('asociaciones_programa_retiro_auditoria')) r(nombre);
select table_name,column_name,data_type from information_schema.columns where table_schema='public'
 and table_name in ('inscripciones_academicas','ficha_certificacion','certificacion_auditoria') order by table_name,ordinal_position;
select c.conrelid::regclass tabla,c.conname,pg_get_constraintdef(c.oid) definicion from pg_constraint c
 where c.contype='f' and c.confrelid in(to_regclass('public.alumno_programas'),to_regclass('public.inscripciones_academicas'),to_regclass('public.ficha_certificacion')) order by tabla,c.conname;
select tgrelid::regclass tabla,tgname,pg_get_triggerdef(oid) definicion,pg_get_functiondef(tgfoid) funcion from pg_trigger
 where not tgisinternal and tgrelid in(to_regclass('public.alumno_programas'),to_regclass('public.inscripciones_academicas'),to_regclass('public.ficha_certificacion'));
select pg_get_functiondef(to_regprocedure('public._ap_revision_retiro_v1(uuid,uuid)')) revision_instalada;
