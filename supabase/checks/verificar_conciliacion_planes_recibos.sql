-- Solo lectura. Ejecutar después de instalar la migración; no llama RPC con p_aplicar.
select
  to_regclass('public.planes_pago_vinculos_recibo') is not null as tabla_vinculos_presente,
  to_regprocedure('public.revisar_reasociacion_con_recibos(uuid,uuid,boolean)') is not null
    as revision_con_recibos_presente,
  to_regprocedure('public.conciliar_recibo_detalle_plan(uuid,uuid,integer,numeric,boolean)') is not null
    as conciliacion_individual_presente,
  to_regprocedure('public.desvincular_detalle_recibo_plan(uuid)') is not null
    as desvinculacion_presente,
  to_regprocedure('public.registrar_pago_transaccional_v2(jsonb,jsonb,uuid,jsonb,uuid,numeric)') is not null
    as cobro_v2_presente,
  to_regprocedure('public.vincular_recibo_detalle_planes_v2(uuid,jsonb)') is not null
    as vinculacion_v2_presente,
  exists (select 1 from pg_trigger
    where tgrelid = 'public.recibos_detalles'::regclass
      and tgname = 'validar_vinculo_explicito_detalle' and not tgisinternal)
    as validacion_vinculo_nuevo_presente,
  (select relrowsecurity from pg_class where oid = 'public.planes_pago_vinculos_recibo'::regclass)
    as rls_activa;

select
  count(*) as vinculos_totales,
  count(*) filter (where anulado_en is null) as vinculos_vigentes,
  count(*) filter (where anulado_en is not null) as vinculos_anulados,
  count(*) filter (where origen = 'COBRO') as vinculos_de_cobro,
  count(*) filter (where origen = 'CONCILIACION') as vinculos_conciliados
from public.planes_pago_vinculos_recibo;
