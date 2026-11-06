-- Diagnóstico de solo lectura. Cambia el nombre y el tipo por el ciclo de entrega.
-- Cuenta planes de alumnos inscritos en grupos de ese ciclo cuyo ID corresponde
-- al ciclo elegido o a otro ciclo con el mismo nombre.
WITH parametro AS (
  SELECT '2027-1'::text AS nombre, 'Cuatrimestral'::text AS tipo_periodo
), ciclo_objetivo AS (
  SELECT c.id, c.nombre, c.tipo_periodo
  FROM public.ciclos_escolares c
  JOIN parametro p ON c.nombre = p.nombre
    AND lower(c.tipo_periodo) = lower(p.tipo_periodo)
), alumnos_del_ciclo AS (
  SELECT DISTINCT c.id AS ciclo_id, ag.alumno_id
  FROM ciclo_objetivo c
  JOIN public.grupos g ON g.ciclo_id = c.id
  JOIN public.alumnos_grupos ag ON ag.grupo_id = g.id
)
SELECT c.id AS ciclo_id_seleccionado,
  c.nombre AS ciclo_seleccionado,
  c.tipo_periodo AS tipo_seleccionado,
  CASE WHEN pp.ciclo_id = c.id THEN 'ID CORRECTO' ELSE 'OTRO ID' END AS asociacion,
  cp.id AS ciclo_id_del_plan,
  cp.tipo_periodo AS tipo_del_ciclo_del_plan,
  pp.tipo_plan,
  count(DISTINCT pp.id) AS planes,
  count(DISTINCT pp.alumno_id) AS alumnos
FROM ciclo_objetivo c
JOIN alumnos_del_ciclo ac ON ac.ciclo_id = c.id
JOIN public.planes_pago pp ON pp.alumno_id = ac.alumno_id
JOIN public.ciclos_escolares cp ON cp.id = pp.ciclo_id AND cp.nombre = c.nombre
GROUP BY c.id, c.nombre, c.tipo_periodo, asociacion, cp.id, cp.tipo_periodo, pp.tipo_plan
ORDER BY asociacion, cp.tipo_periodo, pp.tipo_plan;
