-- Solo lectura. No presume que un plan vacío haya perdido contenido:
-- distingue detalles normalizados, campos legados y una fuente previa comprobable.
-- Un solo SELECT para que Supabase SQL Editor muestre las filas diagnosticadas.

with planes_2027 as (
  select pp.*, c.nombre as nombre_ciclo, c.tipo_periodo as periodo_ciclo,
    c.fecha_inicio as inicio_ciclo
  from public.planes_pago pp
  join public.ciclos_escolares c on c.id = pp.ciclo_id
  where c.nombre = '2027-1' and lower(btrim(c.tipo_periodo)) in ('cuatrimestral', 'semestral')
), diagnostico as (
  select p.id as plan_pago_id, p.alumno_id, p.ciclo_id,
    p.periodo_ciclo, p.tipo_plan, p.created_at as creado_en,
    actuales.total_detalles, actuales.detalles_con_concepto, legados.campos_con_concepto,
    anteriores.plan_anterior_id, anteriores.ciclo_anterior,
    anteriores.periodo_anterior, anteriores.detalles_anteriores,
    anteriores.campos_anteriores,
    (select count(*) from public.recibos r
      where r.alumno_id = p.alumno_id and r.ciclo_id = p.ciclo_id) as recibos_ciclo_actual,
    (select count(*) from public.planes_pago otro
      where otro.alumno_id = p.alumno_id and otro.ciclo_id = p.ciclo_id) as planes_mismo_ciclo
  from planes_2027 p
  cross join lateral (
    select count(*) as total_detalles,
      count(*) filter (where nullif(btrim(d.concepto), '') is not null) as detalles_con_concepto
    from public.planes_pago_detalles d where d.plan_id = p.id
  ) actuales
  cross join lateral (
    select count(*) as campos_con_concepto from generate_series(1, 18) as i(indice)
    where nullif(btrim(coalesce(to_jsonb(p) ->> ('concepto_' || i.indice), '')), '') is not null
  ) legados
  left join lateral (
    select previo.id as plan_anterior_id, cp.nombre as ciclo_anterior,
      cp.tipo_periodo as periodo_anterior, d.conteo as detalles_anteriores,
      l.conteo as campos_anteriores
    from public.planes_pago previo
    join public.ciclos_escolares cp on cp.id = previo.ciclo_id
    cross join lateral (
      select count(*) as conteo from public.planes_pago_detalles dp
      where dp.plan_id = previo.id and nullif(btrim(dp.concepto), '') is not null
    ) d
    cross join lateral (
      select count(*) as conteo from generate_series(1, 18) as i(indice)
      where nullif(btrim(coalesce(to_jsonb(previo) ->> ('concepto_' || i.indice), '')), '') is not null
    ) l
    where previo.alumno_id = p.alumno_id and previo.id <> p.id
      and lower(btrim(cp.tipo_periodo)) = lower(btrim(p.periodo_ciclo))
      and lower(btrim(coalesce(previo.tipo_plan, ''))) = lower(btrim(p.periodo_ciclo))
      and (d.conteo > 0 or l.conteo > 0)
      and case
        when cp.fecha_inicio is not null and p.inicio_ciclo is not null
          then cp.fecha_inicio < p.inicio_ciclo
        when cp.nombre ~ '^[0-9]{4}-[0-9]+$'
          and p.nombre_ciclo ~ '^[0-9]{4}-[0-9]+$'
          then (split_part(cp.nombre, '-', 1)::integer,
                split_part(cp.nombre, '-', 2)::integer)
            < (split_part(p.nombre_ciclo, '-', 1)::integer,
               split_part(p.nombre_ciclo, '-', 2)::integer)
        else false end
    order by cp.fecha_inicio desc nulls last, previo.created_at desc, previo.id desc
    limit 1
  ) anteriores on true
)
select *, case
  when detalles_con_concepto > 0 then 'DETALLES CON CONTENIDO: CONSERVAR'
  when total_detalles > 0 and campos_con_concepto > 0 then 'DETALLES VACÍOS OCULTAN CAMPOS LEGADOS'
  when campos_con_concepto > 0 then 'CAMPOS LEGADOS CON CONTENIDO: CONSERVAR'
  when recibos_ciclo_actual > 0 then 'VACÍO CON RECIBOS: REVISIÓN FINANCIERA'
  when planes_mismo_ciclo > 1 then 'VARIOS PLANES DEL CICLO: REVISAR'
  when plan_anterior_id is null then 'VACÍO SIN FUENTE ANTERIOR COMPROBABLE'
  else 'CANDIDATO A RECUPERACIÓN, REVISAR FILAS E IMPORTES' end as clasificacion
from diagnostico
where detalles_con_concepto = 0
order by clasificacion, periodo_ciclo, creado_en, plan_pago_id;
