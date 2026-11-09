-- Ejecutar después de finanzasOperaciones.local.sql, solo en ensayo_finanzas.
\set ON_ERROR_STOP on
do $$begin if current_database()<>'ensayo_finanzas' then raise exception 'Solo ensayo_finanzas'; end if; end$$;
create function public.u(text) returns uuid language sql immutable as $$select md5($1)::uuid$$;
create table public.ensayo_resultados(nombre text primary key);
create function public.comprobar(text,boolean) returns void language plpgsql as $$begin
 if $2 is distinct from true then raise exception 'FALLO: %',$1;end if;insert into public.ensayo_resultados values($1);end$$;
select set_config('request.jwt.claim.sub',public.u('usuario')::text,false),set_config('request.jwt.claim.rol','COORDINADOR FINANCIERO',false);
insert into usuarios(auth_id,activo) values(u('usuario'),true);
insert into alumnos(id,saldo_a_favor) values(u('alumno'),50),(u('otro-alumno'),0);
insert into ciclos_escolares values(u('c1'),'2027-1','Cuatrimestral'),(u('c2'),'2027-1','Semestral'),(u('c3'),'2026-3','Cuatrimestral');
insert into planes_estudio values(u('academico'),'Cuatrimestral');
insert into alumno_programas(alumno_id,plan_id,es_vigente) values(u('alumno'),u('academico'),true);
insert into planes_pago(id,alumno_id,ciclo_id,tipo_plan,concepto_1,cantidad_1,estatus_1,concepto_2,cantidad_2,estatus_2)
 values(u('p1'),u('alumno'),u('c1'),'Cuatrimestral','PRIMER PAGO',1000,'NO PAGADO','SEGUNDO PAGO',200,'PENDIENTE'),
 (u('p2'),u('alumno'),u('c1'),'Cuatrimestral','OTRO CONCEPTO',800,'R-999 (Pagado $800.00)',null,null,null);
insert into planes_pago_detalles(plan_id,indice_concepto,concepto,cantidad,estatus)
 values(u('p1'),1,'PRIMER PAGO',1000,'NO PAGADO'),(u('p1'),2,'SEGUNDO PAGO',200,'PENDIENTE'),(u('p2'),1,'OTRO CONCEPTO',800,'R-999 (Pagado $800.00)');
insert into recibos(id,alumno_id,ciclo_id,fecha_recibo,fecha_pago,total,forma_pago,banco)
 select u('r'||n),u('alumno'),case when n=4 then u('c2') when n=5 then u('c3') else u('c1') end,current_date,current_date,
 case n when 1 then 400 when 2 then 300 when 3 then 500 when 4 then 800 else 100 end,'EFECTIVO','NO APLICA' from generate_series(1,7)n;
insert into recibos_detalles(id,recibo_id,cantidad,concepto,costo_unitario,subtotal)
 select u('d'||n),u('r'||n),1,'PRIMER PAGO CON COSTO PROMOCIONAL',total,total from recibos r join generate_series(1,7)n on r.id=u('r'||n);

select comprobar('NO PAGADO conserva el importe',saldo_concepto_financiero_v1(1000,'NO PAGADO')=1000);
select comprobar('Texto ambiguo requiere revisión',saldo_concepto_financiero_v1(1000,'Por revisar') is null);
select comprobar('Resta tiene prioridad sobre pagos anteriores',saldo_concepto_financiero_v1(1000,'R-1 (Pagado $200); R-2 (Abono $300, Resta $500.00)')=500);
select comprobar('PAGADO promocional sí liquida',saldo_concepto_financiero_v1(1000,'R-1 (Pagado $1000.00)')=0);

do $$declare r jsonb; destinos jsonb; n int; begin
 destinos:=jsonb_build_array(jsonb_build_object('plan_id',u('p1'),'indice',1));
 for n in 1..3 loop
   r:=vinculacion_financiera_v1(u('d'||n),destinos,'aplicar');
   perform comprobar('Vista previa sin escritura '||n,(select count(*) from planes_pago_vinculos_recibo)=n-1);
   r:=vinculacion_financiera_v1(u('d'||n),destinos,'aplicar',true,r->>'revision');
   perform comprobar('Aplicación confirmada '||n,(r->>'aplicado')::boolean);
 end loop;
end$$;
select comprobar('Tres recibos y aplicado total 1000',(select count(*)=3 and sum(importe)=1000 from planes_pago_vinculos_recibo where plan_id=u('p1')));
select comprobar('Excedente nuevo 200 una vez',(select saldo_a_favor=250 from alumnos where id=u('alumno')));
select comprobar('Bitácora de excedente única',(select count(*)=1 and sum(importe)=200 from planes_pago_excedentes_monedero));
select comprobar('Detalle y legado sincronizados',(select p.estatus_1=d.estatus and p.estatus_1 like '%Pagado $1000.00%' from planes_pago p join planes_pago_detalles d on d.plan_id=p.id and d.indice_concepto=1 where p.id=u('p1')));

do $$begin
 begin perform vinculacion_financiera_v1(u('d3'),jsonb_build_array(jsonb_build_object('plan_id',u('p1'),'indice',1)),'aplicar',true,'revision'); raise exception 'No rechazó duplicado';
 exception when others then if sqlerrm='No rechazó duplicado' then raise;end if;end;
 perform comprobar('Reintentar no duplica monedero',(select saldo_a_favor=250 from alumnos where id=u('alumno')));
end$$;

do $$declare r jsonb; d jsonb; begin
 d:=jsonb_build_array(jsonb_build_object('plan_id',u('p2'),'indice',1,'importe',800));
 r:=vinculacion_financiera_v1(u('d4'),d,'historico');
 perform comprobar('Homónimo histórico permitido',(r->>'aplicable')::boolean);
 perform vinculacion_financiera_v1(u('d4'),d,'historico',true,r->>'revision');
 perform comprobar('Histórico no acredita monedero',(select saldo_a_favor=250 from alumnos where id=u('alumno')));
 perform comprobar('Histórico conserva observación',(select estatus_1='R-999 (Pagado $800.00)' from planes_pago where id=u('p2')));
 perform comprobar('Histórico conserva ciclo y monto',(select ciclo_id=u('c2') and total=800 from recibos where id=u('r4')));
 r:=vinculacion_financiera_v1(u('d5'),d,'historico');
 perform comprobar('Otro periodo sigue restringido',not (r->>'aplicable')::boolean);
end$$;

select guardar_observacion_plan_v1(u('p1'),2,'PENDIENTE','R-40200 (observación manual)');
select comprobar('Observación puntual sincroniza detalle',(select estatus='R-40200 (observación manual)' from planes_pago_detalles where plan_id=u('p1') and indice_concepto=2));
select comprobar('Observación no modifica dinero',(select saldo_a_favor=250 from alumnos where id=u('alumno')));
do $$begin
 begin perform guardar_observacion_plan_v1(u('p1'),2,'PENDIENTE','Otra observación');raise exception 'No rechazó conflicto';
 exception when serialization_failure then perform comprobar('Concurrencia de observación rechazada',true);end;
 begin perform guardar_observacion_plan_v1(u('p1'),1,(select estatus_1 from planes_pago where id=u('p1')),'PENDIENTE');raise exception 'No rechazó vínculo';
 exception when others then if sqlerrm='No rechazó vínculo' then raise;end if;perform comprobar('Texto no anula vínculo',true);end;
end$$;

update planes_pago set estatus_2='PENDIENTE' where id=u('p1');
do $$declare r jsonb; d jsonb; begin
 d:=jsonb_build_array(jsonb_build_object('plan_id',u('p1'),'indice',2));
 r:=vinculacion_financiera_v1(u('d6'),d,'aplicar');
 update planes_pago set cantidad_2=250 where id=u('p1');
 begin perform vinculacion_financiera_v1(u('d6'),d,'aplicar',true,r->>'revision');raise exception 'No rechazó revisión';
 exception when serialization_failure then perform comprobar('Revisión caducada rechazada',true);end;
 perform comprobar('Conflicto no escribe vínculo',not exists(select 1 from planes_pago_vinculos_recibo where recibo_detalle_id=u('d6')));
end$$;
select set_config('request.jwt.claim.rol','CAJERO',false);
do $$begin
 begin perform vinculacion_financiera_v1(u('d7'),jsonb_build_array(jsonb_build_object('plan_id',u('p1'),'indice',2,'importe',100)),'historico');raise exception 'No rechazó rol';
 exception when insufficient_privilege then perform comprobar('Caja no concilia históricos',true);end;
end$$;
update usuarios set activo=false;
do $$begin
 begin perform guardar_observacion_plan_v1(u('p1'),2,'PENDIENTE','Prueba');raise exception 'No rechazó inactivo';
 exception when insufficient_privilege then perform comprobar('Inactivo no guarda',true);end;
end$$;
select comprobar('Sin ejecución anónima',not has_function_privilege('anon','public.guardar_observacion_plan_v1(uuid,integer,text,text)','EXECUTE') and not has_function_privilege('anon','public.vinculacion_financiera_v1(uuid,jsonb,text,boolean,text)','EXECUTE'));
select comprobar('Sin escritura directa de auditoría',not has_table_privilege('authenticated','public.finanzas_operaciones_auditoria','INSERT') and not has_table_privilege('authenticated','public.finanzas_operaciones_auditoria','UPDATE'));
select count(*) comprobaciones_ok from ensayo_resultados;
