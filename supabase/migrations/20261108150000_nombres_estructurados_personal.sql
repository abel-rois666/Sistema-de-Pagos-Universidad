-- Preparada, no ejecutada. Requiere 20261108120000_personal_y_docentes.sql.
-- Sin separación automática, backfill, eliminación ni modificación de cuentas/asignaciones.
begin;
alter table public.personal_personas
  add column nombre_original text,
  add column nombre_confirmado_en timestamptz,
  add column nombre_confirmado_por uuid,
  add column nombre_fuente text;

-- El motor previo conserva las operaciones de contacto, contratos y documentos.
alter function public.personal_guardar_v1(text,uuid,integer,jsonb,text,jsonb,text) rename to _personal_guardar_base_v1;
revoke all on function public._personal_guardar_base_v1(text,uuid,integer,jsonb,text,jsonb,text) from public,anon,authenticated;

create function public.personal_guardar_v1(p_tipo text,p_id uuid,p_revision integer,p_original jsonb,p_seccion text,p_datos jsonb,p_motivo text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); f jsonb; p public.personal_personas; anterior jsonb; d jsonb; payload jsonb=p_datos;
  resultado jsonb; k text; hubo_cambio boolean=false; completo boolean; tiene_partes boolean;
begin
  if p_revision is null or p_revision<0 then raise exception 'Falta la revisión del expediente'; end if;
  if p_seccion='generales' then
    f=public._personal_fuente_v1(p_tipo,p_id,true);
    select * into p from public.personal_personas where id=(f->>'persona_id')::uuid for update;
    anterior=coalesce(p.datos,f->'datos','{}'::jsonb);d=p_datos->'datos';
    if jsonb_typeof(d) is distinct from 'object' then raise exception 'Datos generales incompletos'; end if;
    foreach k in array array['nombres','apellido_paterno','apellido_materno'] loop
      d=jsonb_set(d,array[k],coalesce(to_jsonb(nullif(regexp_replace(trim(d->>k),'[[:space:]]+',' ','g'),'')),'null'::jsonb));
      hubo_cambio=hubo_cambio or coalesce(d->>k,'')<>coalesce(nullif(regexp_replace(trim(anterior->>k),'[[:space:]]+',' ','g'),''),'');
    end loop;
    completo=nullif(d->>'nombres','') is not null and nullif(d->>'apellido_paterno','') is not null;
    tiene_partes=nullif(d->>'nombres','') is not null or nullif(d->>'apellido_paterno','') is not null or nullif(d->>'apellido_materno','') is not null;
    if completo then
      if hubo_cambio and f->'registro'<>'null'::jsonb and p_datos->'nombre_revisado' is distinct from 'true'::jsonb then
        raise exception 'Confirma la revisión de nombres y apellidos';
      end if;
      d=jsonb_set(d,'{nombre_completo}',to_jsonb(concat_ws(' ',d->>'apellido_paterno',d->>'apellido_materno',d->>'nombres')));
    elsif tiene_partes or f->'registro'='null'::jsonb or nullif(anterior->>'nombres','') is not null or nullif(anterior->>'apellido_paterno','') is not null then
      raise exception 'Completa primer apellido y nombre(s). El segundo apellido es opcional';
    else
      -- Contacto histórico sin desglose: el nombre anterior es inmutable desde este flujo.
      d=jsonb_set(d,'{nombre_completo}',anterior->'nombre_completo');
    end if;
    payload=jsonb_set(p_datos,'{datos}',d);
  end if;
  resultado=public._personal_guardar_base_v1(p_tipo,p_id,p_revision,p_original,p_seccion,payload,p_motivo);
  if p_seccion='generales' and completo and (hubo_cambio or f->'registro'='null'::jsonb) then
    update public.personal_personas set
      nombre_original=coalesce(nombre_original,case when f->'registro'<>'null'::jsonb then anterior->>'nombre_completo' end),
      nombre_confirmado_en=now(),nombre_confirmado_por=auth.uid(),nombre_fuente='CAPTURA_REVISADA'
    where id=(resultado->>'persona_id')::uuid;
    insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol)
      values((resultado->>'persona_id')::uuid,'nombres',p_motivo,anterior,d,auth.uid(),rol);
  end if;
  return resultado;
end $$;

create function public.personal_consultar_v2(p_tipo text,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare resultado jsonb; p public.personal_personas;
begin
  resultado=public.personal_consultar_v1(p_tipo,p_id);
  select * into p from public.personal_personas where id=(resultado->>'persona_id')::uuid;
  return resultado||jsonb_build_object('nombres_disponibles',true,'nombre_revision',jsonb_build_object(
    'original',p.nombre_original,'confirmado_en',p.nombre_confirmado_en,'confirmado_por',p.nombre_confirmado_por,'fuente',p.nombre_fuente));
end $$;

-- La relación explícita con RH también conserva el nombre docente anterior.
alter function public.personal_vincular_v1(uuid,uuid,integer,integer,jsonb,jsonb,text) rename to _personal_vincular_base_v1;
revoke all on function public._personal_vincular_base_v1(uuid,uuid,integer,integer,jsonb,jsonb,text) from public,anon,authenticated;
create function public.personal_vincular_v1(p_docente uuid,p_empleado uuid,p_revision_docente integer,p_revision_empleado integer,p_original_docente jsonb,p_original_empleado jsonb,p_motivo text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); anterior jsonb; p public.personal_personas;
begin
  if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración relaciona directorios' using errcode='42501'; end if;
  anterior=public._personal_fuente_v1('DOCENTE',p_docente,true)->'datos';
  perform public._personal_vincular_base_v1(p_docente,p_empleado,p_revision_docente,p_revision_empleado,p_original_docente,p_original_empleado,p_motivo);
  select a.* into p from public.personal_personas a join public.docentes d on d.persona_id=a.id where d.id=p_docente;
  if nullif(trim(p.datos->>'nombres'),'') is not null and nullif(trim(p.datos->>'apellido_paterno'),'') is not null then
    update public.personal_personas set nombre_original=coalesce(nombre_original,anterior->>'nombre_completo'),
      nombre_confirmado_en=now(),nombre_confirmado_por=auth.uid(),nombre_fuente='RELACION_REVISADA' where id=p.id;
    insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol)
      values(p.id,'nombres',p_motivo,anterior,p.datos,auth.uid(),rol);
  end if;
end $$;

create function public.personal_nombres_pendientes_v1(p_busqueda text default '',p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); filas jsonb; cantidad integer;
begin
  if rol not in ('ADMINISTRADOR','COORDINADOR ACADEMICO') then raise exception 'Sin permiso para regularizar nombres docentes' using errcode='42501'; end if;
  if p_offset<0 or length(coalesce(p_busqueda,''))>150 then raise exception 'Consulta no válida'; end if;
  select count(*) into cantidad from public.docentes t left join public.personal_personas p on p.id=t.persona_id
    where (nullif(trim(p.datos->>'nombres'),'') is null or nullif(trim(p.datos->>'apellido_paterno'),'') is null)
      and concat_ws(' ',t.nombre_completo,t.clave_legado) ilike '%'||coalesce(p_busqueda,'')||'%';
  select coalesce(jsonb_agg(jsonb_build_object('docente_id',t.id,'clave',t.clave_legado,'nombre_historico',t.nombre_completo,
    'revision',coalesce(p.revision,0),'original',public._personal_fuente_v1('DOCENTE',t.id)->'original',
    'datos',coalesce(p.datos,public._personal_fuente_v1('DOCENTE',t.id)->'datos')) order by t.nombre_completo,t.id),'[]'::jsonb) into filas
    from (select d.* from public.docentes d left join public.personal_personas a on a.id=d.persona_id
      where (nullif(trim(a.datos->>'nombres'),'') is null or nullif(trim(a.datos->>'apellido_paterno'),'') is null)
        and concat_ws(' ',d.nombre_completo,d.clave_legado) ilike '%'||coalesce(p_busqueda,'')||'%'
      order by d.nombre_completo,d.id offset p_offset limit 15) t
    left join public.personal_personas p on p.id=t.persona_id;
  return jsonb_build_object('filas',filas,'total',cantidad);
end $$;

create function public.personal_nombres_revisar_lote_v1(p_filas jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); fila jsonb; perfil jsonb; resultado jsonb; ids uuid[]='{}'; doc uuid;
begin
  if rol not in ('ADMINISTRADOR','COORDINADOR ACADEMICO') then raise exception 'Sin permiso para regularizar nombres docentes' using errcode='42501'; end if;
  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) not between 1 and 50 or pg_column_size(p_filas)>262144 then raise exception 'Revisa entre 1 y 50 docentes por lote'; end if;
  if length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Describe la revisión realizada'; end if;
  -- Orden fijo para reducir conflictos entre lotes. Un fallo revierte todo el lote.
  for fila in select value from jsonb_array_elements(p_filas) order by value->>'docente_id' loop
    doc=(fila->>'docente_id')::uuid;
    if doc=any(ids) or fila->'revisado' is distinct from 'true'::jsonb then raise exception 'Solo se admiten docentes únicos y revisados'; end if;
    ids=array_append(ids,doc);perfil=public.personal_consultar_v2('DOCENTE',doc);
    if perfil->'original'='null'::jsonb then raise exception 'Un docente del lote ya no existe'; end if;
    resultado=public.personal_guardar_v1('DOCENTE',doc,(fila->>'revision')::integer,fila->'original','generales',jsonb_build_object(
      'datos',perfil->'datos'||jsonb_build_object('nombres',fila->>'nombres','apellido_paterno',fila->>'apellido_paterno','apellido_materno',fila->>'apellido_materno'),
      'nombre_revisado',true,'docente',jsonb_build_object('clave_legado',perfil->'original'->>'clave_legado','estatus',perfil->'original'->>'estatus')),p_motivo);
  end loop;
  return jsonb_build_object('revisados',cardinality(ids));
end $$;

revoke all on function public.personal_guardar_v1(text,uuid,integer,jsonb,text,jsonb,text),public.personal_consultar_v2(text,uuid),public.personal_nombres_pendientes_v1(text,integer),public.personal_nombres_revisar_lote_v1(jsonb,text) from public,anon;
grant execute on function public.personal_guardar_v1(text,uuid,integer,jsonb,text,jsonb,text),public.personal_consultar_v2(text,uuid),public.personal_nombres_pendientes_v1(text,integer),public.personal_nombres_revisar_lote_v1(jsonb,text) to authenticated;
revoke all on function public.personal_vincular_v1(uuid,uuid,integer,integer,jsonb,jsonb,text) from public,anon;
grant execute on function public.personal_vincular_v1(uuid,uuid,integer,integer,jsonb,jsonb,text) to authenticated;
commit;
