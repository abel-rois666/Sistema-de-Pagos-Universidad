-- Solo metadatos; no ejecuta funciones de escritura.
select p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anonimo,has_function_privilege('authenticated',p.oid,'EXECUTE') autenticado from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('titulacion_guardar_v1','titulacion_lote_preview_v1','titulacion_asociar_lote_v1','_tit_lote_candidato_v1');
select indexname,indexdef from pg_indexes where schemaname='public' and tablename='ficha_titulacion';
