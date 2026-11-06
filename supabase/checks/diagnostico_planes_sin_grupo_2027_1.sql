-- SOLO LECTURA. Complementa la auditoría general: planes sin grupo en el
-- ciclo guardado, cuyo tipo no coincide con ese ciclo o con el programa
-- vigente. No mover por nombre, especialidad ni programa sin revisar la ficha.
-- Titulación se excluye porque es un trámite independiente.
WITH ciclos AS (
  SELECT c.id, c.tipo_periodo
  FROM public.ciclos_escolares c
  WHERE c.id IN (
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
  )
), candidatos AS (
  SELECT pp.*, c.tipo_periodo AS tipo_ciclo,
    programas.programas_vigentes,
    programas.tipos_programa_vigente
  FROM public.planes_pago pp
  JOIN ciclos c ON c.id = pp.ciclo_id
  LEFT JOIN LATERAL (
    SELECT string_agg(DISTINCT pe.clave_legado || ' (' ||
      coalesce(pe.tipo_periodo, '(sin tipo)') || ', ' ||
      coalesce(ap.estatus, '(sin estatus)') || ')', ', ') AS programas_vigentes,
      string_agg(DISTINCT pe.tipo_periodo, ', ' ORDER BY pe.tipo_periodo)
        AS tipos_programa_vigente
    FROM public.alumno_programas ap
    JOIN public.planes_estudio pe ON pe.id = ap.plan_id
    WHERE ap.alumno_id = pp.alumno_id AND ap.es_vigente = true
  ) programas ON true
  WHERE lower(trim(coalesce(pp.tipo_plan, ''))) NOT IN ('titulación', 'titulacion')
    AND NOT EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = c.id
    )
)
SELECT pp.id AS plan_pago_id, pp.alumno_id,
  pp.tipo_plan, pp.tipo_ciclo, pp.licenciatura,
  pp.grado, pp.turno, pp.fecha_plan,
  pp.programas_vigentes, pp.tipos_programa_vigente,
  grupos_homonimos.grupos AS grupos_en_otro_ciclo_2027_1,
  otros.planes_en_otro_ciclo_2027_1,
  recibos.total AS recibos_en_ciclo_del_plan,
  recibos.no_activos AS recibos_no_activos,
  recibos.con_factura_o_solicitud AS recibos_con_factura_o_solicitud,
  recibos.con_indice AS recibos_con_indice_de_plan,
  recibos.sin_indice AS recibos_con_detalle_sin_indice
FROM candidatos pp
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT g.codigo_grupo::text || ' (' ||
    coalesce(pe.tipo_periodo, '(sin tipo)') || ')', ', ') AS grupos
  FROM public.alumnos_grupos ag
  JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id <> pp.ciclo_id
  JOIN ciclos c ON c.id = g.ciclo_id
  JOIN public.planes_estudio pe ON pe.id = g.plan_id
  WHERE ag.alumno_id = pp.alumno_id
) grupos_homonimos ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS planes_en_otro_ciclo_2027_1
  FROM public.planes_pago otro
  JOIN ciclos c ON c.id = otro.ciclo_id
  WHERE otro.alumno_id = pp.alumno_id AND otro.ciclo_id <> pp.ciclo_id
) otros ON true
LEFT JOIN LATERAL (
  SELECT count(DISTINCT r.id) AS total,
    count(DISTINCT r.id) FILTER (WHERE upper(coalesce(r.estatus, '')) <> 'ACTIVO') AS no_activos,
    count(DISTINCT r.id) FILTER (WHERE coalesce(r.requiere_factura, false)
      OR nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
      OR upper(trim(coalesce(r.estatus_factura, ''))) NOT IN ('', 'NO APLICA'))
      AS con_factura_o_solicitud,
    count(DISTINCT r.id) FILTER (WHERE rd.indice_concepto_plan IS NOT NULL) AS con_indice,
    count(DISTINCT r.id) FILTER (WHERE rd.id IS NOT NULL
      AND rd.indice_concepto_plan IS NULL) AS sin_indice
  FROM public.recibos r
  LEFT JOIN public.recibos_detalles rd ON rd.recibo_id = r.id
  WHERE r.alumno_id = pp.alumno_id AND r.ciclo_id = pp.ciclo_id
) recibos ON true
WHERE lower(trim(coalesce(pp.tipo_plan, ''))) LIKE '%cuatrimestral%'
  AND lower(trim(coalesce(pp.tipo_ciclo, ''))) <> 'cuatrimestral'
  OR lower(trim(coalesce(pp.tipo_plan, ''))) LIKE '%semestral%'
  AND lower(trim(coalesce(pp.tipo_ciclo, ''))) <> 'semestral'
  OR pp.tipos_programa_vigente IS NULL
  OR (lower(trim(coalesce(pp.tipo_plan, ''))) IN ('cuatrimestral', 'semestral')
    AND lower(trim(pp.tipo_plan)) <> lower(trim(coalesce(pp.tipos_programa_vigente, ''))))
ORDER BY pp.tipo_ciclo, pp.tipo_plan, pp.id;
