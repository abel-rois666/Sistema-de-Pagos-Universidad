-- SOLO LECTURA. No confirma inscripciones ni activa integraciones.
select to_regprocedure('public.ic_consultar(uuid,boolean)') consulta,to_regprocedure('public.ic_guardar_lote(uuid,jsonb)') guardar,
 to_regprocedure('public.ic_promover_alumno(uuid,uuid,uuid,text,uuid,boolean,boolean)') promocion_integrada,
 to_regprocedure('public.ic_acreditar_911(jsonb)') puente_911_opcional;
select integrar_promocion from public.inscripciones_ciclo_config where id;
select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT') insercion_directa,
 has_table_privilege('authenticated',c.oid,'UPDATE') cambio_directo,
 has_table_privilege('authenticated',c.oid,'DELETE') borrado_directo,
 has_table_privilege('anon',c.oid,'SELECT') lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'inscripciones_ciclo%' and c.relkind='r';
select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') ejecutable_anonimo,
 has_function_privilege('authenticated',p.oid,'EXECUTE') ejecutable_autenticado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('ic_consultar','ic_guardar_lote','ic_integrar_promocion','ic_promover_alumno','ic_acreditar_911');
select count(*) inscripciones_registradas,count(distinct (alumno_programa_id,ciclo_id)) claves_unicas from public.inscripciones_ciclo;
-- Completar con sesiones de Administración, Control Escolar y un rol sin autorización.
