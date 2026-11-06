-- Solo lectura. Explica por qué el plan 271-106 puede o no moverse a
-- 2027-1 Cuatrimestral. No devuelve nombre, matrícula ni importes.
with casos as (
  select p.id, p.alumno_id, p.ciclo_id, p.tipo_plan
  from public.planes_pago p
  join public.ciclos_escolares origen on origen.id = p.ciclo_id
  where p.no_plan_pagos = '271-106' and origen.nombre = '2027-1'
), destino as (
  select id from public.ciclos_escolares
  where nombre = '2027-1' and lower(btrim(tipo_periodo)) = 'cuatrimestral'
)
select c.id as plan_pago_id, c.tipo_plan, c.ciclo_id as ciclo_registrado_id,
  d.id as ciclo_propuesto_id,
  (select count(*) from public.alumno_programas ap
    join public.planes_estudio pe on pe.id = ap.plan_id
    where ap.alumno_id = c.alumno_id and ap.es_vigente is true) as programas_vigentes,
  (select string_agg(distinct pe.tipo_periodo, ', ')
    from public.alumno_programas ap join public.planes_estudio pe on pe.id = ap.plan_id
    where ap.alumno_id = c.alumno_id and ap.es_vigente is true) as tipos_programa_vigente,
  (select count(distinct g.plan_id) from public.alumnos_grupos ag
    join public.grupos g on g.id = ag.grupo_id
    where ag.alumno_id = c.alumno_id and g.ciclo_id = d.id) as planes_academicos_en_grupo_destino,
  (select count(distinct g.plan_id) from public.alumnos_grupos ag
    join public.grupos g on g.id = ag.grupo_id
    join public.alumno_programas ap on ap.alumno_id = ag.alumno_id
      and ap.plan_id = g.plan_id and ap.es_vigente is true
    where ag.alumno_id = c.alumno_id and g.ciclo_id = d.id)
    as grupos_destino_del_programa_vigente,
  (select count(*) from public.alumnos_grupos ag
    join public.grupos g on g.id = ag.grupo_id
    where ag.alumno_id = c.alumno_id and g.ciclo_id = c.ciclo_id) as grupos_en_origen,
  (select count(*) from public.planes_pago otro
    where otro.alumno_id = c.alumno_id and otro.id <> c.id
      and otro.ciclo_id in (c.ciclo_id, d.id)) as otros_planes_en_ambos_ciclos,
  (select count(*) from public.recibos r
    where r.alumno_id = c.alumno_id and r.ciclo_id = c.ciclo_id) as recibos_conservables_en_origen
from casos c cross join destino d;
