-- Solo lectura. Ejecutar después de 20261018133000_reasociar_solo_plan_pago.sql.
select
  to_regprocedure('public.revisar_reasociacion_solo_plan_pago(uuid,uuid,boolean)') is not null
    as funcion_instalada,
  exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planes_pago_reasociaciones'
      and column_name = 'recibos_conservados_ids') as auditoria_recibos_conservados,
  has_function_privilege('authenticated',
    'public.revisar_reasociacion_solo_plan_pago(uuid,uuid,boolean)', 'EXECUTE')
    as ejecucion_autenticados,
  has_function_privilege('anon',
    'public.revisar_reasociacion_solo_plan_pago(uuid,uuid,boolean)', 'EXECUTE')
    as ejecucion_anon_debe_ser_false;
