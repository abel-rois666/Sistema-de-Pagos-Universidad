-- PREPARADA, NO EJECUTADA. Requiere certificación por programa (20261109120000).
begin;
create function public._ap_lote_cert_autorizar_v1() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null or not(select count(*)=1 and coalesce(bool_and(activo is true and rol='ADMINISTRADOR'),false)
 from public.usuarios where auth_id=auth.uid()) then raise exception 'Solo Administración activa puede asociar certificaciones en lote' using errcode='42501';end if;
end $$;

create function public._cert_lote_candidato_v1(p_ficha uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_certificacion; programas jsonb; otras jsonb; destino uuid; motivo text=''; pendientes bigint; nombre text; matricula text; etiqueta text;
begin
 select * into f from public.ficha_certificacion where id=p_ficha;
 if f.id is null then raise exception 'La ficha ya no existe';end if;
 select nombre_completo,a.matricula into nombre,matricula from public.alumnos a where id=f.alumno_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into programas from public.alumno_programas p where alumno_id=f.alumno_id;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') into otras from public.ficha_certificacion c where alumno_id=f.alumno_id and id<>f.id;
 select count(*) into pendientes from public.ficha_certificacion where alumno_id=f.alumno_id and alumno_programa_id is null and archivado_en is null;
 if f.archivado_en is not null or f.alumno_programa_id is not null then motivo='La ficha ya fue asociada o archivada';
 elsif nombre is null then motivo='Alumno sin identificar';
 elsif jsonb_array_length(programas)<>1 then motivo=case when jsonb_array_length(programas)=0 then 'Sin programa asociado' else 'Varios programas, incluidos históricos: revisar individualmente' end;
 elsif pendientes<>1 then motivo='Varias fichas pendientes: revisar individualmente';
 else
  destino=(programas->0->>'id')::uuid;
  if exists(select 1 from jsonb_array_elements(otras) c where c->>'alumno_programa_id'=destino::text) then motivo='El programa ya tiene otra ficha, incluso archivada';end if;
  select concat_ws(' · ',c.nombre,p.clave_legado,p.nombre) into etiqueta from public.alumno_programas a
   join public.planes_estudio p on p.id=a.plan_id left join public.carreras c on c.id=p.carrera_id where a.id=destino;
  if etiqueta is null then motivo='Plan del programa sin identificar';end if;
 end if;
 return jsonb_build_object('id',f.id,'alumnoId',f.alumno_id,'nombre',nombre,'matricula',matricula,'programaId',destino,'programa',etiqueta,
 'elegible',motivo='','motivo',motivo,'pago',f.pago_certificado,'tramite',case when f.tramite_completado then 'Completado' when f.fecha_inicio_tramite is not null then 'En trámite' else 'En preparación' end,
 'huella',md5(jsonb_build_object('ficha',to_jsonb(f),'programas',programas,'otras',otras)::text));
end $$;

create function public.certificacion_lote_preview_v1(p_desde integer default 0,p_busqueda text default '') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; total bigint;
begin
 perform public._ap_lote_cert_autorizar_v1();
 if p_desde is null or p_desde<0 or length(coalesce(p_busqueda,''))>100 then raise exception 'Consulta fuera de límites';end if;
 select count(*) into total from public.ficha_certificacion f join public.alumnos a on a.id=f.alumno_id
 where f.alumno_programa_id is null and f.archivado_en is null
 and (coalesce(p_busqueda,'')='' or strpos(lower(concat_ws(' ',a.nombre_completo,a.matricula)),lower(p_busqueda))>0);
 select coalesce(jsonb_agg(public._cert_lote_candidato_v1(id) order by nombre,id),'[]') into r from (
 select f.id,a.nombre_completo nombre from public.ficha_certificacion f join public.alumnos a on a.id=f.alumno_id
 where f.alumno_programa_id is null and f.archivado_en is null
 and (coalesce(p_busqueda,'')='' or strpos(lower(concat_ws(' ',a.nombre_completo,a.matricula)),lower(p_busqueda))>0)
 order by a.nombre_completo,f.id offset p_desde limit 25) pagina;
 return jsonb_build_object('total',total,'filas',r);
end $$;

create function public.certificacion_asociar_lote_v1(p_filas jsonb,p_motivo text) returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare x jsonb; r jsonb; f public.ficha_certificacion; n public.ficha_certificacion; cantidad integer=0;
begin
 perform public._ap_lote_cert_autorizar_v1();
 if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Selección inválida';end if;
 if jsonb_array_length(p_filas) not between 1 and 50 or length(btrim(coalesce(p_motivo,''))) not between 10 and 1000
 or (select count(distinct v->>'id') from jsonb_array_elements(p_filas) v)<>jsonb_array_length(p_filas) then raise exception 'Revisa la selección (máximo 50) y el respaldo';end if;
 perform set_config('lock_timeout','3s',true);
 -- Orden común y bloqueo de padres: también impide insertar otro programa/ficha mientras se confirma.
 perform a.id from public.alumnos a where a.id in(select alumno_id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by a.id for update;
 perform p.id from public.alumno_programas p where alumno_id in(select alumno_id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by p.id for update;
 perform c.id from public.ficha_certificacion c where alumno_id in(select alumno_id from public.ficha_certificacion where id in(select (v->>'id')::uuid from jsonb_array_elements(p_filas) v)) order by c.id for update;
 for x in select v from jsonb_array_elements(p_filas) v order by v->>'id' loop
  r=public._cert_lote_candidato_v1((x->>'id')::uuid);
  if not (r->>'elegible')::boolean or r->>'huella' is distinct from x->>'huella' or r->>'programaId' is distinct from x->>'programaId' then
   raise exception 'Cambió una ficha o su programa. Actualiza y revisa el lote; no se guardó ninguna asociación' using errcode='40001';end if;
  select * into f from public.ficha_certificacion where id=(x->>'id')::uuid;
  -- Asociación específica: no llama al guardado general ni cierra programas completados.
  update public.ficha_certificacion set alumno_programa_id=(r->>'programaId')::uuid,revision=revision+1,updated_at=now() where id=f.id returning * into n;
  insert into public.certificacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues)
   values(f.id,auth.uid(),'ASOCIAR_LEGADO_LOTE',btrim(p_motivo),to_jsonb(f),to_jsonb(n));
  cantidad=cantidad+1;
 end loop;
 return cantidad;
end $$;
revoke all on function public._cert_lote_candidato_v1(uuid),public._ap_lote_cert_autorizar_v1() from public,anon,authenticated;
revoke all on function public.certificacion_lote_preview_v1(integer,text),public.certificacion_asociar_lote_v1(jsonb,text) from public,anon;
grant execute on function public.certificacion_lote_preview_v1(integer,text),public.certificacion_asociar_lote_v1(jsonb,text) to authenticated;
commit;
