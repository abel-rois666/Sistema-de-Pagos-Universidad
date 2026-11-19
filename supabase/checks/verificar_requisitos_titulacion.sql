-- SOLO LECTURA: no ejecutar el guardado para verificar la instalación.
select to_regprocedure('public.titulacion_requisitos_v1(uuid,uuid,uuid,uuid)') consulta,
 position('_titulacion_requisitos_v1' in pg_get_functiondef(to_regprocedure('public.titulacion_guardar_v1(uuid,uuid,uuid,integer,jsonb,text,text)')))>0 revalida_en_guardado;
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and indexname in ('titulacion_pago_un_programa','titulacion_ss_un_programa');
select has_function_privilege('anon','public.titulacion_requisitos_v1(uuid,uuid,uuid,uuid)','EXECUTE') anonimo,
 has_function_privilege('authenticated','public._titulacion_requisitos_v1(uuid,uuid,uuid,uuid,boolean)','EXECUTE') helper_publico;
