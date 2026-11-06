-- Solo lectura. Comprueba si los folios de los recibos de los 18 planes
-- pendientes aparecen en el estatus del plan, incluidos detalles normalizados.
-- Un resultado falso no demuestra que el recibo pertenezca a otro ciclo.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), planes_pendientes AS (
  SELECT pp.id AS plan_id, pp.alumno_id, pp.ciclo_id
  FROM public.planes_pago pp
  CROSS JOIN parametros p
  WHERE pp.ciclo_id = p.origen_id
    AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
    AND EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = p.destino_id
    )
), referencias_plan AS (
  SELECT pp.id AS plan_id, e.value AS estatus
  FROM public.planes_pago pp
  JOIN planes_pendientes p ON p.plan_id = pp.id
  CROSS JOIN LATERAL jsonb_each_text(to_jsonb(pp)) e
  WHERE e.key ~ '^estatus_([1-9]|1[0-8])$'
    AND e.value IS NOT NULL
  UNION ALL
  SELECT d.plan_id, d.estatus
  FROM public.planes_pago_detalles d
  JOIN planes_pendientes p ON p.plan_id = d.plan_id
  WHERE d.estatus IS NOT NULL
), recibos_pendientes AS (
  SELECT p.plan_id, p.alumno_id, r.id AS recibo_id, r.folio,
    r.estatus, r.requiere_factura, r.estatus_factura, r.folio_fiscal
  FROM planes_pendientes p
  JOIN public.recibos r ON r.alumno_id = p.alumno_id
    AND r.ciclo_id = p.ciclo_id
)
SELECT r.alumno_id, r.plan_id, r.folio,
  r.estatus AS estatus_recibo, r.requiere_factura, r.estatus_factura,
  EXISTS (
    SELECT 1 FROM public.recibos_detalles d
    WHERE d.recibo_id = r.recibo_id
      AND d.indice_concepto_plan BETWEEN 1 AND 18
  ) AS tiene_detalle_vinculado,
  EXISTS (
    SELECT 1 FROM public.recibos_detalles d
    WHERE d.recibo_id = r.recibo_id
      AND d.concepto ILIKE '%(Plan Cuatrimestral - 2027-1)%'
  ) AS concepto_menciona_plan,
  EXISTS (
    SELECT 1 FROM referencias_plan ref
    WHERE ref.plan_id = r.plan_id
      AND ref.estatus ~* (
        '(^|[^[:alnum:]])R-' || r.folio::text || '([^0-9]|$)'
      )
  ) AS folio_recibo_en_estatus_plan,
  EXISTS (
    SELECT 1 FROM referencias_plan ref
    WHERE ref.plan_id = r.plan_id
      AND nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
      AND position(('F-' || r.folio_fiscal) in ref.estatus) > 0
  ) AS folio_fiscal_en_estatus_plan
FROM recibos_pendientes r
ORDER BY r.alumno_id, r.folio;
