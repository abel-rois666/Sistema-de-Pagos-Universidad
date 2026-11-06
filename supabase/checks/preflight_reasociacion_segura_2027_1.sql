-- Solo lectura. Ejecutar antes de la corrección por etapas de 2027-1.
-- No muestra nombres ni datos fiscales. Un alumno con cualquier recibo ambiguo
-- queda fuera por completo, incluido su plan de pago.
WITH parametros AS (
  SELECT origen.id AS origen_id, destino.id AS destino_id
  FROM public.ciclos_escolares origen
  JOIN public.ciclos_escolares destino ON destino.nombre = origen.nombre
  WHERE origen.id = '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid
    AND destino.id = '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
    AND origen.nombre = '2027-1'
    AND lower(trim(origen.tipo_periodo)) = 'semestral'
    AND lower(trim(destino.tipo_periodo)) = 'cuatrimestral'
), candidatos AS (
  SELECT pp.id AS plan_id, pp.alumno_id, p.origen_id, p.destino_id
  FROM public.planes_pago pp
  CROSS JOIN parametros p
  WHERE pp.ciclo_id = p.origen_id
    AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
    AND EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = p.destino_id
    )
), clasificacion AS (
  SELECT c.plan_id, c.alumno_id,
    EXISTS (
      SELECT 1 FROM candidatos otro
      WHERE otro.alumno_id = c.alumno_id AND otro.plan_id <> c.plan_id
    ) AS varios_candidatos,
    EXISTS (
      SELECT 1 FROM public.planes_pago otro
      WHERE otro.alumno_id = c.alumno_id
        AND otro.ciclo_id IN (c.origen_id, c.destino_id)
        AND otro.id <> c.plan_id
    ) AS otro_plan_origen_o_destino,
    EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = c.alumno_id AND g.ciclo_id = c.origen_id
    ) AS grupo_origen,
    EXISTS (
      SELECT 1 FROM public.recibos r
      WHERE r.alumno_id = c.alumno_id AND r.ciclo_id = c.destino_id
    ) AS recibos_destino,
    (SELECT count(*) FROM public.recibos r
      WHERE r.alumno_id = c.alumno_id AND r.ciclo_id = c.origen_id
    ) AS recibos_origen,
    EXISTS (
      SELECT 1 FROM public.recibos r
      WHERE r.alumno_id = c.alumno_id AND r.ciclo_id = c.origen_id
        AND (r.estatus IS DISTINCT FROM 'ACTIVO'
          OR r.requiere_factura IS TRUE
          OR upper(trim(coalesce(r.estatus_factura, 'NO APLICA')))
            NOT IN ('NO APLICA', '')
          OR nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.recibos_detalles rd
            WHERE rd.recibo_id = r.id
              AND rd.indice_concepto_plan BETWEEN 1 AND 18
          )
          OR EXISTS (
            SELECT 1 FROM public.recibos_detalles rd
            WHERE rd.recibo_id = r.id
              AND (rd.indice_concepto_plan IS NULL
                OR rd.indice_concepto_plan NOT BETWEEN 1 AND 18)
          ))
    ) AS recibos_ambiguos
  FROM candidatos c
)
SELECT count(*) AS planes_candidatos,
  count(*) FILTER (WHERE varios_candidatos) AS con_varios_candidatos,
  count(*) FILTER (WHERE otro_plan_origen_o_destino) AS con_otro_plan,
  count(*) FILTER (WHERE grupo_origen) AS con_grupo_semestral,
  count(*) FILTER (WHERE recibos_destino) AS con_recibos_destino,
  count(*) FILTER (WHERE recibos_ambiguos) AS con_recibos_ambiguos,
  count(*) FILTER (WHERE NOT (
    varios_candidatos OR otro_plan_origen_o_destino OR grupo_origen
    OR recibos_destino OR recibos_ambiguos
  )) AS planes_reasociables,
  coalesce(sum(recibos_origen) FILTER (WHERE NOT (
    varios_candidatos OR otro_plan_origen_o_destino OR grupo_origen
    OR recibos_destino OR recibos_ambiguos
  )), 0) AS recibos_reasociables,
  count(*) FILTER (WHERE
    varios_candidatos OR otro_plan_origen_o_destino OR grupo_origen
    OR recibos_destino OR recibos_ambiguos
  ) AS alumnos_para_revision
FROM clasificacion;
