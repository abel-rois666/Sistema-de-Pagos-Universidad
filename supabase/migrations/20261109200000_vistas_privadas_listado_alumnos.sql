-- PREPARADA, NO EJECUTADA. No consulta ni modifica alumnos al instalarse.
begin;
create table public.listado_vistas_usuario (
 id uuid primary key, usuario_auth uuid not null references auth.users(id) on delete cascade, nombre text not null check(length(btrim(nombre)) between 2 and 80),
 configuracion jsonb not null, predeterminada boolean not null default false,
 revision integer not null default 1 check(revision>0),
 creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create unique index listado_vista_nombre_usuario on public.listado_vistas_usuario(usuario_auth,lower(btrim(nombre)));
create unique index listado_vista_predeterminada_usuario on public.listado_vistas_usuario(usuario_auth) where predeterminada;
alter table public.listado_vistas_usuario enable row level security;
revoke all on public.listado_vistas_usuario from public,anon,authenticated;

create function public._listado_vistas_autorizar_v1() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null or not(select count(*)=1 and coalesce(bool_and(activo is true and rol in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR')),false)
   from public.usuarios where auth_id=auth.uid()) then
  raise exception 'No tienes permiso para administrar vistas del Listado General' using errcode='42501';
 end if;
end $$;

create function public._listado_validar_vista_v1(c jsonb) returns void
language plpgsql stable set search_path=pg_catalog,public as $$
declare k text; a jsonb; f text; opcionales text[]=array['email','grado','edad','sexo','nacimiento','procedencia','residencia','pagoTitulacion','pagoCertificado','certificacion'];
begin
 if jsonb_typeof(c) is distinct from 'object' or c->'version' is distinct from '1'::jsonb or octet_length(c::text)>24000 then
  raise exception 'Configuración de vista incompatible o demasiado grande';end if;
 if exists(select 1 from jsonb_object_keys(c) x where x not in ('version','columnas','filtros','filtrosColumnas','orden','fechaEdad')) then raise exception 'La vista contiene opciones desconocidas';end if;
 if jsonb_typeof(c->'columnas') is distinct from 'array' or jsonb_typeof(c->'filtros') is distinct from 'object'
   or jsonb_typeof(c->'filtrosColumnas') is distinct from 'object' or jsonb_typeof(c->'orden') is distinct from 'object'
   or jsonb_typeof(c->'fechaEdad') is distinct from 'object' then raise exception 'Faltan opciones de la vista';end if;
 if jsonb_array_length(c->'columnas')>10 or exists(select 1 from jsonb_array_elements(c->'columnas') x
   where jsonb_typeof(x)<>'string' or not((x#>>'{}')=any(opcionales))) then raise exception 'Columna de vista no admitida';end if;
 if exists(select 1 from jsonb_object_keys(c->'filtros') x where x not in ('ciclos','licenciaturas','tiposPlan','turnos','estatus'))
   or exists(select 1 from jsonb_object_keys(c->'orden') x where x not in ('columna','descendente'))
   or exists(select 1 from jsonb_object_keys(c->'fechaEdad') x where x not in ('modo','valor')) then raise exception 'Opciones de vista desconocidas';end if;
 foreach k in array array['ciclos','licenciaturas','tiposPlan','turnos','estatus'] loop
  a=c->'filtros'->k;
  if jsonb_typeof(a) is distinct from 'array' then raise exception 'Filtro de vista inválido: %',k;end if;
  if jsonb_array_length(a)>200 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}'))=0 or length(x#>>'{}')>200) then raise exception 'Filtro de vista fuera de límites';end if;
  if k='ciclos' and exists(select 1 from jsonb_array_elements_text(a) x where x !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'El ciclo de la vista debe conservar su ID';end if;
 end loop;
 for k,a in select * from jsonb_each(c->'filtrosColumnas') loop
  if not(k=any(opcionales)) or not(c->'columnas' ? k) or jsonb_typeof(a) is distinct from 'array' then raise exception 'Filtro de columna no visible';end if;
  if jsonb_array_length(a)>200 or exists(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}'))=0 or length(x#>>'{}')>200) then raise exception 'Filtro de columna fuera de límites';end if;
 end loop;
 k=c->'orden'->>'columna';
 if k is null or (k not in ('nombre','licenciatura','turno','estatus','telefonos') and not(c->'columnas' ? k))
   or jsonb_typeof(c->'orden'->'descendente') is distinct from 'boolean' then raise exception 'Orden de vista inválido';end if;
 k=c->'fechaEdad'->>'modo'; f=c->'fechaEdad'->>'valor';
 if k='hoy' then
  if jsonb_typeof(c->'fechaEdad'->'valor') is distinct from 'null' then raise exception 'La fecha actual se calcula al consultar';end if;
 elsif k='fija' then
  if f is null or f !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha de referencia inválida';end if;
  if to_char(f::date,'YYYY-MM-DD')<>f or f::date>(now() at time zone 'America/Mexico_City')::date then raise exception 'Fecha de referencia inválida o futura';end if;
 else raise exception 'Modo de fecha no admitido';end if;
end $$;

create function public.listado_vistas_consultar_v1() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb;
begin
 perform public._listado_vistas_autorizar_v1();
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'configuracion',configuracion,'predeterminada',predeterminada,'revision',revision) order by lower(nombre),id),'[]')
 into r from public.listado_vistas_usuario where usuario_auth=auth.uid();
 return r;
end $$;

create function public.listado_vista_guardar_v1(p_id uuid,p_revision integer,p_nombre text,p_configuracion jsonb,p_predeterminada boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.listado_vistas_usuario;
begin
 perform public._listado_vistas_autorizar_v1();
 perform public._listado_validar_vista_v1(p_configuracion);
 if p_id is null or p_revision is null or p_revision<0 or p_predeterminada is null or length(btrim(coalesce(p_nombre,''))) not between 2 and 80 then raise exception 'Revisa el nombre y la revisión de la vista';end if;
 -- Serializa las preferencias de esta cuenta, sin bloquear las de otros usuarios.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':vistas-listado',0));
 select * into v from public.listado_vistas_usuario where id=p_id and usuario_auth=auth.uid() for update;
 if (v.id is null and p_revision<>0) or (v.id is not null and v.revision<>p_revision) then raise exception 'La vista cambió. Actualiza las vistas antes de sobrescribirla' using errcode='40001';end if;
 if v.id is null and (select count(*) from public.listado_vistas_usuario where usuario_auth=auth.uid())>=20 then raise exception 'Puedes guardar hasta 20 vistas; elimina una que ya no utilices';end if;
 if p_predeterminada then
  update public.listado_vistas_usuario set predeterminada=false,revision=revision+1,actualizado_en=now()
  where usuario_auth=auth.uid() and predeterminada and id<>p_id;
 end if;
 if v.id is null then
  insert into public.listado_vistas_usuario(id,usuario_auth,nombre,configuracion,predeterminada)
   values(p_id,auth.uid(),btrim(p_nombre),p_configuracion,p_predeterminada);
 else
  update public.listado_vistas_usuario set nombre=btrim(p_nombre),configuracion=p_configuracion,predeterminada=p_predeterminada,revision=revision+1,actualizado_en=now()
   where id=p_id and usuario_auth=auth.uid();
 end if;
 return public.listado_vistas_consultar_v1();
exception when unique_violation then raise exception 'Ya existe una vista con ese nombre o identificador. Actualiza las vistas y revisa el nombre';
end $$;

create function public.listado_vista_eliminar_v1(p_id uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v public.listado_vistas_usuario;
begin
 perform public._listado_vistas_autorizar_v1();
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':vistas-listado',0));
 select * into v from public.listado_vistas_usuario where id=p_id and usuario_auth=auth.uid() for update;
 if v.id is null or p_revision is null or v.revision<>p_revision then raise exception 'La vista ya no está disponible o cambió. Actualiza las vistas' using errcode='40001';end if;
 delete from public.listado_vistas_usuario where id=p_id and usuario_auth=auth.uid();
 return public.listado_vistas_consultar_v1();
end $$;

revoke all on function public._listado_vistas_autorizar_v1(),public._listado_validar_vista_v1(jsonb) from public,anon,authenticated;
revoke all on function public.listado_vistas_consultar_v1(),public.listado_vista_guardar_v1(uuid,integer,text,jsonb,boolean),public.listado_vista_eliminar_v1(uuid,integer) from public,anon;
grant execute on function public.listado_vistas_consultar_v1(),public.listado_vista_guardar_v1(uuid,integer,text,jsonb,boolean),public.listado_vista_eliminar_v1(uuid,integer) to authenticated;
commit;
