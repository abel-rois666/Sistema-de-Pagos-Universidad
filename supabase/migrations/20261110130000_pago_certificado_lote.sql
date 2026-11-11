-- PREPARADA, NO EJECUTADA. Requiere certificación por programa 20261109120000.
begin;
do $$ begin if to_regprocedure('public._certificacion_autorizar_v1(boolean)') is null then raise exception 'Instala primero certificación por programa';end if;end $$;
create function public.certificacion_pago_lote_preview_v1(p_alumnos uuid[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb;begin
 perform public._certificacion_autorizar_v1(true);
 if p_alumnos is null or cardinality(p_alumnos) not between 1 and 50 or (select count(distinct x) from unnest(p_alumnos) x)<>cardinality(p_alumnos) then raise exception 'Selecciona entre 1 y 50 alumnos distintos';end if;
 if (select count(*) from public.alumnos where id=any(p_alumnos))<>cardinality(p_alumnos) then raise exception 'Algún alumno ya no está disponible';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by nombre,programa,id),'[]') into r from (
 select a.id "alumnoId",a.nombre_completo nombre,a.matricula,f.id,f.alumno_programa_id "programaId",f.revision,f.pago_certificado estado,f.tramite_completado concluido,
 concat_ws(' · ',c.nombre,pe.clave_legado,pe.nombre) programa,
 (f.id is not null and ap.id is not null and ap.alumno_id=a.id) elegible,
 case when f.id is null then 'Sin registro de certificación' when f.alumno_programa_id is null then 'Asocia primero la ficha anterior a su programa' when ap.id is null or ap.alumno_id<>a.id then 'Revisa la asociación académica de esta ficha' else '' end motivo,
 case when f.id is not null then md5(to_jsonb(f)::text) end huella
 from public.alumnos a left join public.ficha_certificacion f on f.alumno_id=a.id and f.archivado_en is null
 left join public.alumno_programas ap on ap.id=f.alumno_programa_id left join public.planes_estudio pe on pe.id=ap.plan_id left join public.carreras c on c.id=pe.carrera_id where a.id=any(p_alumnos)
 ) t;
 return r;
end $$;
create function public.certificacion_pago_lote_aplicar_v1(p_filas jsonb,p_estado text,p_motivo text,p_revisar_concluidos boolean default false) returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare x jsonb;f public.ficha_certificacion;n public.ficha_certificacion;cantidad integer=0;begin
 perform public._certificacion_autorizar_v1(true);
 if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Selección inválida';end if;
 if jsonb_array_length(p_filas) not between 1 and 50 or (select count(distinct entrada.elemento->>'id') from jsonb_array_elements(p_filas) as entrada(elemento))<>jsonb_array_length(p_filas) then raise exception 'Selecciona entre 1 y 50 fichas distintas';end if;
 if p_estado is null or p_estado not in ('SIN_INICIAR','EN_CURSO','COMPLETADO') or length(btrim(coalesce(p_motivo,''))) not between 10 and 1000 then raise exception 'Revisa el estado y el motivo (10–1000 caracteres)';end if;
 perform set_config('lock_timeout','3s',true);
 perform a.id from public.alumnos a where a.id in(select alumno_id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by a.id for update;
 perform ap.id from public.alumno_programas ap where alumno_id in(select alumno_id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by ap.id for update;
 perform id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v) order by id for update;
 for x in select v from jsonb_array_elements(p_filas) v order by v->>'id' loop
 select * into f from public.ficha_certificacion where id=(x->>'id')::uuid;
 if f.id is null or f.archivado_en is not null or f.alumno_programa_id is null or f.alumno_id::text is distinct from x->>'alumnoId' or f.alumno_programa_id::text is distinct from x->>'programaId' or md5(to_jsonb(f)::text) is distinct from x->>'huella' then raise exception 'Alguna ficha cambió. Actualiza y revisa el lote; no se guardó ningún cambio' using errcode='40001';end if;
 if not exists(select 1 from public.alumno_programas where id=f.alumno_programa_id and alumno_id=f.alumno_id) then raise exception 'El programa no pertenece al alumno';end if;
 if f.tramite_completado and p_estado<>'COMPLETADO' and p_revisar_concluidos is not true then raise exception 'Confirma la revisión del cambio de pago en trámites concluidos';end if;
 -- Única escritura de negocio: estado administrativo del pago del certificado.
 update public.ficha_certificacion set pago_certificado=p_estado,revision=revision+1,updated_at=clock_timestamp() where id=f.id returning * into n;
 insert into public.certificacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues) values(f.id,auth.uid(),'PAGO_CERTIFICADO_LOTE',btrim(p_motivo)||case when f.tramite_completado and p_estado<>'COMPLETADO' then ' [Cambio en trámite concluido revisado expresamente]' else '' end,to_jsonb(f),to_jsonb(n));
 cantidad=cantidad+1;
 end loop;
 return cantidad;
end $$;
revoke all on function public.certificacion_pago_lote_preview_v1(uuid[]),public.certificacion_pago_lote_aplicar_v1(jsonb,text,text,boolean) from public,anon;
grant execute on function public.certificacion_pago_lote_preview_v1(uuid[]),public.certificacion_pago_lote_aplicar_v1(jsonb,text,text,boolean) to authenticated;
commit;
