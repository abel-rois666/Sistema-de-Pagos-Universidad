-- Solo lectura: ejecutar después de aplicar 20261006123000_promover_alumno_ciclo.sql.
select 'promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)' as objeto,
  case when to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)') is not null
    then 'OK' else 'FALTA' end as resultado;

select 'Ejecución para authenticated' as objeto,
  case when has_function_privilege('authenticated',
    'public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)', 'EXECUTE')
    then 'OK' else 'FALTA' end as resultado;

select 'Programa ACTIVO o CURSANDO' as objeto,
  case when exists (select 1 from pg_proc p
    where p.oid = to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)')
      and position('not in (''CURSANDO'', ''ACTIVO'')' in p.prosrc) > 0)
    then 'OK' else 'REVISAR' end as resultado;

select 'Conserva plan existente al promover' as objeto,
  case when exists (select 1 from pg_proc p
    where p.oid = to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)')
      and position('El plan de pago existente cambió desde la previsualización' in p.prosrc) > 0)
    then 'OK' else 'REVISAR' end as resultado;

select t.tgname as disparador, pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
where t.tgrelid = 'public.alumno_programas'::regclass
  and t.tgname in ('trg_blindar_motivo_alumno_programa', 'trg_recalcular_estatus_institucional_alumno')
  and not t.tgisinternal
order by t.tgname;
