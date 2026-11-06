-- SOLO LECTURA. No necesita datos personales ni ejecutar funciones con escritura.
select nombre,to_regprocedure(nombre) is not null presente
from unnest(array['public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)','public.ic_configuracion()',
 'public.ic_trayectorias(uuid[])','public.ic_guardar_revision(uuid,jsonb)','public.ic_preparar_lote(uuid,jsonb)',
 'public.ic_confirmar_lote_preparado(jsonb,boolean)']) nombre;
select c.relname,c.relrowsecurity from pg_class c where c.oid in(
 to_regclass('public.inscripciones_ciclo_contextos'),to_regclass('public.inscripciones_ciclo_preparaciones'));
select nombre,case when to_regprocedure(nombre) is not null then pg_get_functiondef(to_regprocedure(nombre)) end definicion
from unnest(array['public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)','public.ic_configuracion()']) nombre;
