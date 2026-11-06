-- Solo lectura. Plan identificado en las auditorías previas; no incluye datos personales.
-- Confirma que los folios 41069 y 41140 estén realmente desvinculados.
with plan as (
  select pp.* from public.planes_pago pp
  where pp.id = 'eec385f9-4bc4-4330-847a-d9e8b1c0246d'::uuid
), recibos as (
  select r.id, r.folio, r.ciclo_id, r.estatus, r.requiere_factura,
    r.estatus_factura, nullif(btrim(coalesce(r.folio_fiscal, '')), '') is not null as tiene_folio_fiscal,
    count(d.id) as detalles, count(d.id) filter (where d.indice_concepto_plan is not null) as detalles_vinculados
  from public.recibos r
  left join public.recibos_detalles d on d.recibo_id = r.id
  where r.alumno_id = (select alumno_id from plan)
    and r.folio in (41069, 41140)
  group by r.id
), estados as (
  select count(*) filter (where upper(btrim(coalesce(d.estatus, 'PENDIENTE')))
    not in ('', 'PENDIENTE')) as estados_cobrados_detalle
  from public.planes_pago_detalles d where d.plan_id = (select id from plan)
), estados_legados as (
  select count(*) filter (where upper(btrim(coalesce(to_jsonb(p) ->> ('estatus_' || i.indice), 'PENDIENTE')))
    not in ('', 'PENDIENTE')) as estados_cobrados_legados
  from plan p cross join generate_series(1, 18) as i(indice)
)
select p.id as plan_pago_id, p.ciclo_id as ciclo_del_plan,
  e.estados_cobrados_detalle, el.estados_cobrados_legados,
  r.folio, r.ciclo_id as ciclo_del_recibo, r.estatus,
  r.requiere_factura, r.estatus_factura, r.tiene_folio_fiscal,
  r.detalles, r.detalles_vinculados
from plan p cross join estados e cross join estados_legados el
left join recibos r on true
order by r.folio;
