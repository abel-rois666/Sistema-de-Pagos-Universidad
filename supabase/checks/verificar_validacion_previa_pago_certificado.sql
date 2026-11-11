-- Solo metadatos: no guarda ni prueba pagos reales.
select p.proname,p.prosecdef,p.proconfig,pg_get_function_identity_arguments(p.oid),has_function_privilege('anon',p.oid,'EXECUTE') anonimo,has_function_privilege('authenticated',p.oid,'EXECUTE') autenticado,pg_get_functiondef(p.oid) definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('certificacion_pago_lote_validar_v1','_certificacion_pago_lote_revisar_v1','certificacion_pago_lote_aplicar_v1');
