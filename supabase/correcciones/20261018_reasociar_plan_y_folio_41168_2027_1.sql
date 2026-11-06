-- PREPARADO, NO EJECUTADO. El único plan del alumno corresponde al grupo
-- Cuatrimestral 2027-1. El folio 41168 contiene dos conceptos del plan,
-- cada uno con coincidencia única en los índices 1 y 2, pero sus detalles
-- NO están vinculados por indice_concepto_plan.
-- Esta etapa corrige exclusivamente el tipo/ID del plan y el ID del recibo.
-- NO asigna índices, NO cambia estados de pago, conceptos ni importes.
-- Después, el área de pagos debe revisar la aplicación de esos dos abonos.
-- Ejecutar completa, con respaldo; cualquier cambio revierte la operación.

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $correccion$
DECLARE
  v_origen CONSTANT uuid := '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83';
  v_destino CONSTANT uuid := '93a9e5d8-da9f-4d20-9dfc-75334add0464';
  v_plan CONSTANT uuid := '7d943567-dcf1-4701-9c0e-d470a7ef9b78';
  v_alumno CONSTANT uuid := 'db303bcc-2077-48dd-a243-8eb5a0da12e8';
  v_folio CONSTANT integer := 41168;
  v_recibo_id uuid;
  v_modificados integer;
BEGIN
  IF current_setting('transaction_isolation') <> 'serializable' THEN
    RAISE EXCEPTION 'No se inició una transacción serializable';
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
    RAISE EXCEPTION 'Cambió la definición de los dos ciclos';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.planes_pago pp
    WHERE pp.id = v_plan AND pp.alumno_id = v_alumno
      AND pp.ciclo_id = v_origen AND lower(trim(pp.tipo_plan)) = 'semestral'
  ) OR EXISTS (
    SELECT 1 FROM public.planes_pago otro
    WHERE otro.alumno_id = v_alumno AND otro.id <> v_plan
      AND otro.ciclo_id IN (v_origen, v_destino)
  ) THEN
    RAISE EXCEPTION 'Cambió el plan de pagos o apareció otro plan';
  END IF;
  IF (SELECT count(DISTINCT g.plan_id)
      FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = v_alumno AND g.ciclo_id = v_destino) <> 1
    OR NOT EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = v_destino
      JOIN public.planes_estudio pe ON pe.id = g.plan_id
      JOIN public.alumno_programas ap ON ap.alumno_id = ag.alumno_id
        AND ap.plan_id = pe.id AND ap.es_vigente = true
      WHERE ag.alumno_id = v_alumno
        AND lower(trim(pe.tipo_periodo)) = 'cuatrimestral'
        AND upper(trim(coalesce(ap.estatus, ''))) IN ('ACTIVO', 'CURSANDO')
    ) OR EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = v_origen
      WHERE ag.alumno_id = v_alumno
    ) THEN
    RAISE EXCEPTION 'Cambió el grupo o programa académico del alumno';
  END IF;

  SELECT r.id INTO v_recibo_id
  FROM public.recibos r
  WHERE r.folio = v_folio AND r.alumno_id = v_alumno
    AND r.ciclo_id = v_origen AND r.estatus = 'ACTIVO'
    AND r.requiere_factura IS NOT DISTINCT FROM false
    AND upper(trim(coalesce(r.estatus_factura, 'NO APLICA'))) = 'NO APLICA'
    AND nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NULL;
  IF v_recibo_id IS NULL OR EXISTS (
    SELECT 1 FROM public.recibos otro
    WHERE otro.alumno_id = v_alumno
      AND otro.ciclo_id IN (v_origen, v_destino)
      AND otro.id <> v_recibo_id
  ) THEN
    RAISE EXCEPTION 'Cambió el recibo, su estado fiscal o apareció otro folio';
  END IF;

  IF (SELECT count(*) FROM public.recibos_detalles
      WHERE recibo_id = v_recibo_id) <> 2
    OR NOT EXISTS (
      SELECT 1 FROM public.recibos_detalles d
      WHERE d.id = '94e319da-d5e1-4aaa-8dc0-fdc27c62ad21'::uuid
        AND d.recibo_id = v_recibo_id
        AND d.indice_concepto_plan IS NULL
        AND lower(trim(d.concepto)) =
          'constancias renovación de beca (plan semestral - 2027-1)'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.recibos_detalles d
      WHERE d.id = 'e99fff32-b18e-412b-90af-69c47492233d'::uuid
        AND d.recibo_id = v_recibo_id
        AND d.indice_concepto_plan IS NULL
        AND lower(trim(d.concepto)) = '1er pago (plan semestral - 2027-1)'
    )
  THEN
    RAISE EXCEPTION 'Cambió el conjunto de dos conceptos del folio 41168';
  END IF;

  -- Revalida los dos conceptos únicos y sus índices sin atribuir aún abonos.
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('CONSTANCIAS RENOVACIÓN DE BECA'::text, 1),
      ('1ER PAGO'::text, 2)
    ) AS esperado(nombre, indice)
    WHERE (SELECT count(*)
      FROM generate_series(1, 18) AS serie(i)
      CROSS JOIN public.planes_pago pp
      LEFT JOIN LATERAL (
        SELECT pd.concepto
        FROM public.planes_pago_detalles pd
        WHERE pd.plan_id = pp.id AND pd.indice_concepto = serie.i
        ORDER BY pd.created_at DESC, pd.id DESC LIMIT 1
      ) pd ON true
      WHERE pp.id = v_plan
        AND lower(trim(coalesce(pd.concepto,
          to_jsonb(pp) ->> ('concepto_' || serie.i::text), '')))
          = lower(esperado.nombre)) <> 1
      OR NOT EXISTS (
        SELECT 1 FROM public.planes_pago pp
        LEFT JOIN LATERAL (
          SELECT pd.concepto, pd.estatus
          FROM public.planes_pago_detalles pd
          WHERE pd.plan_id = pp.id AND pd.indice_concepto = esperado.indice
          ORDER BY pd.created_at DESC, pd.id DESC LIMIT 1
        ) pd ON true
        WHERE pp.id = v_plan
          AND lower(trim(coalesce(pd.concepto,
            to_jsonb(pp) ->> ('concepto_' || esperado.indice::text), '')))
            = lower(esperado.nombre)
          AND upper(trim(coalesce(pd.estatus,
            to_jsonb(pp) ->> ('estatus_' || esperado.indice::text), '')))
            = 'PENDIENTE'
      )
  ) THEN
    RAISE EXCEPTION 'Los conceptos, índices únicos o estados del plan cambiaron';
  END IF;

  UPDATE public.planes_pago
  SET ciclo_id = v_destino, tipo_plan = 'Cuatrimestral'
  WHERE id = v_plan AND alumno_id = v_alumno
    AND ciclo_id = v_origen AND lower(trim(tipo_plan)) = 'semestral';
  GET DIAGNOSTICS v_modificados = ROW_COUNT;
  IF v_modificados <> 1 THEN
    RAISE EXCEPTION 'No se corrigió exactamente un plan';
  END IF;

  UPDATE public.recibos
  SET ciclo_id = v_destino
  WHERE id = v_recibo_id AND ciclo_id = v_origen;
  GET DIAGNOSTICS v_modificados = ROW_COUNT;
  IF v_modificados <> 1 THEN
    RAISE EXCEPTION 'No se corrigió exactamente un recibo';
  END IF;
  RAISE NOTICE 'Plan y folio 41168 reasociados; los dos abonos siguen sin índice y requieren conciliación';
END;
$correccion$;

COMMIT;

-- Verificación: un plan y un folio Cuatrimestrales, dos detalles aún sin índice.
SELECT pp.id AS plan_pago_id, pp.tipo_plan, pp.ciclo_id,
  r.folio, r.ciclo_id AS ciclo_del_recibo,
  count(rd.id) FILTER (WHERE rd.indice_concepto_plan IS NULL) AS detalles_sin_indice
FROM public.planes_pago pp
JOIN public.recibos r ON r.alumno_id = pp.alumno_id
LEFT JOIN public.recibos_detalles rd ON rd.recibo_id = r.id
WHERE pp.id = '7d943567-dcf1-4701-9c0e-d470a7ef9b78'::uuid
  AND r.folio = 41168
GROUP BY pp.id, pp.tipo_plan, pp.ciclo_id, r.folio, r.ciclo_id;
