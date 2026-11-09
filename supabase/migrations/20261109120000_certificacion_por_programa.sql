-- PREPARADA, NO EJECUTADA. Revisar preflight_certificacion_por_programa_20261109.sql.
-- Las fichas anteriores permanecen con programa NULL. No hay backfill ni borrado de registros.
begin;
alter table public.ficha_certificacion add column alumno_programa_id uuid references public.alumno_programas(id) on delete no action;
alter table public.ficha_certificacion add column revision integer not null default 0 check (revision>=0);
alter table public.ficha_certificacion add column archivado_en timestamptz;
-- El nombre de la restricción de alumno puede variar entre instalaciones.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.ficha_certificacion'::regclass and contype='u'
 and conkey=array[(select attnum from pg_attribute where attrelid='public.ficha_certificacion'::regclass and attname='alumno_id')]::smallint[]
 loop execute format('alter table public.ficha_certificacion drop constraint %I',c.conname);end loop;
end $$;
do $$ declare i record; begin
 for i in select c.relname from pg_index x join pg_class c on c.oid=x.indexrelid
 where x.indrelid='public.ficha_certificacion'::regclass and x.indisunique and x.indpred is null
 and x.indkey::text=(select attnum::text from pg_attribute where attrelid=x.indrelid and attname='alumno_id')
 and not exists(select 1 from pg_constraint where conindid=x.indexrelid)
 loop execute format('drop index public.%I',i.relname);end loop;
end $$;
create unique index certificacion_programa_activa on public.ficha_certificacion(alumno_programa_id) where alumno_programa_id is not null and archivado_en is null;
create unique index certificacion_legado_alumno_activa on public.ficha_certificacion(alumno_id) where alumno_programa_id is null and archivado_en is null;
create index certificacion_alumno_consulta on public.ficha_certificacion(alumno_id,id);

create table public.certificacion_auditoria (
 -- El identificador y las instantáneas se conservan si el flujo previo elimina al alumno.
 -- No se añade una FK restrictiva que bloquee la eliminación ya existente del alumno.
 id uuid primary key default gen_random_uuid(), ficha_id uuid not null,
 usuario_auth uuid not null, fecha timestamptz not null default now(), accion text not null,
 motivo text, antes jsonb, despues jsonb
);
alter table public.certificacion_auditoria enable row level security;
revoke all on public.certificacion_auditoria from public,anon,authenticated;
grant select on public.certificacion_auditoria to authenticated;
create policy certificacion_auditoria_admin on public.certificacion_auditoria for select to authenticated using(exists(select 1 from public.usuarios u where u.auth_id=auth.uid() and u.activo is true and u.rol='ADMINISTRADOR'));

create function public._certificacion_autorizar_v1(p_escritura boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text; cantidad integer;
begin
 select count(*),max(u.rol) into cantidad,rol from public.usuarios u where u.auth_id=auth.uid() and u.activo is true;
 if auth.uid() is null or cantidad<>1 or coalesce(rol,'') not in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR')
 or (p_escritura and rol<>'ADMINISTRADOR') then raise exception 'No tienes permiso para esta operación de certificación' using errcode='42501';end if;
end $$;
revoke all on function public._certificacion_autorizar_v1(boolean) from public,anon,authenticated;

-- Defensa adicional de integridad. Una asociación explícita siempre pertenece al mismo alumno.
create function public._certificacion_integridad_v1() returns trigger
language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.alumno_programa_id is not null and not exists(select 1 from public.alumno_programas where id=new.alumno_programa_id and alumno_id=new.alumno_id)
 then raise exception 'El programa no pertenece al alumno';end if;
 return new;
end $$;
create trigger certificacion_integridad_programa before insert or update of alumno_programa_id,alumno_id on public.ficha_certificacion for each row execute function public._certificacion_integridad_v1();

-- Las escrituras del cliente pasan solo por las funciones transaccionales.
do $$ declare c record; begin
 for c in select policyname from pg_policies where schemaname='public' and tablename='ficha_certificacion'
 loop execute format('drop policy %I on public.ficha_certificacion',c.policyname);end loop;
end $$;
alter table public.ficha_certificacion enable row level security;
revoke all on public.ficha_certificacion from public,anon,authenticated;
grant select on public.ficha_certificacion to authenticated;
create policy certificacion_lectura_escolar on public.ficha_certificacion for select to authenticated
using(exists(select 1 from public.usuarios u where u.auth_id=auth.uid() and u.activo is true and u.rol in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR')));

create function public.certificacion_consultar_v1(p_alumno_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare fichas jsonb; programas jsonb;
begin
 perform public._certificacion_autorizar_v1(false);
 select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]'::jsonb) into fichas from public.ficha_certificacion f where alumno_id=p_alumno_id and archivado_en is null;
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('planes_estudio',to_jsonb(e)||jsonb_build_object('carreras',to_jsonb(c))) order by e.nombre,p.id),'[]'::jsonb)
 into programas from public.alumno_programas p left join public.planes_estudio e on e.id=p.plan_id left join public.carreras c on c.id=e.carrera_id where p.alumno_id=p_alumno_id;
 return jsonb_build_object('fichas',fichas,'programas',programas);
end $$;

create function public.certificacion_resumen_v1(p_alumnos uuid[],p_desde integer default 0,p_cantidad integer default 500) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb;
begin
 perform public._certificacion_autorizar_v1(false);
 if p_alumnos is null or cardinality(p_alumnos)>200 or p_desde is null or p_desde<0 or p_cantidad is null or p_cantidad not between 1 and 500 then raise exception 'Consulta fuera de límites';end if;
 with filas as (
 select p.alumno_id,f.id,p.id alumno_programa_id,concat_ws(' · ',c.nombre,e.clave_legado,e.nombre) programa,
 f.pago_certificado,f.tramite_completado,f.fecha_inicio_tramite,(f.id is null) sin_ficha
 from public.alumno_programas p join public.planes_estudio e on e.id=p.plan_id left join public.carreras c on c.id=e.carrera_id
 left join public.ficha_certificacion f on f.alumno_programa_id=p.id and f.archivado_en is null where p.alumno_id=any(p_alumnos)
 union all
 select alumno_id,id,null::uuid,'Ficha anterior sin asociar',pago_certificado,tramite_completado,fecha_inicio_tramite,false
 from public.ficha_certificacion where alumno_id=any(p_alumnos) and alumno_programa_id is null and archivado_en is null
 ), pagina as (select * from filas order by alumno_id,alumno_programa_id nulls first,id offset p_desde limit p_cantidad)
 select coalesce(jsonb_agg(to_jsonb(pagina) order by alumno_id,alumno_programa_id nulls first,id),'[]'::jsonb) into r from pagina;
 return r;
end $$;

create function public.certificacion_guardar_v1(p_id uuid,p_alumno_id uuid,p_programa_id uuid,p_revision integer,p_datos jsonb,p_motivo text default '') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_certificacion; n public.ficha_certificacion; p public.alumno_programas; especialidad boolean; antes jsonb; k text; ahora timestamptz=clock_timestamp();
begin
 perform public._certificacion_autorizar_v1(true);
 if p_id is null or p_programa_id is null or p_alumno_id is null or p_revision is null or p_revision<0 or jsonb_typeof(p_datos) is distinct from 'object' or pg_column_size(p_datos)>32768 then raise exception 'Revisa el programa y los datos de certificación';end if;
 select * into p from public.alumno_programas where id=p_programa_id and alumno_id=p_alumno_id for update;
 if p.id is null then raise exception 'El programa no pertenece al alumno';end if;
 select * into f from public.ficha_certificacion where id=p_id for update;
 if f.id is not null then
  if f.alumno_id<>p_alumno_id or f.archivado_en is not null then raise exception 'Ficha no disponible';end if;
  if f.revision<>p_revision then raise exception 'La ficha cambió. Recarga antes de guardar' using errcode='40001';end if;
  if f.alumno_programa_id is not null and f.alumno_programa_id<>p_programa_id then raise exception 'No se puede trasladar una certificación ya asociada a otro programa';end if;
  if f.alumno_programa_id is null and length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Indica el respaldo para asociar la ficha anterior';end if;
 else
  if p_revision<>0 then raise exception 'La ficha ya no existe. Recarga antes de continuar' using errcode='40001';end if;
  if exists(select 1 from public.ficha_certificacion where alumno_id=p_alumno_id and alumno_programa_id is null and archivado_en is null)
  then raise exception 'Revisa y asocia primero la ficha anterior sin programa, o archívala con un motivo';end if;
 end if;
 if exists(select 1 from public.ficha_certificacion where alumno_programa_id=p_programa_id and archivado_en is null and id<>p_id) then raise exception 'Este programa ya tiene una certificación. Abre su ficha';end if;
 antes=case when f.id is null then null else to_jsonb(f) end;
 n=jsonb_populate_record(null::public.ficha_certificacion,p_datos);
 if n.pago_certificado is null or n.pago_certificado not in ('SIN_INICIAR','EN_CURSO','COMPLETADO') then raise exception 'Estado de pago no válido';end if;
 foreach k in array array['doc_acta_nacimiento','doc_curp','doc_antecedente','doc_titulo_profesional','doc_cedula_profesional'] loop
  if coalesce(p_datos->>k,'') not in ('SIN_INICIAR','APROBADO','RECHAZADO') then raise exception 'Estado documental no válido: %',k;end if;
 end loop;
 if n.tipo_certificado is not null and n.tipo_certificado not in ('TOTAL','PARCIAL') then raise exception 'Tipo de certificado no válido';end if;
 if n.fecha_termino_tramite is not null and (n.fecha_inicio_tramite is null or n.fecha_termino_tramite<n.fecha_inicio_tramite) then raise exception 'La fecha de término no puede ser anterior al inicio';end if;
 select coalesce(c.nivel_educativo='Especialidad',false) into especialidad from public.planes_estudio e left join public.carreras c on c.id=e.carrera_id where e.id=p.plan_id;
 if n.fecha_inicio_tramite is not null or coalesce(n.tramite_completado,false) then
  if n.pago_certificado<>'COMPLETADO' or n.doc_acta_nacimiento<>'APROBADO' or n.doc_curp<>'APROBADO' or n.doc_antecedente<>'APROBADO' or n.tipo_certificado is null
  or (especialidad and (n.doc_titulo_profesional<>'APROBADO' or n.doc_cedula_profesional<>'APROBADO')) then raise exception 'Completa pago, revisión documental y tipo de certificado antes de iniciar el trámite';end if;
 end if;
 if coalesce(n.tramite_completado,false) and n.fecha_inicio_tramite is null then raise exception 'Registra la fecha de inicio antes de completar el trámite';end if;
 n.fecha_completado=case when n.tramite_completado then case when f.tramite_completado then f.fecha_completado else ahora end else null end;
 if f.id is null then
  insert into public.ficha_certificacion(id,alumno_id,alumno_programa_id,pago_certificado,tipo_certificado,doc_acta_nacimiento,doc_acta_nacimiento_nota,doc_curp,doc_curp_nota,doc_antecedente,doc_antecedente_nota,doc_titulo_profesional,doc_titulo_profesional_nota,doc_cedula_profesional,doc_cedula_profesional_nota,fecha_inicio_tramite,fecha_termino_tramite,tramite_completado,fecha_completado,enlace_drive,revision)
  values(p_id,p_alumno_id,p_programa_id,n.pago_certificado,n.tipo_certificado,n.doc_acta_nacimiento,n.doc_acta_nacimiento_nota,n.doc_curp,n.doc_curp_nota,n.doc_antecedente,n.doc_antecedente_nota,n.doc_titulo_profesional,n.doc_titulo_profesional_nota,n.doc_cedula_profesional,n.doc_cedula_profesional_nota,n.fecha_inicio_tramite,n.fecha_termino_tramite,coalesce(n.tramite_completado,false),n.fecha_completado,n.enlace_drive,1) returning * into n;
 else
  update public.ficha_certificacion set alumno_programa_id=p_programa_id,pago_certificado=n.pago_certificado,tipo_certificado=n.tipo_certificado,doc_acta_nacimiento=n.doc_acta_nacimiento,doc_acta_nacimiento_nota=n.doc_acta_nacimiento_nota,doc_curp=n.doc_curp,doc_curp_nota=n.doc_curp_nota,doc_antecedente=n.doc_antecedente,doc_antecedente_nota=n.doc_antecedente_nota,doc_titulo_profesional=n.doc_titulo_profesional,doc_titulo_profesional_nota=n.doc_titulo_profesional_nota,doc_cedula_profesional=n.doc_cedula_profesional,doc_cedula_profesional_nota=n.doc_cedula_profesional_nota,fecha_inicio_tramite=n.fecha_inicio_tramite,fecha_termino_tramite=n.fecha_termino_tramite,tramite_completado=coalesce(n.tramite_completado,false),fecha_completado=n.fecha_completado,enlace_drive=n.enlace_drive,revision=f.revision+1,updated_at=ahora where id=p_id returning * into n;
 end if;
 -- Conserva la regla de cierre al completar; se limita al programa elegido y nunca degrada titulados.
 if n.tramite_completado and n.tipo_certificado='TOTAL' then
  update public.alumno_programas set estatus='EGRESADO',motivo_estatus='PLAN_CONCLUIDO',fecha_ultimo_cambio=ahora where id=p_programa_id and estatus in ('CURSANDO','ACTIVO');
  -- El trigger institucional existente decide el estatus del alumno a partir de sus programas.
 end if;
 insert into public.certificacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues)
 values(n.id,auth.uid(),case when f.id is null then 'CREAR' when f.alumno_programa_id is null then 'ASOCIAR_LEGADO' when f.tramite_completado and not n.tramite_completado then 'REABRIR' else 'GUARDAR' end,nullif(trim(p_motivo),''),antes,to_jsonb(n));
 return to_jsonb(n);
end $$;

create function public.certificacion_archivar_v1(p_id uuid,p_revision integer,p_motivo text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_certificacion; n public.ficha_certificacion;
begin
 perform public._certificacion_autorizar_v1(true);
 if length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Describe por qué se archiva la ficha';end if;
 select * into f from public.ficha_certificacion where id=p_id for update;
 if f.id is null or f.archivado_en is not null or p_revision is null or f.revision<>p_revision then raise exception 'La ficha cambió. Recarga antes de archivar' using errcode='40001';end if;
 update public.ficha_certificacion set archivado_en=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=p_id returning * into n;
 insert into public.certificacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues) values(p_id,auth.uid(),'ARCHIVAR',trim(p_motivo),to_jsonb(f),to_jsonb(n));
end $$;

revoke all on function public._certificacion_integridad_v1() from public,anon,authenticated;
revoke all on function public.certificacion_consultar_v1(uuid),public.certificacion_resumen_v1(uuid[],integer,integer),public.certificacion_guardar_v1(uuid,uuid,uuid,integer,jsonb,text),public.certificacion_archivar_v1(uuid,integer,text) from public,anon;
grant execute on function public.certificacion_consultar_v1(uuid),public.certificacion_resumen_v1(uuid[],integer,integer),public.certificacion_guardar_v1(uuid,uuid,uuid,integer,jsonb,text),public.certificacion_archivar_v1(uuid,integer,text) to authenticated;
commit;
