-- Solo lectura. No modifica planes, recibos ni otros datos.
-- Evalúa únicamente planes Cuatrimestrales guardados en el ID Semestral
-- de 2027-1 cuyos alumnos aparecen en grupos del 2027-1 Cuatrimestral.
WITH parametros AS (
  SELECT origen.id AS ciclo_origen_id, destino.id AS ciclo_destino_id
  FROM public.ciclos_escolares origen
  JOIN public.ciclos_escolares destino ON destino.nombre = origen.nombre
  WHERE origen.id = '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid
    AND destino.id = '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
    AND lower(origen.tipo_periodo) = 'semestral'
    AND lower(destino.tipo_periodo) = 'cuatrimestral'
), candidatos AS (
  SELECT pp.id, pp.alumno_id, p.ciclo_origen_id, p.ciclo_destino_id
  FROM public.planes_pago pp
  CROSS JOIN parametros p
  WHERE pp.ciclo_id = p.ciclo_origen_id
    AND pp.tipo_plan = 'Cuatrimestral'
    AND EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = p.ciclo_destino_id
    )
), riesgos AS (
  SELECT c.id, c.alumno_id,
    EXISTS (
      SELECT 1 FROM public.planes_pago otro
      WHERE otro.alumno_id = c.alumno_id AND otro.ciclo_id = c.ciclo_destino_id
    ) AS ya_tiene_plan_destino,
    EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = c.alumno_id AND g.ciclo_id = c.ciclo_origen_id
    ) AS tambien_en_grupo_semestral,
    (SELECT count(*) FROM candidatos otro WHERE otro.alumno_id = c.alumno_id) > 1
      AS varios_planes_candidatos,
    (SELECT count(*) FROM public.recibos r
      WHERE r.alumno_id = c.alumno_id AND r.ciclo_id = c.ciclo_origen_id
        AND r.estatus = 'ACTIVO') AS recibos_activos_origen,
    (SELECT count(*) FROM public.recibos r
      WHERE r.alumno_id = c.alumno_id AND r.ciclo_id = c.ciclo_destino_id
        AND r.estatus = 'ACTIVO') AS recibos_activos_destino
  FROM candidatos c
)
SELECT count(*) AS planes_candidatos,
  count(DISTINCT alumno_id) AS alumnos_candidatos,
  count(*) FILTER (WHERE ya_tiene_plan_destino) AS con_plan_en_destino,
  count(*) FILTER (WHERE tambien_en_grupo_semestral) AS tambien_en_grupo_semestral,
  count(*) FILTER (WHERE varios_planes_candidatos) AS con_varios_planes_candidatos,
  count(*) FILTER (WHERE recibos_activos_origen > 0) AS con_recibos_en_origen,
  coalesce(sum(recibos_activos_origen), 0) AS recibos_activos_origen,
  count(*) FILTER (WHERE recibos_activos_destino > 0) AS con_recibos_en_destino,
  coalesce(sum(recibos_activos_destino), 0) AS recibos_activos_destino
FROM riesgos;
