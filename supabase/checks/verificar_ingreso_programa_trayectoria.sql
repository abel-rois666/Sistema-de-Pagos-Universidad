-- Solo lectura. Todos los controles de seguridad deben devolver true.
select c.relname,c.relrowsecurity,
 not has_table_privilege('authenticated',c.oid,'INSERT') sin_alta_directa,
 not has_table_privilege('authenticated',c.oid,'UPDATE') sin_cambio_directo,
 not has_table_privilege('anon',c.oid,'SELECT') sin_lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in('inscripciones_programa_ingreso','inscripciones_programa_ingreso_historial');
select to_regprocedure('public.ic_guardar_ingreso_programa(uuid,integer,uuid,date,text,text,text)') guardar,
 position('El inicio histórico corresponde al ingreso al programa' in pg_get_functiondef('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)'::regprocedure))>0 fecha_historica_separada;

-- Casos heredados que necesitan revisión humana; no modificar automáticamente.
select count(*) inscripciones_con_fecha_historica_para_revisar
from public.inscripciones_ciclo i join public.inscripciones_ciclo_contextos c on c.inscripcion_id=i.id and c.revision=i.revision
where c.contexto#>>'{desde,metodo}'='INICIO_HISTORICO_CON_CALIFICACIONES'
and c.contexto#>>'{desde,ciclo_id}' is distinct from i.ciclo_id::text;
select count(*) preparaciones_con_fecha_historica_para_revisar
from public.inscripciones_ciclo_preparaciones p
where p.estado='PENDIENTE' and p.referencia->>'metodo_desde'='HISTORIAL_MAS_ANTIGUO' and p.referencia->'aplicar_desde'='true'::jsonb;
