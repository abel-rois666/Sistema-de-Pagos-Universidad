-- Solo lectura. Examina los recibos de los 216 posibles planes Cuatrimestrales
-- de 2027-1 asociados al ID Semestral. No atribuye un recibo a un plan específico.
WITH parametros AS (
  SELECT origen.id AS ciclo_origen_id, destino.id AS ciclo_destino_id
  FROM public.ciclos_escolares origen
  JOIN public.ciclos_escolares destino ON destino.nombre = origen.nombre
  WHERE origen.id = '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid
    AND destino.id = '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
    AND lower(origen.tipo_periodo) = 'semestral'
    AND lower(destino.tipo_periodo) = 'cuatrimestral'
), candidatos AS (
  SELECT pp.id, pp.alumno_id, p.ciclo_origen_id
  FROM public.planes_pago pp
  CROSS JOIN parametros p
  WHERE pp.ciclo_id = p.ciclo_origen_id
    AND pp.tipo_plan = 'Cuatrimestral'
    AND EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = p.ciclo_destino_id
    )
), recibos_candidatos AS (
  SELECT r.id, r.estatus, r.estatus_factura, r.folio_fiscal,
    EXISTS (
      SELECT 1 FROM public.recibos_detalles rd
      WHERE rd.recibo_id = r.id AND rd.indice_concepto_plan IS NOT NULL
    ) AS tiene_detalle_vinculado,
    EXISTS (
      SELECT 1 FROM public.planes_pago otro
      WHERE otro.alumno_id = c.alumno_id AND otro.ciclo_id = c.ciclo_origen_id
        AND otro.id <> c.id
    ) AS otro_plan_en_origen
  FROM candidatos c
  JOIN public.recibos r ON r.alumno_id = c.alumno_id
    AND r.ciclo_id = c.ciclo_origen_id
)
SELECT (SELECT count(*) FROM candidatos) AS planes_candidatos,
  (SELECT count(*) FROM candidatos c WHERE EXISTS (
    SELECT 1 FROM public.planes_pago otro
    WHERE otro.alumno_id = c.alumno_id AND otro.ciclo_id = c.ciclo_origen_id
      AND otro.id <> c.id
  )) AS alumnos_con_otro_plan_en_origen,
  count(*) AS recibos_total_origen,
  count(*) FILTER (WHERE estatus = 'ACTIVO') AS recibos_activos,
  count(*) FILTER (WHERE estatus = 'CANCELADO') AS recibos_cancelados,
  count(*) FILTER (WHERE estatus_factura = 'FACTURADO' OR folio_fiscal IS NOT NULL)
    AS recibos_facturados,
  count(*) FILTER (WHERE tiene_detalle_vinculado) AS recibos_con_detalle_vinculado,
  count(*) FILTER (WHERE NOT tiene_detalle_vinculado) AS recibos_sin_detalle_vinculado,
  count(*) FILTER (WHERE otro_plan_en_origen) AS recibos_con_otro_plan_en_origen
FROM recibos_candidatos;
