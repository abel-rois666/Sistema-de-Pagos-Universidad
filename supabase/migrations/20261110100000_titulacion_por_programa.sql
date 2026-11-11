-- PREPARADA, NO EJECUTADA. Instalar con cliente actualizado; clientes antiguos dejarán de escribir.
begin;
alter table public.ficha_titulacion add column revision integer not null default 0 check(revision>=0);
alter table public.ficha_titulacion add column archivado_en timestamptz;
-- Conservar los trámites aun cuando se intente retirar una asociación académica.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.ficha_titulacion'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.ficha_titulacion'::regclass and attname='alumno_programa_id')]::smallint[] loop execute format('alter table public.ficha_titulacion drop constraint %I',c.conname);end loop;
end $$;
alter table public.ficha_titulacion add constraint titulacion_programa_conservado foreign key(alumno_programa_id) references public.alumno_programas(id) on delete no action;
-- El nombre de la restricción de alumno puede variar entre instalaciones.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.ficha_titulacion'::regclass and contype='u'
 and conkey=array[(select attnum from pg_attribute where attrelid='public.ficha_titulacion'::regclass and attname='alumno_id')]::smallint[]
 loop execute format('alter table public.ficha_titulacion drop constraint %I',c.conname);end loop;
end $$;
do $$ declare i record; begin
 for i in select c.relname from pg_index x join pg_class c on c.oid=x.indexrelid
 where x.indrelid='public.ficha_titulacion'::regclass and x.indisunique and x.indpred is null
 and x.indkey::text=(select attnum::text from pg_attribute where attrelid=x.indrelid and attname='alumno_id')
 and not exists(select 1 from pg_constraint where conindid=x.indexrelid)
 loop execute format('drop index public.%I',i.relname);end loop;
end $$;
create unique index titulacion_programa_activa on public.ficha_titulacion(alumno_programa_id) where alumno_programa_id is not null and archivado_en is null;
create unique index titulacion_legado_alumno_activa on public.ficha_titulacion(alumno_id) where alumno_programa_id is null and archivado_en is null;
create index titulacion_alumno_consulta on public.ficha_titulacion(alumno_id,id);

create table public.titulacion_auditoria (
 -- El identificador y las instantáneas se conservan si el flujo previo elimina al alumno.
 -- No se añade una FK restrictiva que bloquee la eliminación ya existente del alumno.
 id uuid primary key default gen_random_uuid(), ficha_id uuid not null,
 usuario_auth uuid not null, fecha timestamptz not null default now(), accion text not null,
 motivo text, antes jsonb, despues jsonb
);
alter table public.titulacion_auditoria enable row level security;
revoke all on public.titulacion_auditoria from public,anon,authenticated;
grant select on public.titulacion_auditoria to authenticated;
create policy titulacion_auditoria_admin on public.titulacion_auditoria for select to authenticated using(exists(select 1 from public.usuarios u where u.auth_id=auth.uid() and u.activo is true and u.rol='ADMINISTRADOR'));

create function public._titulacion_autorizar_v1(p_escritura boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null or not (select count(*)=1 and coalesce(bool_and(activo and (rol='ADMINISTRADOR' or (not p_escritura and rol='COORDINADOR CONTROL ESCOLAR'))),false) from public.usuarios where auth_id=auth.uid()) then raise exception 'No tienes permiso para esta operación de titulación' using errcode='42501';end if;
end $$;
revoke all on function public._titulacion_autorizar_v1(boolean) from public,anon,authenticated;
create function public._titulacion_integridad_v1() returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.alumno_programa_id is not null and not exists(select 1 from public.alumno_programas where id=new.alumno_programa_id and alumno_id=new.alumno_id) then raise exception 'El programa no pertenece al alumno';end if;return new;
end $$;
create trigger titulacion_integridad_programa before insert or update of alumno_programa_id,alumno_id on public.ficha_titulacion for each row execute function public._titulacion_integridad_v1();
do $$ declare c record;begin for c in select policyname from pg_policies where schemaname='public' and tablename='ficha_titulacion' loop execute format('drop policy %I on public.ficha_titulacion',c.policyname);end loop;end $$;
alter table public.ficha_titulacion enable row level security;
revoke all on public.ficha_titulacion from public,anon,authenticated;
grant select on public.ficha_titulacion to authenticated;
create policy titulacion_lectura on public.ficha_titulacion for select to authenticated using(exists(select 1 from public.usuarios where auth_id=auth.uid() and activo and rol in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR')));
create function public.titulacion_guardar_v1(p_alumno uuid,p_programa uuid,p_id uuid,p_revision integer,p_datos jsonb,p_accion text,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_titulacion;n public.ficha_titulacion;pr public.alumno_programas;esp boolean;skip boolean;requisitos boolean;k text;
begin
 perform public._titulacion_autorizar_v1(true);
 if p_accion not in ('GUARDAR','COMPLETAR','REABRIR','ARCHIVAR') or p_accion is null or length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Revisa la acción y su motivo';end if;
 perform id from public.alumnos where id=p_alumno for update;
 select * into pr from public.alumno_programas where id=p_programa and alumno_id=p_alumno for update;
 if pr.id is null then raise exception 'Selecciona un programa del alumno';end if;
 if p_id is not null then
 select * into f from public.ficha_titulacion where id=p_id and alumno_id=p_alumno and alumno_programa_id=p_programa and archivado_en is null for update;
 if f.id is null or f.revision is distinct from p_revision then raise exception 'La ficha cambió. Consulta y revisa antes de guardar' using errcode='40001';end if;
 else
 if p_accion<>'GUARDAR' or exists(select 1 from public.ficha_titulacion where alumno_id=p_alumno and alumno_programa_id is null and archivado_en is null) then raise exception 'Asocia primero la ficha anterior pendiente';end if;
 end if;
 if p_accion='GUARDAR' and f.tramite_completado then raise exception 'Reabre el trámite antes de editar';end if;
 if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos';end if;
 for k in select jsonb_object_keys(p_datos) loop
 if k not in ('modalidad','pago_titulacion','certificado_estudios','ingles','servicio_social_req','fotografias','doc_antecedente','doc_antecedente_nota','doc_acta_nacimiento','doc_acta_nacimiento_nota','doc_curp','doc_curp_nota','doc_titulo_profesional','doc_titulo_profesional_nota','doc_cedula_profesional','doc_cedula_profesional_nota','promedio_alto_rendimiento','fecha_inicio_tramite','fecha_estimada_culminacion','enlace_drive','libro','foja','folio_control','fecha_examen','fecha_exencion') then raise exception 'Campo no permitido: %',k;end if;end loop;
 if f.id is null then insert into public.ficha_titulacion(alumno_id,alumno_programa_id) values(p_alumno,p_programa) returning * into f;end if;
 n=jsonb_populate_record(f,p_datos);
 if n.pago_titulacion not in ('SIN_INICIAR','EN_CURSO','COMPLETADO') or n.certificado_estudios not in ('SIN_INICIAR','EN_TRAMITE','TRAMITADO') then raise exception 'Estado de pago o certificado inválido';end if;
 if n.libro<0 or n.foja<0 then raise exception 'Libro y foja deben ser no negativos';end if;
 if n.fecha_examen is not null and n.fecha_exencion is not null then raise exception 'Elige examen o exención, no ambos';end if;
 if n.fecha_examen<n.fecha_inicio_tramite or n.fecha_exencion<n.fecha_inicio_tramite then raise exception 'La fecha del acta no puede preceder al trámite';end if;
 if n.fecha_inicio_tramite>n.fecha_estimada_culminacion then raise exception 'La fecha inicial supera la final';end if;
 if coalesce(n.modalidad,'')='' then raise exception 'Selecciona una modalidad';end if;
 select c.nivel_educativo='Especialidad' into esp from public.planes_estudio e join public.carreras c on c.id=e.carrera_id where e.id=pr.plan_id;
 skip=coalesce(esp,false) and n.modalidad in ('TESINA','ALTO RENDIMIENTO ACADÉMICO');
 requisitos=n.pago_titulacion='COMPLETADO' and n.certificado_estudios='TRAMITADO' and n.fotografias='ENTREGADAS' and n.doc_antecedente='APROBADO' and n.doc_acta_nacimiento='APROBADO' and n.doc_curp='APROBADO' and (skip or (n.ingles='COMPLETADO' and n.servicio_social_req='COMPLETADO')) and (not skip or (n.doc_titulo_profesional='APROBADO' and n.doc_cedula_profesional='APROBADO'));
 if p_accion='COMPLETAR' then
 if f.tramite_completado then raise exception 'El trámite ya está completado';end if;
 if (upper(n.modalidad) like '%TESIS%' or upper(n.modalidad) like '%TESINA%') and n.fecha_examen is null then raise exception 'Registra la fecha de examen';end if;
 if not (upper(n.modalidad) like '%TESIS%' or upper(n.modalidad) like '%TESINA%') and n.fecha_exencion is null then raise exception 'Registra la fecha de exención';end if;
 if not coalesce(requisitos,false) or n.libro is null or n.foja is null or coalesce(n.folio_control,'')='' or (n.fecha_examen is null and n.fecha_exencion is null) then raise exception 'Faltan requisitos o datos del acta';end if;
 if not exists(select 1 from public.ficha_certificacion c where c.alumno_programa_id=p_programa and c.archivado_en is null and c.tramite_completado) then raise exception 'El certificado de este programa no está completado';end if;
 n.tramite_completado=true;n.fecha_completado=now();
 update public.alumno_programas set estatus='TITULADO',motivo_estatus='PLAN_CONCLUIDO',fecha_ultimo_cambio=now() where id=p_programa;
 elsif p_accion='REABRIR' then
 if not f.tramite_completado then raise exception 'El trámite no está completado';end if;
 n.tramite_completado=false;n.fecha_completado=null;
 update public.alumno_programas set estatus='EGRESADO',motivo_estatus='PLAN_CONCLUIDO',fecha_ultimo_cambio=now() where id=p_programa and estatus='TITULADO';
 elsif p_accion='ARCHIVAR' then
 if f.tramite_completado or f.libro is not null or f.foja is not null or f.fecha_examen is not null or f.fecha_exencion is not null then raise exception 'La ficha tiene acta o trámite concluido: requiere revisión individual';end if;n.archivado_en=now();
 elsif coalesce(requisitos,false) then
 update public.alumno_programas set estatus='EGRESADO',motivo_estatus='PLAN_CONCLUIDO',fecha_ultimo_cambio=now() where id=p_programa and estatus in ('CURSANDO','ACTIVO');
 end if;
 n.revision=f.revision+1;n.updated_at=now();
 -- Lista explícita: el JSON nunca puede escribir identidad, revisión o asociación.
 update public.ficha_titulacion set modalidad=n.modalidad,pago_titulacion=n.pago_titulacion,certificado_estudios=n.certificado_estudios,ingles=n.ingles,servicio_social_req=n.servicio_social_req,fotografias=n.fotografias,doc_antecedente=n.doc_antecedente,doc_antecedente_nota=n.doc_antecedente_nota,doc_acta_nacimiento=n.doc_acta_nacimiento,doc_acta_nacimiento_nota=n.doc_acta_nacimiento_nota,doc_curp=n.doc_curp,doc_curp_nota=n.doc_curp_nota,doc_titulo_profesional=n.doc_titulo_profesional,doc_titulo_profesional_nota=n.doc_titulo_profesional_nota,doc_cedula_profesional=n.doc_cedula_profesional,doc_cedula_profesional_nota=n.doc_cedula_profesional_nota,promedio_alto_rendimiento=n.promedio_alto_rendimiento,fecha_inicio_tramite=n.fecha_inicio_tramite,fecha_estimada_culminacion=n.fecha_estimada_culminacion,enlace_drive=n.enlace_drive,libro=n.libro,foja=n.foja,folio_control=n.folio_control,fecha_examen=n.fecha_examen,fecha_exencion=n.fecha_exencion,tramite_completado=n.tramite_completado,fecha_completado=n.fecha_completado,revision=n.revision,archivado_en=n.archivado_en,updated_at=n.updated_at where id=f.id;
 insert into public.titulacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues) values(f.id,auth.uid(),p_accion,p_motivo,to_jsonb(f),to_jsonb(n));
 return to_jsonb(n);
end $$;
revoke all on function public.titulacion_guardar_v1(uuid,uuid,uuid,integer,jsonb,text,text) from public,anon;
grant execute on function public.titulacion_guardar_v1(uuid,uuid,uuid,integer,jsonb,text,text) to authenticated;
create function public._tit_lote_candidato_v1(p_ficha uuid,p_destino uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_titulacion; programas jsonb; otras jsonb; destino uuid; motivo text=''; pendientes bigint; nombre text; matricula text; etiqueta text; opciones jsonb;
begin
 select * into f from public.ficha_titulacion where id=p_ficha;
 if f.id is null then raise exception 'La ficha ya no existe';end if;
 select nombre_completo,a.matricula into nombre,matricula from public.alumnos a where id=f.alumno_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into programas from public.alumno_programas p where alumno_id=f.alumno_id;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') into otras from public.ficha_titulacion c where alumno_id=f.alumno_id and id<>f.id;
 select count(*) into pendientes from public.ficha_titulacion where alumno_id=f.alumno_id and alumno_programa_id is null and archivado_en is null;
 if f.archivado_en is not null or f.alumno_programa_id is not null then motivo='La ficha ya fue asociada o archivada';
 elsif nombre is null then motivo='Alumno sin identificar';
 elsif jsonb_array_length(programas)=0 then motivo='Sin programa asociado';
 elsif pendientes<>1 then motivo='Varias fichas pendientes: revisar individualmente';
 else
  destino=coalesce(p_destino,case when jsonb_array_length(programas)=1 then (programas->0->>'id')::uuid end);
  if destino is null then motivo='Elige y revisa un programa';
  elsif not exists(select 1 from public.alumno_programas where id=destino and alumno_id=f.alumno_id) then motivo='El programa no pertenece al alumno';end if;
  if exists(select 1 from jsonb_array_elements(otras) c where c->>'alumno_programa_id'=destino::text) then motivo='El programa ya tiene otra ficha, incluso archivada';end if;
  select concat_ws(' · ',c.nombre,p.clave_legado,p.nombre) into etiqueta from public.alumno_programas a
   join public.planes_estudio p on p.id=a.plan_id left join public.carreras c on c.id=p.carrera_id where a.id=destino;
  if destino is not null and etiqueta is null then motivo='Plan del programa sin identificar';end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'etiqueta',concat_ws(' · ',c.nombre,p.clave_legado,p.nombre,p.tipo_periodo,a.estatus,case when a.es_vigente then 'Principal' else 'Histórico' end),
 'disponible',not exists(select 1 from public.ficha_titulacion x where x.alumno_programa_id=a.id and x.id<>f.id),
 'motivo',case when exists(select 1 from public.ficha_titulacion x where x.alumno_programa_id=a.id and x.id<>f.id) then 'Ya tiene otra ficha, incluso archivada' else '' end)
 order by c.nombre,p.clave_legado,a.id),'[]') into opciones from public.alumno_programas a join public.planes_estudio p on p.id=a.plan_id left join public.carreras c on c.id=p.carrera_id where a.alumno_id=f.alumno_id;
 return jsonb_build_object('id',f.id,'alumnoId',f.alumno_id,'nombre',nombre,'matricula',matricula,'programaId',destino,'programa',etiqueta,
 'detalle',to_jsonb(f),'opciones',opciones,'cantidadProgramas',jsonb_array_length(programas),'revisable',f.archivado_en is null and f.alumno_programa_id is null and pendientes=1 and nombre is not null,'elegible',motivo='','motivo',motivo,'pago',concat_ws(' · ',f.pago_titulacion,f.modalidad,f.folio_control),'tramite',case when f.tramite_completado then 'Completado' when f.fecha_inicio_tramite is not null then 'En trámite' else 'En preparación' end,
 'huella',md5(jsonb_build_object('ficha',to_jsonb(f),'programas',programas,'otras',otras)::text));
end $$;

create function public.titulacion_lote_preview_v1(p_desde integer default 0,p_busqueda text default '',p_vista text default 'todos',p_alumno uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; total bigint;
begin
 perform public._titulacion_autorizar_v1(true);
 if p_vista is null or p_vista not in ('todos','unico','varios') then raise exception 'Vista inválida';end if;
 if p_desde is null or p_desde<0 or length(coalesce(p_busqueda,''))>100 then raise exception 'Consulta fuera de límites';end if;
 select count(*) into total from public.ficha_titulacion f join public.alumnos a on a.id=f.alumno_id
 where f.alumno_programa_id is null and f.archivado_en is null
 and (p_alumno is null or f.alumno_id=p_alumno)
 and (p_vista='todos' or (p_vista='unico' and (select count(*) from public.alumno_programas ap where ap.alumno_id=f.alumno_id)=1) or (p_vista='varios' and (select count(*) from public.alumno_programas ap where ap.alumno_id=f.alumno_id)>1))
 and (coalesce(p_busqueda,'')='' or strpos(lower(concat_ws(' ',a.nombre_completo,a.matricula)),lower(p_busqueda))>0);
 select coalesce(jsonb_agg(public._tit_lote_candidato_v1(id) order by nombre,id),'[]') into r from (
 select f.id,a.nombre_completo nombre from public.ficha_titulacion f join public.alumnos a on a.id=f.alumno_id
 where f.alumno_programa_id is null and f.archivado_en is null
 and (p_alumno is null or f.alumno_id=p_alumno)
 and (p_vista='todos' or (p_vista='unico' and (select count(*) from public.alumno_programas ap where ap.alumno_id=f.alumno_id)=1) or (p_vista='varios' and (select count(*) from public.alumno_programas ap where ap.alumno_id=f.alumno_id)>1))
 and (coalesce(p_busqueda,'')='' or strpos(lower(concat_ws(' ',a.nombre_completo,a.matricula)),lower(p_busqueda))>0)
 order by a.nombre_completo,f.id offset p_desde limit 25) pagina;
 return jsonb_build_object('total',total,'filas',r);
end $$;

create function public.titulacion_asociar_lote_v1(p_filas jsonb,p_motivo text) returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare x jsonb; r jsonb; f public.ficha_titulacion; n public.ficha_titulacion; cantidad integer=0;
begin
 perform public._titulacion_autorizar_v1(true);
 if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Selección inválida';end if;
 if jsonb_array_length(p_filas) not between 1 and 50 or length(btrim(coalesce(p_motivo,''))) not between 10 and 1000
 or (select count(distinct v->>'id') from jsonb_array_elements(p_filas) v)<>jsonb_array_length(p_filas) then raise exception 'Revisa la selección (máximo 50) y el respaldo';end if;
 perform set_config('lock_timeout','3s',true);
 -- Orden común y bloqueo de padres: también impide insertar otro programa/ficha mientras se confirma.
 perform a.id from public.alumnos a where a.id in(select alumno_id from public.ficha_titulacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by a.id for update;
 perform p.id from public.alumno_programas p where alumno_id in(select alumno_id from public.ficha_titulacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by p.id for update;
 perform c.id from public.ficha_titulacion c where alumno_id in(select alumno_id from public.ficha_titulacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by c.id for update;
 for x in select v from jsonb_array_elements(p_filas) v order by v->>'id' loop
  r=public._tit_lote_candidato_v1((x->>'id')::uuid,(x->>'programaId')::uuid);
  if x->>'programaId' is null or not (r->>'elegible')::boolean or r->>'huella' is distinct from x->>'huella' or r->>'programaId' is distinct from x->>'programaId' then
   raise exception 'Cambió la ficha % o su destino. Actualiza y revisa el lote; no se guardó ninguna asociación',x->>'id' using errcode='40001';end if;
  select * into f from public.ficha_titulacion where id=(x->>'id')::uuid;
  -- Asociación específica: no llama al guardado general ni cierra programas completados.
  update public.ficha_titulacion set alumno_programa_id=(r->>'programaId')::uuid,revision=revision+1,updated_at=now() where id=f.id returning * into n;
  insert into public.titulacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues)
   values(f.id,auth.uid(),'ASOCIAR_LEGADO_LOTE',btrim(p_motivo),to_jsonb(f),to_jsonb(n));
  cantidad=cantidad+1;
 end loop;
 return cantidad;
end $$;
revoke all on function public._tit_lote_candidato_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function public.titulacion_lote_preview_v1(integer,text,text,uuid),public.titulacion_asociar_lote_v1(jsonb,text) from public,anon;
grant execute on function public.titulacion_lote_preview_v1(integer,text,text,uuid),public.titulacion_asociar_lote_v1(jsonb,text) to authenticated;
commit;
