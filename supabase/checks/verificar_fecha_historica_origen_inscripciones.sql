-- SOLO LECTURA: no sustituye la prueba con una sesión institucional autorizada.
select position('INICIO_HISTORICO_CON_CALIFICACIONES' in coalesce(pg_get_functiondef(to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)')),''))>0 fecha_historica_presente,
 position('ULTIMO_CICLO_ANTERIOR_CON_CALIFICACIONES' in coalesce(pg_get_functiondef(to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)')),''))>0 origen_historico_presente,
 position('propuesta_fecha_historial' in coalesce(pg_get_functiondef(to_regprocedure('public.ic_configuracion()')),''))>0 capacidad_cliente_presente;
select p.prosecdef seguridad_definidor,
 has_function_privilege('authenticated',p.oid,'EXECUTE') ejecutable_directamente_autenticado,
 has_function_privilege('anon',p.oid,'EXECUTE') ejecutable_anonimo
from pg_proc p where p.oid=to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)');
select count(*) procedencias_actuales_incoherentes
from public.inscripciones_ciclo_contextos c join public.inscripciones_ciclo i on i.id=c.inscripcion_id and i.revision=c.revision
where (c.contexto#>>'{desde,metodo}'='INICIO_HISTORICO_CON_CALIFICACIONES' and
 (c.contexto#>>'{desde,fecha}' is distinct from i.desde::text or c.contexto#>>'{desde,ciclo_destino_id}' is distinct from i.ciclo_id::text))
 or (c.contexto#>>'{origen_anterior,metodo}'='ULTIMO_CICLO_ANTERIOR_CON_CALIFICACIONES' and
 (c.contexto#>>'{origen_anterior,ciclo_id}' is distinct from c.ciclo_origen_id::text or c.contexto#>>'{origen_anterior,ciclo_destino_id}' is distinct from i.ciclo_id::text));
