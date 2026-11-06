-- Solo lectura. Debe ejecutarse después de instalar la migración.
select
  to_regclass('public.planes_pago_reasociaciones') is not null as auditoria_instalada,
  to_regprocedure('public.revisar_reasociacion_plan_pago(uuid,uuid,boolean)') is not null as funcion_instalada,
  to_regprocedure('public.validar_periodicidad_plan_pago()') is not null as validador_instalado,
  exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'public.planes_pago'::regclass
      and t.tgname = 'validar_periodicidad_plan_pago' and not t.tgisinternal
  ) as disparador_instalado,
  has_function_privilege('authenticated',
    'public.revisar_reasociacion_plan_pago(uuid,uuid,boolean)', 'EXECUTE') as ejecucion_autenticados,
  has_function_privilege('anon',
    'public.revisar_reasociacion_plan_pago(uuid,uuid,boolean)', 'EXECUTE') as ejecucion_anon_debe_ser_false;
