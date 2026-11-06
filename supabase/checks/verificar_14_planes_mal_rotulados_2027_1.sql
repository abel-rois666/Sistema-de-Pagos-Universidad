-- SOLO LECTURA. Ejecutar después de las tres correcciones preparadas para
-- los 14 planes originalmente rotulados Semestral. No sustituye la revisión
-- financiera del folio 41168: sus dos detalles siguen sin índice por diseño.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), esperados(plan_id) AS (
  VALUES
    ('19e3c620-998d-46cd-bfd6-0b3f8874c109'::uuid),
    ('41259086-1470-4134-a678-b2ea22d13e8a'::uuid),
    ('423be973-c1c5-4d68-8902-d30d20d21a07'::uuid),
    ('4cc51d6f-5ef2-4638-8b3a-0ee7a2898c8d'::uuid),
    ('54057ccf-b9bb-4f42-8247-76412d786fba'::uuid),
    ('550ed26d-51f3-427e-b8fc-051a86e9b155'::uuid),
    ('6a2523ff-6dfc-4149-a887-ab2d30842b8b'::uuid),
    ('6ae12e67-8c8c-45c9-9860-c9c9e935b510'::uuid),
    ('7d943567-dcf1-4701-9c0e-d470a7ef9b78'::uuid),
    ('9329c13b-b32f-43fe-bab4-cd8b87cdd7ed'::uuid),
    ('95b3f510-dd1b-4330-aee8-33387c5676cd'::uuid),
    ('b6aae9a7-4def-4c27-b201-2291a03d902a'::uuid),
    ('dde8450d-d4f8-4650-977f-042b255312f4'::uuid),
    ('f25c8fd1-9664-4f66-af6e-107b0dd17425'::uuid)
), planes AS (
  SELECT e.plan_id, pp.alumno_id, pp.ciclo_id, pp.tipo_plan
  FROM esperados e LEFT JOIN public.planes_pago pp ON pp.id = e.plan_id
)
SELECT count(DISTINCT pp.plan_id) AS planes_esperados_14,
  count(DISTINCT pp.plan_id) FILTER (WHERE pp.alumno_id IS NOT NULL
    AND pp.ciclo_id = p.destino_id
    AND lower(trim(pp.tipo_plan)) = 'cuatrimestral') AS planes_correctos_esperados_14,
  count(DISTINCT pp.plan_id) FILTER (WHERE pp.ciclo_id = p.origen_id)
    AS planes_aun_en_origen_esperados_0,
  count(DISTINCT r.folio) FILTER (WHERE r.ciclo_id = p.destino_id)
    AS recibos_en_destino_esperados_7,
  count(DISTINCT r.folio) FILTER (WHERE r.ciclo_id = p.origen_id)
    AS recibos_en_origen_esperados_0,
  count(DISTINCT r.folio) FILTER (WHERE r.folio = 41168
    AND r.ciclo_id = p.destino_id) AS folio_41168_en_destino_esperado_1
FROM planes pp
CROSS JOIN parametros p
LEFT JOIN public.recibos r ON r.alumno_id = pp.alumno_id
  AND r.ciclo_id IN (p.origen_id, p.destino_id);
