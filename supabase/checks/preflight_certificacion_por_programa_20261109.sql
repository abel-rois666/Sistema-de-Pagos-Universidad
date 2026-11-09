-- SOLO LECTURA. No necesita sesión de aplicación para consultar metadatos.
select t.nombre,to_regclass('public.'||t.nombre) tabla from unnest(array['ficha_certificacion','alumno_programas','planes_estudio','carreras','usuarios']) t(nombre);
select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in ('ficha_certificacion','alumno_programas','usuarios') order by table_name,ordinal_position;
select c.relname tabla,p.policyname,p.roles,p.cmd,p.qual,p.with_check from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname where n.nspname='public' and c.relname='ficha_certificacion';
select c.conname,pg_get_constraintdef(c.oid) definicion from pg_constraint c where c.conrelid='public.ficha_certificacion'::regclass;
select indexname,indexdef from pg_indexes where schemaname='public' and tablename='ficha_certificacion';
select count(*) fichas,count(*) filter(where tramite_completado) completadas,
 count(*) filter(where pago_certificado not in ('SIN_INICIAR','EN_CURSO','COMPLETADO')) pagos_con_estado_desconocido,
 count(*) filter(where fecha_termino_tramite<fecha_inicio_tramite) fechas_invertidas,
 count(*) filter(where tramite_completado and fecha_inicio_tramite is null) completadas_sin_inicio from public.ficha_certificacion;
select count(*) alumnos_con_multiples_fichas from(select alumno_id from public.ficha_certificacion group by alumno_id having count(*)>1)t;
select count(*) fichas_sin_programa_academico from public.ficha_certificacion f where not exists(select 1 from public.alumno_programas p where p.alumno_id=f.alumno_id);
select t.tgname,pg_get_triggerdef(t.oid) definicion from pg_trigger t where t.tgrelid in ('public.ficha_certificacion'::regclass,'public.alumno_programas'::regclass) and not t.tgisinternal;
select p.proname,pg_get_functiondef(p.oid) definicion from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_my_rol','fn_recalcular_estatus_institucional_alumno');
