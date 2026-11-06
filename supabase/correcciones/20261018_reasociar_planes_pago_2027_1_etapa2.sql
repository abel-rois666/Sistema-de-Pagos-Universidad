-- CORRECCIÓN DE DATOS. NO ES UNA MIGRACIÓN NI SE EJECUTA AUTOMÁTICAMENTE.
-- Segunda etapa preparada con el detalle de los 18 casos pendientes.
-- No ejecutarla sin respaldo y revisión del preflight. Si falla cualquier
-- comprobación, PostgreSQL revierte todos los cambios de esta transacción.
-- Mueve 10 planes Cuatrimestrales y solo 3 recibos íntegramente vinculados.
-- Conserva en el ciclo de origen 12 recibos de trámites independientes.
-- Excluye los otros 8 planes: facturas, cancelaciones, solicitud de factura,
-- recibo con conceptos mixtos o posible duplicación/atribución de pagos.

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $$
BEGIN
  IF current_setting('transaction_isolation') <> 'serializable' THEN
    RAISE EXCEPTION 'No se inició una transacción serializable';
  END IF;
END $$;

DROP TABLE IF EXISTS pg_temp.etapa2_resultado;

CREATE TEMP TABLE etapa2_planes (
  alumno_id uuid PRIMARY KEY,
  plan_id uuid NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO etapa2_planes (alumno_id, plan_id) VALUES
  ('292e11e0-cc05-4d73-9d87-f9f9a304f5e2', 'fc980b82-1ee0-4fd7-886c-f780ed80ad61'),
  ('2bac5419-1360-4050-8d86-ab3426610db9', 'ea0842d2-2bc3-47bd-b80e-517248658ec7'),
  ('61f61f9f-6aff-4167-b1be-785a47a16cec', '098b4bf2-472c-4627-9acc-98ab8d86203a'),
  ('7cd77110-8aa4-427f-860d-9252d83f0161', 'e60a874c-7979-40dd-9657-6d3d47b550e4'),
  ('8dd1e09d-fcb8-4655-8db8-9c5d07112d7a', 'afab668e-297c-4939-9768-749609cbe05f'),
  ('90ab0638-5354-4f71-b97c-de438a3ca3ea', 'dd5c6eba-06f3-45ec-81fb-c4925a35b390'),
  ('ab375336-97fd-45d1-9968-bff0ad94a762', '8612bfa0-bd67-4dad-a2e2-0ed89e5c10b1'),
  ('b1cc1833-86df-4711-abfc-972ad2a61f34', '5e19a594-ad47-4dcb-9fad-8adc6f0dc087'),
  ('b541cd2c-0673-4c68-b983-1401584eff32', 'ac91f17a-6548-4139-b532-d9b1a0e68923'),
  ('ebcccfb8-b9ad-4161-9594-f04bb6ad4479', '9542edff-65d9-4e13-ba69-8f9f4b29c183');

CREATE TEMP TABLE etapa2_recibos (
  alumno_id uuid NOT NULL REFERENCES etapa2_planes(alumno_id),
  folio integer PRIMARY KEY,
  accion text NOT NULL CHECK (accion IN ('MOVER', 'CONSERVAR'))
) ON COMMIT DROP;

INSERT INTO etapa2_recibos (alumno_id, folio, accion) VALUES
  ('292e11e0-cc05-4d73-9d87-f9f9a304f5e2', 40477, 'CONSERVAR'),
  ('292e11e0-cc05-4d73-9d87-f9f9a304f5e2', 40869, 'CONSERVAR'),
  ('292e11e0-cc05-4d73-9d87-f9f9a304f5e2', 40870, 'CONSERVAR'),
  ('2bac5419-1360-4050-8d86-ab3426610db9', 41135, 'MOVER'),
  ('2bac5419-1360-4050-8d86-ab3426610db9', 41136, 'CONSERVAR'),
  ('61f61f9f-6aff-4167-b1be-785a47a16cec', 40825, 'CONSERVAR'),
  ('7cd77110-8aa4-427f-860d-9252d83f0161', 40102, 'CONSERVAR'),
  ('8dd1e09d-fcb8-4655-8db8-9c5d07112d7a', 40129, 'CONSERVAR'),
  ('90ab0638-5354-4f71-b97c-de438a3ca3ea', 41166, 'CONSERVAR'),
  ('90ab0638-5354-4f71-b97c-de438a3ca3ea', 41167, 'MOVER'),
  ('ab375336-97fd-45d1-9968-bff0ad94a762', 40090, 'CONSERVAR'),
  ('b1cc1833-86df-4711-abfc-972ad2a61f34', 40486, 'CONSERVAR'),
  ('b541cd2c-0673-4c68-b983-1401584eff32', 40871, 'CONSERVAR'),
  ('ebcccfb8-b9ad-4161-9594-f04bb6ad4479', 40438, 'CONSERVAR'),
  ('ebcccfb8-b9ad-4161-9594-f04bb6ad4479', 41096, 'MOVER');

-- Conceptos comprobados en el detalle aportado el 18/10/2026. Una variación
-- puede cambiar la clasificación del recibo y detiene toda la operación.
CREATE TEMP TABLE etapa2_conceptos_conservados (
  folio integer NOT NULL REFERENCES etapa2_recibos(folio),
  concepto text NOT NULL,
  PRIMARY KEY (folio, concepto)
) ON COMMIT DROP;

INSERT INTO etapa2_conceptos_conservados (folio, concepto) VALUES
  (40477, 'CONSTANCIA DE ESTUDIOS'),
  (40869, 'CONSTANCIA DE ESTUDIOS'),
  (40870, 'HISTORIAL ACADÉMICO'),
  (41136, 'CONSTANCIA DE ESTUDIOS'),
  (40825, 'CERTIFICADO TOTAL DE ESTUDIOS (LICENCIATURA)'),
  (40102, 'CARTA DE PRESENTACIÓN DEL SERVICIO SOCIAL'),
  (40102, 'CONSTANCIA DE ESTUDIOS'),
  (40129, 'CONSTANCIA DE ESTUDIOS'),
  (41166, 'EXAMEN EXTRAORDINARIO'),
  (40090, 'CARTA DE PRESENTACIÓN DEL SERVICIO SOCIAL'),
  (40090, 'CONSTANCIA DE ESTUDIOS'),
  (40486, 'CONSTANCIA DE ESTUDIOS'),
  (40871, 'CONSTANCIA DE ESTUDIOS'),
  (40438, 'CARTA DE PRESENTACIÓN DEL SERVICIO SOCIAL');

CREATE TEMP TABLE etapa2_parametros ON COMMIT DROP AS
SELECT origen.id AS origen_id, destino.id AS destino_id
FROM public.ciclos_escolares origen
JOIN public.ciclos_escolares destino ON destino.nombre = origen.nombre
WHERE origen.id = '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid
  AND destino.id = '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid
  AND origen.nombre = '2027-1'
  AND lower(trim(origen.tipo_periodo)) = 'semestral'
  AND lower(trim(destino.tipo_periodo)) = 'cuatrimestral';

-- Snapshot preciso de los 15 recibos conocidos. Sus detalles y los del plan
-- no se modifican; solo se cambia ciclo_id del plan y de 3 recibos.
CREATE TEMP TABLE etapa2_recibos_reales ON COMMIT DROP AS
SELECT r.id AS recibo_id, r.alumno_id, r.folio, r.ciclo_id,
  r.estatus, r.requiere_factura, r.estatus_factura, r.folio_fiscal,
  e.accion, p.plan_id
FROM public.recibos r
JOIN etapa2_recibos e ON e.folio = r.folio AND e.alumno_id = r.alumno_id
JOIN etapa2_planes p ON p.alumno_id = e.alumno_id;

DO $$
BEGIN
  IF (SELECT count(*) FROM etapa2_parametros) <> 1
    OR (SELECT count(*) FROM etapa2_planes) <> 10
    OR (SELECT count(*) FROM etapa2_recibos WHERE accion = 'MOVER') <> 3
    OR (SELECT count(*) FROM etapa2_recibos WHERE accion = 'CONSERVAR') <> 12
    OR (SELECT count(*) FROM etapa2_recibos_reales) <> 15 THEN
    RAISE EXCEPTION 'Cambió la selección 10 planes / 3 recibos del plan / 12 independientes';
  END IF;

  -- Verifica que la primera etapa haya dejado los 18 planes y sus 27 recibos
  -- pendientes; cualquier cambio posterior exige repetir la revisión.
  IF (SELECT count(*) FROM public.planes_pago pp
      CROSS JOIN etapa2_parametros x
      WHERE pp.ciclo_id = x.origen_id
        AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
        AND EXISTS (
          SELECT 1 FROM public.alumnos_grupos ag
          JOIN public.grupos g ON g.id = ag.grupo_id
          WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = x.destino_id
        )) <> 18
    OR (SELECT count(*) FROM public.recibos r
      JOIN public.planes_pago pp ON pp.alumno_id = r.alumno_id
      CROSS JOIN etapa2_parametros x
      WHERE pp.ciclo_id = x.origen_id AND r.ciclo_id = x.origen_id
        AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
        AND EXISTS (
          SELECT 1 FROM public.alumnos_grupos ag
          JOIN public.grupos g ON g.id = ag.grupo_id
          WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = x.destino_id
        )) <> 27 THEN
    RAISE EXCEPTION 'Cambió el conjunto de 18 planes / 27 recibos pendientes';
  END IF;

  IF EXISTS (
    SELECT 1 FROM etapa2_planes e
    CROSS JOIN etapa2_parametros x
    LEFT JOIN public.planes_pago pp ON pp.id = e.plan_id
    WHERE pp.id IS NULL OR pp.alumno_id <> e.alumno_id
      OR pp.ciclo_id <> x.origen_id
      OR lower(trim(pp.tipo_plan)) <> 'cuatrimestral'
      OR NOT EXISTS (
        SELECT 1 FROM public.alumnos_grupos ag
        JOIN public.grupos g ON g.id = ag.grupo_id
        WHERE ag.alumno_id = e.alumno_id AND g.ciclo_id = x.destino_id
      )
      OR EXISTS (
        SELECT 1 FROM public.alumnos_grupos ag
        JOIN public.grupos g ON g.id = ag.grupo_id
        WHERE ag.alumno_id = e.alumno_id AND g.ciclo_id = x.origen_id
      )
      OR EXISTS (
        SELECT 1 FROM public.planes_pago otro
        WHERE otro.alumno_id = e.alumno_id AND otro.id <> e.plan_id
          AND otro.ciclo_id IN (x.origen_id, x.destino_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.recibos r
        WHERE r.alumno_id = e.alumno_id AND r.ciclo_id = x.destino_id
      )
  ) THEN
    RAISE EXCEPTION 'Algún alumno tiene plan, grupo o recibo alternativo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM etapa2_recibos e
    LEFT JOIN etapa2_recibos_reales r ON r.folio = e.folio
    CROSS JOIN etapa2_parametros x
    WHERE r.recibo_id IS NULL OR r.ciclo_id <> x.origen_id
      OR r.estatus <> 'ACTIVO' OR r.requiere_factura IS DISTINCT FROM false
      OR upper(trim(coalesce(r.estatus_factura, 'NO APLICA'))) <> 'NO APLICA'
      OR nullif(trim(coalesce(r.folio_fiscal, '')), '') IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.recibos r
    JOIN etapa2_planes e ON e.alumno_id = r.alumno_id
    CROSS JOIN etapa2_parametros x
    LEFT JOIN etapa2_recibos esperados ON esperados.folio = r.folio
    WHERE r.ciclo_id = x.origen_id AND esperados.folio IS NULL
  ) THEN
    RAISE EXCEPTION 'Cambió el conjunto o estado fiscal de los recibos';
  END IF;

  -- Un recibo que se mueve debe contener exclusivamente partidas del plan,
  -- identificadas por índice y por el texto del ciclo y tipo del plan.
  IF EXISTS (
    SELECT 1 FROM etapa2_recibos_reales r
    WHERE r.accion = 'MOVER' AND (
      NOT EXISTS (
        SELECT 1 FROM public.recibos_detalles d WHERE d.recibo_id = r.recibo_id
      ) OR EXISTS (
        SELECT 1 FROM public.recibos_detalles d
        WHERE d.recibo_id = r.recibo_id
          AND (d.indice_concepto_plan NOT BETWEEN 1 AND 18
            OR d.indice_concepto_plan IS NULL
            OR d.concepto NOT ILIKE '%(Plan Cuatrimestral - 2027-1)%'
            OR NOT (
              EXISTS (
                SELECT 1 FROM public.planes_pago_detalles pd
                WHERE pd.plan_id = r.plan_id
                  AND pd.indice_concepto = d.indice_concepto_plan
              ) OR EXISTS (
                SELECT 1 FROM public.planes_pago pp
                WHERE pp.id = r.plan_id
                  AND nullif(trim(coalesce(to_jsonb(pp) ->>
                    ('concepto_' || d.indice_concepto_plan::text), '')), '')
                    IS NOT NULL
              ))
            OR NOT (
              EXISTS (
                SELECT 1 FROM public.planes_pago_detalles pd
                WHERE pd.plan_id = r.plan_id
                  AND pd.indice_concepto = d.indice_concepto_plan
                  AND pd.estatus ~* (
                    '(^|[^[:alnum:]])R-' || r.folio::text || '([^0-9]|$)'
                  )
              ) OR EXISTS (
                SELECT 1 FROM public.planes_pago pp
                WHERE pp.id = r.plan_id
                  AND (to_jsonb(pp) ->>
                    ('estatus_' || d.indice_concepto_plan::text)) ~* (
                    '(^|[^[:alnum:]])R-' || r.folio::text || '([^0-9]|$)'
                  )
              )))
      )
    )
  ) THEN
    RAISE EXCEPTION 'Un recibo por mover contiene partidas ajenas o sin vínculo al plan';
  END IF;

  -- Un recibo conservado no puede incluir partidas del plan ni estar citado
  -- como pagado en los estados normalizados o numerados del mismo plan.
  IF EXISTS (
    SELECT 1 FROM etapa2_recibos_reales r
    WHERE r.accion = 'CONSERVAR' AND (
      NOT EXISTS (
        SELECT 1 FROM public.recibos_detalles d WHERE d.recibo_id = r.recibo_id
      ) OR EXISTS (
        SELECT 1 FROM public.recibos_detalles d
        WHERE d.recibo_id = r.recibo_id
          AND (d.indice_concepto_plan IS NOT NULL
            OR d.concepto ILIKE '%(Plan Cuatrimestral - 2027-1)%')
      ) OR EXISTS (
        SELECT 1 FROM public.planes_pago_detalles pd
        WHERE pd.plan_id = r.plan_id
          AND pd.estatus ~* (
            '(^|[^[:alnum:]])R-' || r.folio::text || '([^0-9]|$)'
          )
      ) OR EXISTS (
        SELECT 1 FROM public.planes_pago pp
        CROSS JOIN LATERAL jsonb_each_text(to_jsonb(pp)) estado
        WHERE pp.id = r.plan_id
          AND estado.key ~ '^estatus_([1-9]|1[0-8])$'
          AND estado.value ~* (
            '(^|[^[:alnum:]])R-' || r.folio::text || '([^0-9]|$)'
          )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Un recibo conservado parece vinculado al plan';
  END IF;

  IF (SELECT count(*) FROM etapa2_conceptos_conservados) <> 14
    OR EXISTS (
      SELECT 1 FROM etapa2_recibos_reales r
      JOIN public.recibos_detalles d ON d.recibo_id = r.recibo_id
      LEFT JOIN etapa2_conceptos_conservados e
        ON e.folio = r.folio AND e.concepto = upper(trim(d.concepto))
      WHERE r.accion = 'CONSERVAR' AND e.folio IS NULL
    ) OR EXISTS (
      SELECT 1 FROM etapa2_conceptos_conservados e
      JOIN etapa2_recibos_reales r ON r.folio = e.folio
      WHERE NOT EXISTS (
        SELECT 1 FROM public.recibos_detalles d
        WHERE d.recibo_id = r.recibo_id
          AND upper(trim(d.concepto)) = e.concepto
      )
    ) OR (SELECT count(*) FROM public.recibos_detalles d
      JOIN etapa2_recibos_reales r ON r.recibo_id = d.recibo_id
      WHERE r.accion = 'CONSERVAR') <> 14 THEN
    RAISE EXCEPTION 'Cambió algún concepto de los recibos independientes';
  END IF;
END $$;

-- La tabla de auditoría sobrevive al COMMIT en la sesión actual del editor.
CREATE TEMP TABLE etapa2_resultado ON COMMIT PRESERVE ROWS AS
SELECT 'PLAN'::text AS tipo, e.alumno_id, e.plan_id AS id,
  NULL::integer AS folio, 'MOVER'::text AS accion
FROM etapa2_planes e
UNION ALL
SELECT 'RECIBO', r.alumno_id, r.recibo_id, r.folio, r.accion
FROM etapa2_recibos_reales r;

DO $$
DECLARE
  planes_actualizados integer;
  recibos_actualizados integer;
  origen_id uuid;
  destino_id uuid;
BEGIN
  SELECT x.origen_id, x.destino_id INTO STRICT origen_id, destino_id
  FROM etapa2_parametros x;

  UPDATE public.planes_pago pp
  SET ciclo_id = destino_id
  FROM etapa2_planes e
  WHERE pp.id = e.plan_id AND pp.alumno_id = e.alumno_id
    AND pp.ciclo_id = origen_id;
  GET DIAGNOSTICS planes_actualizados = ROW_COUNT;
  IF planes_actualizados <> 10 THEN
    RAISE EXCEPTION 'No se actualizaron exactamente 10 planes';
  END IF;

  UPDATE public.recibos r
  SET ciclo_id = destino_id
  FROM etapa2_recibos_reales e
  WHERE e.accion = 'MOVER' AND r.id = e.recibo_id
    AND r.alumno_id = e.alumno_id AND r.ciclo_id = origen_id;
  GET DIAGNOSTICS recibos_actualizados = ROW_COUNT;
  IF recibos_actualizados <> 3 THEN
    RAISE EXCEPTION 'No se actualizaron exactamente 3 recibos vinculados';
  END IF;

  IF EXISTS (
    SELECT 1 FROM etapa2_planes e
    JOIN public.planes_pago pp ON pp.id = e.plan_id
    WHERE pp.ciclo_id <> destino_id
  ) OR EXISTS (
    SELECT 1 FROM etapa2_recibos_reales e
    JOIN public.recibos r ON r.id = e.recibo_id
    WHERE r.ciclo_id <> CASE WHEN e.accion = 'MOVER'
      THEN destino_id ELSE origen_id END
  ) THEN
    RAISE EXCEPTION 'Falló la comprobación final; se revierte la transacción';
  END IF;
END $$;

COMMIT;

-- Conserva este resultado para el registro de la corrección. Las filas
-- 'CONSERVAR' muestran los recibos que permanecieron en el ciclo de origen.
SELECT tipo, alumno_id, id, folio, accion
FROM etapa2_resultado
ORDER BY alumno_id, tipo, folio NULLS FIRST;
