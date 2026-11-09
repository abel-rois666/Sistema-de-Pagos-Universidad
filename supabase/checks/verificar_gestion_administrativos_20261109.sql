-- SOLO LECTURA. Ejecutar DESPUÉS de la instalación; no prueba el comportamiento transaccional real.
select to_regclass('public.personal_gestion_auditoria') auditoria,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='usuarios' and column_name='empleado_id') enlace_administrativo;
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'execute') anon_puede_ejecutar,
 has_function_privilege('authenticated',p.oid,'execute') autenticado_puede_ejecutar
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('personal_administrativo_revisar_v1','personal_cuentas_administrativas_v1','personal_cuentas_buscar_v1',
 'personal_administrativo_vincular_cuenta_v1','personal_administrativo_eliminar_v1','_personal_cuentas_empleado_v1',
 '_personal_dependencias_empleado_v1','_personal_validar_cuenta_administrativa_v1','_personal_preservar_identidad_cuenta_v1','_personal_proteger_eliminacion_administrativa_v1','_personal_gestion_admin_v1') order by p.proname;
select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT') insercion_directa,
 has_table_privilege('authenticated',c.oid,'DELETE') borrado_directo,
 has_table_privilege('authenticated',c.oid,'SELECT') lectura_autenticada,
 has_table_privilege('anon',c.oid,'SELECT') lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('personal_gestion_auditoria','empleados');
select indexname,indexdef from pg_indexes where schemaname='public' and indexname='usuarios_empleado_unico';
select tgname,pg_get_triggerdef(oid) definicion from pg_trigger where not tgisinternal and tgname in
 ('personal_validar_cuenta_administrativa','personal_proteger_eliminacion_administrativa','personal_preservar_cuenta_empleado','personal_preservar_cuenta_docente');
