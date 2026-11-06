\set ON_ERROR_STOP on
-- Ejecutar solo en copia local de los ensayos previos.
do $$begin if current_database() not in('ic_trayectoria_local','ic_trayectoria_local_final','ic_trayectoria_local_v2') or host(inet_server_addr())<>'127.0.0.1' then raise exception 'Ensayo exclusivamente local';end if;end$$;
\ir ../../supabase/migrations/20261030100000_ingreso_programa_trayectoria.sql
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000099';
set request.jwt.claim.rol='ADMINISTRADOR';
select prueba_ic((select count(*)=0 from inscripciones_programa_ingreso),'No inventa ingresos ni migra fechas legadas');
select ic_guardar_ingreso_programa('00000000-0000-4000-8000-000000000131',0,'00000000-0000-4000-8000-000000000005',null,'APROXIMADA','Antecedente ficticio','Revisión del antecedente histórico');
select prueba_ic((select fecha is null and revision=1 from inscripciones_programa_ingreso where alumno_programa_id='00000000-0000-4000-8000-000000000131'),'Permite acreditar solo el ciclo sin inventar día');
select ic_guardar_ingreso_programa('00000000-0000-4000-8000-000000000131',1,'00000000-0000-4000-8000-000000000005','2024-10-01','APROXIMADA','Historial ficticio revisado','Precisión aproximada revisada');
select prueba_ic((select count(*)=2 from inscripciones_programa_ingreso_historial),'Cada corrección conserva antes y después');
do $$begin
 begin perform ic_guardar_ingreso_programa('00000000-0000-4000-8000-000000000131',1,null,null,'PENDIENTE','Documento ficticio','Revisión concurrente');raise exception 'FALLO: admitió revisión anterior';exception when others then if sqlerrm not like '%ingreso cambió%' then raise;end if;end;
 begin perform ic_guardar_ingreso_programa('00000000-0000-4000-8000-000000000131',2,'00000000-0000-4000-8000-000000000002',null,'APROXIMADA','Documento ficticio','Revisión de ciclo homónimo');raise exception 'FALLO: aceptó periodicidad';exception when others then if sqlerrm not like '%periodicidad%' then raise;end if;end;
 begin perform ic_contexto_revisado('00000000-0000-4000-8000-000000000131','00000000-0000-4000-8000-000000000001','{}','{"metodo_desde":"HISTORIAL_MAS_ANTIGUO","aplicar_desde":true}');raise exception 'FALLO: helper público';exception when insufficient_privilege then null;end;
end$$;
select prueba_ic(not has_table_privilege('authenticated','inscripciones_programa_ingreso','UPDATE'),'No permite cambios directos');
set request.jwt.claim.rol='CAJERO';
select prueba_ic((select count(*)=0 from inscripciones_programa_ingreso),'RLS oculta ingresos a rol sin permiso');
do $$begin
 begin perform ic_guardar_ingreso_programa('00000000-0000-4000-8000-000000000131',2,null,null,'PENDIENTE','Documento ficticio','Revisión no autorizada');raise exception 'FALLO: aceptó cajero';exception when others then if sqlerrm not like '%Sin permiso%' then raise;end if;end;
end$$;
reset role;
do $$begin
 begin perform ic_contexto_revisado('00000000-0000-4000-8000-000000000131','00000000-0000-4000-8000-000000000001','{}','{"metodo_desde":"HISTORIAL_MAS_ANTIGUO","aplicar_desde":true}');raise exception 'FALLO: aceptó fecha histórica como destino';exception when others then if sqlerrm not like '%inicio histórico corresponde%' then raise;end if;end;
end$$;
do $$begin
 begin update inscripciones_ciclo set fecha_primer_ingreso='2025-10-01' where alumno_programa_id='00000000-0000-4000-8000-000000000131';raise exception 'FALLO: aceptó discrepancia con ingreso acreditado';exception when others then if sqlerrm not like '%primer ingreso difiere%' then raise;end if;end;
end$$;
set role authenticated;
set request.jwt.claim.rol='ADMINISTRADOR';
select ic_guardar_ingreso_programa('00000000-0000-4000-8000-000000000133',0,'00000000-0000-4000-8000-000000000001',null,'DOCUMENTADA','Lista ficticia acreditada','Ingreso acreditado solo por ciclo');
select prueba_ic(ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_ic('00000000-0000-4000-8000-000000000133')||jsonb_build_object('plan_id','00000000-0000-4000-8000-000000000011','tipo_ingreso','PRIMER_INGRESO')))=1,'Primer ingreso con ciclo acreditado conserva fecha histórica desconocida');
reset role;
select 'ENSAYO INGRESO COMPLETO' resultado;
