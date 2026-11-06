-- SOLO LECTURA. Verifica definición y permisos; no modifica fechas ni filas.
select to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)') is not null funcion_presente,
 position('INICIO_CICLO_DESTINO_CON_CALIFICACIONES' in coalesce(pg_get_functiondef(to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)')),''))>0 validacion_fecha_presente,
 position('propuesta_fecha_inscripcion' in coalesce(pg_get_functiondef(to_regprocedure('public.ic_configuracion()')),''))>0 capacidad_cliente_presente;
select p.prosecdef seguridad_definidor,
 has_function_privilege('authenticated',p.oid,'EXECUTE') ejecutable_directamente_autenticado,
 has_function_privilege('anon',p.oid,'EXECUTE') ejecutable_anonimo
from pg_proc p where p.oid=to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)');
select count(*) procedencias_inferidas_con_fecha_incoherente
from public.inscripciones_ciclo_contextos c join public.inscripciones_ciclo i on i.id=c.inscripcion_id and i.revision=c.revision
where c.contexto#>>'{desde,metodo}'='INICIO_CICLO_DESTINO_CON_CALIFICACIONES'
 and (c.contexto#>>'{desde,fecha}' is distinct from i.desde::text or c.contexto#>>'{desde,ciclo_id}' is distinct from i.ciclo_id::text);
