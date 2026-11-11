-- PREPARADA, NO EJECUTADA. Requiere 20261110100000. No modifica fichas al instalar.
begin;
do $$ begin if to_regprocedure('public._titulacion_autorizar_v1(boolean)') is null then raise exception 'Instala primero titulación por programa';end if;end $$;
create function public.titulacion_consultar_v1(p_alumno uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb;begin
 perform public._titulacion_autorizar_v1(false);
 select jsonb_build_object('fichas',(select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]') from public.ficha_titulacion f where alumno_id=p_alumno and archivado_en is null),
 'ocupados',(select coalesce(jsonb_agg(distinct alumno_programa_id),'[]') from public.ficha_titulacion where alumno_id=p_alumno and alumno_programa_id is not null),
 'programas',(select coalesce(jsonb_agg(to_jsonb(ap)||jsonb_build_object('planes_estudio',to_jsonb(pe)||jsonb_build_object('carreras',to_jsonb(c))) order by ap.id),'[]') from public.alumno_programas ap join public.planes_estudio pe on pe.id=ap.plan_id left join public.carreras c on c.id=pe.carrera_id where ap.alumno_id=p_alumno)) into r;
 return r;
end $$;
create function public.titulacion_archivar_v1(p_id uuid,p_revision integer,p_motivo text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_titulacion;n public.ficha_titulacion;begin
 perform public._titulacion_autorizar_v1(true);
 if length(btrim(coalesce(p_motivo,''))) not between 5 and 1000 then raise exception 'Describe el motivo de archivo (5–1000 caracteres)';end if;
 select * into f from public.ficha_titulacion where id=p_id for update;
 if f.id is null or f.archivado_en is not null or p_revision is null or f.revision<>p_revision then raise exception 'La ficha cambió. Actualiza antes de archivar' using errcode='40001';end if;
 -- Se conserva íntegramente el acta y su asociación. No revierte logros ni pagos.
 update public.ficha_titulacion set archivado_en=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=p_id returning * into n;
 insert into public.titulacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues) values(f.id,auth.uid(),'ARCHIVAR',btrim(p_motivo),to_jsonb(f),to_jsonb(n));
end $$;
create function public.titulacion_asociar_anterior_v1(p_id uuid,p_revision integer,p_programa uuid,p_motivo text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_titulacion;n public.ficha_titulacion;alumno uuid;begin
 perform public._titulacion_autorizar_v1(true);
 if length(btrim(coalesce(p_motivo,''))) not between 5 and 1000 then raise exception 'Registra respaldo de la asignación (5–1000 caracteres)';end if;
 select alumno_id into alumno from public.ficha_titulacion where id=p_id;
 perform id from public.alumnos where id=alumno for update;
 perform id from public.alumno_programas where alumno_id=alumno order by id for update;
 perform id from public.ficha_titulacion where alumno_id=alumno order by id for update;
 select * into f from public.ficha_titulacion where id=p_id;
 if f.id is null or f.archivado_en is not null or f.alumno_programa_id is not null or p_revision is null or f.revision<>p_revision then raise exception 'La ficha cambió. Actualiza antes de asignar' using errcode='40001';end if;
 if p_programa is null or not exists(select 1 from public.alumno_programas where id=p_programa and alumno_id=f.alumno_id) then raise exception 'El programa no pertenece al alumno';end if;
 if exists(select 1 from public.ficha_titulacion where alumno_programa_id=p_programa and id<>p_id) then raise exception 'El destino tiene otra ficha, incluso archivada. No se sobrescribirá';end if;
 update public.ficha_titulacion set alumno_programa_id=p_programa,revision=revision+1,updated_at=clock_timestamp() where id=p_id returning * into n;
 insert into public.titulacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues) values(f.id,auth.uid(),'ASOCIAR_LEGADO',btrim(p_motivo),to_jsonb(f),to_jsonb(n));
 return to_jsonb(n);
end $$;
revoke all on function public.titulacion_consultar_v1(uuid),public.titulacion_archivar_v1(uuid,integer,text),public.titulacion_asociar_anterior_v1(uuid,integer,uuid,text) from public,anon;
grant execute on function public.titulacion_consultar_v1(uuid),public.titulacion_archivar_v1(uuid,integer,text),public.titulacion_asociar_anterior_v1(uuid,integer,uuid,text) to authenticated;
commit;
