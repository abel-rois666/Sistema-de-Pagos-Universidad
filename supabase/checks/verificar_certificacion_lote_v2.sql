-- Solo metadatos; no asocia fichas.
select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.prosecdef,p.proconfig,
has_function_privilege('anon',p.oid,'EXECUTE') acceso_anonimo,
has_function_privilege('authenticated',p.oid,'EXECUTE') acceso_autenticado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('_cert_lote_candidato_v2','certificacion_lote_preview_v2','certificacion_asociar_lote_v2') order by p.proname;
