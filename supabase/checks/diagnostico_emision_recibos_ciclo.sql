-- Solo lectura. Ejecutar en el proyecto Supabase usado por producción.
-- No devuelve alumnos, folios, importes ni credenciales.

select
  to_regprocedure('public.registrar_pago_transaccional(jsonb,jsonb,uuid,jsonb,uuid,numeric)') is not null
    as funcion_cobro_anterior_presente,
  to_regprocedure('public.registrar_pago_transaccional_v2(jsonb,jsonb,uuid,jsonb,uuid,numeric)') is not null
    as funcion_cobro_v2_presente,
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'planes_pago'
      and t.tgname = 'validar_periodicidad_plan_pago'
      and not t.tgisinternal and t.tgenabled <> 'D'
  ) as validacion_periodicidad_plan_activa,
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'recibos_detalles'
      and t.tgname = 'validar_vinculo_explicito_detalle'
      and not t.tgisinternal and t.tgenabled <> 'D'
  ) as vinculo_explicito_obligatorio;

select
  c.nombre as ciclo,
  c.tipo_periodo as tipo_ciclo,
  pp.tipo_plan,
  count(*) as planes,
  count(*) filter (where lower(btrim(coalesce(pp.tipo_plan, ''))) like '%cuatrimestral%'
    and lower(btrim(coalesce(c.tipo_periodo, ''))) <> 'cuatrimestral'
    or lower(btrim(coalesce(pp.tipo_plan, ''))) like '%semestral%'
    and lower(btrim(coalesce(c.tipo_periodo, ''))) <> 'semestral') as planes_con_tipo_incompatible
from public.planes_pago pp
join public.ciclos_escolares c on c.id = pp.ciclo_id
where c.nombre in (
  select nombre from public.ciclos_escolares
  group by nombre having count(distinct lower(btrim(tipo_periodo))) > 1
)
group by c.nombre, c.tipo_periodo, pp.tipo_plan
order by c.nombre desc, c.tipo_periodo, pp.tipo_plan;
