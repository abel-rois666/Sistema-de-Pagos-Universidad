\set ON_ERROR_STOP on
-- EXCLUSIVAMENTE base local VACÍA de prueba. Nunca ejecutar en Supabase.
do $$ begin
 if current_database()<>'ic_pruebas_local' or coalesce(host(inet_server_addr()),'') not in('127.0.0.1','::1') then raise exception 'Este ensayo exige ic_pruebas_local en localhost';end if;
 if to_regclass('public.alumnos') is not null then raise exception 'La base de prueba debe estar vacía';end if;
end $$;
do $$begin
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
end$$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create function public.get_my_rol() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.rol',true),'')$$;
create table alumnos(id uuid primary key,matricula text,nombre_completo text,apellido_paterno text,apellido_materno text,nombres text,grado_actual text,ciclo_ultima_asignacion_grado uuid);
create table ciclos_escolares(id uuid primary key,nombre text,tipo_periodo text);
create table planes_estudio(id uuid primary key,nombre text,clave_legado text,tipo_periodo text,modalidad text,total_periodos integer);
create table alumno_programas(id uuid primary key,alumno_id uuid,plan_id uuid,es_vigente boolean,estatus text);
create table grupos(id uuid primary key,ciclo_id uuid,plan_id uuid,codigo_grupo text);
create table alumnos_grupos(id uuid primary key,alumno_id uuid,grupo_id uuid);
create table asignaturas(id uuid primary key,plan_id uuid);
create table inscripciones_academicas(id uuid primary key,alumno_id uuid,ciclo_id uuid,asignatura_id uuid);
create table planes_pago(id uuid primary key,alumno_id uuid,ciclo_id uuid);
grant select,insert,update on alumnos,alumno_programas,planes_pago to authenticated;
grant select on ciclos_escolares,planes_estudio to authenticated;
create function promover_alumno_ciclo(p_alumno_id uuid,p_ciclo_id uuid,p_programa_id uuid,p_grado_esperado text,p_plan_pago_id uuid,p_copiar_conceptos boolean,p_crear_plan boolean) returns jsonb
language plpgsql security invoker as $$declare grado text;begin
 if public.get_my_rol() not in('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR') then raise exception 'Sin permiso';end if;
 select grado_actual into grado from alumnos where id=p_alumno_id for update;
 if grado='10' then return jsonb_build_object('tipo','EGRESO','grado',grado);end if;
 if exists(select 1 from alumnos where id=p_alumno_id and ciclo_ultima_asignacion_grado=p_ciclo_id) then return jsonb_build_object('tipo','AVANCE','grado',grado);end if;
 update alumnos set grado_actual=(grado::integer+1)::text,ciclo_ultima_asignacion_grado=p_ciclo_id where id=p_alumno_id returning grado_actual into grado;
 if p_crear_plan then insert into planes_pago values(p_plan_pago_id,p_alumno_id,p_ciclo_id);end if;
 return jsonb_build_object('tipo','AVANCE','grado',grado,'plan_pago_id',p_plan_pago_id);
end $$;
insert into ciclos_escolares values('00000000-0000-4000-8000-000000000001','2027-1','Cuatrimestral'),('00000000-0000-4000-8000-000000000002','2027-1','Semestral');
insert into planes_estudio values('00000000-0000-4000-8000-000000000011','Derecho','LD','CUATRIMESTRAL','ESCOLARIZADA',10),('00000000-0000-4000-8000-000000000012','Psicología','LSP','SEMESTRAL','ESCOLARIZADA',8);
insert into alumnos(id,matricula,nombre_completo,grado_actual) values
 ('00000000-0000-4000-8000-000000000021','PRUEBA-1','Persona ficticia 1','2'),('00000000-0000-4000-8000-000000000022','PRUEBA-2','Persona ficticia 2','3'),
 ('00000000-0000-4000-8000-000000000023','PRUEBA-3','Persona ficticia 3','2'),('00000000-0000-4000-8000-000000000024','PRUEBA-4','Persona ficticia 4','2');
insert into alumno_programas values('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011',true,'ACTIVO'),
 ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000011',false,'EGRESADO'),
 ('00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000012',true,'CURSANDO'),
 ('00000000-0000-4000-8000-000000000034','00000000-0000-4000-8000-000000000024','00000000-0000-4000-8000-000000000011',true,'CURSANDO');
insert into grupos values('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','G-FICTICIO');
insert into alumnos_grupos values(gen_random_uuid(),'00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000041'),(gen_random_uuid(),'00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000041');
\ir ../../supabase/migrations/20261027130000_inscripciones_ciclo.sql
create function prueba_ic(condicion boolean,mensaje text) returns void language plpgsql as $$begin if condicion is distinct from true then raise exception 'PRUEBA FALLIDA: %',mensaje;end if;raise notice 'OK: %',mensaje;end$$;
create function fila_ic(ap uuid,rev integer default 0,ic uuid default null) returns jsonb language sql as $$select jsonb_build_object('alumno_programa_id',ap,'revision',rev,'inscripcion_id',ic,'estado','CONFIRMADA','desde','2026-09-01','hasta',null,'grado_personal','2DO','tipo_ingreso','REINGRESO','fecha_primer_ingreso',null,'evidencia','Ficha ficticia acreditada','motivo','Confirmación de inscripción ficticia','admitir_historico',false)$$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000099';set request.jwt.claim.rol='ADMINISTRADOR';
select prueba_ic((select count(*)=2 from ic_consultar('00000000-0000-4000-8000-000000000001',false)),'Consulta filtra periodicidad exacta y programas cursables');
select prueba_ic((select count(*)=3 from ic_consultar('00000000-0000-4000-8000-000000000001',true)),'Recuperación incluye programas históricos explícitamente');
select prueba_ic((select jsonb_array_length(grupos)=1 and inscripcion is null from ic_consultar('00000000-0000-4000-8000-000000000001',false) where alumno_programa_id='00000000-0000-4000-8000-000000000031'),'Varias materias del grupo no duplican matrícula ni confirman inscripción');
select prueba_ic(ic_guardar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_ic('00000000-0000-4000-8000-000000000031')))=1,'Confirmación sin crear grupos ni planes financieros');
select prueba_ic((select count(*)=1 from inscripciones_ciclo_historial),'Alta auditada');
do $$declare fallo boolean=false;begin
 begin perform ic_guardar_lote('00000000-0000-4000-8000-000000000002',jsonb_build_array(fila_ic('00000000-0000-4000-8000-000000000031')));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo,'Ciclo homónimo de otra periodicidad bloqueado');
end$$;
do $$declare fallo boolean=false;begin
 begin perform ic_guardar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_ic('00000000-0000-4000-8000-000000000031')));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo,'Alta repetida no sobrescribe inscripción');
end$$;
select ic_guardar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array((select fila_ic(alumno_programa_id,revision,id)||jsonb_build_object('estado','BAJA','hasta','2026-10-01') from inscripciones_ciclo)));
select prueba_ic((select revision=2 and estado='BAJA' and desde='2026-09-01' from inscripciones_ciclo),'Corrección conserva inicio, agrega término y revisión');
do $$declare fallo boolean=false;begin
 begin perform ic_guardar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(
 (select fila_ic(alumno_programa_id,revision,id)||jsonb_build_object('grado_personal','3') from inscripciones_ciclo),fila_ic('00000000-0000-4000-8000-000000000033')));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and (select revision=2 and grado_personal='2DO' from inscripciones_ciclo),'Error de otra fila revierte lote entero');
end$$;
select prueba_ic((select count(*)=2 from inscripciones_ciclo_historial),'Rollback no deja bitácoras parciales');
set request.jwt.claim.rol='CAJERO';
select prueba_ic((select count(*)=0 from inscripciones_ciclo),'RLS oculta matrícula a rol financiero');
do $$declare fallo boolean=false;begin
 begin perform ic_consultar('00000000-0000-4000-8000-000000000001',false);exception when raise_exception then fallo=true;end;perform prueba_ic(fallo,'RPC verifica rol');
 fallo=false;begin update inscripciones_ciclo set grado_personal='9';exception when insufficient_privilege then fallo=true;end;perform prueba_ic(fallo,'Escritura directa rechazada');
end$$;
set request.jwt.claim.rol='COORDINADOR CONTROL ESCOLAR';
do $$declare fallo boolean=false;begin
 begin perform ic_integrar_promocion(true);exception when raise_exception then fallo=true;end;perform prueba_ic(fallo,'Control Escolar no activa integración reservada a Administración');
end$$;
set request.jwt.claim.rol='ADMINISTRADOR';
select prueba_ic(ic_configuracion()->'integrar_promocion'='false','Integración apagada inicialmente');
select ic_integrar_promocion(true);
select prueba_ic(ic_promover_alumno('00000000-0000-4000-8000-000000000024','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','2','00000000-0000-4000-8000-000000000051',false,true)->'inscripcion_registrada'='true','Promoción integra inscripción en una transacción');
select prueba_ic((select grado_personal='3' and tipo_ingreso='REINGRESO' from inscripciones_ciclo where alumno_programa_id='00000000-0000-4000-8000-000000000034'),'Inscripción conserva grado resultante de promoción');
select prueba_ic(ic_promover_alumno('00000000-0000-4000-8000-000000000024','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000034','2','00000000-0000-4000-8000-000000000051',false,true)->'inscripcion_registrada'='true','Reintento conserva inscripción y plan');
select prueba_ic((select count(*)=1 from planes_pago),'Reintento no duplica plan de pago');
select prueba_ic((select not prosecdef from pg_proc where oid='public.ic_promover_alumno(uuid,uuid,uuid,text,uuid,boolean,boolean)'::regprocedure),'Integración preserva permisos invoker de promoción financiera');
do $$declare fallo boolean=false;begin
 begin perform ic_promover_alumno('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000031','2','00000000-0000-4000-8000-000000000052',false,true);exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and (select grado_actual='2' from alumnos where id='00000000-0000-4000-8000-000000000021') and (select count(*)=1 from planes_pago),'Conflicto de inscripción revierte avance y creación financiera');
end$$;
reset role;
create table s911_inscripciones(id uuid primary key default gen_random_uuid(),alumno_programa_id uuid,ciclo_id uuid,desde date,hasta date,tipo_ingreso text,fecha_primer_ingreso date,grado_personal text,situacion text,confirmado boolean,evidencia text,unique(alumno_programa_id,ciclo_id));
create table s911_auditoria(id uuid primary key default gen_random_uuid(),accion text,datos jsonb);
create function s911_autorizado(p_academico boolean) returns boolean language sql as $$select ic_autorizado()$$;
\ir ../../supabase/migrations/20261027133000_fuentes_911_desde_inscripciones.sql
set role authenticated;
select prueba_ic(ic_acreditar_911((select jsonb_agg(jsonb_build_object('id',id,'revision',revision)) from inscripciones_ciclo))->>'creadas'='2','Puente 911 copia fuentes seleccionadas con revisión');
select prueba_ic(ic_acreditar_911((select jsonb_agg(jsonb_build_object('id',id,'revision',revision)) from inscripciones_ciclo))->>'conservadas'='2','Puente conserva fuentes existentes sin sobrescribir');
select prueba_ic(ic_configuracion()->'puente_911'='true','Configuración reconoce puente opcional');
reset role;
select prueba_ic((select hasta='2026-10-01' and situacion='ACTIVO' from s911_inscripciones where alumno_programa_id='00000000-0000-4000-8000-000000000031'),'Baja se respalda con vigencia histórica al corte');
select prueba_ic(not has_table_privilege('authenticated','inscripciones_ciclo','UPDATE') and not has_table_privilege('anon','inscripciones_ciclo','SELECT'),'Privilegios finales permanecen restringidos');
select 'ENSAYO LOCAL COMPLETO' resultado;
