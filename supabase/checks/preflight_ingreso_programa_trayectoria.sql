-- Solo lectura. No instalar si falta un requisito.
select to_regclass('public.alumno_programas') programas,
 to_regclass('public.inscripciones_ciclo') inscripciones,
 to_regclass('public.inscripciones_ciclo_preparaciones') preparaciones,
 to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)') helper,
 to_regclass('public.inscripciones_programa_ingreso') ingreso_ya_instalado;
