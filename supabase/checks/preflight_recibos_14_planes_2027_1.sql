-- SOLO LECTURA. Revisa los recibos de los 14 planes registrados como
-- Semestrales cuyo grupo y programa vigentes son Cuatrimestrales.
-- El índice de concepto NO es una FK al plan: compara los textos antes de
-- atribuir un recibo al plan. Un recibo sin índice puede ser independiente.
-- La salida no contiene nombre, matrícula ni importes. Revisar conceptos
-- antes de compartir si alguno contiene datos personales capturados a mano.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), candidatos AS (
  SELECT pp.*
  FROM public.planes_pago pp
  CROSS JOIN parametros p
  WHERE pp.ciclo_id = p.origen_id
    AND lower(trim(coalesce(pp.tipo_plan, ''))) = 'semestral'
    AND EXISTS (
      SELECT 1
      FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = p.destino_id
      JOIN public.planes_estudio pe ON pe.id = g.plan_id
      WHERE ag.alumno_id = pp.alumno_id
        AND lower(trim(pe.tipo_periodo)) = 'cuatrimestral'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.planes_pago otro
      WHERE otro.alumno_id = pp.alumno_id
        AND otro.ciclo_id IN (p.origen_id, p.destino_id)
        AND otro.id <> pp.id
    )
)
SELECT pp.id AS plan_pago_id, pp.alumno_id,
  r.folio, r.estatus AS estatus_recibo,
  r.requiere_factura, r.estatus_factura,
  nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL AS tiene_folio_fiscal,
  rd.id AS detalle_recibo_id, rd.indice_concepto_plan,
  rd.concepto AS concepto_del_recibo,
  coalesce(pd.concepto,
    to_jsonb(pp) ->> ('concepto_' || rd.indice_concepto_plan::text))
    AS concepto_del_plan_mismo_indice,
  CASE
    WHEN rd.id IS NULL THEN 'SIN DETALLE: REVISAR'
    WHEN rd.indice_concepto_plan IS NULL THEN 'SIN ÍNDICE: NO ATRIBUIR AUTOMÁTICAMENTE'
    WHEN lower(trim(coalesce(rd.concepto, ''))) IN (
      lower(trim(coalesce(pd.concepto,
        to_jsonb(pp) ->> ('concepto_' || rd.indice_concepto_plan::text), ''))),
      lower(trim(coalesce(pd.concepto,
        to_jsonb(pp) ->> ('concepto_' || rd.indice_concepto_plan::text), '')))
        || ' (plan semestral - 2027-1)'
    ) THEN 'MISMO CONCEPTO E ÍNDICE; SUFIJO HISTÓRICO ADMITIDO'
    ELSE 'CONCEPTO DISTINTO O VACÍO: REVISAR'
  END AS comparacion
FROM candidatos pp
LEFT JOIN public.recibos r ON r.alumno_id = pp.alumno_id
  AND r.ciclo_id = pp.ciclo_id
LEFT JOIN public.recibos_detalles rd ON rd.recibo_id = r.id
LEFT JOIN LATERAL (
  SELECT d.concepto
  FROM public.planes_pago_detalles d
  WHERE d.plan_id = pp.id
    AND d.indice_concepto = rd.indice_concepto_plan
  ORDER BY d.created_at DESC, d.id DESC
  LIMIT 1
) pd ON true
ORDER BY pp.id, r.folio, rd.id;
