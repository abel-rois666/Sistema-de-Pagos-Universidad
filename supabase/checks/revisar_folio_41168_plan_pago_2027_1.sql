-- SOLO LECTURA. El folio 41168 tiene dos detalles sin índice de plan.
-- Compara cada concepto (sin el sufijo automático histórico) con las 18
-- posiciones del único plan del alumno y muestra si la coincidencia es única.
-- No asigna índices, no mueve plan ni recibo y no modifica estatus de pagos.
WITH plan AS (
  SELECT pp.* FROM public.planes_pago pp
  WHERE pp.id = '7d943567-dcf1-4701-9c0e-d470a7ef9b78'::uuid
    AND pp.alumno_id = 'db303bcc-2077-48dd-a243-8eb5a0da12e8'::uuid
), detalle AS (
  SELECT rd.id, rd.concepto,
    trim(regexp_replace(rd.concepto,
      '\s*\(Plan Semestral - 2027-1\)\s*$', '', 'i')) AS concepto_base
  FROM public.recibos r
  JOIN public.recibos_detalles rd ON rd.recibo_id = r.id
  JOIN plan pp ON pp.alumno_id = r.alumno_id AND pp.ciclo_id = r.ciclo_id
  WHERE r.folio = 41168 AND rd.indice_concepto_plan IS NULL
)
SELECT d.id AS detalle_recibo_id, d.concepto AS concepto_historico,
  d.concepto_base,
  coincidencias.indices_del_plan, coincidencias.estatus_en_plan,
  coincidencias.numero_de_coincidencias
FROM detalle d
CROSS JOIN plan pp
LEFT JOIN LATERAL (
  SELECT array_agg(concepto.indice ORDER BY concepto.indice) AS indices_del_plan,
    string_agg(concepto.estatus, ', ' ORDER BY concepto.indice) AS estatus_en_plan,
    count(*) AS numero_de_coincidencias
  FROM (
    SELECT i AS indice,
      coalesce(pd.concepto, to_jsonb(pp) ->> ('concepto_' || i::text)) AS nombre,
      coalesce(pd.estatus, to_jsonb(pp) ->> ('estatus_' || i::text)) AS estatus
    FROM generate_series(1, 18) AS i
    LEFT JOIN LATERAL (
      SELECT p.concepto, p.estatus
      FROM public.planes_pago_detalles p
      WHERE p.plan_id = pp.id AND p.indice_concepto = i
      ORDER BY p.created_at DESC, p.id DESC LIMIT 1
    ) pd ON true
  ) concepto
  WHERE lower(trim(coalesce(concepto.nombre, ''))) = lower(d.concepto_base)
) coincidencias ON true
ORDER BY d.id;
