-- Solo lectura, posterior a 20261018170000.
select
  to_regprocedure('public.revisar_reasociacion_con_recibos(uuid,uuid,boolean)') is not null
    as funcion_presente,
  pg_get_functiondef('public.revisar_reasociacion_con_recibos(uuid,uuid,boolean)'::regprocedure)
    like '%PROGRAMA_VIGENTE%' as criterio_sin_grupo_presente,
  pg_get_functiondef('public.revisar_reasociacion_con_recibos(uuid,uuid,boolean)'::regprocedure)
    like '%v_grupos > 1%' as grupos_contradictorios_bloqueados;
