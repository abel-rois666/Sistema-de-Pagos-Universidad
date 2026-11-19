\set ON_ERROR_STOP on
do $$begin if current_database()<>'ensayo_titulacion' or inet_server_port()<>55449 then raise exception 'Solo base local ficticia ensayo_titulacion:55449';end if;end$$;
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
end$$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.u(text) returns uuid language sql immutable as $$select md5($1)::uuid$$;
create table usuarios(auth_id uuid,activo boolean,rol text);
create table alumnos(id uuid primary key);
create table carreras(id uuid primary key,nombre text,nivel_educativo text,calificacion_minima_aprobatoria numeric);
create table planes_estudio(id uuid primary key,carrera_id uuid);
create table alumno_programas(id uuid primary key,alumno_id uuid,plan_id uuid,estatus text default 'ACTIVO',motivo_estatus text,fecha_ultimo_cambio timestamptz);
create table asignaturas(id uuid primary key,plan_id uuid,nombre text,activo boolean default true,clasificacion_clave text default '263',clasificacion_nombre text default 'Obligatoria');
create table inscripciones_academicas(id uuid primary key default gen_random_uuid(),alumno_id uuid,asignatura_id uuid,calificacion_final numeric);
create table ficha_certificacion(id uuid primary key default gen_random_uuid(),alumno_id uuid,alumno_programa_id uuid,archivado_en timestamptz,tipo_certificado text,tramite_completado boolean,created_at timestamptz default now());
create table servicio_social(id uuid primary key,alumno_id uuid,nombre_empresa text,estatus text,fecha_inicio date);
create table ciclos_escolares(id uuid primary key,nombre text,tipo_periodo text);
create table planes_pago(id uuid primary key,alumno_id uuid,ciclo_id uuid,no_plan_pagos text,licenciatura text,tipo_plan text);
do $$begin for i in 1..18 loop execute format('alter table planes_pago add column concepto_%s text,add column cantidad_%s numeric,add column estatus_%s text',i,i,i);end loop;end$$;
create table planes_pago_detalles(id uuid primary key default gen_random_uuid(),plan_id uuid,indice_concepto integer,concepto text,cantidad numeric,estatus text);
create table recibos(id uuid primary key,estatus text);
create table recibos_detalles(id uuid primary key,recibo_id uuid);
create table planes_pago_vinculos_recibo(id uuid primary key default gen_random_uuid(),plan_id uuid,indice_concepto integer,recibo_detalle_id uuid,importe numeric,anulado_en timestamptz);
create table ficha_titulacion(id uuid primary key default gen_random_uuid(),alumno_id uuid,alumno_programa_id uuid,revision integer default 0,archivado_en timestamptz,
 modalidad text,pago_titulacion text default 'SIN_INICIAR',certificado_estudios text default 'SIN_INICIAR',ingles text default 'SIN_INICIAR',servicio_social_req text default 'SIN_INICIAR',fotografias text default 'PENDIENTES',promedio_alto_rendimiento text default 'SIN_INICIAR',
 doc_antecedente text default 'SIN_INICIAR',doc_antecedente_nota text,doc_acta_nacimiento text default 'SIN_INICIAR',doc_acta_nacimiento_nota text,doc_curp text default 'SIN_INICIAR',doc_curp_nota text,doc_titulo_profesional text default 'SIN_INICIAR',doc_titulo_profesional_nota text,doc_cedula_profesional text default 'SIN_INICIAR',doc_cedula_profesional_nota text,
 fecha_inicio_tramite date,fecha_estimada_culminacion date,enlace_drive text,libro integer,foja integer,folio_control text,fecha_examen date,fecha_exencion date,tramite_completado boolean default false,fecha_completado timestamptz,updated_at timestamptz);
create table titulacion_auditoria(id uuid default gen_random_uuid(),ficha_id uuid,usuario_auth uuid,accion text,motivo text,antes jsonb,despues jsonb);
create function public._titulacion_autorizar_v1(p_escritura boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $$begin
 if auth.uid() is null or not (select count(*)=1 and coalesce(bool_and(activo and (rol='ADMINISTRADOR' or (not p_escritura and rol='COORDINADOR CONTROL ESCOLAR'))),false) from public.usuarios where auth_id=auth.uid()) then raise exception 'No tienes permiso' using errcode='42501';end if;
end$$;
create function public.comprobar(text,boolean) returns void language plpgsql as $$begin if $2 is distinct from true then raise exception 'FALLO: %',$1;end if;raise notice 'OK: %',$1;end$$;
