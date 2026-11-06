-- Solo lectura. Ejecutar después de la segunda etapa para comprobar que se
-- movieron 10 planes y 3 recibos del plan, y que 12 recibos de trámites
-- independientes permanecieron en el ciclo original. Un plan en destino con
-- uno de esos recibos en origen es intencional y no indica fallo por sí solo.
WITH parametros AS (
  SELECT
    '0d7186e7-00dc-46e0-9eb6-526b8fc9dc83'::uuid AS origen_id,
    '93a9e5d8-da9f-4d20-9dfc-75334add0464'::uuid AS destino_id
), planes_esperados (plan_id) AS (
  VALUES
    ('fc980b82-1ee0-4fd7-886c-f780ed80ad61'::uuid),
    ('ea0842d2-2bc3-47bd-b80e-517248658ec7'::uuid),
    ('098b4bf2-472c-4627-9acc-98ab8d86203a'::uuid),
    ('e60a874c-7979-40dd-9657-6d3d47b550e4'::uuid),
    ('afab668e-297c-4939-9768-749609cbe05f'::uuid),
    ('dd5c6eba-06f3-45ec-81fb-c4925a35b390'::uuid),
    ('8612bfa0-bd67-4dad-a2e2-0ed89e5c10b1'::uuid),
    ('5e19a594-ad47-4dcb-9fad-8adc6f0dc087'::uuid),
    ('ac91f17a-6548-4139-b532-d9b1a0e68923'::uuid),
    ('9542edff-65d9-4e13-ba69-8f9f4b29c183'::uuid)
), recibos_esperados (folio, accion) AS (
  VALUES
    (40477, 'CONSERVAR'), (40869, 'CONSERVAR'), (40870, 'CONSERVAR'),
    (41135, 'MOVER'), (41136, 'CONSERVAR'), (40825, 'CONSERVAR'),
    (40102, 'CONSERVAR'), (40129, 'CONSERVAR'), (41166, 'CONSERVAR'),
    (41167, 'MOVER'), (40090, 'CONSERVAR'), (40486, 'CONSERVAR'),
    (40871, 'CONSERVAR'), (40438, 'CONSERVAR'), (41096, 'MOVER')
)
SELECT
  (SELECT count(*) FROM planes_esperados e
    JOIN public.planes_pago pp ON pp.id = e.plan_id
    WHERE pp.ciclo_id = p.destino_id) AS planes_etapa2_en_destino_esperados_10,
  (SELECT count(*) FROM recibos_esperados e
    JOIN public.recibos r ON r.folio = e.folio
    WHERE e.accion = 'MOVER' AND r.ciclo_id = p.destino_id)
    AS recibos_del_plan_en_destino_esperados_3,
  (SELECT count(*) FROM recibos_esperados e
    JOIN public.recibos r ON r.folio = e.folio
    WHERE e.accion = 'CONSERVAR' AND r.ciclo_id = p.origen_id)
    AS recibos_independientes_en_origen_esperados_12,
  (SELECT count(*) FROM public.planes_pago pp
    WHERE pp.ciclo_id = p.origen_id
      AND lower(trim(pp.tipo_plan)) = 'cuatrimestral'
      AND EXISTS (
        SELECT 1 FROM public.alumnos_grupos ag
        JOIN public.grupos g ON g.id = ag.grupo_id
        WHERE ag.alumno_id = pp.alumno_id AND g.ciclo_id = p.destino_id
      )) AS planes_pendientes_esperados_8
FROM parametros p;
