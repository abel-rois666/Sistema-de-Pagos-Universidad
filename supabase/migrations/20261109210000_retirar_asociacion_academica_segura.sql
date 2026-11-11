-- PREPARADA, NO EJECUTADA. Retira SOLO asociaciones sin antecedentes y no principales.
-- No elimina planes del catálogo, materias, pagos, recibos ni antecedentes.
begin;
do $$ begin
 if to_regclass('public.inscripciones_academicas') is null or to_regclass('public.asignaturas') is null
   or to_regclass('public.alumnos_grupos') is null or to_regclass('public.grupos') is null then
  raise exception 'Faltan tablas académicas requeridas; revisa el preflight de asociaciones';end if;
end $$;

create table public.asociaciones_programa_retiro_auditoria (
 id uuid primary key default gen_random_uuid(), alumno_id uuid not null, programa_id uuid not null,
 actor uuid not null, motivo text not null, antes jsonb not null, alumno_antes jsonb, alumno_despues jsonb,
 transaccion bigint not null default txid_current(), creado_en timestamptz not null default now()
);
alter table public.asociaciones_programa_retiro_auditoria enable row level security;
revoke all on public.asociaciones_programa_retiro_auditoria from public,anon,authenticated;
grant select on public.asociaciones_programa_retiro_auditoria to authenticated;
create policy asociaciones_retiro_auditoria_admin on public.asociaciones_programa_retiro_auditoria for select to authenticated
 using(exists(select 1 from public.usuarios where auth_id=auth.uid() and activo is true and rol='ADMINISTRADOR'));
-- Sin FK hacia alumno/programa: la auditoría no cambia sus reglas existentes de eliminación.

create function public._ap_retiro_autorizar_v1() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null or not(select count(*)=1 and coalesce(bool_and(activo is true and rol='ADMINISTRADOR'),false)
   from public.usuarios where auth_id=auth.uid()) then
  raise exception 'Solo Administración con cuenta activa puede retirar asociaciones erróneas' using errcode='42501';end if;
end $$;

create function public._ap_revision_retiro_v1(p_alumno uuid,p_programa uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare p public.alumno_programas; r record; n bigint; antecedentes jsonb='[]'; motivos jsonb='[]';
        principales integer; contexto jsonb; titulo text; etiqueta text; puede boolean;
begin
 select * into p from public.alumno_programas where id=p_programa and alumno_id=p_alumno;
 if p.id is null then raise exception 'La asociación ya no existe o no pertenece al alumno';end if;
 select count(*) filter(where es_vigente is true),jsonb_agg(to_jsonb(ap) order by id) into principales,contexto
 from public.alumno_programas ap where alumno_id=p_alumno;
 if p.es_vigente is true then motivos=motivos||jsonb_build_array('Este es el programa principal. Establece primero el programa correcto como principal desde Administrar programas.');end if;
 if principales<>1 then motivos=motivos||jsonb_build_array('El alumno requiere un único programa principal antes de retirar asociaciones.');end if;
 if upper(btrim(coalesce(p.estatus,''))) in ('EGRESADO','TITULADO','EGRESADO TITULADO') or p.motivo_estatus='PLAN_CONCLUIDO' then
  motivos=motivos||jsonb_build_array('El programa conserva un logro académico concluido y requiere revisión individual.');end if;

 -- Toda referencia FK bloquea, incluso si su ON DELETE permitiría CASCADE o SET NULL.
 -- Incluye certificaciones archivadas, preparaciones canceladas y bitácoras históricas.
 for r in
  select c.conname,c.conrelid,c.conkey,c.confkey,n.nspname,t.relname,a.attname
  from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  left join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.contype='f' and c.confrelid='public.alumno_programas'::regclass
  order by n.nspname,t.relname,c.conname
 loop
  etiqueta=case r.relname when 'ficha_certificacion' then 'Certificaciones, incluidas las archivadas'
    when 'ficha_titulacion' then 'Trámites de titulación'
    when 'inscripciones_ciclo' then 'Inscripciones por ciclo'
    when 'inscripciones_ciclo_preparaciones' then 'Preparaciones de inscripción'
    when 'inscripciones_programa_ingreso' then 'Ingreso acreditado al programa'
    when 'inscripciones_programa_ingreso_historial' then 'Historial del ingreso'
    when 's911_inscripciones' then 'Inscripciones del expediente 911'
    when 's911_eventos' then 'Eventos del expediente 911'
    else 'Otros antecedentes vinculados' end;
  if cardinality(r.conkey)<>1 or cardinality(r.confkey)<>1 or r.confkey[1]<>(select attnum from pg_attribute where attrelid='public.alumno_programas'::regclass and attname='id') then
   antecedentes=antecedentes||jsonb_build_array(jsonb_build_object('clave',format('%I.%I:%s',r.nspname,r.relname,r.conname),'etiqueta','Relación adicional que requiere revisión individual','cantidad',null,'bloquea',true));
  else
   execute format('select count(*) from %I.%I where %I=$1',r.nspname,r.relname,r.attname) into n using p.id;
   antecedentes=antecedentes||jsonb_build_array(jsonb_build_object('clave',format('%I.%I:%s',r.nspname,r.relname,r.conname),'etiqueta',etiqueta,'cantidad',n,'bloquea',n>0));
  end if;
 end loop;
 select count(*) into n from public.inscripciones_academicas i join public.asignaturas a on a.id=i.asignatura_id
 where i.alumno_id=p.alumno_id and a.plan_id=p.plan_id;
 antecedentes=antecedentes||jsonb_build_array(jsonb_build_object('clave','materias','etiqueta','Materias inscritas o calificaciones de este plan','cantidad',n,'bloquea',n>0));
 select count(*) into n from public.inscripciones_academicas i left join public.asignaturas a on a.id=i.asignatura_id
 where i.alumno_id=p.alumno_id and (a.id is null or a.plan_id is null);
 antecedentes=antecedentes||jsonb_build_array(jsonb_build_object('clave','materias_no_identificadas','etiqueta','Materias cuyo plan requiere identificación','cantidad',n,'bloquea',n>0));
 select count(*) into n from public.alumnos_grupos ag join public.grupos g on g.id=ag.grupo_id
 where ag.alumno_id=p.alumno_id and g.plan_id=p.plan_id;
 antecedentes=antecedentes||jsonb_build_array(jsonb_build_object('clave','grupos','etiqueta','Asignaciones a grupos de este plan','cantidad',n,'bloquea',n>0));
 -- Un trámite anterior sin programa no puede atribuirse ni descartarse automáticamente.
 if to_regclass('public.ficha_titulacion') is not null then
  if exists(select 1 from pg_attribute where attrelid='public.ficha_titulacion'::regclass and attname='alumno_programa_id' and not attisdropped) then
   execute 'select count(*) from public.ficha_titulacion where alumno_id=$1 and alumno_programa_id is null' into n using p.alumno_id;
  else
   execute 'select count(*) from public.ficha_titulacion where alumno_id=$1' into n using p.alumno_id;
  end if;
  antecedentes=antecedentes||jsonb_build_array(jsonb_build_object('clave','titulacion_sin_programa','etiqueta','Titulación anterior pendiente de identificar','cantidad',n,'bloquea',n>0));
 end if;
 if to_regclass('public.ficha_certificacion') is not null then
  if exists(select 1 from pg_attribute where attrelid='public.ficha_certificacion'::regclass and attname='alumno_programa_id' and not attisdropped) then
   execute 'select count(*) from public.ficha_certificacion where alumno_id=$1 and alumno_programa_id is null' into n using p.alumno_id;
  else
   execute 'select count(*) from public.ficha_certificacion where alumno_id=$1' into n using p.alumno_id;
  end if;
  antecedentes=antecedentes||jsonb_build_array(jsonb_build_object('clave','certificado_sin_programa','etiqueta','Certificaciones anteriores pendientes de identificar','cantidad',n,'bloquea',n>0));
 end if;
 if exists(select 1 from jsonb_array_elements(antecedentes) x where (x->>'bloquea')::boolean) then
  motivos=motivos||jsonb_build_array('Hay antecedentes que deben conservarse. Esta acción no elimina ni desvincula historial, aunque esté archivado.');end if;
 puede=jsonb_array_length(motivos)=0;
 select concat_ws(' · ',e.clave_legado,e.nombre) into titulo from public.planes_estudio e where e.id=p.plan_id;
 return jsonb_build_object('alumnoId',p.alumno_id,'programaId',p.id,'planId',p.plan_id,'programa',titulo,
  'puedeRetirar',puede,'motivos',motivos,'antecedentes',antecedentes,
  'huella',md5(jsonb_build_object('asociacion',to_jsonb(p),'contexto',contexto,'antecedentes',antecedentes)::text));
end $$;

create function public.ap_revisar_retiro_v1(p_alumno uuid,p_programa uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 perform public._ap_retiro_autorizar_v1();return public._ap_revision_retiro_v1(p_alumno,p_programa);
end $$;

create function public._ap_proteger_retiro_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare revision jsonb;
begin
 -- Conserva la cascada existente al eliminar un alumno, sin abrir el DELETE individual.
 if pg_trigger_depth()>1 and not exists(select 1 from public.alumnos where id=old.alumno_id) then return old;end if;
 perform public._ap_retiro_autorizar_v1();
 if current_setting('app.retiro_asociacion',true) is distinct from old.id::text or not exists(
   select 1 from public.asociaciones_programa_retiro_auditoria where programa_id=old.id and alumno_id=old.alumno_id
   and actor=auth.uid() and transaccion=txid_current() and antes=to_jsonb(old)) then
  raise exception 'Revisa y confirma el retiro desde la ficha del alumno' using errcode='42501';end if;
 revision=public._ap_revision_retiro_v1(old.alumno_id,old.id);
 if not (revision->>'puedeRetirar')::boolean then raise exception 'Hay antecedentes o cambió la situación del programa; no se retiró la asociación';end if;
 return old;
end $$;
create trigger ap_proteger_retiro before delete on public.alumno_programas for each row execute function public._ap_proteger_retiro_v1();

create function public.ap_retirar_asociacion_v1(p_alumno uuid,p_programa uuid,p_huella text,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare revision jsonb; original public.alumno_programas; antes_alumno jsonb; auditoria uuid;
begin
 perform public._ap_retiro_autorizar_v1();
 if length(btrim(coalesce(p_motivo,''))) not between 10 and 1000 or p_huella is null then raise exception 'Describe el error de asociación y revisa sus antecedentes';end if;
 perform set_config('lock_timeout','3s',true);
 perform id from public.alumnos where id=p_alumno for update;
 if not found then raise exception 'El alumno ya no existe';end if;
 perform id from public.alumno_programas where alumno_id=p_alumno order by id for update;
 -- Materias y grupos relacionan alumno/plan sin FK a la asociación: impedir carreras
 -- contra altas, cambios de plan de materias/grupos y nuevas asignaciones durante el retiro.
 lock table public.inscripciones_academicas,public.asignaturas,public.alumnos_grupos,public.grupos in share mode;
 revision=public._ap_revision_retiro_v1(p_alumno,p_programa);
 if revision->>'huella' is distinct from p_huella then raise exception 'Los antecedentes cambiaron. Actualiza la revisión antes de confirmar' using errcode='40001';end if;
 if not (revision->>'puedeRetirar')::boolean then raise exception 'La asociación tiene antecedentes o requiere otro programa principal. No se retiró';end if;
 select * into original from public.alumno_programas where id=p_programa and alumno_id=p_alumno;
 select jsonb_build_object('id',id,'estatus',estatus,'licenciatura',licenciatura) into antes_alumno from public.alumnos where id=p_alumno;
 insert into public.asociaciones_programa_retiro_auditoria(alumno_id,programa_id,actor,motivo,antes,alumno_antes)
 values(p_alumno,p_programa,auth.uid(),btrim(p_motivo),to_jsonb(original),antes_alumno) returning id into auditoria;
 perform set_config('app.retiro_asociacion',p_programa::text,true);
 delete from public.alumno_programas where id=p_programa and alumno_id=p_alumno;
 perform set_config('app.retiro_asociacion','',true);
 update public.asociaciones_programa_retiro_auditoria set alumno_despues=
   (select jsonb_build_object('id',id,'estatus',estatus,'licenciatura',licenciatura) from public.alumnos where id=p_alumno) where id=auditoria;
 return jsonb_build_object('programaId',p_programa,'alumnoId',p_alumno,'retirado',true);
end $$;

revoke all on function public._ap_retiro_autorizar_v1(),public._ap_revision_retiro_v1(uuid,uuid),public._ap_proteger_retiro_v1() from public,anon,authenticated;
revoke all on function public.ap_revisar_retiro_v1(uuid,uuid),public.ap_retirar_asociacion_v1(uuid,uuid,text,text) from public,anon;
grant execute on function public.ap_revisar_retiro_v1(uuid,uuid),public.ap_retirar_asociacion_v1(uuid,uuid,text,text) to authenticated;
commit;
