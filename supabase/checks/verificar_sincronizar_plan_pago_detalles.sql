-- Solo lectura, después de 20261018190000. Los indicadores deben ser true.
select
  to_regprocedure('public.sincronizar_detalles_plan_pago_editado()') is not null
    as funcion_presente,
  exists (select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'planes_pago'
      and t.tgname = 'sincronizar_detalles_plan_pago_editado' and not t.tgisinternal)
    as disparador_presente,
  pg_get_functiondef('public.sincronizar_detalles_plan_pago_editado()'::regprocedure)
    like '%v_cambio_cantidad%' as sincroniza_solo_cambios,
  pg_get_functiondef('public.sincronizar_detalles_plan_pago_editado()'::regprocedure)
    like '%v_cantidad + 0.005 < v_aplicado%' as protege_importes_vinculados;

-- Diagnóstico adicional: filas duplicadas que impedirían editar un concepto.
select plan_id, indice_concepto, count(*) as detalles_duplicados
from public.planes_pago_detalles
group by plan_id, indice_concepto
having count(*) > 1;
