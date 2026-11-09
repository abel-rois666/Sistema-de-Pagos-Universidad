\set ON_ERROR_STOP on
do $$begin if current_database()<>'ensayo_finanzas' then raise exception 'Solo ensayo_finanzas';end if;end$$;
select set_config('request.jwt.claim.sub',public.u('usuario')::text,false),set_config('request.jwt.claim.rol','COORDINADOR FINANCIERO',false);
update usuarios set activo=true;
create function public.rechazo_auditoria_ensayo() returns trigger language plpgsql as $$begin
 if new.entidad_id=public.u('d6') and new.operacion='APLICAR_RECIBO' then raise exception 'Rechazo simulado posterior a la aplicación';end if;
 return new;
end$$;
create trigger rechazo_ensayo before insert on public.finanzas_operaciones_auditoria for each row execute function public.rechazo_auditoria_ensayo();
do $$declare d jsonb; r jsonb;begin
 d:=jsonb_build_array(jsonb_build_object('plan_id',u('p1'),'indice',2));
 r:=vinculacion_financiera_v1(u('d6'),d,'aplicar');
 begin perform vinculacion_financiera_v1(u('d6'),d,'aplicar',true,r->>'revision');raise exception 'No falló auditoría';
 exception when others then if sqlerrm<>'Rechazo simulado posterior a la aplicación' then raise;end if;end;
 perform comprobar('Fallo posterior revierte vínculo',not exists(select 1 from planes_pago_vinculos_recibo where recibo_detalle_id=u('d6')));
 perform comprobar('Fallo posterior revierte estado',(select estatus_2='PENDIENTE' from planes_pago where id=u('p1')));
 perform comprobar('Fallo posterior conserva dinero',(select saldo_a_favor=250 from alumnos where id=u('alumno')));
end$$;
drop trigger rechazo_ensayo on public.finanzas_operaciones_auditoria;
insert into planes_pago(id,alumno_id,ciclo_id,tipo_plan,concepto_1,cantidad_1,estatus_1,concepto_2,cantidad_2,estatus_2)
 values(u('p4'),u('alumno'),u('c1'),'Cuatrimestral','PRIMERO',50,'PENDIENTE','SEGUNDO',30,'PENDIENTE');
do $$declare d jsonb;r jsonb;begin
 d:=jsonb_build_array(jsonb_build_object('plan_id',u('p4'),'indice',1),jsonb_build_object('plan_id',u('p4'),'indice',2));
 r:=vinculacion_financiera_v1(u('d7'),d,'aplicar');
 perform comprobar('Distribución previa 50 más 30 y excedente 20',(r->>'aplicado_total')::numeric=80 and (r->>'remanente')::numeric=20);
 perform vinculacion_financiera_v1(u('d7'),d,'aplicar',true,r->>'revision');
 perform comprobar('Distribución múltiple registra ambos conceptos',(select count(*)=2 and sum(importe)=80 from planes_pago_vinculos_recibo where recibo_detalle_id=u('d7')));
 perform comprobar('Excedente múltiple se acredita al terminar',(select saldo_a_favor=270 from alumnos where id=u('alumno')));
end$$;
select count(*) comprobaciones_ok from ensayo_resultados;
