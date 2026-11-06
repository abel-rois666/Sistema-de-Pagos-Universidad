-- Solo lectura. Ejecutar después de la corrección de los casos claros.
-- Los conteos generales de recibos incluyen a todos los alumnos de grupos
-- Cuatrimestrales, aunque su plan sea Semestral o de Titulación. Las dos
-- columnas nuevas separan los recibos de los planes aún pendientes.
-- Tras la segunda etapa, "planes_destino_con_recibos_en_origen" debe ser 10:
-- esos alumnos conservaron recibos de trámites independientes en origen.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), alumnos_cuatrimestrales AS (
  SELECT DISTINCT ag.alumno_id
  FROM public.alumnos_grupos ag
  JOIN public.grupos g ON g.id = ag.grupo_id
  CROSS JOIN parametros p
  WHERE g.ciclo_id = p.destino_id
), planes AS (
  SELECT pp.id, pp.alumno_id, pp.ciclo_id
  FROM public.planes_pago pp
  JOIN alumnos_cuatrimestrales a ON a.alumno_id = pp.alumno_id
  CROSS JOIN parametros p
  WHERE pp.ciclo_id IN (p.origen_id, p.destino_id)
    AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
), recibos AS (
  SELECT r.id, r.alumno_id, r.ciclo_id
  FROM public.recibos r
  JOIN alumnos_cuatrimestrales a ON a.alumno_id = r.alumno_id
  CROSS JOIN parametros p
  WHERE r.ciclo_id IN (p.origen_id, p.destino_id)
)
SELECT
  count(DISTINCT planes.id) FILTER (WHERE planes.ciclo_id = p.origen_id)
    AS planes_cuatrimestrales_aun_en_origen,
  count(DISTINCT planes.id) FILTER (WHERE planes.ciclo_id = p.destino_id)
    AS planes_cuatrimestrales_en_destino,
  (SELECT count(*) FROM recibos r WHERE r.ciclo_id = p.origen_id)
    AS recibos_aun_en_origen,
  (SELECT count(*) FROM recibos r WHERE r.ciclo_id = p.destino_id)
    AS recibos_en_destino,
  (SELECT count(*) FROM recibos r
    WHERE r.ciclo_id = p.origen_id
      AND EXISTS (SELECT 1 FROM planes pp
        WHERE pp.alumno_id = r.alumno_id AND pp.ciclo_id = p.origen_id)
  ) AS recibos_de_planes_cuatrimestrales_pendientes,
  (SELECT count(*) FROM recibos r
    WHERE r.ciclo_id = p.origen_id
      AND NOT EXISTS (SELECT 1 FROM planes pp
        WHERE pp.alumno_id = r.alumno_id AND pp.ciclo_id = p.origen_id)
  ) AS recibos_de_otros_casos_en_origen,
  count(DISTINCT planes.id) FILTER (
    WHERE planes.ciclo_id = p.destino_id
      AND EXISTS (SELECT 1 FROM recibos r
        WHERE r.alumno_id = planes.alumno_id AND r.ciclo_id = p.origen_id)
  ) AS planes_destino_con_recibos_en_origen,
  count(DISTINCT planes.id) FILTER (
    WHERE planes.ciclo_id = p.origen_id
      AND EXISTS (SELECT 1 FROM recibos r
        WHERE r.alumno_id = planes.alumno_id AND r.ciclo_id = p.destino_id)
  ) AS planes_origen_con_recibos_en_destino
FROM parametros p
LEFT JOIN planes ON true
GROUP BY p.origen_id, p.destino_id;
