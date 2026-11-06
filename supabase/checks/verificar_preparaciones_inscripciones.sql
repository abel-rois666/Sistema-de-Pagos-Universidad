-- SOLO LECTURA. Ejecutar después de instalar la actualización; las sesiones reales se prueban en la aplicación.
select nombre,to_regprocedure(nombre) funcion from unnest(array[
 'public.ic_trayectorias(uuid[])','public.ic_guardar_revision(uuid,jsonb)','public.ic_preparar_lote(uuid,jsonb)',
 'public.ic_preparacion_bloqueada(uuid,integer)','public.ic_confirmar_preparacion(uuid,integer,boolean)',
 'public.ic_confirmar_lote_preparado(jsonb,boolean)','public.ic_cancelar_preparacion(uuid,integer,text)']) nombre;
select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT') escritura_directa,
 has_table_privilege('authenticated',c.oid,'UPDATE') cambio_directo,
 has_table_privilege('authenticated',c.oid,'DELETE') borrado_directo,
 has_table_privilege('anon',c.oid,'SELECT') lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('inscripciones_ciclo_contextos','inscripciones_ciclo_preparaciones','inscripciones_ciclo_preparaciones_historial') order by c.relname;
select not prosecdef orquestacion_conserva_invoker from pg_proc where oid=to_regprocedure('public.ic_confirmar_lote_preparado(jsonb,boolean)');
select nombre,has_function_privilege('authenticated',to_regprocedure(nombre),'EXECUTE') acceso_directo_no_debe_existir
from unnest(array['public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)','public.ic_validar_preparacion(uuid,uuid,uuid,uuid,jsonb)']) nombre;
select integrar_promocion from public.inscripciones_ciclo_config where id;
select estado,count(*) preparaciones from public.inscripciones_ciclo_preparaciones group by estado order by estado;
select count(*) contextos, count(*) filter(where c.revision>i.revision) revisiones_incoherentes
from public.inscripciones_ciclo_contextos c join public.inscripciones_ciclo i on i.id=c.inscripcion_id;
