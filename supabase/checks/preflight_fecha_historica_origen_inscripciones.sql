-- SOLO LECTURA. Instalar primero las migraciones 29100000 y 29140000 de inscripciones.
select to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)') is not null helper_presente,
 position('INICIO_CICLO_DESTINO_CON_CALIFICACIONES' in coalesce(pg_get_functiondef(to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)')),''))>0 base_fecha_presente;
select pg_get_functiondef(to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)')) helper_actual,
 pg_get_functiondef(to_regprocedure('public.ic_configuracion()')) configuracion_actual;
select relname,relrowsecurity from pg_class where oid in ('public.inscripciones_ciclo'::regclass,'public.inscripciones_ciclo_contextos'::regclass,'public.inscripciones_ciclo_preparaciones'::regclass);
