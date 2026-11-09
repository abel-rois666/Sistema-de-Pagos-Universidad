-- Solo metadatos. No sustituye el ensayo de funciones con roles y datos ficticios.
select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anonimo,has_function_privilege('authenticated',p.oid,'EXECUTE') autenticado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
('personal_consultar_v3','personal_buscar_personas_v1','personal_anadir_funcion_v1','personal_docencia_guardar_v1','personal_institucional_guardar_v1') order by p.proname;
select p.proname,has_function_privilege('authenticated',p.oid,'EXECUTE') helper_ejecutable_por_cliente
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('_personal_guardar_base_v1','_personal_vincular_base_v1','_personal_rol_v1','_personal_fuente_v1');
