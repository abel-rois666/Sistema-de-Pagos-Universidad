-- SOLO LECTURA. No invoca operaciones de retiro ni crea preferencias.
select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') acceso_anonimo,
 has_function_privilege('authenticated',p.oid,'EXECUTE') acceso_autenticado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('ap_revisar_retiro_v1','ap_retirar_asociacion_v1','listado_vistas_consultar_v1','listado_vista_guardar_v1','listado_vista_eliminar_v1') order by p.proname;
-- Cinco entradas públicas: anónimo=false, autenticado=true, search_path fijado.

select relname,relrowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') escritura_directa,
 has_table_privilege('anon',c.oid,'SELECT') lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and relname in ('listado_vistas_usuario','asociaciones_programa_retiro_auditoria');
-- Dos tablas: RLS=true, escritura_directa=false, lectura_anonima=false.

select tgname,tgenabled,pg_get_triggerdef(oid) definicion from pg_trigger
where tgrelid=to_regclass('public.alumno_programas') and tgname='ap_proteger_retiro';
-- Un trigger BEFORE DELETE habilitado. Conservar también los triggers anteriores.

select indexname,indexdef from pg_indexes where schemaname='public' and tablename='listado_vistas_usuario';
-- Unicidad del nombre por cuenta y de la vista predeterminada por cuenta.
