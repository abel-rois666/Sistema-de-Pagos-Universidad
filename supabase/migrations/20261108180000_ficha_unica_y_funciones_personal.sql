-- PREPARADA, NO EJECUTADA. Requiere las migraciones de Personal 120000 y 150000.
-- No hace backfill, fusiona identidades, crea usuarios ni cambia relaciones operativas.
begin;
create function public.personal_consultar_v3(p_tipo text,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); r jsonb; e public.empleados; d public.docentes;
begin
 r=public.personal_consultar_v2(p_tipo,p_id);
 select * into e from public.empleados where (p_tipo='EMPLEADO' and id=p_id) or (persona_id is not null and persona_id=(r->>'persona_id')::uuid) limit 1;
 select * into d from public.docentes where (p_tipo='DOCENTE' and id=p_id) or (persona_id is not null and persona_id=(r->>'persona_id')::uuid) limit 1;
 return r||jsonb_build_object('funciones_disponibles',true,'empleado_id',e.id,'docente_id',d.id,
 'referencia_docente',case when d.id is not null then jsonb_build_object('id',d.id,'clave_legado',d.clave_legado,'estatus',d.estatus) else null end,
 'referencia_institucional',case when e.id is not null and rol in ('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS') then
 jsonb_build_object('estatus',e.estatus,'puesto',e.puesto,'clave_puesto',e.clave_puesto,'departamento',e.departamento,
 'firmante_certificados',coalesce(e.firmante_certificados,false),'firmante_titulos',coalesce(e.firmante_titulos,false),'firmante_boletas',coalesce(e.firmante_boletas,false),'titulo_academico',e.titulo_academico,'firma_url',e.firma_url) else null end);
end $$;

create function public.personal_buscar_personas_v1(p_busqueda text,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); filas jsonb; n integer;
begin
 if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración gestiona las funciones de una persona' using errcode='42501';end if;
 if length(trim(coalesce(p_busqueda,'')))<3 then return jsonb_build_object('filas','[]'::jsonb,'total',0);end if;
 if length(p_busqueda)>150 or p_offset<0 then raise exception 'Consulta no válida';end if;
 with fuentes as (
 select 'EMPLEADO'::text tipo,e.id,e.persona_id,coalesce(p.datos->>'nombre_completo',concat_ws(' ',e.apellido_paterno,e.apellido_materno,e.nombres)) nombre,
 e.id empleado_id,d.id docente_id,d.clave_legado from public.empleados e left join public.personal_personas p on p.id=e.persona_id left join public.docentes d on d.persona_id=e.persona_id
 union all select 'DOCENTE',d.id,d.persona_id,coalesce(p.datos->>'nombre_completo',d.nombre_completo),null::uuid,d.id,d.clave_legado
 from public.docentes d left join public.personal_personas p on p.id=d.persona_id where not exists(select 1 from public.empleados e where e.persona_id=d.persona_id)
 ) select count(*) into n from fuentes where concat_ws(' ',nombre,clave_legado) ilike '%'||trim(p_busqueda)||'%';
 with fuentes as (
 select 'EMPLEADO'::text tipo,e.id,e.persona_id,coalesce(p.datos->>'nombre_completo',concat_ws(' ',e.apellido_paterno,e.apellido_materno,e.nombres)) nombre,
 e.id empleado_id,d.id docente_id,d.clave_legado from public.empleados e left join public.personal_personas p on p.id=e.persona_id left join public.docentes d on d.persona_id=e.persona_id
 union all select 'DOCENTE',d.id,d.persona_id,coalesce(p.datos->>'nombre_completo',d.nombre_completo),null::uuid,d.id,d.clave_legado
 from public.docentes d left join public.personal_personas p on p.id=d.persona_id where not exists(select 1 from public.empleados e where e.persona_id=d.persona_id)
 ) select coalesce(jsonb_agg(jsonb_build_object('origen',jsonb_build_object('tipo',t.tipo,'id',t.id),'nombre',t.nombre,'persona_id',t.persona_id,
 'empleado_id',t.empleado_id,'docente_id',t.docente_id,'clave_docente',t.clave_legado) order by t.nombre,t.tipo,t.id),'[]'::jsonb) into filas from
 (select * from fuentes where concat_ws(' ',nombre,clave_legado) ilike '%'||trim(p_busqueda)||'%' order by nombre,tipo,id offset p_offset limit 10)t;
 return jsonb_build_object('filas',filas,'total',n);
end $$;

create function public.personal_anadir_funcion_v1(p_tipo text,p_id uuid,p_destino text,p_nuevo_id uuid,p_revision integer,p_original jsonb,p_datos jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1();f jsonb;p public.personal_personas;d jsonb;existente uuid;
begin
 if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración añade funciones' using errcode='42501';end if;
 if p_tipo not in ('EMPLEADO','DOCENTE') or p_destino not in ('EMPLEADO','DOCENTE') or p_nuevo_id is null or p_revision is null or p_revision<0 then raise exception 'Función o revisión no válida';end if;
 if length(trim(coalesce(p_motivo,'')))<10 then raise exception 'Describe el respaldo de identidad y la función que añades';end if;
 if jsonb_typeof(p_datos) is distinct from 'object' or pg_column_size(p_datos)>4096 then raise exception 'Datos de función no válidos';end if;
 f=public._personal_fuente_v1(p_tipo,p_id,true);
 if f->'registro'='null'::jsonb then raise exception 'Primero registra a la persona';end if;
 select * into p from public.personal_personas where id=(f->>'persona_id')::uuid for update;
 if p_destino='DOCENTE' then select id into existente from public.docentes where persona_id=p.id;
 else select id into existente from public.empleados where persona_id=p.id;end if;
 -- Reintento del mismo ID tras pérdida de respuesta: no crea otra función ni repite la auditoría.
 if existente=p_nuevo_id then return jsonb_build_object('id',existente,'persona_id',p.id,'ya_registrada',true);end if;
 if existente is not null or p_tipo=p_destino then raise exception 'Esta persona ya tiene esa función. Abre su sección existente';end if;
 if f->'original' is distinct from p_original or coalesce(p.revision,0)<>p_revision then raise exception 'El expediente cambió. Recarga y revisa antes de añadir la función' using errcode='40001';end if;
 d=coalesce(p.datos,f->'datos');
 if nullif(trim(d->>'nombre_completo'),'') is null then raise exception 'Revisa la identidad de la persona';end if;
 if p_destino='EMPLEADO' and (nullif(trim(d->>'nombres'),'') is null or nullif(trim(d->>'apellido_paterno'),'') is null) then raise exception 'Completa y confirma primero nombres y apellidos en Datos generales';end if;
 if coalesce(p_datos->>'estatus','') not in ('activo','inactivo') then raise exception 'Elige la situación de la función';end if;
 if p_destino='DOCENTE' and (nullif(trim(p_datos->>'clave_legado'),'') is null or length(p_datos->>'clave_legado')>80 or coalesce(p_datos->>'estatus','') not in ('activo','inactivo')) then raise exception 'Revisa clave y habilitación docente';end if;
 perform set_config('app.personal_operacion','v1',true);
 if p.id is null then
 insert into public.personal_personas(datos) values(d) returning * into p;
 if p_tipo='DOCENTE' then update public.docentes set persona_id=p.id where id=p_id;else update public.empleados set persona_id=p.id where id=p_id;end if;
 end if;
 if p_destino='DOCENTE' then
 insert into public.docentes(id,persona_id,clave_legado,nombre_completo,rfc,curp,email,estatus) values
 (p_nuevo_id,p.id,trim(p_datos->>'clave_legado'),d->>'nombre_completo',d->>'rfc',d->>'curp',d->>'email',p_datos->>'estatus');
 else
 -- Ningún contrato, fecha, firma, autorización o cuenta se inventa al añadir la función administrativa.
 insert into public.empleados(id,persona_id,nombres,apellido_paterno,apellido_materno,rfc,curp,fecha_nacimiento,sexo,estado_civil,direccion,telefono,estatus,firmante_certificados,firmante_titulos,firmante_boletas)
 values(p_nuevo_id,p.id,d->>'nombres',d->>'apellido_paterno',d->>'apellido_materno',d->>'rfc',d->>'curp',nullif(d->>'fecha_nacimiento','')::date,d->>'sexo',d->>'estado_civil',d->>'direccion',d->>'telefono',p_datos->>'estatus',false,false,false);
 end if;
 update public.personal_personas set revision=revision+1,actualizado_en=now() where id=p.id;
 insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol) values
 (p.id,'funciones',trim(p_motivo),jsonb_build_object('origen',p_tipo,'id',p_id),jsonb_build_object('funcion',p_destino,'id',p_nuevo_id),auth.uid(),rol);
 return jsonb_build_object('id',p_nuevo_id,'persona_id',p.id,'ya_registrada',false);
end $$;

create function public.personal_docencia_guardar_v1(p_tipo text,p_id uuid,p_revision integer,p_original jsonb,p_estatus text,p_motivo text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1();r jsonb;d public.docentes;p public.personal_personas;
begin
 if rol not in ('ADMINISTRADOR','COORDINADOR ACADEMICO') then raise exception 'Sin permiso para editar docencia' using errcode='42501';end if;
 r=public.personal_consultar_v3(p_tipo,p_id);
 select * into d from public.docentes where id=(r->>'docente_id')::uuid for update;
 if d.id is null then raise exception 'La persona no tiene función docente';end if;
 select * into p from public.personal_personas where id=d.persona_id for update;
 if p.id is null then raise exception 'Guarda primero los datos generales de la ficha';end if;
 if p_revision is null or p.revision<>p_revision or jsonb_build_object('id',d.id,'clave_legado',d.clave_legado,'estatus',d.estatus) is distinct from p_original then raise exception 'La función docente cambió. Recarga la ficha' using errcode='40001';end if;
 if p_estatus not in ('activo','inactivo') or p_estatus is null or length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Revisa habilitación y motivo';end if;
 update public.docentes set estatus=p_estatus where id=d.id;
 update public.personal_personas set revision=revision+1,actualizado_en=now() where id=p.id;
 insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol) values(p.id,'docencia',p_motivo,jsonb_build_object('estatus',d.estatus),jsonb_build_object('estatus',p_estatus),auth.uid(),rol);
end $$;

create function public.personal_institucional_guardar_v1(p_tipo text,p_id uuid,p_revision integer,p_original jsonb,p_datos jsonb,p_motivo text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1();r jsonb;e public.empleados;p public.personal_personas;k integer;cert boolean;tit boolean;bol boolean;nombre_puesto text;firma text;
begin
 if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración modifica la configuración institucional' using errcode='42501';end if;
 if jsonb_typeof(p_datos) is distinct from 'object' or pg_column_size(p_datos)>1048576 or length(trim(coalesce(p_motivo,'')))<5 then raise exception 'Revisa configuración y motivo';end if;
 -- Serializa los cupos de firmantes dentro del flujo nuevo.
 perform pg_advisory_xact_lock(hashtextextended('personal.firmantes.institucional',0));
 r=public.personal_consultar_v3(p_tipo,p_id);
 select * into e from public.empleados where id=(r->>'empleado_id')::uuid for update;
 if e.id is null then raise exception 'La persona no tiene función administrativa';end if;
 select * into p from public.personal_personas where id=e.persona_id for update;
 if p.id is null then raise exception 'Guarda primero los datos generales de la ficha';end if;
 r=public.personal_consultar_v3(p_tipo,p_id);
 if p_revision is null or p.revision<>p_revision or r->'referencia_institucional' is distinct from p_original then raise exception 'La configuración cambió. Recarga antes de guardar' using errcode='40001';end if;
 k=nullif(p_datos->>'clave_puesto','')::integer;
 select nombre into nombre_puesto from (values(1,'Director'),(2,'Subdirector'),(3,'Rector'),(4,'Coordinador de Control Escolar'),(5,'Responsable de Expedición'),(6,'Coordinador de Relaciones Públicas'),(7,'Coordinador Financiero'),(8,'Coordinador Académico'),(9,'Intendente'),(10,'Auxiliar Administrativo'),(11,'Coordinador de Recursos Humanos y Materiales'),(12,'Tutoría y Bienestar'),(13,'Portero'))v(clave,nombre) where clave=k;
 if coalesce(p_datos->>'puesto','')<>coalesce(nombre_puesto,'') and (p_datos->>'puesto' is distinct from e.puesto or k is distinct from e.clave_puesto) then raise exception 'El cargo no corresponde a su clave';end if;
 if coalesce(p_datos->>'estatus','') not in ('activo','inactivo') and p_datos->>'estatus' is distinct from e.estatus then raise exception 'Situación administrativa no válida';end if;
 cert=coalesce((p_datos->>'firmante_certificados')::boolean,false);tit=coalesce((p_datos->>'firmante_titulos')::boolean,false);bol=coalesce((p_datos->>'firmante_boletas')::boolean,false);
 if ((cert or tit) and (k is null or k not in (1,2,3,4,5))) or (bol and (k is null or k not in (1,2,3,4,5,8))) then raise exception 'El cargo no admite las autorizaciones de firma seleccionadas';end if;
 if cert and exists(select 1 from public.empleados where id<>e.id and firmante_certificados) then raise exception 'Ya existe un firmante de certificados';end if;
 if tit and (select count(*) from public.empleados where id<>e.id and firmante_titulos)>=2 then raise exception 'Ya existen dos firmantes de títulos';end if;
 firma=nullif(p_datos->>'firma_url','');
 if firma is not null and firma is distinct from e.firma_url and firma !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' then raise exception 'La firma nueva debe ser una imagen PNG, JPEG o WebP';end if;
 if firma is distinct from e.firma_url and length(coalesce(firma,''))>700000 then raise exception 'La firma excede 500 KB';end if;
 if length(coalesce(p_datos->>'departamento',''))>200 or length(coalesce(p_datos->>'titulo_academico',''))>80 then raise exception 'Área o abreviatura demasiado extensa';end if;
 update public.empleados set puesto=nullif(p_datos->>'puesto',''),clave_puesto=k,departamento=nullif(p_datos->>'departamento',''),estatus=coalesce(nullif(p_datos->>'estatus',''),e.estatus),firmante_certificados=cert,firmante_titulos=tit,firmante_boletas=bol,titulo_academico=nullif(p_datos->>'titulo_academico',''),firma_url=firma where id=e.id;
 update public.personal_personas set revision=revision+1,actualizado_en=now() where id=p.id;
 insert into public.personal_auditoria(persona_id,seccion,motivo,antes,despues,creado_por,rol) values(p.id,'institucional',p_motivo,r->'referencia_institucional',p_datos,auth.uid(),rol);
end $$;

revoke all on function public.personal_consultar_v3(text,uuid),public.personal_buscar_personas_v1(text,integer),public.personal_anadir_funcion_v1(text,uuid,text,uuid,integer,jsonb,jsonb,text),public.personal_docencia_guardar_v1(text,uuid,integer,jsonb,text,text),public.personal_institucional_guardar_v1(text,uuid,integer,jsonb,jsonb,text) from public,anon;
grant execute on function public.personal_consultar_v3(text,uuid),public.personal_buscar_personas_v1(text,integer),public.personal_anadir_funcion_v1(text,uuid,text,uuid,integer,jsonb,jsonb,text),public.personal_docencia_guardar_v1(text,uuid,integer,jsonb,text,text),public.personal_institucional_guardar_v1(text,uuid,integer,jsonb,jsonb,text) to authenticated;
commit;
