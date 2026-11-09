-- Solo lectura: no contiene datos de alumnos, importes o credenciales.
select nombre,to_regprocedure(nombre) is not null instalada
from unnest(array[
 'public.vinculacion_financiera_v1(uuid,jsonb,text,boolean,text)',
 'public.vincular_recibo_detalle_planes_v2(uuid,jsonb)',
 'public.vincular_recibo_detalle_planes_v3(uuid,jsonb)',
 'public.saldo_concepto_financiero_v1(numeric,text)',
 'public.desvincular_detalle_recibo_plan(uuid)']) nombre;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('planes_pago_vinculos_recibo','planes_pago_excedentes_monedero','finanzas_operaciones_auditoria');
select p.proname,md5(pg_get_functiondef(p.oid)) huella,pg_get_functiondef(p.oid) definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('vinculacion_financiera_v1','vincular_recibo_detalle_planes_v2','vincular_recibo_detalle_planes_v3');
select c.relname,t.tgname,pg_get_triggerdef(t.oid) definicion from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public'
and c.relname in ('planes_pago','planes_pago_detalles','planes_pago_vinculos_recibo','recibos','recibos_detalles');
