-- Solo lectura. Reproduce los alumnos del ciclo Cuatrimestral 2027-1 que no
-- tienen ningún plan de pagos con el ID exacto seleccionado, pero sí un plan
-- en otro ciclo de nombre 2027-1. tipo_plan es una etiqueta y NO demuestra
-- la periodicidad académica: cruza los casos con el plan y grupo mediante
-- diagnostico_periodicidad_planes_pago_2027_1.sql. Titulación se
-- excluye por completo de Comunicados y de este diagnóstico.
-- Los conteos por fila pueden compartir alumno si tiene varios planes.
WITH destino AS (
  SELECT c.id, c.nombre
  FROM public.ciclos_escolares c
  WHERE c.id = '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
    AND c.nombre = '2027-1'
    AND lower(trim(c.tipo_periodo)) = 'cuatrimestral'
), alumnos_del_ciclo AS (
  SELECT DISTINCT ag.alumno_id
  FROM destino d
  JOIN public.grupos g ON g.ciclo_id = d.id
  JOIN public.alumnos_grupos ag ON ag.grupo_id = g.id
), homonimos_sin_plan_destino AS (
  SELECT pp.id AS plan_id, pp.alumno_id, pp.tipo_plan,
    cp.tipo_periodo AS tipo_ciclo_del_plan
  FROM alumnos_del_ciclo a
  JOIN public.planes_pago pp ON pp.alumno_id = a.alumno_id
  JOIN public.ciclos_escolares cp ON cp.id = pp.ciclo_id
  CROSS JOIN destino d
  WHERE pp.ciclo_id <> d.id AND cp.nombre = d.nombre
    AND lower(trim(coalesce(pp.tipo_plan, ''))) NOT IN ('titulación', 'titulacion')
    AND NOT EXISTS (
      SELECT 1 FROM public.planes_pago exacto
      WHERE exacto.alumno_id = a.alumno_id AND exacto.ciclo_id = d.id
    )
)
SELECT CASE
    WHEN nullif(trim(coalesce(h.tipo_plan, '')), '') IS NULL
      OR lower(trim(h.tipo_plan)) LIKE '%cuatrimestral%'
      THEN 'REVISAR ASOCIACIÓN DEL PLAN CUATRIMESTRAL'
    ELSE 'TIPO REGISTRADO DISTINTO; PERIODICIDAD ACADÉMICA POR COMPROBAR'
  END AS clasificacion,
  h.tipo_plan, h.tipo_ciclo_del_plan,
  count(DISTINCT h.plan_id) AS planes,
  count(DISTINCT h.alumno_id) AS alumnos
FROM homonimos_sin_plan_destino h
GROUP BY clasificacion, h.tipo_plan, h.tipo_ciclo_del_plan
ORDER BY clasificacion, h.tipo_plan, h.tipo_ciclo_del_plan;
