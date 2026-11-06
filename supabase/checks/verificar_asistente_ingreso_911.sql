-- SOLO LECTURA. Después de 20261027100000 y 20261027110000, sin invocar RPC que escriben fuentes.
select public.s911_criterios_pertinencia()->>'version' guia,
 public.s911_criterios_pertinencia()->>'sha256' huella,
 (select count(*) from jsonb_object_keys(public.s911_criterios_pertinencia()->'criterios')) desgloses_homologados;
select to_regprocedure('public.s911_candidatos_guiados(uuid)') candidatos,
 to_regprocedure('public.s911_inferir_ingreso(uuid[],uuid)') inferencia,
 to_regprocedure('public.s911_guardar_lote_inscripciones(jsonb)') lote;
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_puede_ejecutar,
 has_function_privilege('authenticated',p.oid,'EXECUTE') usuario_puede_ejecutar
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in('s911_candidatos_guiados','s911_inferir_ingreso','s911_guardar_lote_inscripciones','s911_validar_perfil','s911_criterios_pertinencia') order by p.proname;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='s911_inscripciones' and column_name='ingreso_procedencia';
select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'INSERT') escritura_directa,
 has_table_privilege('authenticated',c.oid,'UPDATE') cambio_directo,has_table_privilege('anon',c.oid,'SELECT') lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 's911_%' and c.relkind='r' order by c.relname;
-- Las pruebas de permisos/inferencia por alumno requieren una sesión autorizada real en el frontend.
