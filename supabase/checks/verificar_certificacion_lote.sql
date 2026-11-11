-- SOLO LECTURA. Dos filas; no asigna fichas.
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') acceso_anonimo,
 has_function_privilege('authenticated',p.oid,'EXECUTE') acceso_autenticado
from pg_proc p where p.oid in(to_regprocedure('public.certificacion_lote_preview_v1(integer,text)'),
 to_regprocedure('public.certificacion_asociar_lote_v1(jsonb,text)')) order by p.proname;
-- Definer=true, search_path fijo; anónimo=false, autenticado=true. Permisos por rol se ensayan con sesión.
