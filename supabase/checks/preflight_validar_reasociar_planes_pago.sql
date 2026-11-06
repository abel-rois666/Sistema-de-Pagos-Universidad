-- Solo lectura. Revisar antes de aplicar 20261018120000_validar_y_reasociar_planes_pago.sql.
select
  to_regprocedure('public.get_my_rol()') is not null as rol_disponible,
  to_regclass('public.planes_pago') is not null as planes_pago_disponible,
  to_regclass('public.planes_pago_detalles') is not null as detalles_plan_disponibles,
  to_regclass('public.recibos') is not null as recibos_disponibles,
  to_regclass('public.recibos_detalles') is not null as detalles_recibo_disponibles,
  to_regclass('public.alumno_programas') is not null as programas_disponibles,
  to_regclass('public.alumnos_grupos') is not null as alumnos_grupos_disponibles,
  to_regclass('public.grupos') is not null as grupos_disponibles,
  to_regclass('public.planes_estudio') is not null as planes_academicos_disponibles;

-- La migración no corrige filas históricas. Este conteo ayuda a estimar
-- cuántas altas previas requieren revisión separada.
select c.tipo_periodo as tipo_ciclo, pp.tipo_plan, count(*) as planes
from public.planes_pago pp
join public.ciclos_escolares c on c.id = pp.ciclo_id
where lower(trim(coalesce(pp.tipo_plan, ''))) in ('semestral', 'cuatrimestral')
  and lower(trim(coalesce(pp.tipo_plan, ''))) <> lower(trim(coalesce(c.tipo_periodo, '')))
group by c.tipo_periodo, pp.tipo_plan
order by c.tipo_periodo, pp.tipo_plan;
