-- Solo metadatos; no sustituye pruebas funcionales con roles y datos de ensayo.
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='personal_personas'
and column_name in ('nombre_original','nombre_confirmado_en','nombre_confirmado_por','nombre_fuente') order by column_name;
select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anonimo,
has_function_privilege('authenticated',p.oid,'EXECUTE') autenticado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
('_personal_guardar_base_v1','_personal_vincular_base_v1','personal_vincular_v1','personal_guardar_v1','personal_consultar_v2','personal_nombres_pendientes_v1','personal_nombres_revisar_lote_v1') order by p.proname;
