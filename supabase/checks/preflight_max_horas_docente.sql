-- Solo lectura. Ejecutar antes de 20261007170000_max_horas_semanales_docente.sql.
-- Revisar cualquier resultado distinto de OK / OK: se añadirá / OK: libre.

select nombre, resultado from (values
  ('docente_configuraciones_horario', to_regclass('public.docente_configuraciones_horario')),
  ('horarios_versiones', to_regclass('public.horarios_versiones')),
  ('horarios_cargas', to_regclass('public.horarios_cargas')),
  ('ciclos_escolares', to_regclass('public.ciclos_escolares')),
  ('docentes', to_regclass('public.docentes'))
) as t(nombre, objeto)
cross join lateral (select case when objeto is not null then 'OK' else 'FALTA' end as resultado) r;

select coalesce(data_type, 'sin columna') as tipo_actual,
  case when data_type is null then 'OK: se añadirá'
    when data_type = 'integer' then 'OK' else 'REVISAR: tipo distinto de integer' end as resultado
from (select (select data_type from information_schema.columns
  where table_schema = 'public' and table_name = 'docente_configuraciones_horario'
    and column_name = 'max_horas_semanales') as data_type) c;

select 'validar_max_horas_docente_horario()' as objeto,
  case when to_regprocedure('public.validar_max_horas_docente_horario()') is null
    then 'OK: libre' else 'REVISAR: función existente' end as resultado
union all
select 'trg_horarios_cargas_max_horas_docente',
  case when not exists (select 1 from pg_trigger t
    where t.tgrelid = to_regclass('public.horarios_cargas')
      and t.tgname = 'trg_horarios_cargas_max_horas_docente' and not t.tgisinternal)
    then 'OK: libre' else 'REVISAR: disparador existente' end;
