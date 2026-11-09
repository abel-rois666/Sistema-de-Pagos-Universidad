-- Solo metadatos; no expone datos personales ni ejecuta funciones de escritura.
select nombre,to_regclass('public.'||nombre) tabla from unnest(array['planes_pago','planes_pago_detalles','recibos','recibos_detalles','planes_pago_vinculos_recibo','planes_pago_excedentes_monedero','usuarios']) nombre;
select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.prosecdef,p.proconfig,
 md5(pg_get_functiondef(p.oid)) huella_definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('registrar_pago_transaccional_v2','vincular_recibo_detalle_planes_v2','vincular_recibo_detalle_planes_v3','conciliar_recibo_detalle_plan','desvincular_detalle_recibo_plan','sincronizar_detalles_plan_pago_editado') order by p.proname;
select tgrelid::regclass tabla,tgname,pg_get_triggerdef(oid) definicion from pg_trigger where not tgisinternal
and tgrelid in (to_regclass('public.planes_pago'),to_regclass('public.planes_pago_detalles'),to_regclass('public.recibos_detalles'));
