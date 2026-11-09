\set ON_ERROR_STOP on
do $$begin if current_database()<>'ensayo_finanzas' then raise exception 'Solo ensayo_finanzas';end if;end$$;
select set_config('request.jwt.claim.sub',public.u('usuario')::text,false),set_config('request.jwt.claim.rol','COORDINADOR FINANCIERO',false);
select comprobar('BAJA requiere revisión financiera',saldo_concepto_financiero_v1(1000,'BAJA') is null);
select comprobar('CANCELADO requiere revisión financiera',saldo_concepto_financiero_v1(1000,'CANCELADO') is null);
select comprobar('NO PAGADO acepta espacios legados',saldo_concepto_financiero_v1(1000,' NO   PAGADO ')=1000);
insert into planes_pago(id,alumno_id,ciclo_id,tipo_plan,concepto_18,cantidad_18,estatus_18)
 values(u('p-legado'),u('alumno'),u('c1'),'Cuatrimestral','CONCEPTO LEGADO 18',100,'');
select guardar_observacion_plan_v1(u('p-legado'),18,'PENDIENTE','R-45');
select comprobar('Índice legado 18 y estatus vacío editables',(select estatus_18='R-45' from planes_pago where id=u('p-legado')));
select comprobar('Edición legada no materializa detalles',not exists(select 1 from planes_pago_detalles where plan_id=u('p-legado')));
select count(*) comprobaciones_ok from ensayo_resultados;
