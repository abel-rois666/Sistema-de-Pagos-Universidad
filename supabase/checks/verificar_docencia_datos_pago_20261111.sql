-- Solo lectura. No llama escrituras ni muestra datos privados.
select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'SELECT') lectura_directa,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') escritura_directa,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') acceso_anonimo
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('personal_datos_pago','docencia_expedientes','docencia_entregas','docencia_tarifas_generales','docencia_tarifas_docentes','docencia_auditoria') order by c.relname;
select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') ejecutable_anonimo,has_function_privilege('authenticated',p.oid,'EXECUTE') ejecutable_autenticado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('personal_pago_consultar_v1','personal_pago_guardar_v1','docencia_consultar_v1','docencia_expediente_guardar_v1','docencia_tarifa_guardar_v1') order by p.proname;
select conrelid::regclass tabla,conname,pg_get_constraintdef(oid) definicion from pg_constraint where conrelid in (to_regclass('public.personal_datos_pago'),to_regclass('public.docencia_entregas')) order by conrelid,conname;
