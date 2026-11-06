-- Solo lectura. Antes de la segunda etapa: se esperan 18 planes pendientes,
-- 10 seleccionados, 3 recibos del plan, 12 independientes, 0 recibos nuevos
-- para esos alumnos y 0 planes alternativos en los dos ciclos.
-- El SQL de corrección repite y amplía estas comprobaciones antes de escribir.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), planes_esperados (alumno_id, plan_id) AS (
  VALUES
    ('292e11e0-cc05-4d73-9d87-f9f9a304f5e2'::uuid, 'fc980b82-1ee0-4fd7-886c-f780ed80ad61'::uuid),
    ('2bac5419-1360-4050-8d86-ab3426610db9'::uuid, 'ea0842d2-2bc3-47bd-b80e-517248658ec7'::uuid),
    ('61f61f9f-6aff-4167-b1be-785a47a16cec'::uuid, '098b4bf2-472c-4627-9acc-98ab8d86203a'::uuid),
    ('7cd77110-8aa4-427f-860d-9252d83f0161'::uuid, 'e60a874c-7979-40dd-9657-6d3d47b550e4'::uuid),
    ('8dd1e09d-fcb8-4655-8db8-9c5d07112d7a'::uuid, 'afab668e-297c-4939-9768-749609cbe05f'::uuid),
    ('90ab0638-5354-4f71-b97c-de438a3ca3ea'::uuid, 'dd5c6eba-06f3-45ec-81fb-c4925a35b390'::uuid),
    ('ab375336-97fd-45d1-9968-bff0ad94a762'::uuid, '8612bfa0-bd67-4dad-a2e2-0ed89e5c10b1'::uuid),
    ('b1cc1833-86df-4711-abfc-972ad2a61f34'::uuid, '5e19a594-ad47-4dcb-9fad-8adc6f0dc087'::uuid),
    ('b541cd2c-0673-4c68-b983-1401584eff32'::uuid, 'ac91f17a-6548-4139-b532-d9b1a0e68923'::uuid),
    ('ebcccfb8-b9ad-4161-9594-f04bb6ad4479'::uuid, '9542edff-65d9-4e13-ba69-8f9f4b29c183'::uuid)
), recibos_esperados (folio, accion) AS (
  VALUES
    (40477, 'CONSERVAR'), (40869, 'CONSERVAR'), (40870, 'CONSERVAR'),
    (41135, 'MOVER'), (41136, 'CONSERVAR'), (40825, 'CONSERVAR'),
    (40102, 'CONSERVAR'), (40129, 'CONSERVAR'), (41166, 'CONSERVAR'),
    (41167, 'MOVER'), (40090, 'CONSERVAR'), (40486, 'CONSERVAR'),
    (40871, 'CONSERVAR'), (40438, 'CONSERVAR'), (41096, 'MOVER')
)
SELECT
  (SELECT count(*) FROM public.planes_pago pp
    WHERE pp.ciclo_id = x.origen_id
      AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
      AND EXISTS (
        SELECT 1 FROM public.alumnos_grupos ag
        JOIN public.grupos g ON g.id = ag.grupo_id
        WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = x.destino_id
      )) AS planes_globales_pendientes_esperados_18,
  (SELECT count(*) FROM planes_esperados e
    JOIN public.planes_pago pp ON pp.id = e.plan_id
      AND pp.alumno_id = e.alumno_id AND pp.ciclo_id = x.origen_id)
    AS planes_etapa2_en_origen_esperados_10,
  (SELECT count(*) FROM recibos_esperados e
    JOIN public.recibos r ON r.folio = e.folio
    JOIN planes_esperados pp ON pp.alumno_id = r.alumno_id
    WHERE e.accion = 'MOVER' AND r.ciclo_id = x.origen_id)
    AS recibos_del_plan_en_origen_esperados_3,
  (SELECT count(*) FROM recibos_esperados e
    JOIN public.recibos r ON r.folio = e.folio
    JOIN planes_esperados pp ON pp.alumno_id = r.alumno_id
    WHERE e.accion = 'CONSERVAR' AND r.ciclo_id = x.origen_id)
    AS recibos_independientes_en_origen_esperados_12,
  (SELECT count(*) FROM public.recibos r
    JOIN planes_esperados pp ON pp.alumno_id = r.alumno_id
    LEFT JOIN recibos_esperados e ON e.folio = r.folio
    WHERE r.ciclo_id = x.origen_id AND e.folio IS NULL)
    AS recibos_no_listados_esperados_0,
  (SELECT count(*) FROM public.planes_pago pp
    JOIN planes_esperados e ON e.alumno_id = pp.alumno_id
    WHERE pp.ciclo_id IN (x.origen_id, x.destino_id)
      AND pp.id <> e.plan_id)
    AS planes_alternativos_esperados_0
FROM parametros x;
