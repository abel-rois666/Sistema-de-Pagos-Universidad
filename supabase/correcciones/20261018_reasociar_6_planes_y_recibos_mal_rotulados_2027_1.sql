-- PREPARADO, NO EJECUTADO. Seis planes de pago registrados como Semestral
-- pertenecen a grupos y programas Cuatrimestrales; cada uno tiene un recibo
-- activo, sin factura y con conceptos del propio plan identificados por índice.
-- Reasocia tipo_plan y ciclo_id del plan, y ciclo_id de esos seis recibos.
-- Conserva íntegros los folios, conceptos históricos, importes y detalles.
-- Requiere respaldo y ejecución completa; cualquier discrepancia revierte todo.

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

CREATE TEMP TABLE correccion_6_planes_recibos (
  plan_id uuid PRIMARY KEY,
  alumno_id uuid NOT NULL UNIQUE,
  folio integer NOT NULL UNIQUE,
  detalles_esperados integer NOT NULL
) ON COMMIT DROP;

INSERT INTO correccion_6_planes_recibos VALUES
  ('19e3c620-998d-46cd-bfd6-0b3f8874c109', '0facd11a-03e6-45e5-af4c-ec96c82ffc40', 41117, 1),
  ('423be973-c1c5-4d68-8902-d30d20d21a07', '37dbf842-5bbb-4c5c-afe4-229b9e4a4e03', 41171, 2),
  ('4cc51d6f-5ef2-4638-8b3a-0ee7a2898c8d', '1ec79e75-d520-4d17-b0b8-f6c001d0ef88', 40446, 1),
  ('550ed26d-51f3-427e-b8fc-051a86e9b155', 'db36a7c8-92ff-4219-b5f7-ebefd8fa5bbe', 41143, 2),
  ('6a2523ff-6dfc-4149-a887-ab2d30842b8b', '62038c42-4337-4945-b95e-b15e9d6d9206', 41179, 2),
  ('95b3f510-dd1b-4330-aee8-33387c5676cd', '14f48f80-287f-4b73-83ff-f905063d1a25', 41170, 2);

DO $correccion$
DECLARE
  v_origen CONSTANT uuid := '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83';
  v_destino CONSTANT uuid := '93a9e5d8-da9f-4d20-9dfc-75334add0464';
  v_planes integer;
  v_recibos integer;
BEGIN
  IF current_setting('transaction_isolation') <> 'serializable'
    OR (SELECT count(*) FROM correccion_6_planes_recibos) <> 6
    OR (SELECT sum(detalles_esperados) FROM correccion_6_planes_recibos) <> 10 THEN
    RAISE EXCEPTION 'No coincide la transacción o la selección de seis planes y diez detalles';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ciclos_escolares
    WHERE id = v_origen AND nombre = '2027-1'
      AND lower(trim(tipo_periodo)) = 'semestral'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.ciclos_escolares
    WHERE id = v_destino AND nombre = '2027-1'
      AND lower(trim(tipo_periodo)) = 'cuatrimestral'
  ) THEN
    RAISE EXCEPTION 'Cambió la definición de los dos ciclos 2027-1';
  END IF;

  -- Grupo del destino, plan de estudios y programa vigente deben concordar;
  -- ningún alumno puede tener grupo Semestral u otro plan en esos ciclos.
  IF EXISTS (
    SELECT 1 FROM correccion_6_planes_recibos e
    LEFT JOIN public.planes_pago pp ON pp.id = e.plan_id
    WHERE pp.id IS NULL OR pp.alumno_id <> e.alumno_id
      OR pp.ciclo_id <> v_origen OR lower(trim(pp.tipo_plan)) <> 'semestral'
      OR (SELECT count(DISTINCT g.plan_id)
          FROM public.alumnos_grupos ag
          JOIN public.grupos g ON g.id = ag.grupo_id
          WHERE ag.alumno_id = e.alumno_id AND g.ciclo_id = v_destino) <> 1
      OR NOT EXISTS (
        SELECT 1 FROM public.alumnos_grupos ag
        JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = v_destino
        JOIN public.planes_estudio pe ON pe.id = g.plan_id
        JOIN public.alumno_programas ap ON ap.alumno_id = ag.alumno_id
          AND ap.plan_id = pe.id AND ap.es_vigente = true
        WHERE ag.alumno_id = e.alumno_id
          AND lower(trim(pe.tipo_periodo)) = 'cuatrimestral'
          AND upper(trim(coalesce(ap.estatus, ''))) IN ('ACTIVO', 'CURSANDO')
      ) OR EXISTS (
        SELECT 1 FROM public.alumnos_grupos ag
        JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = v_origen
        WHERE ag.alumno_id = e.alumno_id
      ) OR EXISTS (
        SELECT 1 FROM public.planes_pago otro
        WHERE otro.alumno_id = e.alumno_id AND otro.id <> e.plan_id
          AND otro.ciclo_id IN (v_origen, v_destino)
      )
  ) THEN
    RAISE EXCEPTION 'Cambió la relación del alumno con su grupo, programa o plan';
  END IF;

  -- Debe existir exactamente el folio esperado por alumno, y ningún otro
  -- recibo de los dos ciclos. Los documentos fiscales quedan fuera.
  IF EXISTS (
    SELECT 1 FROM correccion_6_planes_recibos e
    LEFT JOIN public.recibos r ON r.folio = e.folio
    WHERE r.id IS NULL OR r.alumno_id <> e.alumno_id
      OR r.ciclo_id <> v_origen OR r.estatus <> 'ACTIVO'
      OR r.requiere_factura IS DISTINCT FROM false
      OR upper(trim(coalesce(r.estatus_factura, 'NO APLICA'))) <> 'NO APLICA'
      OR nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
      OR (SELECT count(*) FROM public.recibos_detalles rd
          WHERE rd.recibo_id = r.id) <> e.detalles_esperados
      OR EXISTS (
        SELECT 1 FROM public.recibos_detalles rd
        LEFT JOIN LATERAL (
          SELECT d.concepto FROM public.planes_pago_detalles d
          WHERE d.plan_id = e.plan_id
            AND d.indice_concepto = rd.indice_concepto_plan
          ORDER BY d.created_at DESC, d.id DESC LIMIT 1
        ) pd ON true
        JOIN public.planes_pago pp ON pp.id = e.plan_id
        WHERE rd.recibo_id = r.id
          AND (rd.indice_concepto_plan NOT BETWEEN 1 AND 18
            OR rd.indice_concepto_plan IS NULL
            OR nullif(trim(coalesce(pd.concepto,
              to_jsonb(pp) ->> ('concepto_' || rd.indice_concepto_plan::text), '')), '') IS NULL
            OR lower(trim(rd.concepto)) NOT IN (
              lower(trim(coalesce(pd.concepto,
                to_jsonb(pp) ->> ('concepto_' || rd.indice_concepto_plan::text)))),
              lower(trim(coalesce(pd.concepto,
                to_jsonb(pp) ->> ('concepto_' || rd.indice_concepto_plan::text))))
                || ' (plan semestral - 2027-1)'
            ))
      )
  ) OR EXISTS (
    SELECT 1 FROM public.recibos r
    JOIN correccion_6_planes_recibos e ON e.alumno_id = r.alumno_id
    WHERE r.ciclo_id IN (v_origen, v_destino) AND r.folio <> e.folio
  ) THEN
    RAISE EXCEPTION 'Cambió el folio, su estado fiscal o la correspondencia de sus conceptos';
  END IF;

  UPDATE public.planes_pago pp
  SET ciclo_id = v_destino, tipo_plan = 'Cuatrimestral'
  FROM correccion_6_planes_recibos e
  WHERE pp.id = e.plan_id AND pp.alumno_id = e.alumno_id
    AND pp.ciclo_id = v_origen AND lower(trim(pp.tipo_plan)) = 'semestral';
  GET DIAGNOSTICS v_planes = ROW_COUNT;
  IF v_planes <> 6 THEN
    RAISE EXCEPTION 'Se modificaron % planes en lugar de seis', v_planes;
  END IF;

  UPDATE public.recibos r
  SET ciclo_id = v_destino
  FROM correccion_6_planes_recibos e
  WHERE r.folio = e.folio AND r.alumno_id = e.alumno_id
    AND r.ciclo_id = v_origen;
  GET DIAGNOSTICS v_recibos = ROW_COUNT;
  IF v_recibos <> 6 THEN
    RAISE EXCEPTION 'Se modificaron % recibos en lugar de seis', v_recibos;
  END IF;
  RAISE NOTICE 'Corregidos % planes y % recibos; los conceptos históricos no cambiaron',
    v_planes, v_recibos;
END;
$correccion$;

COMMIT;

-- Verificación de la etapa: seis filas, cada una en el ID Cuatrimestral.
SELECT pp.id AS plan_pago_id, pp.tipo_plan, pp.ciclo_id,
  r.folio, r.ciclo_id AS ciclo_del_recibo
FROM public.planes_pago pp
JOIN public.recibos r ON r.alumno_id = pp.alumno_id
WHERE pp.id IN (
  '19e3c620-998d-46cd-bfd6-0b3f8874c109'::uuid,
  '423be973-c1c5-4d68-8902-d30d20d21a07'::uuid,
  '4cc51d6f-5ef2-4638-8b3a-0ee7a2898c8d'::uuid,
  '550ed26d-51f3-427e-b8fc-051a86e9b155'::uuid,
  '6a2523ff-6dfc-4149-a887-ab2d30842b8b'::uuid,
  '95b3f510-dd1b-4330-aee8-33387c5676cd'::uuid
)
ORDER BY pp.id, r.folio;
