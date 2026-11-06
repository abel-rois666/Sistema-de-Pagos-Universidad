-- Solo lectura. Revisar en Supabase; no compartir importes ni conceptos si
-- contienen datos personales. Una fila por detalle de recibo de los 18 planes
-- Cuatrimestrales aún asociados al ID Semestral de 2027-1.
-- El índice nulo puede representar un concepto de catálogo o un vínculo aún
-- no capturado; esta consulta no decide a qué ciclo pertenece el recibo.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), planes_pendientes AS (
  SELECT pp.*
  FROM public.planes_pago pp
  CROSS JOIN parametros p
  WHERE pp.ciclo_id = p.origen_id
    AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
    AND EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = p.destino_id
    )
)
SELECT pp.alumno_id, pp.id AS plan_id, r.folio,
  r.fecha_pago, r.estatus AS estatus_recibo,
  r.requiere_factura, r.estatus_factura,
  nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
    AS tiene_folio_fiscal,
  r.total AS total_recibo,
  rd.id AS detalle_recibo_id, rd.concepto AS concepto_recibo,
  rd.subtotal AS subtotal_detalle,
  rd.indice_concepto_plan,
  coalesce(pd.concepto,
    to_jsonb(pp) ->> ('concepto_' || rd.indice_concepto_plan::text))
    AS concepto_plan_mismo_indice,
  coalesce(pd.estatus,
    to_jsonb(pp) ->> ('estatus_' || rd.indice_concepto_plan::text))
    AS estatus_plan_mismo_indice
FROM planes_pendientes pp
JOIN public.recibos r ON r.alumno_id = pp.alumno_id
  AND r.ciclo_id = pp.ciclo_id
LEFT JOIN public.recibos_detalles rd ON rd.recibo_id = r.id
LEFT JOIN LATERAL (
  SELECT d.concepto, d.estatus
  FROM public.planes_pago_detalles d
  WHERE d.plan_id = pp.id
    AND d.indice_concepto = rd.indice_concepto_plan
  ORDER BY d.created_at DESC, d.id DESC
  LIMIT 1
) pd ON true
ORDER BY pp.alumno_id, r.folio, rd.id;
