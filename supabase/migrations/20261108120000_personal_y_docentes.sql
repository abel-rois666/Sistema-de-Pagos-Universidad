-- Preparación aditiva. No ejecutada contra Supabase por este agente.
begin;

do $$ begin
  if to_regclass('public.docentes') is null or to_regclass('public.empleados') is null or to_regclass('public.usuarios') is null then
    raise exception 'Faltan directorios operativos. Ejecuta primero el preflight de personal.';
  end if;
end $$;

create table public.personal_personas (
  id uuid primary key default gen_random_uuid(), datos jsonb not null check(jsonb_typeof(datos)='object'),
  revision integer not null default 1 check(revision>0), creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create table public.personal_vinculos_laborales (
  id uuid primary key, persona_id uuid not null references public.personal_personas(id) on delete restrict,
  datos jsonb not null check(jsonb_typeof(datos)='object'), actualizado_en timestamptz not null default now()
);
create index personal_laborales_persona on public.personal_vinculos_laborales(persona_id);
create table public.personal_formacion (
  id uuid primary key, persona_id uuid not null references public.personal_personas(id) on delete restrict,
  datos jsonb not null check(jsonb_typeof(datos)='object'), actualizado_en timestamptz not null default now()
);
create index personal_formacion_persona on public.personal_formacion(persona_id);
create unique index personal_formacion_principal on public.personal_formacion(persona_id)
  where datos->>'principal'='true' and coalesce(datos->>'archivado','false')='false';
create table public.personal_expedientes (
  persona_id uuid primary key references public.personal_personas(id) on delete restrict,
  datos jsonb not null check(jsonb_typeof(datos)='object'), actualizado_en timestamptz not null default now()
);
create table public.personal_auditoria (
  id uuid primary key default gen_random_uuid(),persona_id uuid not null references public.personal_personas(id) on delete restrict,
  seccion text not null,motivo text not null,antes jsonb,despues jsonb,creado_por uuid,rol text not null,creado_en timestamptz not null default now()
);
create index personal_auditoria_persona on public.personal_auditoria(persona_id,creado_en desc);
alter table public.docentes add column persona_id uuid references public.personal_personas(id) on delete restrict;
alter table public.empleados add column persona_id uuid references public.personal_personas(id) on delete restrict;
create unique index docentes_persona_unica on public.docentes(persona_id) where persona_id is not null;
create unique index empleados_persona_unica on public.empleados(persona_id) where persona_id is not null;

-- Las tablas privadas no heredan las políticas amplias de los directorios legados.
alter table public.personal_personas enable row level security;
alter table public.personal_vinculos_laborales enable row level security;
alter table public.personal_formacion enable row level security;
alter table public.personal_expedientes enable row level security;
alter table public.personal_auditoria enable row level security;
revoke all on public.personal_personas,public.personal_vinculos_laborales,public.personal_formacion,public.personal_expedientes,public.personal_auditoria from public,anon,authenticated;

create function public._personal_rol_v1() returns text language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_rol text; v_cantidad integer;
begin
  if auth.uid() is null then
    if auth.role()='service_role' or session_user in ('postgres','supabase_admin') then return 'ADMINISTRADOR'; end if;
    raise exception 'Se requiere una sesión autenticada' using errcode='42501';
  end if;
  select count(*),min(rol) into v_cantidad,v_rol from public.usuarios where auth_id=auth.uid() and coalesce(activo,true);
  if v_cantidad<>1 or v_rol not in ('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS','COORDINADOR ACADEMICO') then
    raise exception 'Sin permiso para el expediente de personal' using errcode='42501';
  end if;
  return v_rol;
end $$;

create function public._personal_fuente_v1(p_tipo text,p_id uuid,p_bloquear boolean default false) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb; d jsonb;
begin
  if p_tipo='DOCENTE' then
    if p_bloquear then select to_jsonb(t) into r from public.docentes t where id=p_id for update; else select to_jsonb(t) into r from public.docentes t where id=p_id; end if;
    d=jsonb_build_object('nombre_completo',r->>'nombre_completo','rfc',r->>'rfc','curp',r->>'curp','email',r->>'email');
  elsif p_tipo='EMPLEADO' then
    if p_bloquear then select to_jsonb(t) into r from public.empleados t where id=p_id for update; else select to_jsonb(t) into r from public.empleados t where id=p_id; end if;
    d=jsonb_build_object('nombre_completo',concat_ws(' ',nullif(r->>'apellido_paterno',''),nullif(r->>'apellido_materno',''),nullif(r->>'nombres','')),
      'nombres',r->>'nombres','apellido_paterno',r->>'apellido_paterno','apellido_materno',r->>'apellido_materno',
      'rfc',r->>'rfc','curp',r->>'curp','fecha_nacimiento',r->>'fecha_nacimiento','sexo',r->>'sexo','estado_civil',r->>'estado_civil','direccion',r->>'direccion','telefono',r->>'telefono');
  else raise exception 'Origen de personal no reconocido'; end if;
  return jsonb_build_object('registro',r,'datos',d,'persona_id',r->'persona_id','original',case when r is null then null else d||case when p_tipo='DOCENTE' then jsonb_build_object('clave_legado',r->>'clave_legado','estatus',r->>'estatus') else '{}'::jsonb end end);
end $$;

create function public.personal_consultar_v1(p_tipo text,p_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); f jsonb; p public.personal_personas; privado boolean; e jsonb;
begin
  if p_tipo='EMPLEADO' and rol='COORDINADOR ACADEMICO' then raise exception 'Sin acceso a la ficha administrativa' using errcode='42501'; end if;
  f=public._personal_fuente_v1(p_tipo,p_id);
  if f->'registro'='null'::jsonb and (p_tipo<>'DOCENTE' or rol='COORDINADOR RECURSOS HUMANOS') then raise exception 'Registro no encontrado'; end if;
  select * into p from public.personal_personas where id=(f->>'persona_id')::uuid;
  select to_jsonb(t) into e from public.empleados t where (p.id is not null and t.persona_id=p.id) or (p_tipo='EMPLEADO' and t.id=p_id) limit 1;
  privado=rol in ('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS');
  return jsonb_build_object('disponible',true,'persona_id',p.id,'revision',coalesce(p.revision,0),'original',f->'original',
    'datos',coalesce(p.datos,f->'datos'),'docente_id',(select id from public.docentes where persona_id=p.id),'empleado_id',(select id from public.empleados where persona_id=p.id),
    'permisos',jsonb_build_object('generales',rol='ADMINISTRADOR' or (rol='COORDINADOR ACADEMICO' and p_tipo='DOCENTE'),'docencia',rol in ('ADMINISTRADOR','COORDINADOR ACADEMICO'),'academicos',rol in ('ADMINISTRADOR','COORDINADOR ACADEMICO'),'laborales',privado,'expediente',privado,'editar_laborales',rol='ADMINISTRADOR','editar_expediente',rol='ADMINISTRADOR','vincular',rol='ADMINISTRADOR'),
    'laborales',case when privado then coalesce((select jsonb_agg(datos||jsonb_build_object('id',id) order by datos->>'fecha_inicio' desc nulls last,id) from public.personal_vinculos_laborales where persona_id=p.id),'[]'::jsonb) else '[]'::jsonb end,
    'academicos',coalesce((select jsonb_agg(datos||jsonb_build_object('id',id) order by datos->>'principal' desc,datos->>'nivel',id) from public.personal_formacion where persona_id=p.id),'[]'::jsonb),
    'expediente',case when privado then (select datos from public.personal_expedientes where persona_id=p.id) else null end,
    'referencia_laboral',case when privado and e is not null then jsonb_build_object('fecha_ingreso',e->>'fecha_ingreso','puesto',e->>'puesto','departamento',e->>'departamento','tipo_contratacion',e->>'tipo_contratacion','tipo_jornada',e->>'tipo_jornada','documentos_entregados',e->'documentos_entregados','enlace_drive',e->>'enlace_drive') else null end,
    'referencia_academica',case when e is not null then jsonb_build_object('nivel_estudios',e->>'nivel_estudios','nivel_estudios_estado',e->>'nivel_estudios_estado','titulo_academico',e->>'titulo_academico') else null end);
end $$;

-- Puentes de compatibilidad. No crean personas ni reinterpretan situaciones laborales.
create function public._personal_proteger_enlace_v1() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if (tg_op='INSERT' and new.persona_id is not null) or (tg_op='UPDATE' and new.persona_id is distinct from old.persona_id) then
    if current_setting('app.personal_operacion',true) is distinct from 'v1' then raise exception 'Relaciona los directorios desde la revisión de personal'; end if;
  end if;
  return new;
end $$;
create trigger personal_proteger_docente before insert or update of persona_id on public.docentes for each row execute function public._personal_proteger_enlace_v1();
create trigger personal_proteger_empleado before insert or update of persona_id on public.empleados for each row execute function public._personal_proteger_enlace_v1();

create function public._personal_reflejar_v1() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare d jsonb=new.datos;
begin
  if new.datos is not distinct from old.datos then return new; end if;
  update public.docentes set nombre_completo=d->>'nombre_completo',rfc=nullif(d->>'rfc',''),curp=nullif(d->>'curp',''),email=nullif(d->>'email','')
    where persona_id=new.id and jsonb_build_array(nombre_completo,rfc,curp,email) is distinct from jsonb_build_array(d->>'nombre_completo',nullif(d->>'rfc',''),nullif(d->>'curp',''),nullif(d->>'email',''));
  update public.empleados set nombres=coalesce(nullif(d->>'nombres',''),nombres),apellido_paterno=coalesce(nullif(d->>'apellido_paterno',''),apellido_paterno),apellido_materno=d->>'apellido_materno',
    rfc=nullif(d->>'rfc',''),curp=nullif(d->>'curp',''),fecha_nacimiento=nullif(d->>'fecha_nacimiento','')::date,sexo=nullif(d->>'sexo',''),estado_civil=nullif(d->>'estado_civil',''),direccion=nullif(d->>'direccion',''),telefono=nullif(d->>'telefono','')
    where persona_id=new.id and (jsonb_build_array(nombres,apellido_paterno,apellido_materno,rfc,curp,fecha_nacimiento,sexo,estado_civil,direccion,telefono) is distinct from
      jsonb_build_array(coalesce(nullif(d->>'nombres',''),nombres),coalesce(nullif(d->>'apellido_paterno',''),apellido_paterno),d->>'apellido_materno',nullif(d->>'rfc',''),nullif(d->>'curp',''),nullif(d->>'fecha_nacimiento','')::date,nullif(d->>'sexo',''),nullif(d->>'estado_civil',''),nullif(d->>'direccion',''),nullif(d->>'telefono','')));
  return new;
end $$;
create trigger personal_reflejar after update of datos on public.personal_personas for each row execute function public._personal_reflejar_v1();

create function public._personal_compatibilidad_v1() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare f jsonb; anterior jsonb; destino jsonb; rol text;
begin
  if new.persona_id is null or pg_trigger_depth()>1 or current_setting('app.personal_operacion',true)='v1' then return new; end if;
  rol=public._personal_rol_v1();
  if rol='COORDINADOR RECURSOS HUMANOS' or (tg_table_name='empleados' and rol<>'ADMINISTRADOR') then raise exception 'Sin permiso para editar este directorio' using errcode='42501'; end if;
  if tg_table_name='docentes' then f=public._personal_fuente_v1('DOCENTE',new.id); else f=public._personal_fuente_v1('EMPLEADO',new.id); end if;
  select datos into anterior from public.personal_personas where id=new.persona_id for update;
  destino=anterior||(f->'datos');
  -- Un cliente legado no divide nombres completos ni elimina nombres estructurados confirmados.
  if tg_table_name='docentes' and nullif(anterior->>'nombres','') is not null and new.nombre_completo is distinct from old.nombre_completo then
    raise exception 'Edita los nombres estructurados desde la ficha compartida de personal';
  end if;
  if destino is distinct from anterior then
    update public.personal_personas set datos=destino,revision=revision+1,actualizado_en=now() where id=new.persona_id;
    insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol) values(new.persona_id,'generales','Edición compatible desde directorio existente',anterior,destino,auth.uid(),rol);
  end if;
  return new;
end $$;
create trigger personal_compat_docente after update of nombre_completo,rfc,curp,email on public.docentes for each row execute function public._personal_compatibilidad_v1();
create trigger personal_compat_empleado after update of nombres,apellido_paterno,apellido_materno,rfc,curp,fecha_nacimiento,sexo,estado_civil,direccion,telefono on public.empleados for each row execute function public._personal_compatibilidad_v1();

create function public.personal_guardar_v1(p_tipo text,p_id uuid,p_revision integer,p_original jsonb,p_seccion text,p_datos jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); f jsonb; p public.personal_personas; v jsonb; x jsonb; filas jsonb; antes jsonb; d jsonb; k text; doc_id uuid; es_nuevo boolean; revision_nueva integer;
begin
  if rol='COORDINADOR RECURSOS HUMANOS' then raise exception 'Recursos Humanos tiene acceso de consulta; la edición corresponde a Administración' using errcode='42501'; end if;
  if p_tipo not in ('DOCENTE','EMPLEADO') or p_seccion not in ('generales','laborales','academicos','expediente') then raise exception 'Operación de personal no reconocida'; end if;
  if p_tipo='EMPLEADO' and rol='COORDINADOR ACADEMICO' or p_seccion in ('laborales','expediente') and rol='COORDINADOR ACADEMICO' then raise exception 'Esta sección requiere Administración o Recursos Humanos' using errcode='42501'; end if;
  if p_datos is null or pg_column_size(p_datos)>262144 then raise exception 'Captura demasiado extensa o incompleta'; end if;
  if length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Describe el motivo del registro o corrección'; end if;
  f=public._personal_fuente_v1(p_tipo,p_id,true);es_nuevo=f->'registro'='null'::jsonb;
  if f->'original' is distinct from coalesce(p_original,'null'::jsonb) then raise exception 'El directorio cambió. Actualiza la ficha antes de guardar' using errcode='40001'; end if;
  select * into p from public.personal_personas where id=(f->>'persona_id')::uuid for update;
  if coalesce(p.revision,0)<>p_revision then raise exception 'Otra sesión modificó el expediente. Actualiza antes de guardar' using errcode='40001'; end if;
  if p.id is null and p_seccion<>'generales' then raise exception 'Guarda primero los datos generales del perfil compartido'; end if;
  perform set_config('app.personal_operacion','v1',true);
  if p_seccion='generales' then
    v=p_datos->'datos';if jsonb_typeof(v) is distinct from 'object' then raise exception 'Datos generales incompletos'; end if;
    d='{}'::jsonb;
    foreach k in array array['nombre_completo','nombres','apellido_paterno','apellido_materno','rfc','curp','email','telefono','direccion','fecha_nacimiento','sexo','estado_civil'] loop
      if length(coalesce(v->>k,''))>500 then raise exception 'Un campo excede la longitud permitida'; end if;
      d=d||jsonb_build_object(k,nullif(trim(v->>k),''));
    end loop;
    if nullif(d->>'nombres','') is not null or nullif(d->>'apellido_paterno','') is not null then
      if nullif(d->>'nombres','') is null or nullif(d->>'apellido_paterno','') is null then raise exception 'Completa nombres y apellido paterno'; end if;
      d=jsonb_set(d,'{nombre_completo}',to_jsonb(concat_ws(' ',d->>'apellido_paterno',d->>'apellido_materno',d->>'nombres')));
    end if;
    if nullif(d->>'nombre_completo','') is null then raise exception 'El nombre completo es obligatorio'; end if;
    if nullif(d->>'rfc','') is not null and d->>'rfc' !~* '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$' then raise exception 'Revisa el formato del RFC'; end if;
    if nullif(d->>'curp','') is not null and d->>'curp' !~* '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$' then raise exception 'Revisa el formato de la CURP'; end if;
    if nullif(d->>'email','') is not null and d->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Revisa el correo electrónico'; end if;
    if nullif(d->>'fecha_nacimiento','') is not null and (d->>'fecha_nacimiento')::date>current_date then raise exception 'Nacimiento no puede ser futuro'; end if;
    antes=p.datos;
    if p.id is null then insert into public.personal_personas(datos) values(d) returning * into p;
    else update public.personal_personas set datos=d,revision=revision+1,actualizado_en=now() where id=p.id returning * into p; end if;
    if p_tipo='DOCENTE' then
      if rol='COORDINADOR RECURSOS HUMANOS' and es_nuevo then raise exception 'Recursos Humanos no da de alta perfiles docentes' using errcode='42501'; end if;
      if rol in ('ADMINISTRADOR','COORDINADOR ACADEMICO') then
        if coalesce(p_datos->'docente'->>'estatus','') not in ('activo','inactivo') or nullif(trim(p_datos->'docente'->>'clave_legado'),'') is null then raise exception 'Revisa clave y habilitación docente'; end if;
        if es_nuevo then insert into public.docentes(id,clave_legado,nombre_completo,rfc,curp,email,estatus,persona_id) values(p_id,p_datos->'docente'->>'clave_legado',d->>'nombre_completo',d->>'rfc',d->>'curp',d->>'email',p_datos->'docente'->>'estatus',p.id);
        else
          if p_datos->'docente'->>'clave_legado' is distinct from f->'registro'->>'clave_legado' then raise exception 'La clave docente existente se conserva'; end if;
          update public.docentes set persona_id=p.id,nombre_completo=d->>'nombre_completo',rfc=d->>'rfc',curp=d->>'curp',email=d->>'email',estatus=p_datos->'docente'->>'estatus' where id=p_id;
        end if;
      else update public.docentes set persona_id=p.id,nombre_completo=d->>'nombre_completo',rfc=d->>'rfc',curp=d->>'curp',email=d->>'email' where id=p_id; end if;
    else
      if es_nuevo then raise exception 'Registra primero el empleado en el directorio administrativo'; end if;
      update public.empleados set persona_id=p.id where id=p_id;
      -- El primer enlace requiere reflejar explícitamente los datos; los siguientes los refleja el trigger.
      update public.empleados set nombres=coalesce(d->>'nombres',nombres),apellido_paterno=coalesce(d->>'apellido_paterno',apellido_paterno),apellido_materno=d->>'apellido_materno',rfc=d->>'rfc',curp=d->>'curp',fecha_nacimiento=nullif(d->>'fecha_nacimiento','')::date,sexo=d->>'sexo',estado_civil=d->>'estado_civil',direccion=d->>'direccion',telefono=d->>'telefono' where id=p_id;
    end if;
  elsif p_seccion in ('laborales','academicos') then
    if jsonb_typeof(p_datos) is distinct from 'array' or jsonb_array_length(p_datos)>100 then raise exception 'Listado de personal no válido'; end if;
    if p_seccion='laborales' then select jsonb_agg(datos||jsonb_build_object('id',id)) into antes from public.personal_vinculos_laborales where persona_id=p.id;
    else select jsonb_agg(datos||jsonb_build_object('id',id)) into antes from public.personal_formacion where persona_id=p.id; end if;
    if (select count(distinct value->>'id') from jsonb_array_elements(p_datos))<>jsonb_array_length(p_datos) then raise exception 'Identificador repetido o ausente en el listado'; end if;
    for v in select value from jsonb_array_elements(p_datos) order by case when value->>'principal'='true' and coalesce(value->>'archivado','false')='false' then 1 else 0 end loop
      doc_id=(v->>'id')::uuid;
      if doc_id is null or jsonb_typeof(v->'archivado') is distinct from 'boolean' then raise exception 'Identificador o archivo no válido'; end if;
      if p_seccion='laborales' then
        if exists(select 1 from public.personal_vinculos_laborales where id=doc_id and persona_id<>p.id) then raise exception 'El vínculo pertenece a otra persona'; end if;
        if nullif(trim(v->>'funcion'),'') is null then raise exception 'Indica la función del vínculo laboral'; end if;
        if nullif(v->>'fecha_inicio','')::date>nullif(v->>'fecha_fin','')::date then raise exception 'Inicio posterior al término'; end if;
        if nullif(v->>'horas_contratadas','')::numeric<0 or nullif(v->>'horas_contratadas','')::numeric>168 then raise exception 'Horas contratadas fuera de rango'; end if;
        d=jsonb_build_object('funcion',v->>'funcion','departamento',v->>'departamento','contratacion',v->>'contratacion','jornada',v->>'jornada','fecha_inicio',nullif(v->>'fecha_inicio','')::date,'fecha_fin',nullif(v->>'fecha_fin','')::date,'horas_contratadas',nullif(v->>'horas_contratadas','')::numeric,'observaciones',v->>'observaciones','archivado',(v->>'archivado')::boolean);
        insert into public.personal_vinculos_laborales(id,persona_id,datos) values(doc_id,p.id,d) on conflict(id) do update set datos=excluded.datos,actualizado_en=now();
      else
        if exists(select 1 from public.personal_formacion where id=doc_id and persona_id<>p.id) then raise exception 'La formación pertenece a otra persona'; end if;
        if coalesce(v->>'nivel','') not in ('Licenciatura','Especialidad','Maestría','Doctorado','Otro') or coalesce(v->>'situacion','') not in ('En curso','Incompleto','Terminado','Titulado') or nullif(trim(v->>'programa'),'') is null or jsonb_typeof(v->'principal') is distinct from 'boolean' then raise exception 'Completa nivel, programa y situación de estudios'; end if;
        d=jsonb_build_object('nivel',v->>'nivel','programa',v->>'programa','institucion',v->>'institucion','situacion',v->>'situacion','cedula',v->>'cedula','fecha_titulacion',nullif(v->>'fecha_titulacion','')::date,'principal',(v->>'principal')::boolean,'archivado',(v->>'archivado')::boolean);
        insert into public.personal_formacion(id,persona_id,datos) values(doc_id,p.id,d) on conflict(id) do update set datos=excluded.datos,actualizado_en=now();
      end if;
    end loop;
    update public.personal_personas set revision=revision+1,actualizado_en=now() where id=p.id returning * into p;
  else
    select datos into antes from public.personal_expedientes where persona_id=p.id;
    if jsonb_typeof(p_datos->'documentos') is distinct from 'array' or jsonb_array_length(p_datos->'documentos')>30 then raise exception 'Listado documental no válido'; end if;
    if nullif(p_datos->>'enlace_drive','') is not null and p_datos->>'enlace_drive' !~ '^https://(drive|docs)[.]google[.]com/' then raise exception 'Revisa el enlace de Google Drive'; end if;
    filas='[]'::jsonb;
    for v in select value from jsonb_array_elements(p_datos->'documentos') loop
      if coalesce(v->>'clave','') not in ('alta_empleado','acta_nacimiento','curp','comprobante_domicilio','constancia_situacion_fiscal','cuenta_bancaria','afiliacion_imss','pruebas','cv','comprobantes_estudio') or coalesce(v->>'estado','') not in ('SIN_REGISTRAR','PENDIENTE','ENTREGADO','REVISADO','NO_APLICA') or jsonb_typeof(v->'requerido') is distinct from 'boolean' then raise exception 'Documento no reconocido'; end if;
      if v->>'estado'='NO_APLICA' and length(trim(coalesce(v->>'motivo','')))<5 then raise exception 'Justifica los documentos que no aplican'; end if;
      if exists(select 1 from jsonb_array_elements(filas) z where z->>'clave'=v->>'clave') then raise exception 'Documento repetido'; end if;
      filas=filas||jsonb_build_array(jsonb_build_object('clave',v->>'clave','estado',v->>'estado','requerido',(v->>'requerido')::boolean,'motivo',v->>'motivo','referencia',v->>'referencia'));
    end loop;
    d=jsonb_build_object('documentos',filas,'enlace_drive',nullif(p_datos->>'enlace_drive',''));
    insert into public.personal_expedientes(persona_id,datos) values(p.id,d) on conflict(persona_id) do update set datos=excluded.datos,actualizado_en=now();
    -- Solo se reflejan marcas explícitas; las claves legadas no enviadas se conservan.
    update public.empleados set enlace_drive=d->>'enlace_drive',documentos_entregados=coalesce(documentos_entregados,'{}'::jsonb)||coalesce((select jsonb_object_agg(z->>'clave',(z->>'estado') in ('ENTREGADO','REVISADO')) from jsonb_array_elements(filas) z),'{}'::jsonb) where persona_id=p.id;
    update public.personal_personas set revision=revision+1,actualizado_en=now() where id=p.id returning * into p;
  end if;
  insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol) values(p.id,p_seccion,trim(p_motivo),antes,case when p_seccion='generales' then p.datos else p_datos end,auth.uid(),rol);
  return jsonb_build_object('persona_id',p.id,'revision',p.revision);
end $$;

create function public.personal_candidatos_v1(p_docente uuid,p_busqueda text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1();
begin
  if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración relaciona directorios' using errcode='42501'; end if;
  if length(trim(coalesce(p_busqueda,'')))<3 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'nombre',concat_ws(' ',t.apellido_paterno,t.apellido_materno,t.nombres),'rfc',t.rfc,'curp',t.curp,'persona_id',t.persona_id,'revision',coalesce(p.revision,0),'original',public._personal_fuente_v1('EMPLEADO',t.id)->'original')) from
    (select * from public.empleados where concat_ws(' ',apellido_paterno,apellido_materno,nombres,rfc,curp) ilike '%'||trim(p_busqueda)||'%' order by apellido_paterno,apellido_materno,nombres,id limit 25) t left join public.personal_personas p on p.id=t.persona_id),'[]'::jsonb);
end $$;

create function public.personal_vincular_v1(p_docente uuid,p_empleado uuid,p_revision_docente integer,p_revision_empleado integer,p_original_docente jsonb,p_original_empleado jsonb,p_motivo text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); d jsonb; e jsonb; pd public.personal_personas; pe public.personal_personas; destino uuid; v_datos jsonb;
begin
  if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración relaciona directorios' using errcode='42501'; end if;
  if length(trim(coalesce(p_motivo,'')))<10 then raise exception 'Describe la revisión de identidad realizada'; end if;
  d=public._personal_fuente_v1('DOCENTE',p_docente,true);e=public._personal_fuente_v1('EMPLEADO',p_empleado,true);
  if d->'registro'='null'::jsonb or e->'registro'='null'::jsonb then raise exception 'Uno de los registros ya no existe'; end if;
  if d->'original' is distinct from p_original_docente or e->'original' is distinct from p_original_empleado then raise exception 'Los datos cambiaron. Repite la revisión' using errcode='40001'; end if;
  select * into pd from public.personal_personas where id=(d->>'persona_id')::uuid for update;
  select * into pe from public.personal_personas where id=(e->>'persona_id')::uuid for update;
  if coalesce(pd.revision,0)<>p_revision_docente or coalesce(pe.revision,0)<>p_revision_empleado then raise exception 'El expediente cambió. Repite la revisión' using errcode='40001'; end if;
  if pd.id is not null and pe.id is not null and pd.id<>pe.id then raise exception 'Ambos registros ya tienen expedientes distintos. Requieren revisión individual; no se fusionaron'; end if;
  destino=coalesce(pd.id,pe.id);
  if exists(select 1 from public.docentes where persona_id=destino and id<>p_docente) or exists(select 1 from public.empleados where persona_id=destino and id<>p_empleado) then raise exception 'La persona ya está relacionada con otro registro del directorio'; end if;
  -- La revisión muestra que los nombres estructurados de RH se conservarán. Los vacíos no borran datos conocidos.
  v_datos=coalesce(pe.datos,pd.datos,'{}'::jsonb)||coalesce((select jsonb_object_agg(key,value) from jsonb_each(e->'datos') where value<>'null'::jsonb and trim(value#>>'{}')<>''),'{}'::jsonb);
  if nullif(v_datos->>'email','') is null then v_datos=v_datos||jsonb_build_object('email',d->'datos'->>'email'); end if;
  perform set_config('app.personal_operacion','v1',true);
  if destino is null then insert into public.personal_personas(datos) values(v_datos) returning id into destino;
  else update public.personal_personas set datos=v_datos,revision=revision+1,actualizado_en=now() where id=destino; end if;
  update public.docentes set persona_id=destino,nombre_completo=v_datos->>'nombre_completo',rfc=v_datos->>'rfc',curp=v_datos->>'curp',email=v_datos->>'email' where id=p_docente;
  update public.empleados set persona_id=destino where id=p_empleado;
  insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol) values(destino,'relacion',p_motivo,jsonb_build_object('docente',p_docente,'empleado',p_empleado),jsonb_build_object('persona_id',destino),auth.uid(),rol);
end $$;

create function public.personal_directorio_docente_v1(p_busqueda text default '',p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); n integer; filas jsonb;
begin
  if rol not in ('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS') then raise exception 'Sin acceso al directorio de personal' using errcode='42501'; end if;
  if p_offset<0 then raise exception 'Página no válida'; end if;
  select count(*) into n from public.docentes where concat_ws(' ',nombre_completo,clave_legado) ilike '%'||coalesce(p_busqueda,'')||'%';
  select jsonb_agg(to_jsonb(t)) into filas from (select id,clave_legado,nombre_completo,rfc,curp,email,estatus,persona_id from public.docentes where concat_ws(' ',nombre_completo,clave_legado) ilike '%'||coalesce(p_busqueda,'')||'%' order by nombre_completo,id offset p_offset limit 15) t;
  return jsonb_build_object('filas',coalesce(filas,'[]'::jsonb),'total',n);
end $$;

revoke all on function public._personal_rol_v1(),public._personal_fuente_v1(text,uuid,boolean),public._personal_proteger_enlace_v1(),public._personal_reflejar_v1(),public._personal_compatibilidad_v1() from public,anon,authenticated;
revoke all on function public.personal_consultar_v1(text,uuid),public.personal_guardar_v1(text,uuid,integer,jsonb,text,jsonb,text),public.personal_candidatos_v1(uuid,text),public.personal_vincular_v1(uuid,uuid,integer,integer,jsonb,jsonb,text),public.personal_directorio_docente_v1(text,integer) from public,anon;
grant execute on function public.personal_consultar_v1(text,uuid),public.personal_guardar_v1(text,uuid,integer,jsonb,text,jsonb,text),public.personal_candidatos_v1(uuid,text),public.personal_vincular_v1(uuid,uuid,integer,integer,jsonb,jsonb,text),public.personal_directorio_docente_v1(text,integer) to authenticated;
commit;
