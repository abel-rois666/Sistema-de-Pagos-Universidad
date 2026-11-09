-- PREPARADA, NO EJECUTADA. Requiere Personal 20261108120000 y sus ampliaciones.
-- No asigna cuentas históricas, borra personas ni modifica roles existentes.
begin;
do $$ begin
 if to_regclass('public.personal_personas') is null or to_regprocedure('public._personal_rol_v1()') is null then
  raise exception 'Instala y verifica primero la base de Personal';
 end if;
end $$;
alter table public.usuarios add column empleado_id uuid references public.empleados(id) on delete restrict;
create unique index usuarios_empleado_unico on public.usuarios(empleado_id) where empleado_id is not null;

create function public._personal_gestion_admin_v1() returns boolean
language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and count(*)=1 and coalesce(bool_and(rol='ADMINISTRADOR' and activo is true),false)
 from public.usuarios where auth_id=auth.uid();
$$;

create table public.personal_gestion_auditoria (
 id uuid primary key default gen_random_uuid(), empleado_id uuid not null, persona_id uuid,
 accion text not null, motivo text not null, antes jsonb, despues jsonb,
 creado_por uuid not null, creado_en timestamptz not null default now()
);
alter table public.personal_gestion_auditoria enable row level security;
revoke all on public.personal_gestion_auditoria from public,anon,authenticated;
-- Auditoría privada: sin lectura ni escrituras directas desde el cliente; revisión por propietario SQL.

-- Un vínculo doble exige identidad compartida explícita; jamás se compara el nombre.
create function public._personal_validar_cuenta_administrativa_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare ep uuid; dp uuid; cambio boolean=false; cambia_docente boolean=false; liberacion_fk boolean=false;
begin
 if tg_op='INSERT' then cambio=new.empleado_id is not null;cambia_docente=new.docente_id is not null;
 else
  cambia_docente=new.docente_id is distinct from old.docente_id;
  cambio=new.empleado_id is distinct from old.empleado_id or ((new.empleado_id is not null or old.empleado_id is not null) and new.docente_id is distinct from old.docente_id);
  -- Conserva el SET NULL de la FK al eliminar un docente desde el flujo anterior.
  liberacion_fk=new.empleado_id is not distinct from old.empleado_id and new.docente_id is null and old.docente_id is not null and pg_trigger_depth()>1;
  if liberacion_fk then cambio=false;end if;
 end if;
 if cambia_docente and not liberacion_fk then
  if not public._personal_gestion_admin_v1() and auth.role() is distinct from 'service_role' then
   raise exception 'Solo Administración vincula cuentas docentes' using errcode='42501';end if;
  if new.docente_id is not null then
   -- Serializa también el alta docente legada frente a la nueva cuenta administrativa.
   perform 1 from public.docentes where id=new.docente_id for update;
   if exists(select 1 from public.usuarios u where u.id<>new.id and
     (u.docente_id=new.docente_id or u.empleado_id in
       (select e.id from public.empleados e join public.docentes d on d.persona_id=e.persona_id
        where d.id=new.docente_id and e.persona_id is not null))) then
    raise exception 'La persona ya tiene una cuenta; completa su vínculo desde Personal en lugar de duplicarla';end if;
  end if;
 end if;
 if cambio then
  if not public._personal_gestion_admin_v1() or current_setting('app.personal_vincular_cuenta_administrativa',true) is distinct from 'autorizado' then
   raise exception 'Usa la vinculación revisada de cuentas administrativas' using errcode='42501';
  end if;
 end if;
 if new.empleado_id is null then return new; end if;
 select persona_id into ep from public.empleados where id=new.empleado_id;
 if not found then raise exception 'El administrativo ya no existe'; end if;
 if new.docente_id is not null then
  select persona_id into dp from public.docentes where id=new.docente_id;
  if ep is null or dp is null or ep<>dp then raise exception 'La cuenta docente pertenece a otra identidad; revisa la relación de Personal'; end if;
 end if;
 return new;
end $$;
create trigger personal_validar_cuenta_administrativa before insert or update of empleado_id,docente_id
 on public.usuarios for each row execute function public._personal_validar_cuenta_administrativa_v1();

-- Las relaciones de Personal posteriores tampoco pueden dejar una cuenta apuntando a dos identidades.
create function public._personal_preservar_identidad_cuenta_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.persona_id is not distinct from old.persona_id then return new;end if;
 if tg_table_name='empleados' then
  if exists(select 1 from public.usuarios u join public.docentes d on d.id=u.docente_id
   where u.empleado_id=new.id and (new.persona_id is null or new.persona_id is distinct from d.persona_id)) then
   raise exception 'La cuenta compartida impide separar estas identidades. Revisa los vínculos de Personal';end if;
 else
  if exists(select 1 from public.usuarios u join public.empleados e on e.id=u.empleado_id
   where u.docente_id=new.id and (new.persona_id is null or new.persona_id is distinct from e.persona_id)) then
   raise exception 'La cuenta compartida impide separar estas identidades. Revisa los vínculos de Personal';end if;
 end if;
 return new;
end $$;
create trigger personal_preservar_cuenta_empleado before update of persona_id on public.empleados for each row execute function public._personal_preservar_identidad_cuenta_v1();
create trigger personal_preservar_cuenta_docente before update of persona_id on public.docentes for each row execute function public._personal_preservar_identidad_cuenta_v1();

create function public._personal_cuentas_empleado_v1(p_empleado uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'username',u.username,'rol',u.rol,'activo',u.activo,
 'auth_id',u.auth_id,'empleado_id',u.empleado_id,'docente_id',u.docente_id) order by u.username,u.id),'[]'::jsonb)
 from public.usuarios u where u.empleado_id=p_empleado or u.docente_id in
 (select d.id from public.docentes d join public.empleados e on e.persona_id=d.persona_id where e.id=p_empleado and e.persona_id is not null);
$$;

-- Cuenta TODAS las referencias entrantes, incluidas CASCADE y SET NULL, antes de autorizar el borrado.
create function public._personal_dependencias_empleado_v1(p_empleado uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare r record; n bigint; resultado jsonb='[]'::jsonb; e public.empleados; hay boolean;
begin
 select * into e from public.empleados where id=p_empleado;
 for r in select c.conname,n.nspname,t.relname,a.attname,cardinality(c.conkey) cantidad,referida.attname columna_referida
  from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  join pg_attribute a on a.attrelid=t.oid and a.attnum=c.conkey[1]
  join pg_attribute referida on referida.attrelid=c.confrelid and referida.attnum=c.confkey[1]
  where c.contype='f' and c.confrelid='public.empleados'::regclass
 loop
  if r.cantidad<>1 or r.columna_referida<>'id' then resultado=resultado||jsonb_build_array(jsonb_build_object('tabla',r.nspname||'.'||r.relname,'cantidad',null,'motivo','Referencia no simple por ID: revisión necesaria'));continue;end if;
  execute format('select count(*) from %I.%I where %I=$1',r.nspname,r.relname,r.attname) into n using p_empleado;
  if n>0 then resultado=resultado||jsonb_build_array(jsonb_build_object('tabla',r.nspname||'.'||r.relname,'cantidad',n));end if;
 end loop;
 if e.persona_id is not null then
  select exists(select 1 from public.personal_vinculos_laborales where persona_id=e.persona_id)
   or exists(select 1 from public.personal_formacion where persona_id=e.persona_id)
   or exists(select 1 from public.personal_expedientes where persona_id=e.persona_id) into hay;
  if hay then resultado=resultado||jsonb_build_array(jsonb_build_object('tabla','Expediente compartido de Personal','cantidad',1));end if;
 end if;
 if coalesce(e.firmante_certificados,false) or coalesce(e.firmante_titulos,false) or coalesce(e.firmante_boletas,false) or nullif(trim(e.firma_url),'') is not null then
  resultado=resultado||jsonb_build_array(jsonb_build_object('tabla','Firmas y funciones de firmante','cantidad',1));
 end if;
 if coalesce(e.documentos_entregados,'{}'::jsonb) not in ('{}'::jsonb,'null'::jsonb) or nullif(trim(e.enlace_drive),'') is not null then
  resultado=resultado||jsonb_build_array(jsonb_build_object('tabla','Documentos o expediente anterior','cantidad',1));
 end if;
 if jsonb_array_length(public._personal_cuentas_empleado_v1(p_empleado))>0 and not exists(select 1 from public.usuarios where empleado_id=p_empleado) then
  resultado=resultado||jsonb_build_array(jsonb_build_object('tabla','Cuenta de la función docente compartida','cantidad',1));
 end if;
 return resultado;
end $$;

create function public.personal_administrativo_revisar_v1(p_empleado uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.empleados; dependencias jsonb;
begin
 if not public._personal_gestion_admin_v1() then raise exception 'Solo Administración gestiona eliminación y cuentas' using errcode='42501';end if;
 select * into e from public.empleados where id=p_empleado;
 if not found then raise exception 'El administrativo ya no existe';end if;
 dependencias=public._personal_dependencias_empleado_v1(e.id);
 return jsonb_build_object('empleado',to_jsonb(e),'cuentas',public._personal_cuentas_empleado_v1(e.id),
 'docente_id',(select id from public.docentes where persona_id=e.persona_id and e.persona_id is not null),
 'dependencias',dependencias,'puede_eliminar',jsonb_array_length(dependencias)=0);
end $$;

create function public.personal_cuentas_administrativas_v1(p_ids uuid[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare filas jsonb;
begin
 if not public._personal_gestion_admin_v1() then raise exception 'Solo Administración consulta cuentas' using errcode='42501';end if;
 if coalesce(cardinality(p_ids),0)>200 then raise exception 'Consulta acotada a 200 administrativos';end if;
 select coalesce(jsonb_agg(jsonb_build_object('empleado_id',e.id,'cuentas',public._personal_cuentas_empleado_v1(e.id)) order by e.id),'[]'::jsonb)
 into filas from public.empleados e where e.id=any(p_ids);
 return filas;
end $$;

create function public.personal_cuentas_buscar_v1(p_busqueda text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public._personal_gestion_admin_v1() then raise exception 'Solo Administración consulta cuentas' using errcode='42501';end if;
 if length(trim(coalesce(p_busqueda,'')))<3 or length(p_busqueda)>100 then return '[]'::jsonb;end if;
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from
 (select id,username,rol,activo,auth_id,empleado_id,docente_id from public.usuarios
 where position(lower(trim(p_busqueda)) in lower(username))>0 order by username,id limit 20)t);
end $$;

create function public.personal_administrativo_vincular_cuenta_v1(p_empleado uuid,p_usuario uuid,p_original jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.empleados; u public.usuarios; d uuid; cuentas jsonb; previo jsonb;
begin
 if not public._personal_gestion_admin_v1() then raise exception 'Solo Administración vincula cuentas' using errcode='42501';end if;
 if (length(trim(coalesce(p_motivo,'')))<10 or length(p_motivo)>500) then raise exception 'Describe cómo comprobaste la identidad de la cuenta';end if;
 select * into e from public.empleados where id=p_empleado for update;
 if not found then raise exception 'El administrativo ya no existe';end if;
 if e.persona_id is not null then perform 1 from public.personal_personas where id=e.persona_id for update;end if;
 if to_jsonb(e) is distinct from p_original then raise exception 'El administrativo cambió. Vuelve a consultar antes de vincular' using errcode='40001';end if;
 select * into u from public.usuarios where id=p_usuario for update;
 if not found or u.auth_id is null then raise exception 'La cuenta no tiene identidad de inicio de sesión verificable';end if;
 if u.empleado_id is not null and u.empleado_id<>e.id then raise exception 'Esta cuenta ya pertenece a otro administrativo';end if;
 select id into d from public.docentes where persona_id=e.persona_id and e.persona_id is not null for update;
 if u.docente_id is not null and u.docente_id is distinct from d then raise exception 'La cuenta docente corresponde a otra identidad. Revisa primero Personal';end if;
 cuentas=public._personal_cuentas_empleado_v1(e.id);
 if exists(select 1 from jsonb_array_elements(cuentas) c where (c->>'id')::uuid<>u.id) then raise exception 'Hay otra cuenta para esta persona. Revisa los accesos antes de vincular';end if;
 if u.empleado_id=e.id and u.docente_id is not distinct from d then return jsonb_build_object('usuario_id',u.id,'ya_vinculada',true);end if;
 previo=to_jsonb(u)-'password';
 perform set_config('app.personal_vincular_cuenta_administrativa','autorizado',true);
 update public.usuarios set empleado_id=e.id,docente_id=coalesce(docente_id,d) where id=u.id;
 perform set_config('app.personal_vincular_cuenta_administrativa','',true);
 insert into public.personal_gestion_auditoria(empleado_id,persona_id,accion,motivo,antes,despues,creado_por)
 values(e.id,e.persona_id,'VINCULAR_CUENTA',trim(p_motivo),previo,jsonb_build_object('usuario_id',u.id,'docente_id',coalesce(u.docente_id,d),'rol',u.rol,'activo',u.activo),auth.uid());
 return jsonb_build_object('usuario_id',u.id,'rol',u.rol,'activo',u.activo);
end $$;

create function public.personal_administrativo_eliminar_v1(p_empleado uuid,p_original jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare e public.empleados; dependencias jsonb;
begin
 if not public._personal_gestion_admin_v1() then raise exception 'Solo Administración elimina administrativos' using errcode='42501';end if;
 if (length(trim(coalesce(p_motivo,'')))<10 or length(p_motivo)>500) then raise exception 'Indica el motivo de eliminación';end if;
 select * into e from public.empleados where id=p_empleado for update;
 if not found then raise exception 'El administrativo ya no existe. Actualiza el directorio';end if;
 if e.persona_id is not null then perform 1 from public.personal_personas where id=e.persona_id for update;end if;
 if to_jsonb(e) is distinct from p_original then raise exception 'El administrativo cambió. Repite la revisión antes de eliminar' using errcode='40001';end if;
 dependencias=public._personal_dependencias_empleado_v1(e.id);
 if jsonb_array_length(dependencias)>0 then raise exception 'Conserva historial, una cuenta o dependencias. No se eliminó nada; revisa su ficha para darlo de baja';end if;
 insert into public.personal_gestion_auditoria(empleado_id,persona_id,accion,motivo,antes,despues,creado_por)
 values(e.id,e.persona_id,'ELIMINAR_ADMINISTRATIVO',trim(p_motivo),to_jsonb(e),jsonb_build_object('identidad_conservada',e.persona_id,'funcion_docente_conservada',true),auth.uid());
 perform set_config('app.personal_eliminar_administrativo','autorizado',true);
 delete from public.empleados where id=e.id;
 perform set_config('app.personal_eliminar_administrativo','',true);
 return jsonb_build_object('eliminado_id',e.id);
end $$;

-- Evita el borrado directo legado: la operación autorizada conserva una auditoría y comprueba cascadas.
create function public._personal_proteger_eliminacion_administrativa_v1() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not public._personal_gestion_admin_v1() or current_setting('app.personal_eliminar_administrativo',true) is distinct from 'autorizado' then
  raise exception 'Usa la revisión de eliminación de administrativos' using errcode='42501';
 end if;
 return old;
end $$;
create trigger personal_proteger_eliminacion_administrativa before delete on public.empleados
 for each row execute function public._personal_proteger_eliminacion_administrativa_v1();
revoke delete on public.empleados from public,anon,authenticated;

revoke all on function public._personal_validar_cuenta_administrativa_v1(),public._personal_cuentas_empleado_v1(uuid),
 public._personal_dependencias_empleado_v1(uuid),public._personal_proteger_eliminacion_administrativa_v1(),
 public._personal_preservar_identidad_cuenta_v1(),public._personal_gestion_admin_v1() from public,anon,authenticated;
revoke all on function public.personal_administrativo_revisar_v1(uuid),public.personal_cuentas_administrativas_v1(uuid[]),
 public.personal_cuentas_buscar_v1(text),public.personal_administrativo_vincular_cuenta_v1(uuid,uuid,jsonb,text),
 public.personal_administrativo_eliminar_v1(uuid,jsonb,text) from public,anon;
grant execute on function public.personal_administrativo_revisar_v1(uuid),public.personal_cuentas_administrativas_v1(uuid[]),
 public.personal_cuentas_buscar_v1(text),public.personal_administrativo_vincular_cuenta_v1(uuid,uuid,jsonb,text),
 public.personal_administrativo_eliminar_v1(uuid,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
