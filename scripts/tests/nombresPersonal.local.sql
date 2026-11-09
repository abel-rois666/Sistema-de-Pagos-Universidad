-- SOLO para una base local desechable vacía. No ejecutar en Supabase.
\set ON_ERROR_STOP on
do $$begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;
end$$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.ensayo_uid',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select 'authenticated'::text$$;
create table public.usuarios(id uuid primary key,auth_id uuid,rol text,activo boolean);
create table public.docentes(id uuid primary key,clave_legado text unique,nombre_completo text,rfc text,curp text,email text,estatus text);
create table public.empleados(id uuid primary key,nombres text,apellido_paterno text,apellido_materno text,rfc text,curp text,fecha_nacimiento date,sexo text,estado_civil text,direccion text,telefono text,documentos_entregados jsonb,enlace_drive text);
\ir ../../supabase/migrations/20261108120000_personal_y_docentes.sql
\ir ../../supabase/migrations/20261108150000_nombres_estructurados_personal.sql
insert into public.usuarios values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','ADMINISTRADOR',true);
select set_config('app.ensayo_uid','00000000-0000-4000-8000-000000000002',false);
insert into public.docentes values('11111111-1111-4111-8111-111111111111','PF0001','MARÍA DEL CARMEN DE LA CRUZ LÓPEZ',null,null,null,'activo'),
('22222222-2222-4222-8222-222222222222','PF0002','DOCENTE HISTÓRICO DOS',null,null,null,'activo'),
('33333333-3333-4333-8333-333333333333','PF0003','DOCENTE HISTÓRICO TRES',null,null,null,'activo');
create function public.ensayo_exigir(v boolean,m text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'FALLO: %',m;end if;end$$;
do $$declare f jsonb; r jsonb; original_nombre text; rev integer; n integer; lote jsonb; rechazado boolean;
begin
  f=public.personal_consultar_v2('DOCENTE','11111111-1111-4111-8111-111111111111');
  perform public.ensayo_exigir((f->>'nombres_disponibles')::boolean,'capacidad de nombres');
  original_nombre=f->'datos'->>'nombre_completo';
  -- Contacto histórico conserva nombre y no genera apellidos.
  r=public.personal_guardar_v1('DOCENTE','11111111-1111-4111-8111-111111111111',0,f->'original','generales',jsonb_build_object('datos',f->'datos'||'{"email":"contacto@example.test","nombre_completo":"NO DEBE REEMPLAZAR"}'::jsonb,'docente',jsonb_build_object('clave_legado','PF0001','estatus','activo')),'Contacto verificado');
  f=public.personal_consultar_v2('DOCENTE','11111111-1111-4111-8111-111111111111');
  perform public.ensayo_exigir(f->'datos'->>'nombre_completo'=original_nombre and nullif(f->'datos'->>'nombres','') is null,'contacto histórico sin inventar desglose');
  rechazado=false;
  begin
    perform public.personal_guardar_v1('DOCENTE','11111111-1111-4111-8111-111111111111',(f->>'revision')::integer,f->'original','generales',jsonb_build_object('datos',f->'datos'||'{"nombres":"MARÍA DEL CARMEN","apellido_paterno":"DE LA CRUZ","apellido_materno":"LÓPEZ"}'::jsonb,'docente',jsonb_build_object('clave_legado','PF0001','estatus','activo')),'Separación sin revisar');
  exception when others then rechazado=true;end;
  perform public.ensayo_exigir(rechazado,'rechaza desglose sin revisión');
  r=public.personal_guardar_v1('DOCENTE','11111111-1111-4111-8111-111111111111',(f->>'revision')::integer,f->'original','generales',jsonb_build_object('nombre_revisado',true,'datos',f->'datos'||'{"nombres":"MARÍA DEL CARMEN","apellido_paterno":"DE LA CRUZ","apellido_materno":"LÓPEZ"}'::jsonb,'docente',jsonb_build_object('clave_legado','PF0001','estatus','activo')),'Nombre cotejado con expediente');
  f=public.personal_consultar_v2('DOCENTE','11111111-1111-4111-8111-111111111111');
  perform public.ensayo_exigir(f->'datos'->>'nombre_completo'='DE LA CRUZ LÓPEZ MARÍA DEL CARMEN','nombre derivado');
  perform public.ensayo_exigir(f->'nombre_revision'->>'original'=original_nombre and f->'nombre_revision'->>'confirmado_por'=auth.uid()::text,'antecedente y responsable');
  perform public.ensayo_exigir((select clave_legado='PF0001' from public.docentes where id='11111111-1111-4111-8111-111111111111'),'ID y clave conservados');
  rechazado=false;
  begin
    perform public.personal_guardar_v1('DOCENTE','44444444-4444-4444-8444-444444444444',0,null,'generales','{"datos":{"nombre_completo":"SOLO TEXTO"},"docente":{"clave_legado":"PF0004","estatus":"activo"}}','Alta incompleta');
  exception when others then rechazado=true;end;
  perform public.ensayo_exigir(rechazado and not exists(select 1 from public.docentes where clave_legado='PF0004'),'alta sin partes rechazada sin residuos');
  r=public.personal_guardar_v1('DOCENTE','44444444-4444-4444-8444-444444444444',0,null,'generales','{"datos":{"nombres":"ALTA NUEVA","apellido_paterno":"DE PRUEBA","apellido_materno":null},"docente":{"clave_legado":"PF0004","estatus":"activo"}}','Alta estructurada revisada');
  perform public.ensayo_exigir((select nombre_completo='DE PRUEBA ALTA NUEVA' from public.docentes where clave_legado='PF0004'),'alta estructurada sin segundo apellido');
  -- Un lote con una fila incompleta revierte todas las anteriores.
  f=public.personal_nombres_pendientes_v1('',0);
  select jsonb_agg(jsonb_build_object('docente_id',z->>'docente_id','revision',z->'revision','original',z->'original','revisado',true,'apellido_paterno','REVISADO','nombres',case when z->>'clave'='PF0003' then '' else 'DOS' end)) into lote from jsonb_array_elements(f->'filas') z;
  rechazado=false;
  begin perform public.personal_nombres_revisar_lote_v1(lote,'Revisión de lote ficticio');exception when others then rechazado=true;end;
  perform public.ensayo_exigir(rechazado and (select nombre_completo='DOCENTE HISTÓRICO DOS' and persona_id is null from public.docentes where clave_legado='PF0002'),'rollback íntegro del lote');
  select jsonb_agg(z||jsonb_build_object('nombres',case when z->>'docente_id'='22222222-2222-4222-8222-222222222222' then 'DOS' else 'TRES' end)) into lote from jsonb_array_elements(lote) z;
  r=public.personal_nombres_revisar_lote_v1(lote,'Cotejo de lote ficticio');
  perform public.ensayo_exigir((r->>'revisados')::integer=2,'confirma lote válido');
  rechazado=false;
  begin perform public.personal_nombres_revisar_lote_v1(lote,'Reintento con revisión obsoleta');exception when sqlstate '40001' then rechazado=true;end;
  perform public.ensayo_exigir(rechazado,'detecta concurrencia/reintentos obsoletos');
  perform public.ensayo_exigir(not has_function_privilege('authenticated','public._personal_guardar_base_v1(text,uuid,integer,jsonb,text,jsonb,text)','EXECUTE'),'helper privado');
  update public.usuarios set rol='COORDINADOR RECURSOS HUMANOS';rechazado=false;
  begin perform public.personal_nombres_pendientes_v1('',0);exception when insufficient_privilege then rechazado=true;end;
  perform public.ensayo_exigir(rechazado,'RH no regulariza nombres');
  raise notice 'OK: nombres estructurados, histórico, auditoría, altas, lote atómico, concurrencia y permisos';
end$$;
do $$declare d jsonb;e jsonb;p jsonb;
begin
  update public.usuarios set rol='ADMINISTRADOR';
  insert into public.docentes values('55555555-5555-4555-8555-555555555555','PF0005','NOMBRE DOCENTE ANTERIOR',null,null,null,'activo',null);
  insert into public.empleados(id,nombres,apellido_paterno,apellido_materno) values('66666666-6666-4666-8666-666666666666','ANA MARÍA','DE LA CRUZ',null);
  d=public.personal_consultar_v2('DOCENTE','55555555-5555-4555-8555-555555555555');e=public.personal_consultar_v2('EMPLEADO','66666666-6666-4666-8666-666666666666');
  perform public.personal_vincular_v1('55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666',0,0,d->'original',e->'original','Identidad y nombres cotejados explícitamente');
  p=public.personal_consultar_v2('DOCENTE','55555555-5555-4555-8555-555555555555');
  perform public.ensayo_exigir(p->'datos'->>'nombres'='ANA MARÍA' and p->'nombre_revision'->>'original'='NOMBRE DOCENTE ANTERIOR' and p->'nombre_revision'->>'fuente'='RELACION_REVISADA','relación explícita conserva antecedentes');
  perform public.ensayo_exigir((select id='66666666-6666-4666-8666-666666666666'::uuid from public.empleados where persona_id=(p->>'persona_id')::uuid),'empleado conserva ID');
  raise notice 'OK: relación explícita, identidad común y nombre docente histórico';
end$$;
