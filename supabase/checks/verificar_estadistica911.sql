-- SOLO LECTURA. Después de instalar exclusivamente las dos migraciones 911.
select table_name from information_schema.tables where table_schema='public' and table_name like 's911_%' order by table_name;
select edicion,sha256,(select count(*) from jsonb_object_keys(fuentes)) cuestionarios,jsonb_array_length(reglas) reglas,
 (select count(*) from jsonb_array_elements(reglas) r where r->'ast'='null'::jsonb) reglas_sin_ast
from public.s911_catalogos where edicion='2026-2027';
-- Debe quedar sin filas después de 999_publicar.sql. No es un catálogo utilizable por la app.
select edicion,sha256,
 (select count(*) from jsonb_object_keys(fuentes->'fragmentos')) partes_recibidas,
 (select count(*) from jsonb_object_keys(fuentes#>'{metadatos,partes}')) partes_esperadas
from public.s911_catalogos where edicion='CARGA_2026-2027' and sha256 like 'CARGA911:%';
select cuestionario,count(*) definiciones from public.s911_campos group by cuestionario order by cuestionario;
select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 's911_%' order by p.proname;
select tablename,cmd,roles,qual,with_check from pg_policies where schemaname='public' and tablename like 's911_%' order by tablename,cmd;
select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT') escritura_directa,
 has_table_privilege('authenticated',c.oid,'UPDATE') cambio_directo,
 has_table_privilege('anon',c.oid,'SELECT') lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 's911_%' and c.relkind='r' order by c.relname;
select id,public,file_size_limit from storage.buckets where id='estadistica-911';
