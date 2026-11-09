-- Solo lectura de metadatos. La base de Personal debe estar instalada primero.
select nombre,to_regclass('public.'||nombre) tabla from unnest(array['personal_personas','personal_auditoria','docentes','empleados']) nombre;
select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
('personal_guardar_v1','personal_consultar_v1','_personal_guardar_base_v1','personal_consultar_v2','personal_nombres_revisar_lote_v1');
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='personal_personas'
and column_name in ('nombre_original','nombre_confirmado_en','nombre_confirmado_por','nombre_fuente');
