-- SOLO LECTURA. Ejecutar en Supabase SQL Editor y compartir el resultado.
-- Revisa los planes de pago con nombre de ciclo 2027-1 que siguen ligados al
-- ID Semestral para alumnos inscritos en grupos del ID Cuatrimestral.
-- No se decide una corrección a partir de tipo_plan solamente: se cruza con
-- el plan académico del grupo, el programa del alumno y sus recibos.
-- La salida no contiene nombres, matrículas, importes ni conceptos.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), alumnos_destino AS (
  SELECT DISTINCT ag.alumno_id
  FROM parametros p
  JOIN public.grupos g ON g.ciclo_id = p.destino_id
  JOIN public.alumnos_grupos ag ON ag.grupo_id = g.id
), candidatos AS (
  SELECT pp.id, pp.alumno_id, pp.ciclo_id, pp.tipo_plan,
    pp.licenciatura, pp.grado, pp.turno
  FROM parametros p
  JOIN public.planes_pago pp ON pp.ciclo_id = p.origen_id
  JOIN alumnos_destino ad ON ad.alumno_id = pp.alumno_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.planes_pago otro
    WHERE otro.alumno_id = pp.alumno_id AND otro.ciclo_id = p.destino_id
      AND lower(trim(coalesce(otro.tipo_plan, ''))) NOT IN ('titulación', 'titulacion')
  )
)
SELECT c.id AS plan_pago_id, c.alumno_id,
  c.tipo_plan AS tipo_plan_pago,
  coalesce(nullif(trim(c.licenciatura), ''), '(sin dato)') AS licenciatura_en_pago,
  c.grado AS grado_en_pago, c.turno AS turno_en_pago,
  grupos_destino.grupos AS grupos_cuatrimestrales,
  grupos_destino.planes AS planes_academicos_del_grupo,
  grupos_destino.tipos AS periodicidad_del_plan_academico,
  grupos_destino.turnos AS turnos_del_grupo,
  programas.programas_vigentes,
  programas.tipos_programa_vigente,
  grupos_origen.grupos_semestrales,
  otros.planes_pago_origen, otros.planes_pago_destino,
  recibos.total AS recibos_en_origen,
  recibos.no_activos AS recibos_no_activos,
  recibos.con_factura_o_solicitud AS recibos_con_factura_o_solicitud,
  recibos.con_detalle_vinculado AS recibos_con_detalle_vinculado,
  recibos.con_detalle_sin_indice AS recibos_con_detalle_sin_indice,
  CASE
    WHEN lower(trim(coalesce(c.tipo_plan, ''))) IN ('titulación', 'titulacion')
      THEN 'TITULACIÓN: FUERA DE COMUNICADOS; REVISAR POR SEPARADO'
    WHEN lower(grupos_destino.tipos) = 'cuatrimestral'
      AND lower(programas.tipos_programa_vigente) = 'cuatrimestral'
      AND grupos_origen.grupos_semestrales IS NULL
      THEN 'POSIBLE ERROR DE TIPO E ID; REVISAR RECIBOS Y FICHA'
    WHEN lower(grupos_destino.tipos) LIKE '%semestral%'
      THEN 'REVISAR PERIODICIDAD DEL PLAN ACADÉMICO'
    ELSE 'ASOCIACIÓN AMBIGUA; REVISIÓN INDIVIDUAL'
  END AS orientacion_no_concluyente
FROM candidatos c
CROSS JOIN parametros p
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT g.codigo_grupo::text, ', ' ORDER BY g.codigo_grupo::text) AS grupos,
    string_agg(DISTINCT pe.clave_legado || ' (' || pe.nombre || ')', ', ') AS planes,
    string_agg(DISTINCT coalesce(pe.tipo_periodo, '(sin tipo)'), ', ') AS tipos,
    string_agg(DISTINCT coalesce(g.turno, '(sin turno)'), ', ') AS turnos
  FROM public.alumnos_grupos ag
  JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = p.destino_id
  JOIN public.planes_estudio pe ON pe.id = g.plan_id
  WHERE ag.alumno_id = c.alumno_id
) grupos_destino ON true
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT pe.clave_legado || ' (' ||
    coalesce(pe.tipo_periodo, '(sin tipo)') || ', ' ||
    coalesce(ap.estatus, '(sin estatus)') || ')', ', ') AS programas_vigentes,
    string_agg(DISTINCT pe.tipo_periodo, ', ' ORDER BY pe.tipo_periodo)
      AS tipos_programa_vigente
  FROM public.alumno_programas ap
  JOIN public.planes_estudio pe ON pe.id = ap.plan_id
  WHERE ap.alumno_id = c.alumno_id AND ap.es_vigente = true
) programas ON true
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT g.codigo_grupo::text || ' (' ||
    coalesce(pe.tipo_periodo, '(sin tipo)') || ')', ', ') AS grupos_semestrales
  FROM public.alumnos_grupos ag
  JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = p.origen_id
  JOIN public.planes_estudio pe ON pe.id = g.plan_id
  WHERE ag.alumno_id = c.alumno_id
) grupos_origen ON true
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE pp.ciclo_id = p.origen_id) AS planes_pago_origen,
    count(*) FILTER (WHERE pp.ciclo_id = p.destino_id) AS planes_pago_destino
  FROM public.planes_pago pp
  WHERE pp.alumno_id = c.alumno_id
    AND pp.ciclo_id IN (p.origen_id, p.destino_id)
) otros ON true
LEFT JOIN LATERAL (
  SELECT count(DISTINCT r.id) AS total,
    count(DISTINCT r.id) FILTER (WHERE upper(coalesce(r.estatus, '')) <> 'ACTIVO') AS no_activos,
    count(DISTINCT r.id) FILTER (WHERE coalesce(r.requiere_factura, false)
      OR nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
      OR upper(trim(coalesce(r.estatus_factura, ''))) NOT IN ('', 'NO APLICA'))
      AS con_factura_o_solicitud,
    count(DISTINCT r.id) FILTER (WHERE rd.indice_concepto_plan IS NOT NULL)
      AS con_detalle_vinculado,
    count(DISTINCT r.id) FILTER (WHERE rd.id IS NOT NULL
      AND rd.indice_concepto_plan IS NULL) AS con_detalle_sin_indice
  FROM public.recibos r
  LEFT JOIN public.recibos_detalles rd ON rd.recibo_id = r.id
  WHERE r.alumno_id = c.alumno_id AND r.ciclo_id = p.origen_id
) recibos ON true
ORDER BY CASE lower(trim(coalesce(c.tipo_plan, '')))
  WHEN 'cuatrimestral' THEN 1 WHEN 'semestral' THEN 2 ELSE 3 END,
  c.id;
