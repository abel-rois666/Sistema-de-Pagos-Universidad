-- Solo metadatos: no modifica fichas.
select p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anonimo,has_function_privilege('authenticated',p.oid,'EXECUTE') autenticado,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('titulacion_consultar_v1','titulacion_archivar_v1','titulacion_asociar_anterior_v1');
