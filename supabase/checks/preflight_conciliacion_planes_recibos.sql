-- Solo lectura. Ejecutar antes de 20261018160000_conciliacion_planes_recibos.sql.
select
  to_regclass('public.planes_pago') is not null as planes_presentes,
  to_regclass('public.planes_pago_detalles') is not null as detalles_planes_presentes,
  to_regclass('public.recibos') is not null as recibos_presentes,
  to_regclass('public.recibos_detalles') is not null as detalles_recibos_presentes,
  to_regclass('public.planes_pago_reasociaciones') is not null as auditoria_presente,
  to_regprocedure('public.revisar_reasociacion_solo_plan_pago(uuid,uuid,boolean)') is not null
    as revision_solo_plan_presente,
  to_regprocedure('public.registrar_pago_transaccional(jsonb,jsonb,uuid,jsonb,uuid,numeric)') is not null
    as cobro_transaccional_presente;

-- Magnitudes globales, sin identificar alumnos ni importes.
select
  count(*) filter (where d.indice_concepto_plan is not null) as detalles_con_indice_legado,
  count(*) filter (where d.indice_concepto_plan is null) as detalles_sin_indice,
  count(*) filter (where r.requiere_factura is true and r.estatus_factura = 'PENDIENTE')
    as detalles_en_recibos_pendientes_de_factura
from public.recibos_detalles d
join public.recibos r on r.id = d.recibo_id;
