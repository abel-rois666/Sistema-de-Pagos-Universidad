-- Solo lectura. Ejecutar después de la migración; no modifica registros.
select 'columna' as objeto, 'docente_configuraciones_horario.max_horas_semanales' as nombre,
  case when exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'docente_configuraciones_horario' and column_name = 'max_horas_semanales'
    and data_type = 'integer') then 'OK' else 'FALTA O TIPO INCORRECTO' end as resultado
union all
select 'restricción', 'docente_config_horas_maximas_validas',
  case when exists (select 1 from pg_constraint where conname = 'docente_config_horas_maximas_validas'
    and conrelid = to_regclass('public.docente_configuraciones_horario')) then 'OK' else 'FALTA' end
union all
select 'función', 'validar_max_horas_docente_horario()',
  case when to_regprocedure('public.validar_max_horas_docente_horario()') is not null then 'OK' else 'FALTA' end
union all
select 'disparador', 'trg_horarios_cargas_max_horas_docente',
  case when exists (select 1 from pg_trigger where tgrelid = to_regclass('public.horarios_cargas')
    and tgname = 'trg_horarios_cargas_max_horas_docente' and not tgisinternal)
    then 'OK' else 'FALTA' end;
