-- PREPARADA, NO EJECUTADA. Corrección de ambigüedad y revisión antes de confirmar.
begin;
do $guard$ declare instalado text;begin
 select p.prosrc into instalado from pg_proc p where p.oid=to_regprocedure('public.certificacion_pago_lote_aplicar_v1(jsonb,text,text,boolean)');
 if instalado is null then raise exception 'Instala primero 20261110130000_pago_certificado_lote.sql';end if;
 if regexp_replace(instalado,'\s','','g') not in (regexp_replace($original$
declare x jsonb;f public.ficha_certificacion;n public.ficha_certificacion;cantidad integer=0;begin
 perform public._certificacion_autorizar_v1(true);
 if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Selección inválida';end if;
 if jsonb_array_length(p_filas) not between 1 and 50 or (select count(distinct x->>'id') from jsonb_array_elements(p_filas) x)<>jsonb_array_length(p_filas) then raise exception 'Selecciona entre 1 y 50 fichas distintas';end if;
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
end $original$,'\s','','g'),regexp_replace($corregida$
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
end $corregida$,'\s','','g')) then raise exception 'La función instalada difiere de la revisada. Comparte la definición antes de sustituirla';end if;
end $guard$;
create function public._certificacion_pago_lote_revisar_v1(p_filas jsonb,p_estado text,p_motivo text,p_revisar_concluidos boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_fila jsonb;v_ficha public.ficha_certificacion;v_motivo text;v_incidencias jsonb='[]';begin
 perform public._certificacion_autorizar_v1(true);
 if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Selección inválida';end if;
 if jsonb_array_length(p_filas) not between 1 and 50 or (select count(distinct entrada.elemento->>'id') from jsonb_array_elements(p_filas) as entrada(elemento))<>jsonb_array_length(p_filas) then raise exception 'Selecciona entre 1 y 50 fichas distintas';end if;
 if p_estado is null or p_estado not in ('SIN_INICIAR','EN_CURSO','COMPLETADO') or length(btrim(coalesce(p_motivo,''))) not between 10 and 1000 then raise exception 'Revisa el estado y el motivo (10–1000 caracteres)';end if;
 for v_fila in select entrada.elemento from jsonb_array_elements(p_filas) as entrada(elemento) loop
 v_motivo=null;
 select fc.* into v_ficha from public.ficha_certificacion fc where fc.id=(v_fila->>'id')::uuid;
 if v_ficha.id is null or v_ficha.archivado_en is not null or v_ficha.alumno_programa_id is null or v_ficha.alumno_id::text is distinct from v_fila->>'alumnoId' or v_ficha.alumno_programa_id::text is distinct from v_fila->>'programaId' then v_motivo='La ficha fue archivada, reasociada o dejó de estar disponible';
 elsif md5(to_jsonb(v_ficha)::text) is distinct from v_fila->>'huella' then v_motivo='La ficha cambió desde la consulta; actualiza sus datos y revísala de nuevo';
 elsif not exists(select 1 from public.alumno_programas ap where ap.id=v_ficha.alumno_programa_id and ap.alumno_id=v_ficha.alumno_id) then v_motivo='El programa no pertenece al alumno';
 elsif v_ficha.tramite_completado and p_estado<>'COMPLETADO' and p_revisar_concluidos is not true then v_motivo='Confirma expresamente el cambio de pago de un trámite concluido';end if;
 if v_motivo is not null then v_incidencias=v_incidencias||jsonb_build_array(jsonb_build_object('id',v_fila->>'id','motivo',v_motivo));end if;
 end loop;
 return jsonb_build_object('valido',jsonb_array_length(v_incidencias)=0,'incidencias',v_incidencias);
end $$;
create function public.certificacion_pago_lote_validar_v1(p_filas jsonb,p_estado text,p_motivo text,p_revisar_concluidos boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin return public._certificacion_pago_lote_revisar_v1(p_filas,p_estado,p_motivo,p_revisar_concluidos);end $$;
create or replace function public.certificacion_pago_lote_aplicar_v1(p_filas jsonb,p_estado text,p_motivo text,p_revisar_concluidos boolean default false) returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_fila jsonb;f public.ficha_certificacion;n public.ficha_certificacion;cantidad integer=0;v_revision jsonb;begin
 perform public._certificacion_autorizar_v1(true);
 if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Selección inválida';end if;
 if jsonb_array_length(p_filas) not between 1 and 50 or (select count(distinct entrada.elemento->>'id') from jsonb_array_elements(p_filas) as entrada(elemento))<>jsonb_array_length(p_filas) then raise exception 'Selecciona entre 1 y 50 fichas distintas';end if;
 if p_estado is null or p_estado not in ('SIN_INICIAR','EN_CURSO','COMPLETADO') or length(btrim(coalesce(p_motivo,''))) not between 10 and 1000 then raise exception 'Revisa el estado y el motivo (10–1000 caracteres)';end if;
 perform set_config('lock_timeout','3s',true);
 perform a.id from public.alumnos a where a.id in(select alumno_id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by a.id for update;
 perform ap.id from public.alumno_programas ap where alumno_id in(select alumno_id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by ap.id for update;
 perform id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v) order by id for update;
 v_revision=public._certificacion_pago_lote_revisar_v1(p_filas,p_estado,p_motivo,p_revisar_concluidos);
 if not (v_revision->>'valido')::boolean then raise exception 'Alguna ficha cambió. Actualiza y revisa el lote; no se guardó ningún cambio' using errcode='40001',detail=(v_revision->'incidencias')::text;end if;
 for v_fila in select v from jsonb_array_elements(p_filas) v order by v->>'id' loop
 select * into f from public.ficha_certificacion where id=(v_fila->>'id')::uuid;
 if f.id is null or f.archivado_en is not null or f.alumno_programa_id is null or f.alumno_id::text is distinct from v_fila->>'alumnoId' or f.alumno_programa_id::text is distinct from v_fila->>'programaId' or md5(to_jsonb(f)::text) is distinct from v_fila->>'huella' then raise exception 'Alguna ficha cambió. Actualiza y revisa el lote; no se guardó ningún cambio' using errcode='40001';end if;
 if not exists(select 1 from public.alumno_programas where id=f.alumno_programa_id and alumno_id=f.alumno_id) then raise exception 'El programa no pertenece al alumno';end if;
 if f.tramite_completado and p_estado<>'COMPLETADO' and p_revisar_concluidos is not true then raise exception 'Confirma la revisión del cambio de pago en trámites concluidos';end if;
 -- Única escritura de negocio: estado administrativo del pago del certificado.
 update public.ficha_certificacion set pago_certificado=p_estado,revision=revision+1,updated_at=clock_timestamp() where id=f.id returning * into n;
 insert into public.certificacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues) values(f.id,auth.uid(),'PAGO_CERTIFICADO_LOTE',btrim(p_motivo)||case when f.tramite_completado and p_estado<>'COMPLETADO' then ' [Cambio en trámite concluido revisado expresamente]' else '' end,to_jsonb(f),to_jsonb(n));
 cantidad=cantidad+1;
 end loop;
 return cantidad;
end $$;
revoke all on function public._certificacion_pago_lote_revisar_v1(jsonb,text,text,boolean) from public,anon,authenticated;
revoke all on function public.certificacion_pago_lote_validar_v1(jsonb,text,text,boolean) from public,anon;
grant execute on function public.certificacion_pago_lote_validar_v1(jsonb,text,text,boolean) to authenticated;
commit;
