-- Ejecutar en el ensayo ficticio tras finanzasOperaciones, Casos, Rollback y Legados.
\set ON_ERROR_STOP on
do $$begin if current_database()<>'ensayo_finanzas' then raise exception 'Solo ensayo_finanzas';end if;end$$;
\ir ../../supabase/migrations/20261106150000_conciliacion_recibos_entre_periodos.sql
begin;
select set_config('request.jwt.claim.sub',u('usuario')::text,false),set_config('request.jwt.claim.rol','COORDINADOR FINANCIERO',false);
update usuarios set activo=true;
insert into planes_pago(id,alumno_id,ciclo_id,tipo_plan,concepto_1,cantidad_1,estatus_1)
 select u('xp'||n),u('alumno'),u('c1'),'Cuatrimestral','CONCEPTO DESTINO DIFERENTE',case when n=2 then 300 else 1000 end,'PENDIENTE' from generate_series(1,9)n;
insert into planes_pago_detalles(plan_id,indice_concepto,concepto,cantidad,estatus)
 select id,1,concepto_1,cantidad_1,estatus_1 from planes_pago where id in (select u('xp'||n) from generate_series(1,9)n);
insert into recibos(id,alumno_id,ciclo_id,fecha_recibo,fecha_pago,total,forma_pago,banco,requiere_factura,estatus_factura)
 select u('xr'||n),u('alumno'),case when n=3 then u('c1') else u('c3') end,current_date,current_date,
 case when n=1 then 800 when n=2 then 300 when n=4 then 500 else 400 end,'EFECTIVO','NO APLICA',true,'PENDIENTE' from generate_series(1,14)n;
insert into recibos_detalles(id,recibo_id,cantidad,concepto,costo_unitario,subtotal)
 select u('xd'||n),u('xr'||n),1,'PRIMER PAGO CON COSTO PROMOCIONAL',total,total from recibos r join generate_series(1,14)n on r.id=u('xr'||n);
create table public.snapshot_entre_periodos as select to_jsonb(r) recibo,to_jsonb(d) detalle from recibos r join recibos_detalles d on d.recibo_id=r.id where d.id=u('xd1');

do $$declare r jsonb;begin
 r:=conciliar_recibo_entre_periodos_v1(u('xd1'),u('xp1'),1,400,'historico','PAGO_ANTICIPADO','Solicitud de anticipo comprobada');
 perform comprobar('Entre periodos: vista previa no escribe',not exists(select 1 from planes_pago_vinculos_recibo where recibo_detalle_id=u('xd1')));
 perform comprobar('Entre periodos: origen disponible comprobado',(r->>'disponible_origen')::numeric=800);
 perform conciliar_recibo_entre_periodos_v1(u('xd1'),u('xp1'),1,400,'historico','PAGO_ANTICIPADO','Solicitud de anticipo comprobada',true,r->>'revision');
 perform comprobar('Histórico entre periodos conserva recibo completo',(select to_jsonb(rr)=s.recibo from recibos rr cross join snapshot_entre_periodos s where rr.id=u('xr1')));
 perform comprobar('Histórico entre periodos conserva detalle completo',(select to_jsonb(d)=s.detalle from recibos_detalles d cross join snapshot_entre_periodos s where d.id=u('xd1')));
 perform comprobar('Histórico entre periodos conserva monedero',(select saldo_a_favor=270 from alumnos where id=u('alumno')));
 perform comprobar('Histórico entre periodos conserva texto del plan',(select estatus_1='PENDIENTE' from planes_pago where id=u('xp1')));
 perform comprobar('Histórico entre periodos audita motivo y evidencia',exists(select 1 from finanzas_operaciones_auditoria where entidad_id=u('xd1') and despues->>'motivo'='PAGO_ANTICIPADO' and despues->>'evidencia'='Solicitud de anticipo comprobada'));
 perform comprobar('Vínculo histórico reduce saldo sin doble conteo',saldo_aplicable_concepto_v1(u('xp1'),1,1000,'PENDIENTE')=600);
 r:=conciliar_recibo_entre_periodos_v1(u('xd2'),u('xp1'),1,300,'historico','REGULARIZACION_HISTORICA','Expediente y pago verificados');
 perform conciliar_recibo_entre_periodos_v1(u('xd2'),u('xp1'),1,300,'historico','REGULARIZACION_HISTORICA','Expediente y pago verificados',true,r->>'revision');
 perform comprobar('Dos históricos parciales acumulan 700',(select sum(importe)=700 from planes_pago_vinculos_recibo where plan_id=u('xp1')));
 r:=vinculacion_financiera_v1(u('xd3'),jsonb_build_array(jsonb_build_object('plan_id',u('xp1'),'indice',1)),'aplicar');
 perform comprobar('Aplicación habitual respeta vínculos históricos',(r->>'aplicado_total')::numeric=300 and (r->>'remanente')::numeric=100);
 perform vinculacion_financiera_v1(u('xd3'),jsonb_build_array(jsonb_build_object('plan_id',u('xp1'),'indice',1)),'aplicar',true,r->>'revision');
 perform comprobar('Destino nunca excede 1000',(select sum(importe)=1000 from planes_pago_vinculos_recibo where plan_id=u('xp1')));
 perform comprobar('Monedero solo recibe excedente nuevo',(select saldo_a_favor=370 from alumnos where id=u('alumno')));
end$$;

do $$declare r jsonb;begin
 r:=conciliar_recibo_entre_periodos_v1(u('xd4'),u('xp2'),1,null,'aplicar','PAGO_ANTICIPADO','Anticipo sin aplicación anterior');
 perform comprobar('Anticipo revisado aplica 300 y excedente 200',(r->>'aplicado_total')::numeric=300 and (r->>'remanente')::numeric=200);
 perform conciliar_recibo_entre_periodos_v1(u('xd4'),u('xp2'),1,null,'aplicar','PAGO_ANTICIPADO','Anticipo sin aplicación anterior',true,r->>'revision');
 perform comprobar('Anticipo acredita monedero una vez',(select saldo_a_favor=570 from alumnos where id=u('alumno')));
 perform comprobar('Anticipo registra bitácora excedente',(select importe=200 from planes_pago_excedentes_monedero where recibo_detalle_id=u('xd4')));
 perform comprobar('Anticipo conserva ciclo y facturación pendiente',(select ciclo_id=u('c3') and requiere_factura and estatus_factura='PENDIENTE' and total=500 from recibos where id=u('xr4')));
 perform comprobar('Anticipo sincroniza estado en plan y detalle',(select p.estatus_1=d.estatus and d.estatus like '%Pagado $300.00%' from planes_pago p join planes_pago_detalles d on d.plan_id=p.id where p.id=u('xp2')));
 begin perform conciliar_recibo_entre_periodos_v1(u('xd4'),u('xp2'),1,null,'aplicar','PAGO_ANTICIPADO','Anticipo sin aplicación anterior',true,r->>'revision');raise exception 'FALLO_DUPLICADO';
 exception when others then if sqlerrm='FALLO_DUPLICADO' then raise;end if;perform comprobar('Reintento no vuelve a acreditar',(select saldo_a_favor=570 from alumnos where id=u('alumno')));end;
 begin perform desvincular_detalle_recibo_plan(u('xd4'));raise exception 'FALLO_DESVINCULAR';
 exception when others then if sqlerrm='FALLO_DESVINCULAR' then raise;end if;perform comprobar('Excedente conserva bloqueo de desvinculación',true);end;
 -- Un remanente ya acreditado nunca se presenta como dinero histórico disponible.
 begin perform conciliar_recibo_entre_periodos_v1(u('xd4'),u('xp3'),1,200,'historico','OTRO','Revisión del remanente del anticipo');raise exception 'FALLO_REMANENTE';
 exception when others then if sqlerrm='FALLO_REMANENTE' then raise;end if;perform comprobar('Histórico descuenta excedente ya acreditado',true);end;
end$$;

-- Casos inválidos verifican que el servidor no depende de controles de la interfaz.
do $$declare r jsonb;begin
 begin perform conciliar_recibo_entre_periodos_v1(u('xd5'),u('xp3'),1,400,'historico','OTRO','');raise exception 'FALLO_RESPALDO';exception when others then if sqlerrm='FALLO_RESPALDO' then raise;end if;perform comprobar('Rechaza respaldo vacío',true);end;
 begin perform conciliar_recibo_entre_periodos_v1(u('xd5'),u('xp3'),1,400,'historico','INVENTADO','Detalle revisado');raise exception 'FALLO_MOTIVO';exception when others then if sqlerrm='FALLO_MOTIVO' then raise;end if;perform comprobar('Rechaza motivo desconocido',true);end;
 begin perform conciliar_recibo_entre_periodos_v1(u('xd5'),u('xp3'),1,400.001,'historico','OTRO','Detalle revisado');raise exception 'FALLO_DECIMALES';exception when others then if sqlerrm='FALLO_DECIMALES' then raise;end if;perform comprobar('Rechaza más de dos decimales',true);end;
 begin perform conciliar_recibo_entre_periodos_v1(u('xd5'),u('xp3'),1,401,'historico','OTRO','Detalle revisado');raise exception 'FALLO_MONTO';exception when others then if sqlerrm='FALLO_MONTO' then raise;end if;perform comprobar('Rechaza importe superior al recibo',true);end;
 r:=conciliar_recibo_entre_periodos_v1(u('xd5'),u('xp3'),1,400,'historico','OTRO','Detalle revisado');
 begin perform conciliar_recibo_entre_periodos_v1(u('xd5'),u('xp3'),1,400,'historico','OTRO','Respaldo distinto',true,r->>'revision');raise exception 'FALLO_REVISION';exception when serialization_failure then perform comprobar('Cambiar respaldo invalida revisión',true);end;
 update planes_pago set cantidad_1=900 where id=u('xp3');
 begin perform conciliar_recibo_entre_periodos_v1(u('xd5'),u('xp3'),1,400,'historico','OTRO','Detalle revisado',true,r->>'revision');raise exception 'FALLO_CONFLICTO';exception when serialization_failure then perform comprobar('Cambio concurrente invalida revisión',true);end;
 update recibos set estatus='CANCELADO' where id=u('xr5');
 begin perform conciliar_recibo_entre_periodos_v1(u('xd5'),u('xp3'),1,400,'historico','OTRO','Detalle revisado');raise exception 'FALLO_CANCELADO';exception when others then if sqlerrm='FALLO_CANCELADO' then raise;end if;perform comprobar('Rechaza recibo cancelado',true);end;
 update recibos set alumno_id=u('otro-alumno') where id=u('xr6');
 begin perform conciliar_recibo_entre_periodos_v1(u('xd6'),u('xp3'),1,400,'historico','OTRO','Detalle revisado');raise exception 'FALLO_ALUMNO';exception when others then if sqlerrm='FALLO_ALUMNO' then raise;end if;perform comprobar('Rechaza otro alumno',true);end;
end$$;

select set_config('request.jwt.claim.rol','CAJERO',false);
do $$begin
 begin perform conciliar_recibo_entre_periodos_v1(u('xd7'),u('xp3'),1,null,'aplicar','OTRO','Detalle revisado');raise exception 'FALLO_ROL';exception when insufficient_privilege then perform comprobar('Caja no aplica entre periodos',true);end;
end$$;
select set_config('request.jwt.claim.rol','COORDINADOR FINANCIERO',false);
update usuarios set activo=false;
do $$begin
 begin perform conciliar_recibo_entre_periodos_v1(u('xd7'),u('xp3'),1,400,'historico','OTRO','Detalle revisado');raise exception 'FALLO_ACTIVO';exception when insufficient_privilege then perform comprobar('Inactivo no concilia entre periodos',true);end;
end$$;
update usuarios set activo=true;
select comprobar('Nueva RPC no es anónima',not has_function_privilege('anon','public.conciliar_recibo_entre_periodos_v1(uuid,uuid,integer,numeric,text,text,text,boolean,text)','execute'));
select comprobar('Helper no expone saldos directamente',not has_function_privilege('authenticated','public.saldo_aplicable_concepto_v1(uuid,integer,numeric,text)','execute'));

-- Fallo al final debe revertir vínculo, estados y monedero juntos.
create or replace function public.rechazo_auditoria_ensayo() returns trigger language plpgsql as $$begin
 if new.entidad_id=public.u('xd8') then raise exception 'Rechazo final simulado';end if;return new;end$$;
create trigger rechazo_ensayo before insert on public.finanzas_operaciones_auditoria for each row execute function public.rechazo_auditoria_ensayo();
do $$declare r jsonb;begin
 update planes_pago set cantidad_1=200 where id=u('xp4');
 r:=conciliar_recibo_entre_periodos_v1(u('xd8'),u('xp4'),1,null,'aplicar','PAGO_ANTICIPADO','Expediente de anticipo revisado');
 begin perform conciliar_recibo_entre_periodos_v1(u('xd8'),u('xp4'),1,null,'aplicar','PAGO_ANTICIPADO','Expediente de anticipo revisado',true,r->>'revision');raise exception 'FALLO_ROLLBACK';exception when others then if sqlerrm<>'Rechazo final simulado' then raise;end if;end;
 perform comprobar('Fallo auditoría revierte vínculo entre periodos',not exists(select 1 from planes_pago_vinculos_recibo where recibo_detalle_id=u('xd8')));
 perform comprobar('Fallo auditoría revierte excedente entre periodos',not exists(select 1 from planes_pago_excedentes_monedero where recibo_detalle_id=u('xd8')));
 perform comprobar('Fallo auditoría revierte estado entre periodos',(select estatus_1='PENDIENTE' from planes_pago where id=u('xp4')));
 perform comprobar('Fallo auditoría conserva monedero entre periodos',(select saldo_a_favor=570 from alumnos where id=u('alumno')));
end$$;
drop trigger rechazo_ensayo on public.finanzas_operaciones_auditoria;

-- Desvincular no borra los antecedentes que impiden convertir un histórico en dinero nuevo.
do $$declare r jsonb;begin
 r:=conciliar_recibo_entre_periodos_v1(u('xd9'),u('xp5'),1,400,'historico','OTRO','Pago histórico comprobado');
 perform conciliar_recibo_entre_periodos_v1(u('xd9'),u('xp5'),1,400,'historico','OTRO','Pago histórico comprobado',true,r->>'revision');
 perform desvincular_detalle_recibo_plan(u('xd9'));
 begin perform conciliar_recibo_entre_periodos_v1(u('xd9'),u('xp5'),1,null,'aplicar','OTRO','Pago histórico comprobado');raise exception 'FALLO_REAPLICAR';exception when others then if sqlerrm='FALLO_REAPLICAR' then raise;end if;perform comprobar('Desvincular no habilita anticipo nuevo',true);end;
 begin perform vinculacion_financiera_v1(u('xd9'),jsonb_build_array(jsonb_build_object('plan_id',u('xp5'),'indice',1)),'aplicar');raise exception 'FALLO_RUTA_ANTERIOR';exception when others then if sqlerrm='FALLO_RUTA_ANTERIOR' then raise;end if;perform comprobar('Ruta habitual respeta antecedente histórico anulado',true);end;
 begin perform vincular_recibo_detalle_planes_v3(u('xd9'),jsonb_build_array(jsonb_build_object('plan_id',u('xp5'),'indice',1)));raise exception 'FALLO_V3';exception when others then if sqlerrm='FALLO_V3' then raise;end if;perform comprobar('V3 directa respeta antecedente histórico anulado',true);end;
 update recibos_detalles set observaciones='Excedente enviado a monedero' where id=u('xd10');
 begin perform conciliar_recibo_entre_periodos_v1(u('xd10'),u('xp6'),1,100,'historico','OTRO','Saldo histórico por revisar');raise exception 'FALLO_MONEDERO_AMBIGUO';exception when others then if sqlerrm='FALLO_MONEDERO_AMBIGUO' then raise;end if;perform comprobar('Monedero sin importe comprobable exige revisión',true);end;
 update recibos set ciclo_id=null where id=u('xr11');
 begin perform conciliar_recibo_entre_periodos_v1(u('xd11'),u('xp6'),1,100,'historico','OTRO','Saldo histórico por revisar');raise exception 'FALLO_SIN_CICLO';exception when others then if sqlerrm='FALLO_SIN_CICLO' then raise;end if;perform comprobar('Sin ciclo no se elige uno implícitamente',true);end;
 update planes_pago set tipo_plan='Semestral' where id=u('xp7');
 begin perform conciliar_recibo_entre_periodos_v1(u('xd12'),u('xp7'),1,100,'historico','OTRO','Saldo histórico por revisar');raise exception 'FALLO_TIPO';exception when others then if sqlerrm='FALLO_TIPO' then raise;end if;perform comprobar('Plan mal asociado requiere corrección previa',true);end;
 update planes_pago set concepto_2='RESIDUAL',cantidad_2=100 where id=u('xp8');
 delete from planes_pago_detalles where plan_id=u('xp8') and indice_concepto=2;
 begin perform conciliar_recibo_entre_periodos_v1(u('xd13'),u('xp8'),2,100,'historico','OTRO','Saldo histórico por revisar');raise exception 'FALLO_RESIDUAL';exception when others then if sqlerrm='FALLO_RESIDUAL' then raise;end if;perform comprobar('No habilita índice legado residual',true);end;
end$$;
select count(*) comprobaciones_totales_ok from ensayo_resultados;
rollback;
