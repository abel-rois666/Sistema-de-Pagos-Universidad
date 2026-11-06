-- CORRECCIÓN DE DATOS. NO ES UNA MIGRACIÓN NI SE EJECUTA AUTOMÁTICAMENTE.
-- Preparada para revisión; requiere autorización separada para ejecutarse.
-- Antes de ejecutar: guardar un respaldo de planes_pago y recibos, volver a
-- ejecutar supabase/checks/preflight_reasociacion_segura_2027_1.sql y revisar
-- los conteos. No modificar los UUID ni el criterio sin repetir el diagnóstico.
-- Solo mueve casos inequívocos: un plan Cuatrimestral de un alumno del grupo
-- Cuatrimestral 2027-1, sin plan alternativo, grupo Semestral ni recibos en
-- destino. Si CUALQUIER recibo del alumno en origen está cancelado, requiere
-- factura, tiene estado de factura, o tiene detalles no vinculados al plan,
-- no mueve ni el plan ni ningún recibo suyo.
-- Los detalles de plan y recibo mantienen sus mismos IDs y relaciones.

-- BEGIN debe ser la primera instrucción: el editor puede enviar todo el
-- archivo en una sola transacción implícita. Un DROP previo impide cambiar
-- después el nivel de aislamiento con SET TRANSACTION.
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
DO $$
BEGIN
  IF current_setting('transaction_isolation') <> 'serializable' THEN
    RAISE EXCEPTION 'No se inició una transacción serializable; no se modificó ningún dato';
  END IF;
END $$;
DROP TABLE IF EXISTS pg_temp.correccion_2027_1_resultado;

CREATE TEMP TABLE correccion_2027_1_candidatos ON COMMIT DROP AS
WITH parametros AS (
  SELECT origen.id AS origen_id, destino.id AS destino_id
  FROM public.ciclos_escolares origen
  JOIN public.ciclos_escolares destino ON destino.nombre = origen.nombre
  WHERE origen.id = '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid
    AND destino.id = '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
    AND origen.nombre = '2027-1'
    AND lower(trim(origen.tipo_periodo)) = 'semestral'
    AND lower(trim(destino.tipo_periodo)) = 'cuatrimestral'
), candidatos AS (
  SELECT pp.id AS plan_id, pp.alumno_id, p.origen_id, p.destino_id
  FROM public.planes_pago pp
  CROSS JOIN parametros p
  WHERE pp.ciclo_id = p.origen_id
    AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
    AND EXISTS (
      SELECT 1 FROM public.alumnos_grupos ag
      JOIN public.grupos g ON g.id = ag.grupo_id
      WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = p.destino_id
    )
)
SELECT c.*,
  EXISTS (
    SELECT 1 FROM candidatos otro
    WHERE otro.alumno_id = c.alumno_id AND otro.plan_id <> c.plan_id
  ) AS varios_candidatos,
  EXISTS (
    SELECT 1 FROM public.planes_pago otro
    WHERE otro.alumno_id = c.alumno_id
      AND otro.ciclo_id IN (c.origen_id, c.destino_id)
      AND otro.id <> c.plan_id
  ) AS otro_plan_origen_o_destino,
  EXISTS (
    SELECT 1 FROM public.alumnos_grupos ag
    JOIN public.grupos g ON g.id = ag.grupo_id
    WHERE ag.alumno_id = c.alumno_id AND g.ciclo_id = c.origen_id
  ) AS grupo_origen,
  EXISTS (
    SELECT 1 FROM public.recibos r
    WHERE r.alumno_id = c.alumno_id AND r.ciclo_id = c.destino_id
  ) AS recibos_destino,
  EXISTS (
    SELECT 1 FROM public.recibos r
    WHERE r.alumno_id = c.alumno_id AND r.ciclo_id = c.origen_id
      AND (r.estatus IS DISTINCT FROM 'ACTIVO'
        OR r.requiere_factura IS TRUE
        OR upper(trim(coalesce(r.estatus_factura, 'NO APLICA')))
          NOT IN ('NO APLICA', '')
        OR nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.recibos_detalles rd
          WHERE rd.recibo_id = r.id
            AND rd.indice_concepto_plan BETWEEN 1 AND 18
        )
        OR EXISTS (
          SELECT 1 FROM public.recibos_detalles rd
          WHERE rd.recibo_id = r.id
            AND (rd.indice_concepto_plan IS NULL
              OR rd.indice_concepto_plan NOT BETWEEN 1 AND 18)
        ))
  ) AS recibos_ambiguos
FROM candidatos c;

-- Estos valores son los reportados por los diagnósticos del 18/10/2026.
-- Si cambiaron, la transacción se revierte y se repite la revisión.
DO $$
BEGIN
  IF (SELECT count(*) FROM correccion_2027_1_candidatos) <> 216 THEN
    RAISE EXCEPTION 'Cambió el número de planes candidatos: se esperaban 216';
  END IF;
  IF (SELECT count(*) FROM public.recibos r
      JOIN correccion_2027_1_candidatos c
        ON c.alumno_id = r.alumno_id AND c.origen_id = r.ciclo_id) <> 106 THEN
    RAISE EXCEPTION 'Cambió el número de recibos de origen: se esperaban 106';
  END IF;
  IF EXISTS (SELECT 1 FROM correccion_2027_1_candidatos
    WHERE varios_candidatos OR otro_plan_origen_o_destino OR grupo_origen
      OR recibos_destino) THEN
    RAISE EXCEPTION 'Apareció un plan, grupo o recibo alternativo: repetir diagnóstico';
  END IF;
END $$;

CREATE TEMP TABLE correccion_2027_1_elegibles ON COMMIT DROP AS
SELECT plan_id, alumno_id, origen_id, destino_id
FROM correccion_2027_1_candidatos
WHERE NOT (varios_candidatos OR otro_plan_origen_o_destino OR grupo_origen
  OR recibos_destino OR recibos_ambiguos);

-- Captura exactamente las filas a modificar y permite comprobar que ninguna
-- cambió entre la clasificación y las actualizaciones.
CREATE TEMP TABLE correccion_2027_1_recibos ON COMMIT DROP AS
SELECT r.id AS recibo_id, e.alumno_id, e.origen_id, e.destino_id
FROM public.recibos r
JOIN correccion_2027_1_elegibles e
  ON e.alumno_id = r.alumno_id AND e.origen_id = r.ciclo_id;

-- Resultado del preflight confirmado por el usuario: 198 planes, 79 recibos
-- y 18 alumnos excluidos. No aplicar una selección distinta silenciosamente.
DO $$
BEGIN
  IF (SELECT count(*) FROM correccion_2027_1_elegibles) <> 198
    OR (SELECT count(*) FROM correccion_2027_1_recibos) <> 79
    OR (SELECT count(*) FROM correccion_2027_1_candidatos
        WHERE recibos_ambiguos) <> 18 THEN
    RAISE EXCEPTION 'Cambió la clasificación 198/79/18: repetir preflight y revisar';
  END IF;
END $$;

CREATE TEMP TABLE correccion_2027_1_resultado ON COMMIT PRESERVE ROWS AS
SELECT 'PLAN'::text AS tipo, e.plan_id AS id, e.alumno_id,
  e.origen_id AS ciclo_anterior, e.destino_id AS ciclo_nuevo
FROM correccion_2027_1_elegibles e
UNION ALL
SELECT 'RECIBO', r.recibo_id, r.alumno_id, r.origen_id, r.destino_id
FROM correccion_2027_1_recibos r;

DO $$
DECLARE
  planes_actualizados integer;
  recibos_actualizados integer;
BEGIN
  UPDATE public.planes_pago pp
  SET ciclo_id = e.destino_id
  FROM correccion_2027_1_elegibles e
  WHERE pp.id = e.plan_id AND pp.alumno_id = e.alumno_id
    AND pp.ciclo_id = e.origen_id;
  GET DIAGNOSTICS planes_actualizados = ROW_COUNT;
  IF planes_actualizados <> (SELECT count(*) FROM correccion_2027_1_elegibles) THEN
    RAISE EXCEPTION 'No coincidieron todos los planes; se revierte la transacción';
  END IF;

  UPDATE public.recibos r
  SET ciclo_id = x.destino_id
  FROM correccion_2027_1_recibos x
  WHERE r.id = x.recibo_id AND r.alumno_id = x.alumno_id
    AND r.ciclo_id = x.origen_id
    AND r.estatus = 'ACTIVO'
    AND r.requiere_factura IS NOT TRUE
    AND upper(trim(coalesce(r.estatus_factura, 'NO APLICA')))
      IN ('NO APLICA', '')
    AND nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NULL
    AND EXISTS (
      SELECT 1 FROM public.recibos_detalles rd
      WHERE rd.recibo_id = r.id AND rd.indice_concepto_plan BETWEEN 1 AND 18
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.recibos_detalles rd
      WHERE rd.recibo_id = r.id
        AND (rd.indice_concepto_plan IS NULL
          OR rd.indice_concepto_plan NOT BETWEEN 1 AND 18)
    );
  GET DIAGNOSTICS recibos_actualizados = ROW_COUNT;
  IF recibos_actualizados <> (SELECT count(*) FROM correccion_2027_1_recibos) THEN
    RAISE EXCEPTION 'No coincidieron todos los recibos; se revierte la transacción';
  END IF;
END $$;

-- Si cualquiera de estas comprobaciones falla, no se confirma ningún cambio.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM correccion_2027_1_elegibles e
    JOIN public.planes_pago pp ON pp.id = e.plan_id
    WHERE pp.ciclo_id <> e.destino_id
  ) OR EXISTS (
    SELECT 1 FROM correccion_2027_1_recibos x
    JOIN public.recibos r ON r.id = x.recibo_id
    WHERE r.ciclo_id <> x.destino_id
  ) THEN
    RAISE EXCEPTION 'La verificación final falló; se revierte la transacción';
  END IF;
END $$;

COMMIT;

-- Exportar este resultado para dejar constancia de los IDs cambiados.
-- La tabla temporal solo existe durante esta sesión del editor SQL.
SELECT tipo, id, alumno_id, ciclo_anterior, ciclo_nuevo
FROM correccion_2027_1_resultado
ORDER BY alumno_id, tipo, id;
