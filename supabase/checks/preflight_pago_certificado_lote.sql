-- Solo lectura: comprobar antes de instalar la ampliación.
select to_regprocedure('public._certificacion_autorizar_v1(boolean)') autorizacion,to_regclass('public.certificacion_auditoria') auditoria;
select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name='ficha_certificacion' order by ordinal_position;
select tgname,pg_get_triggerdef(oid),pg_get_functiondef(tgfoid) from pg_trigger where tgrelid='public.ficha_certificacion'::regclass and not tgisinternal;
select policyname,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('ficha_certificacion','certificacion_auditoria');
