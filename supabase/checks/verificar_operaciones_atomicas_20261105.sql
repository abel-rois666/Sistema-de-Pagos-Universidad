-- Solo verifica instalación y permisos; no llama a funciones de escritura.
select f.firma,to_regprocedure(f.firma) is not null instalada,
  case when to_regprocedure(f.firma) is not null then has_function_privilege('anon',f.firma,'EXECUTE') end ejecutable_anon,
  case when to_regprocedure(f.firma) is not null then has_function_privilege('authenticated',f.firma,'EXECUTE') end ejecutable_authenticated
from unnest(array['public.eliminar_grupos_lote_v1(uuid[])','public.activar_programa_principal_v1(uuid,uuid)','public.guardar_calificaciones_lote_v1(jsonb,jsonb,uuid[])']) f(firma);
select c.relname,c.relrowsecurity,
  has_table_privilege('anon',c.oid,'SELECT') lectura_anon,
  has_table_privilege('authenticated',c.oid,'INSERT') insercion_directa,
  has_table_privilege('authenticated',c.oid,'UPDATE') cambio_directo,
  has_table_privilege('authenticated',c.oid,'DELETE') borrado_directo
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='operaciones_academicas_auditoria';
