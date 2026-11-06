-- SOLO LECTURA. Audita TODOS los planes de pago asociados a los dos IDs
-- homónimos de 2027-1, incluidos los ya corregidos. No se debe inferir
-- periodicidad académica únicamente de planes_pago.tipo_plan.
-- Ejecutar por separado del diagnóstico individual y compartir el resultado.
WITH ciclos AS (
  SELECT c.id, c.nombre, c.tipo_periodo
  FROM public.ciclos_escolares c
  WHERE c.id IN (
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
  )
), planes AS (
  SELECT pp.id, pp.alumno_id, pp.tipo_plan,
    c.id AS ciclo_id, c.tipo_periodo AS tipo_ciclo,
    academico.periodos_en_ciclo,
    academico.periodos_en_ciclo_homonimo,
    programas.periodos_programa_vigente
  FROM public.planes_pago pp
  JOIN ciclos c ON c.id = pp.ciclo_id
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT pe.tipo_periodo, ', ' ORDER BY pe.tipo_periodo)
      FILTER (WHERE g.ciclo_id = c.id) AS periodos_en_ciclo,
      string_agg(DISTINCT pe.tipo_periodo, ', ' ORDER BY pe.tipo_periodo)
      FILTER (WHERE g.ciclo_id <> c.id) AS periodos_en_ciclo_homonimo
    FROM public.alumnos_grupos ag
    JOIN public.grupos g ON g.id = ag.grupo_id
    JOIN public.planes_estudio pe ON pe.id = g.plan_id
    WHERE ag.alumno_id = pp.alumno_id
      AND g.ciclo_id IN (SELECT id FROM ciclos)
  ) academico ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT pe.tipo_periodo, ', ' ORDER BY pe.tipo_periodo)
      AS periodos_programa_vigente
    FROM public.alumno_programas ap
    JOIN public.planes_estudio pe ON pe.id = ap.plan_id
    WHERE ap.alumno_id = pp.alumno_id AND ap.es_vigente = true
  ) programas ON true
)
SELECT tipo_ciclo, coalesce(tipo_plan, '(sin tipo)') AS tipo_plan_pago,
  coalesce(periodos_en_ciclo, '(sin grupo en este ciclo)') AS periodicidad_academica_mismo_ciclo,
  coalesce(periodos_en_ciclo_homonimo, '(sin grupo en el otro ciclo)')
    AS periodicidad_academica_otro_ciclo,
  coalesce(periodos_programa_vigente, '(sin programa vigente)')
    AS periodicidad_programa_vigente,
  count(DISTINCT id) AS planes_pago,
  count(DISTINCT alumno_id) AS alumnos
FROM planes
GROUP BY tipo_ciclo, tipo_plan, periodos_en_ciclo,
  periodos_en_ciclo_homonimo, periodos_programa_vigente
ORDER BY tipo_ciclo, tipo_plan, periodos_en_ciclo,
  periodos_en_ciclo_homonimo, periodos_programa_vigente;
