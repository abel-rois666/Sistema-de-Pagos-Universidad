-- PREPARADA, NO EJECUTADA. Requiere 20261109210000 y certificación por programa.
-- La instalación no modifica alumnos, materias ni certificaciones existentes.
begin;
create table public.asociaciones_programa_pruebas_auditoria (
 id uuid primary key default gen_random_uuid(), alumno_id uuid not null, programa_id uuid not null,
 actor uuid not null, motivo text not null, programa_antes jsonb not null,
 materias_antes jsonb not null, certificados_antes jsonb not null, certificados_despues jsonb not null,
 creado_en timestamptz not null default now()
);
create index ap_pruebas_auditoria_alumno on public.asociaciones_programa_pruebas_auditoria(alumno_id);
alter table public.asociaciones_programa_pruebas_auditoria enable row level security;
revoke all on public.asociaciones_programa_pruebas_auditoria from public,anon,authenticated;
grant select on public.asociaciones_programa_pruebas_auditoria to authenticated;
create policy ap_pruebas_lectura_admin on public.asociaciones_programa_pruebas_auditoria for select to authenticated
 using(exists(select 1 from public.usuarios where auth_id=auth.uid() and activo is true and rol='ADMINISTRADOR'));

-- Lista cerrada: cualquier campo nuevo exige revisar su significado antes de depurarlo.
create function public._ap_materia_prueba_v1(j jsonb) returns boolean language sql immutable
set search_path=pg_catalog,public as $$
 select j-array['id','alumno_id','ciclo_id','asignatura_id','created_at','updated_at','parcial_1','parcial_2','parcial_3',
 'promedio_calculado','calificacion_final','modificada_manualmente','observaciones','tipo_evaluacion','estatus','ciclo_legado',
 'bloqueo_p1','bloqueo_p2','bloqueo_p3','bloqueo_final','solicitud_p1','solicitud_p2','solicitud_p3','solicitud_final','id_observacion_certificacion']='{}'::jsonb
 and not exists(select 1 from jsonb_each(j) x where
   (x.key in ('parcial_1','parcial_2','parcial_3','promedio_calculado','calificacion_final','id_observacion_certificacion') and x.value<>'null'::jsonb)
   or (x.key in ('modificada_manualmente','bloqueo_p1','bloqueo_p2','bloqueo_p3','bloqueo_final','solicitud_p1','solicitud_p2','solicitud_p3','solicitud_final') and x.value not in ('null'::jsonb,'false'::jsonb))
   or (x.key='ciclo_legado' and nullif(btrim(x.value#>>'{}'),'') is not null)
   or (x.key='observaciones' and upper(btrim(coalesce(x.value#>>'{}',''))) not in ('','CARGA INICIAL','CARGA DE REINSCRIPCIÓN','CARGA DE REINSCRIPCION','IMPORTADO DE GES 4')))
 and upper(btrim(coalesce(j->>'estatus',''))) in ('','CURSANDO','SIN_EVALUAR','SIN EVALUAR')
 and upper(btrim(coalesce(j->>'tipo_evaluacion','ORDINARIO')))='ORDINARIO';
$$;
create function public._ap_certificado_prueba_v1(j jsonb) returns boolean language sql immutable
set search_path=pg_catalog,public as $$
 select not coalesce((j->>'tramite_completado')::boolean,false)
 and not exists(select 1 from jsonb_each(j) x where
 (x.key in ('fecha_inicio_tramite','fecha_termino_tramite','fecha_completado','enlace_drive') or x.key like 'doc%nota')
 and nullif(btrim(x.value#>>'{}'),'') is not null)
 and j-array['id','alumno_id','alumno_programa_id','revision','archivado_en','pago_certificado','tipo_certificado',
 'doc_acta_nacimiento','doc_acta_nacimiento_nota','doc_curp','doc_curp_nota','doc_antecedente','doc_antecedente_nota',
 'doc_titulo_profesional','doc_titulo_profesional_nota','doc_cedula_profesional','doc_cedula_profesional_nota',
 'fecha_inicio_tramite','fecha_termino_tramite','tramite_completado','fecha_completado','enlace_drive','created_at','updated_at']='{}'::jsonb;
$$;
create function public._ap_cert_prueba_descartada_v1(j jsonb) returns boolean language sql stable security definer
set search_path=pg_catalog,public as $$
 select exists(select 1 from public.asociaciones_programa_pruebas_auditoria a,
 jsonb_array_elements(a.certificados_despues) c where c=j and a.alumno_id=(j->>'alumno_id')::uuid);
$$;

-- Solo excluir fichas explícitamente descartadas y que siguen idénticas a su instantánea.
-- Una ficha archivada normal sigue bloqueando. No se ignoran otros antecedentes.
do $adaptacion$
declare cuerpo text; anterior text := $a$execute 'select count(*) from public.ficha_certificacion where alumno_id=$1 and alumno_programa_id is null'$a$;
 nuevo text := $b$execute 'select count(*) from public.ficha_certificacion where alumno_id=$1 and alumno_programa_id is null and not public._ap_cert_prueba_descartada_v1(to_jsonb(ficha_certificacion))'$b$;
begin
 select pg_get_functiondef(to_regprocedure('public._ap_revision_retiro_v1(uuid,uuid)')) into cuerpo;
 if cuerpo is null or strpos(cuerpo,anterior)=0 then raise exception 'La revisión instalada no coincide con la base esperada. Revisar preflight antes de adaptar';end if;
 execute replace(cuerpo,anterior,nuevo);
end $adaptacion$;

create function public.ap_revisar_prueba_v1(p_alumno uuid,p_programa uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; motivos jsonb; antecedentes jsonb='[]'; x jsonb; clave_cert text;
 materias jsonb; certificados jsonb; ids uuid[]; tabla regclass; fk record; n bigint; referencias bigint=0;
begin
 perform public._ap_retiro_autorizar_v1(); r=public._ap_revision_retiro_v1(p_alumno,p_programa);
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') into materias from public.inscripciones_academicas i
 join public.asignaturas a on a.id=i.asignatura_id where i.alumno_id=p_alumno and a.plan_id=(r->>'planId')::uuid;
 select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') into certificados from public.ficha_certificacion f where alumno_programa_id=p_programa;
 -- Una nota borrada posteriormente no convierte un antecedente real en prueba.
 if to_regclass('public.operaciones_academicas_auditoria') is not null then
  execute $historial$select count(*) from public.operaciones_academicas_auditoria a
   where a.entidad_id in(select (v->>'id')::uuid from jsonb_array_elements($1) v)
   and exists(select 1 from jsonb_array_elements(jsonb_build_array(a.antes,a.despues)) j
    where j<>'null'::jsonb and case when jsonb_typeof(j)='object' then not public._ap_materia_prueba_v1(j) else true end)$historial$
   into n using materias;
  referencias=referencias+n;
 end if;
 select count(*) into n from public.certificacion_auditoria a
 where a.ficha_id in(select (v->>'id')::uuid from jsonb_array_elements(certificados) v)
 and exists(select 1 from jsonb_array_elements(jsonb_build_array(a.antes,a.despues)) j
  where j<>'null'::jsonb and case when jsonb_typeof(j)='object' then not public._ap_certificado_prueba_v1(j) else true end);
 referencias=referencias+n;
 select format('%I.%I:%s',ns.nspname,t.relname,c.conname) into clave_cert from pg_constraint c
 join pg_class t on t.oid=c.conrelid join pg_namespace ns on ns.oid=t.relnamespace
 where c.contype='f' and c.conrelid='public.ficha_certificacion'::regclass and c.confrelid='public.alumno_programas'::regclass
 and cardinality(c.conkey)=1 and (select attname from pg_attribute where attrelid=c.conrelid and attnum=c.conkey[1])='alumno_programa_id';
 -- Referencias a filas que se depurarían no se borran ni se dejan sin vínculo.
 foreach tabla in array array['public.inscripciones_academicas'::regclass,'public.ficha_certificacion'::regclass] loop
  select array_agg((v->>'id')::uuid) into ids from jsonb_array_elements(case when tabla='public.inscripciones_academicas'::regclass then materias else certificados end) v;
  for fk in select c.*,ns.nspname,t.relname,a.attname from pg_constraint c
    join pg_class t on t.oid=c.conrelid join pg_namespace ns on ns.oid=t.relnamespace
    left join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid=tabla loop
   if cardinality(fk.conkey)<>1 or cardinality(fk.confkey)<>1 or fk.confkey[1]<>(select attnum from pg_attribute where attrelid=tabla and attname='id') then
    if cardinality(ids)>0 then referencias=referencias+1;end if;
   else
    execute format('select count(*) from %I.%I where %I=any($1)',fk.nspname,fk.relname,fk.attname) into n using ids;
    referencias=referencias+n;
   end if;
  end loop;
 end loop;
 for x in select * from jsonb_array_elements(r->'antecedentes') loop
  if x->>'clave'='materias' then
   select count(*) into n from jsonb_array_elements(materias) j where not public._ap_materia_prueba_v1(j);
   x=jsonb_set(x,'{cantidad}',to_jsonb(n)); x=jsonb_set(x,'{bloquea}',to_jsonb(n>0));x=jsonb_set(x,'{etiqueta}','"Materias con información que debe conservarse"');
  elsif x->>'clave'=clave_cert then
   select count(*) into n from jsonb_array_elements(certificados) j where not public._ap_certificado_prueba_v1(j);
   x=jsonb_set(x,'{cantidad}',to_jsonb(n));x=jsonb_set(x,'{bloquea}',to_jsonb(n>0));x=jsonb_set(x,'{etiqueta}','"Certificaciones con evidencia o campos que requieren revisión"');
  end if;
  antecedentes=antecedentes||jsonb_build_array(x);
 end loop;
 select coalesce(jsonb_agg(m),'[]') into motivos from jsonb_array_elements(r->'motivos') m
 where m#>>'{}'<>'Hay antecedentes que deben conservarse. Esta acción no elimina ni desvincula historial, aunque esté archivado.';
 if referencias>0 then motivos=motivos||jsonb_build_array('Hay referencias a materias o certificaciones que requieren revisión individual.');end if;
 if exists(select 1 from jsonb_array_elements(antecedentes) v where (v->>'bloquea')::boolean) then
  motivos=motivos||jsonb_build_array('Se conserva información académica o antecedentes que no pueden retirarse como prueba.');end if;
 return r||jsonb_build_object('esPrueba',true,'antecedentes',antecedentes,'motivos',motivos,'puedeRetirar',jsonb_array_length(motivos)=0,
 'materiasVacias',(select count(*) from jsonb_array_elements(materias) j where public._ap_materia_prueba_v1(j)),
 'certificacionesPrueba',jsonb_array_length(certificados),
 'huella',md5(jsonb_build_object('revision',r,'materias',materias,'certificados',certificados,'referencias',referencias)::text));
end $$;

create function public.ap_retirar_prueba_v1(p_alumno uuid,p_programa uuid,p_huella text,p_motivo text,p_confirmacion text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; materias jsonb; certificados jsonb; despues jsonb; resultado jsonb;
begin
 perform public._ap_retiro_autorizar_v1();
 if p_confirmacion is distinct from 'RETIRAR PRUEBA' or length(btrim(coalesce(p_motivo,''))) not between 10 and 1000 then raise exception 'Confirma los datos de prueba y explica el motivo';end if;
 perform set_config('lock_timeout','3s',true);
 perform id from public.alumnos where id=p_alumno for update;
 perform id from public.alumno_programas where alumno_id=p_alumno order by id for update;
 lock table public.inscripciones_academicas,public.asignaturas,public.alumnos_grupos,public.grupos in share row exclusive mode;
 perform id from public.inscripciones_academicas where alumno_id=p_alumno order by id for update;
 perform id from public.ficha_certificacion where alumno_id=p_alumno order by id for update;
 r=public.ap_revisar_prueba_v1(p_alumno,p_programa);
 if r->>'huella' is distinct from p_huella then raise exception 'Los antecedentes cambiaron. Actualiza la revisión' using errcode='40001';end if;
 if not (r->>'puedeRetirar')::boolean then raise exception 'Hay antecedentes protegidos; no se retiró la prueba';end if;
 select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') into materias from public.inscripciones_academicas i join public.asignaturas a on a.id=i.asignatura_id
 where i.alumno_id=p_alumno and a.plan_id=(r->>'planId')::uuid;
 select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]') into certificados from public.ficha_certificacion f where alumno_programa_id=p_programa;
 -- Conservar la ficha completa archivada, identificada por instantánea, sin atribuirla al programa correcto.
 update public.ficha_certificacion set alumno_programa_id=null,archivado_en=coalesce(archivado_en,now()),revision=revision+1,updated_at=now() where alumno_programa_id=p_programa;
 select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]') into despues from public.ficha_certificacion f where id in(select (v->>'id')::uuid from jsonb_array_elements(certificados) v);
 insert into public.asociaciones_programa_pruebas_auditoria(alumno_id,programa_id,actor,motivo,programa_antes,materias_antes,certificados_antes,certificados_despues)
 select p_alumno,p_programa,auth.uid(),btrim(p_motivo),to_jsonb(p),materias,certificados,despues from public.alumno_programas p where id=p_programa;
 insert into public.certificacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues)
 select (v->>'id')::uuid,auth.uid(),'DESCARTAR_PRUEBA',btrim(p_motivo),v,
 (select d from jsonb_array_elements(despues) d where d->>'id'=v->>'id') from jsonb_array_elements(certificados) v;
 delete from public.inscripciones_academicas where id in(select (v->>'id')::uuid from jsonb_array_elements(materias) v);
 r=public._ap_revision_retiro_v1(p_alumno,p_programa);
 resultado=public.ap_retirar_asociacion_v1(p_alumno,p_programa,r->>'huella',p_motivo);
 return resultado;
end $$;
revoke all on function public._ap_materia_prueba_v1(jsonb),public._ap_certificado_prueba_v1(jsonb),public._ap_cert_prueba_descartada_v1(jsonb) from public,anon,authenticated;
revoke all on function public.ap_revisar_prueba_v1(uuid,uuid),public.ap_retirar_prueba_v1(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.ap_revisar_prueba_v1(uuid,uuid),public.ap_retirar_prueba_v1(uuid,uuid,text,text,text) to authenticated;
commit;
