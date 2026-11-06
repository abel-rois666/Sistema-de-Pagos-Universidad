-- PREPARADO, NO EJECUTADO. Etapa comprobada sin recibos para siete de los
-- catorce planes etiquetados Semestral de alumnos Cuatrimestrales.
-- Corrige solo tipo_plan y ciclo_id. No toca recibos, importes, conceptos,
-- detalles, planes de estudio, grupos ni los dos planes de Titulación.
-- Ejecutar únicamente tras revisar el preflight vigente y hacer respaldo.
-- Una discrepancia aborta toda la transacción; no ejecutar solo fragmentos.

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $correccion$
DECLARE
  v_origen CONSTANT uuid := '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83';
  v_destino CONSTANT uuid := '93a9e5d8-da9f-4d20-9dfc-75334add0464';
  v_ids CONSTANT uuid[] := ARRAY[
    '41259086-1470-4134-a678-b2ea22d13e8a'::uuid,
    '54057ccf-b9bb-4f42-8247-76412d786fba'::uuid,
    '6ae12e67-8c8c-45c9-9860-c9c9e935b510'::uuid,
    '9329c13b-b32f-43fe-bab4-cd8b87cdd7ed'::uuid,
    'b6aae9a7-4def-4c27-b201-2291a03d902a'::uuid,
    'dde8450d-d4f8-4650-977f-042b255312f4'::uuid,
    'f25c8fd1-9664-4f66-af6e-107b0dd17425'::uuid
  ];
  v_planes integer;
  v_alumnos integer;
  v_modificados integer;
BEGIN
  IF current_setting('transaction_isolation') <> 'serializable' THEN
    RAISE EXCEPTION 'No se inició una transacción serializable';
  END IF;
  IF cardinality(v_ids) <> 7 OR
    (SELECT count(DISTINCT id) FROM unnest(v_ids) AS ids(id)) <> 7 THEN
    RAISE EXCEPTION 'La lista de siete planes no es válida';
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
    RAISE EXCEPTION 'Los IDs o tipos de los ciclos 2027-1 cambiaron';
  END IF;

  SELECT count(*), count(DISTINCT alumno_id)
  INTO v_planes, v_alumnos
  FROM public.planes_pago
  WHERE id = ANY(v_ids) AND ciclo_id = v_origen
    AND lower(trim(tipo_plan)) = 'semestral';
  IF v_planes <> 7 OR v_alumnos <> 7 THEN
    RAISE EXCEPTION 'Los siete planes ya no corresponden al preflight (planes %, alumnos %)',
      v_planes, v_alumnos;
  END IF;

  -- El grupo del ciclo destino y el programa vigente deben ser del mismo
  -- plan académico Cuatrimestral. Un alumno multigrupo se revisa aparte.
  IF EXISTS (
    SELECT 1 FROM public.planes_pago pp
    WHERE pp.id = ANY(v_ids)
      AND (
        (SELECT count(DISTINCT g.plan_id)
         FROM public.alumnos_grupos ag
         JOIN public.grupos g ON g.id = ag.grupo_id
         WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = v_destino) <> 1
        OR NOT EXISTS (
          SELECT 1 FROM public.alumnos_grupos ag
          JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = v_destino
          JOIN public.planes_estudio pe ON pe.id = g.plan_id
          JOIN public.alumno_programas ap ON ap.alumno_id = ag.alumno_id
            AND ap.plan_id = pe.id AND ap.es_vigente = true
          WHERE ag.alumno_id = pp.alumno_id
            AND lower(trim(pe.tipo_periodo)) = 'cuatrimestral'
            AND upper(trim(coalesce(ap.estatus, ''))) IN ('ACTIVO', 'CURSANDO')
        )
        OR EXISTS (
          SELECT 1 FROM public.alumnos_grupos ag
          JOIN public.grupos g ON g.id = ag.grupo_id AND g.ciclo_id = v_origen
          WHERE ag.alumno_id = pp.alumno_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Grupo, periodicidad o programa académico cambiaron';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.planes_pago pp
    JOIN public.planes_pago otro ON otro.alumno_id = pp.alumno_id
      AND otro.id <> pp.id AND otro.ciclo_id IN (v_origen, v_destino)
    WHERE pp.id = ANY(v_ids)
  ) THEN
    RAISE EXCEPTION 'Algún alumno ya tiene otro plan en uno de los ciclos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.planes_pago pp
    JOIN public.recibos r ON r.alumno_id = pp.alumno_id
      AND r.ciclo_id IN (v_origen, v_destino)
    WHERE pp.id = ANY(v_ids)
  ) THEN
    RAISE EXCEPTION 'Aparecieron recibos; revisar antes de mover el plan';
  END IF;

  UPDATE public.planes_pago
  SET ciclo_id = v_destino, tipo_plan = 'Cuatrimestral'
  WHERE id = ANY(v_ids) AND ciclo_id = v_origen
    AND lower(trim(tipo_plan)) = 'semestral';
  GET DIAGNOSTICS v_modificados = ROW_COUNT;
  IF v_modificados <> 7 THEN
    RAISE EXCEPTION 'Se actualizaron % planes en lugar de siete', v_modificados;
  END IF;
  RAISE NOTICE 'Corregidos % planes sin recibos; verificar consulta posterior',
    v_modificados;
END;
$correccion$;

COMMIT;

-- Verificación de la etapa. Debe devolver siete filas en Cuatrimestral.
SELECT id AS plan_pago_id, ciclo_id, tipo_plan
FROM public.planes_pago
WHERE id IN (
  '41259086-1470-4134-a678-b2ea22d13e8a'::uuid,
  '54057ccf-b9bb-4f42-8247-76412d786fba'::uuid,
  '6ae12e67-8c8c-45c9-9860-c9c9e935b510'::uuid,
  '9329c13b-b32f-43fe-bab4-cd8b87cdd7ed'::uuid,
  'b6aae9a7-4def-4c27-b201-2291a03d902a'::uuid,
  'dde8450d-d4f8-4650-977f-042b255312f4'::uuid,
  'f25c8fd1-9664-4f66-af6e-107b0dd17425'::uuid
)
ORDER BY id;
