-- PREPARADA, NO EJECUTADA. Requiere 20261110010000. Contrato v1 conservado.
begin;
create function public._cert_lote_candidato_v2(p_ficha uuid,p_destino uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare f public.ficha_certificacion; programas jsonb; otras jsonb; destino uuid; motivo text=''; pendientes bigint; nombre text; matricula text; etiqueta text; opciones jsonb;
begin
 select * into f from public.ficha_certificacion where id=p_ficha;
 if f.id is null then raise exception 'La ficha ya no existe';end if;
 select nombre_completo,a.matricula into nombre,matricula from public.alumnos a where id=f.alumno_id;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into programas from public.alumno_programas p where alumno_id=f.alumno_id;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') into otras from public.ficha_certificacion c where alumno_id=f.alumno_id and id<>f.id;
 select count(*) into pendientes from public.ficha_certificacion where alumno_id=f.alumno_id and alumno_programa_id is null and archivado_en is null;
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
 'disponible',not exists(select 1 from public.ficha_certificacion x where x.alumno_programa_id=a.id and x.id<>f.id),
 'motivo',case when exists(select 1 from public.ficha_certificacion x where x.alumno_programa_id=a.id and x.id<>f.id) then 'Ya tiene otra ficha, incluso archivada' else '' end)
 order by c.nombre,p.clave_legado,a.id),'[]') into opciones from public.alumno_programas a join public.planes_estudio p on p.id=a.plan_id left join public.carreras c on c.id=p.carrera_id where a.alumno_id=f.alumno_id;
 return jsonb_build_object('id',f.id,'alumnoId',f.alumno_id,'nombre',nombre,'matricula',matricula,'programaId',destino,'programa',etiqueta,
 'opciones',opciones,'cantidadProgramas',jsonb_array_length(programas),'revisable',f.archivado_en is null and f.alumno_programa_id is null and pendientes=1 and nombre is not null,'elegible',motivo='','motivo',motivo,'pago',f.pago_certificado,'tramite',case when f.tramite_completado then 'Completado' when f.fecha_inicio_tramite is not null then 'En trámite' else 'En preparación' end,
 'huella',md5(jsonb_build_object('ficha',to_jsonb(f),'programas',programas,'otras',otras)::text));
end $$;

create function public.certificacion_lote_preview_v2(p_desde integer default 0,p_busqueda text default '',p_vista text default 'todos',p_alumno uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; total bigint;
begin
 perform public._ap_lote_cert_autorizar_v1();
 if p_vista is null or p_vista not in ('todos','unico','varios') then raise exception 'Vista inválida';end if;
 if p_desde is null or p_desde<0 or length(coalesce(p_busqueda,''))>100 then raise exception 'Consulta fuera de límites';end if;
 select count(*) into total from public.ficha_certificacion f join public.alumnos a on a.id=f.alumno_id
 where f.alumno_programa_id is null and f.archivado_en is null
 and (p_alumno is null or f.alumno_id=p_alumno)
 and (p_vista='todos' or (p_vista='unico' and (select count(*) from public.alumno_programas ap where ap.alumno_id=f.alumno_id)=1) or (p_vista='varios' and (select count(*) from public.alumno_programas ap where ap.alumno_id=f.alumno_id)>1))
 and (coalesce(p_busqueda,'')='' or strpos(lower(concat_ws(' ',a.nombre_completo,a.matricula)),lower(p_busqueda))>0);
 select coalesce(jsonb_agg(public._cert_lote_candidato_v2(id) order by nombre,id),'[]') into r from (
 select f.id,a.nombre_completo nombre from public.ficha_certificacion f join public.alumnos a on a.id=f.alumno_id
 where f.alumno_programa_id is null and f.archivado_en is null
 and (p_alumno is null or f.alumno_id=p_alumno)
 and (p_vista='todos' or (p_vista='unico' and (select count(*) from public.alumno_programas ap where ap.alumno_id=f.alumno_id)=1) or (p_vista='varios' and (select count(*) from public.alumno_programas ap where ap.alumno_id=f.alumno_id)>1))
 and (coalesce(p_busqueda,'')='' or strpos(lower(concat_ws(' ',a.nombre_completo,a.matricula)),lower(p_busqueda))>0)
 order by a.nombre_completo,f.id offset p_desde limit 25) pagina;
 return jsonb_build_object('total',total,'filas',r);
end $$;

create function public.certificacion_asociar_lote_v2(p_filas jsonb,p_motivo text) returns integer
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
  r=public._cert_lote_candidato_v2((x->>'id')::uuid,(x->>'programaId')::uuid);
  if x->>'programaId' is null or not (r->>'elegible')::boolean or r->>'huella' is distinct from x->>'huella' or r->>'programaId' is distinct from x->>'programaId' then
   raise exception 'Cambió la ficha % o su destino. Actualiza y revisa el lote; no se guardó ninguna asociación',x->>'id' using errcode='40001';end if;
  select * into f from public.ficha_certificacion where id=(x->>'id')::uuid;
  -- Asociación específica: no llama al guardado general ni cierra programas completados.
  update public.ficha_certificacion set alumno_programa_id=(r->>'programaId')::uuid,revision=revision+1,updated_at=now() where id=f.id returning * into n;
  insert into public.certificacion_auditoria(ficha_id,usuario_auth,accion,motivo,antes,despues)
   values(f.id,auth.uid(),'ASOCIAR_LEGADO_LOTE_V2',btrim(p_motivo),to_jsonb(f),to_jsonb(n));
  cantidad=cantidad+1;
 end loop;
 return cantidad;
end $$;
revoke all on function public._cert_lote_candidato_v2(uuid,uuid) from public,anon,authenticated;
revoke all on function public.certificacion_lote_preview_v2(integer,text,text,uuid),public.certificacion_asociar_lote_v2(jsonb,text) from public,anon;
grant execute on function public.certificacion_lote_preview_v2(integer,text,text,uuid),public.certificacion_asociar_lote_v2(jsonb,text) to authenticated;
commit;
