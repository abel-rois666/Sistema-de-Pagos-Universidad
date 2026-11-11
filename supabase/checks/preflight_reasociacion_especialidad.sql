-- Solo lectura. Revisar antes de instalar la función nueva.
select to_regclass('public.planes_pago_reasociaciones') auditoria,to_regclass('public.planes_pago_vinculos_recibo') vinculos;
select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('planes_pago_reasociaciones','planes_estudio','carreras') order by table_name,ordinal_position;
select tgname,pg_get_triggerdef(oid),pg_get_functiondef(tgfoid) from pg_trigger where tgrelid='public.planes_pago'::regclass and not tgisinternal;
select p.proname,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('revisar_reasociacion_con_recibos','get_my_rol');
