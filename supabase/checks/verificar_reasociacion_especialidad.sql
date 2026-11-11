-- Solo metadatos; no aplica correcciones ni llama a funciones de escritura.
select p.proname,p.prosecdef,p.proconfig,pg_get_function_identity_arguments(p.oid),has_function_privilege('anon',p.oid,'EXECUTE') acceso_anonimo,has_function_privilege('authenticated',p.oid,'EXECUTE') acceso_autenticado,pg_get_functiondef(p.oid) definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='revisar_reasociacion_especialidad_pago';
