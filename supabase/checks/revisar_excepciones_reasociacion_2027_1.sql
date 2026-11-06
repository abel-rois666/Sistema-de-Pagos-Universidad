-- Solo lectura. Enumera los alumnos excluidos por recibos ambiguos.
-- Muestra IDs y folios para revisar los casos; no muestra datos fiscales.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), candidatos AS (
  SELECT pp.id AS plan_id, pp.alumno_id, p.origen_id
  FROM public.planes_pago pp
  CROSS JOIN parametros p
  WHERE pp.ciclo_id = p.origen_id
    AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
    AND EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = p.destino_id
    )
), recibos AS (
  SELECT c.plan_id, c.alumno_id, r.folio,
    r.estatus IS DISTINCT FROM 'ACTIVO' AS no_activo,
    (r.requiere_factura IS TRUE
      OR upper(trim(coalesce(r.estatus_factura, 'NO APLICA')))
        NOT IN ('NO APLICA', '')
      OR nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
    ) AS situacion_factura,
    NOT EXISTS (
      SELECT 1 FROM public.recibos_detalles rd
      WHERE rd.recibo_id = r.id AND rd.indice_concepto_plan BETWEEN 1 AND 18
    ) AS sin_detalle_vinculado,
    EXISTS (
      SELECT 1 FROM public.recibos_detalles rd
      WHERE rd.recibo_id = r.id
        AND (rd.indice_concepto_plan IS NULL
          OR rd.indice_concepto_plan NOT BETWEEN 1 AND 18)
    ) AS detalle_mixto_o_invalido
  FROM candidatos c
  JOIN public.recibos r ON r.alumno_id = c.alumno_id
    AND r.ciclo_id = c.origen_id
)
SELECT alumno_id, plan_id,
  array_agg(folio ORDER BY folio) AS folios_a_revisar,
  count(*) FILTER (WHERE no_activo) AS recibos_no_activos,
  count(*) FILTER (WHERE situacion_factura) AS recibos_con_factura_o_solicitud,
  count(*) FILTER (WHERE sin_detalle_vinculado) AS recibos_sin_vinculo,
  count(*) FILTER (WHERE detalle_mixto_o_invalido) AS recibos_con_detalle_mixto
FROM recibos
GROUP BY alumno_id, plan_id
HAVING bool_or(no_activo OR situacion_factura OR sin_detalle_vinculado
  OR detalle_mixto_o_invalido)
ORDER BY alumno_id, plan_id;
