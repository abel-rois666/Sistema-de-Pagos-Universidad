-- PREPARADA, NO EJECUTADA. Requiere la base de Personal y nombres estructurados.
-- Reemplaza solo la revisión nominal en lote y la proyección de cambios exclusivamente nominales.
-- No actualiza registros al instalar. Sin cambios de firma, tablas ni permisos de edición fiscal.
begin;

do $guard$
begin
  if to_regprocedure('public.personal_nombres_revisar_lote_v1(jsonb,text)') is null
    or to_regprocedure('public._personal_reflejar_v1()') is null
    or to_regprocedure('public._personal_fuente_v1(text,uuid,boolean)') is null
    or to_regclass('public.personal_personas') is null then
    raise exception 'Instala primero la base de Personal y 20261108150000_nombres_estructurados_personal.sql';
  end if;
  if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public._personal_reflejar_v1()')
    and md5(regexp_replace(p.prosrc,'[[:space:]]','','g')) in ('5cedef29ea042a597683bdc85aa5543a','99c9bd20445014368753f7addab44715')) then
    raise exception 'La funcion _personal_reflejar_v1 difiere de la version revisada. Ejecuta preflight_revision_nombres_sin_fiscal.sql antes de sustituirla';
  end if;
  if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.personal_nombres_revisar_lote_v1(jsonb,text)')
    and md5(regexp_replace(p.prosrc,'[[:space:]]','','g')) in ('9042a7be9e3b0868cd1f993905b4d5b8','618c61ab2f3fd54dbdb48542f665ede6')) then
    raise exception 'La funcion personal_nombres_revisar_lote_v1 difiere de la version revisada. Ejecuta preflight_revision_nombres_sin_fiscal.sql antes de sustituirla';
  end if;
end $guard$;

create or replace function public._personal_reflejar_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare d jsonb=new.datos;
begin
  if new.datos is not distinct from old.datos then return new; end if;
  -- NOMBRES_SIN_DATOS_FISCALES_V1: una corrección nominal no reescribe contacto ni datos fiscales.
  if (new.datos-array['nombre_completo','nombres','apellido_paterno','apellido_materno'])
    is not distinct from (old.datos-array['nombre_completo','nombres','apellido_paterno','apellido_materno']) then
    update public.docentes set nombre_completo=d->>'nombre_completo'
      where persona_id=new.id and nombre_completo is distinct from d->>'nombre_completo';
    update public.empleados set nombres=coalesce(nullif(d->>'nombres',''),nombres),
      apellido_paterno=coalesce(nullif(d->>'apellido_paterno',''),apellido_paterno),apellido_materno=d->>'apellido_materno'
      where persona_id=new.id and jsonb_build_array(nombres,apellido_paterno,apellido_materno) is distinct from
      jsonb_build_array(coalesce(nullif(d->>'nombres',''),nombres),coalesce(nullif(d->>'apellido_paterno',''),apellido_paterno),d->>'apellido_materno');
    return new;
  end if;
  -- Proyección general anterior: sin cambios para otras operaciones de Personal.
  update public.docentes set nombre_completo=d->>'nombre_completo',rfc=nullif(d->>'rfc',''),curp=nullif(d->>'curp',''),email=nullif(d->>'email','')
    where persona_id=new.id and jsonb_build_array(nombre_completo,rfc,curp,email) is distinct from jsonb_build_array(d->>'nombre_completo',nullif(d->>'rfc',''),nullif(d->>'curp',''),nullif(d->>'email',''));
  update public.empleados set nombres=coalesce(nullif(d->>'nombres',''),nombres),apellido_paterno=coalesce(nullif(d->>'apellido_paterno',''),apellido_paterno),apellido_materno=d->>'apellido_materno',
    rfc=nullif(d->>'rfc',''),curp=nullif(d->>'curp',''),fecha_nacimiento=nullif(d->>'fecha_nacimiento','')::date,sexo=nullif(d->>'sexo',''),estado_civil=nullif(d->>'estado_civil',''),direccion=nullif(d->>'direccion',''),telefono=nullif(d->>'telefono','')
    where persona_id=new.id and (jsonb_build_array(nombres,apellido_paterno,apellido_materno,rfc,curp,fecha_nacimiento,sexo,estado_civil,direccion,telefono) is distinct from
      jsonb_build_array(coalesce(nullif(d->>'nombres',''),nombres),coalesce(nullif(d->>'apellido_paterno',''),apellido_paterno),d->>'apellido_materno',nullif(d->>'rfc',''),nullif(d->>'curp',''),nullif(d->>'fecha_nacimiento','')::date,nullif(d->>'sexo',''),nullif(d->>'estado_civil',''),nullif(d->>'direccion',''),nullif(d->>'telefono','')));
  return new;
end $$;

create or replace function public.personal_nombres_revisar_lote_v1(p_filas jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_rol text=public._personal_rol_v1(); v_fila jsonb; v_fuente jsonb; v_persona public.personal_personas;
  v_ids uuid[]='{}'; v_docente uuid; v_antes jsonb; v_despues jsonb; v_partes jsonb; v_clave text; v_texto text;
  v_revision integer; v_persona_id uuid; v_operacion text=current_setting('app.personal_operacion',true);
begin
  if v_rol not in ('ADMINISTRADOR','COORDINADOR ACADEMICO') then
    raise exception 'Sin permiso para regularizar nombres docentes' using errcode='42501';
  end if;
  if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Revisa entre 1 y 50 docentes por lote'; end if;
  if jsonb_array_length(p_filas) not between 1 and 50 or pg_column_size(p_filas)>262144 then
    raise exception 'Revisa entre 1 y 50 docentes por lote';
  end if;
  if length(trim(coalesce(p_motivo,''))) not between 5 and 1000 then raise exception 'Describe la revisión realizada (5–1000 caracteres)'; end if;
  -- NOMBRES_SIN_DATOS_FISCALES_V1: UUID, revisión y original acreditan la identidad y concurrencia.
  for v_fila in select entrada.elemento from jsonb_array_elements(p_filas) as entrada(elemento) order by entrada.elemento->>'docente_id' loop
    if jsonb_typeof(v_fila) is distinct from 'object' then raise exception 'Una fila del lote no es válida'; end if;
    if exists(select 1 from jsonb_object_keys(v_fila) as campos(clave)
      where campos.clave not in ('docente_id','revision','original','nombres','apellido_paterno','apellido_materno','revisado')) then
      raise exception 'La revisión nominal solo admite nombres y metadatos de comprobación';
    end if;
    begin v_docente=(v_fila->>'docente_id')::uuid;
    exception when invalid_text_representation then raise exception 'Un identificador docente no es válido'; end;
    if v_docente is null or v_docente=any(v_ids) or v_fila->'revisado' is distinct from 'true'::jsonb then
      raise exception 'Solo se admiten docentes únicos y revisados';
    end if;
    if jsonb_typeof(v_fila->'revision') is distinct from 'number' or coalesce(v_fila->>'revision','') !~ '^(0|[1-9][0-9]*)$'
      or jsonb_typeof(v_fila->'original') is distinct from 'object' then raise exception 'Falta la revisión o el original del docente'; end if;
    v_revision=(v_fila->>'revision')::integer;
    v_ids=array_append(v_ids,v_docente);
    v_partes='{}'::jsonb;
    foreach v_clave in array array['nombres','apellido_paterno','apellido_materno'] loop
      if v_fila ? v_clave and jsonb_typeof(v_fila->v_clave) not in ('string','null') then raise exception 'Escribe los nombres y apellidos como texto'; end if;
      v_texto=nullif(regexp_replace(trim(v_fila->>v_clave),'[[:space:]]+',' ','g'),'');
      if length(coalesce(v_texto,''))>150 then raise exception 'Un nombre o apellido excede 150 caracteres'; end if;
      v_partes=v_partes||jsonb_build_object(v_clave,v_texto);
    end loop;
    if nullif(v_partes->>'nombres','') is null or nullif(v_partes->>'apellido_paterno','') is null then
      raise exception 'Completa primer apellido y nombre(s). El segundo apellido es opcional';
    end if;
    v_partes=v_partes||jsonb_build_object('nombre_completo',concat_ws(' ',v_partes->>'apellido_paterno',v_partes->>'apellido_materno',v_partes->>'nombres'));
    v_fuente=public._personal_fuente_v1('DOCENTE',v_docente,true);
    if v_fuente->'registro' is null or v_fuente->'registro'='null'::jsonb then raise exception 'Un docente del lote ya no existe' using errcode='40001'; end if;
    if v_fuente->'original' is distinct from v_fila->'original' then
      raise exception 'El directorio cambió. Actualiza la consulta y revisa el lote; no se guardó ningún nombre' using errcode='40001';
    end if;
    select p.* into v_persona from public.personal_personas p where p.id=(v_fuente->>'persona_id')::uuid for update;
    if coalesce(v_persona.revision,0)<>v_revision then
      raise exception 'Otra sesión modificó el expediente. Actualiza la consulta y revisa el lote; no se guardó ningún nombre' using errcode='40001';
    end if;
    v_antes=coalesce(v_persona.datos,v_fuente->'datos');
    v_despues=v_antes||v_partes;
    perform set_config('app.personal_operacion','v1',true);
    if v_persona.id is null then
      insert into public.personal_personas(datos,nombre_original,nombre_confirmado_en,nombre_confirmado_por,nombre_fuente)
        values(v_despues,v_antes->>'nombre_completo',now(),auth.uid(),'CAPTURA_REVISADA') returning id into v_persona_id;
      -- No se reescriben RFC, CURP, correo, clave ni habilitación del registro legado.
      update public.docentes set persona_id=v_persona_id,nombre_completo=v_partes->>'nombre_completo' where id=v_docente;
    else
      v_persona_id=v_persona.id;
      update public.personal_personas set datos=v_despues,revision=revision+1,actualizado_en=now(),
        nombre_original=coalesce(nombre_original,v_antes->>'nombre_completo'),nombre_confirmado_en=now(),
        nombre_confirmado_por=auth.uid(),nombre_fuente='CAPTURA_REVISADA' where id=v_persona_id;
    end if;
    insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol)
      values(v_persona_id,'nombres',trim(p_motivo),v_antes,v_despues,auth.uid(),v_rol);
  end loop;
  perform set_config('app.personal_operacion',coalesce(v_operacion,''),true);
  return jsonb_build_object('revisados',cardinality(v_ids));
end $$;

revoke all on function public._personal_reflejar_v1() from public,anon,authenticated;
revoke all on function public.personal_nombres_revisar_lote_v1(jsonb,text) from public,anon;
grant execute on function public.personal_nombres_revisar_lote_v1(jsonb,text) to authenticated;
commit;
