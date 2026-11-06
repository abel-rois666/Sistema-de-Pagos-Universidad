-- Preparación aditiva. NO ejecutada por el agente. Preflight: checks/preflight_estadistica911.sql
-- No altera tablas, triggers, recibos, promociones ni preferencias operativas.
begin;
create table public.s911_expedientes (
 id uuid primary key default gen_random_uuid(), nombre text not null,
 estado text not null default 'BORRADOR' check(estado in('BORRADOR','EN_REVISION','CERRADO')),
 revision integer not null default 1, version integer not null default 1,
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 creado_por uuid not null default auth.uid(), creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create table public.s911_versiones (
 id uuid primary key default gen_random_uuid(), expediente_id uuid not null references public.s911_expedientes(id),
 numero integer not null, payload jsonb not null, sha256 text not null,
 cerrado_por uuid not null, cerrado_en timestamptz not null default now(), unique(expediente_id,numero)
);
create table public.s911_respaldos (
 expediente_id uuid not null references public.s911_expedientes(id), version integer not null,
 contenido jsonb not null check(jsonb_typeof(contenido)='array'), primary key(expediente_id,version)
);
create table public.s911_inscripciones (
 id uuid primary key default gen_random_uuid(), alumno_programa_id uuid not null references public.alumno_programas(id),
 ciclo_id uuid not null references public.ciclos_escolares(id), desde date not null, hasta date,
 tipo_ingreso text not null check(tipo_ingreso in('PRIMER_INGRESO','REINGRESO','DESCONOCIDO')),
 fecha_primer_ingreso date, grado_personal text not null, anio_avance_911 smallint check(anio_avance_911 between 1 and 6),situacion text not null,
 confirmado boolean not null default false, evidencia text not null default '',
 actualizado_por uuid not null default auth.uid(), actualizado_en timestamptz not null default now(),
 unique(alumno_programa_id,ciclo_id), check(hasta is null or desde<=hasta),
 check(fecha_primer_ingreso is null or fecha_primer_ingreso<=desde),
 check(not confirmado or length(trim(evidencia))>0),
 check(tipo_ingreso<>'PRIMER_INGRESO' or fecha_primer_ingreso is not null)
);
create table public.s911_eventos (
 id uuid primary key default gen_random_uuid(), alumno_programa_id uuid not null references public.alumno_programas(id),
 tipo text not null check(tipo in('EGRESO','TITULACION')), fecha date not null,
 confirmado boolean not null default false, evidencia text not null,
 creado_por uuid not null default auth.uid(), creado_en timestamptz not null default now(),
 unique(alumno_programa_id,tipo),check(length(trim(evidencia))>0)
);
create table public.s911_complementos (
 id uuid primary key default gen_random_uuid(), tipo text not null check(tipo in('ALUMNO','PERSONAL','INSTITUCION','PLANTEL')),
 referencia_id text not null, desde date not null, hasta date, datos jsonb not null check(jsonb_typeof(datos)='object'),
 evidencia text not null check(length(trim(evidencia))>0), creado_por uuid not null default auth.uid(),
 unique(tipo,referencia_id,desde),check(hasta is null or desde<=hasta)
);
create table public.s911_auditoria (
 id bigint generated always as identity primary key, expediente_id uuid references public.s911_expedientes(id),
 accion text not null, motivo text not null default '', usuario uuid not null default auth.uid(), fecha timestamptz not null default now(), datos jsonb
);
create table public.s911_exportaciones (
 id uuid primary key default gen_random_uuid(), expediente_id uuid not null references public.s911_expedientes(id),
 version integer not null, formato text not null check(formato in('TXT','PDF','XLSX','ZIP')),
 archivo text not null, huella text not null, usuario uuid not null default auth.uid(), fecha timestamptz not null default now()
);
create table public.s911_campos (
 catalogo_sha256 text not null,cuestionario text not null, codigo text not null, definicion jsonb not null, primary key(catalogo_sha256,cuestionario,codigo)
);
create table public.s911_catalogos (
 edicion text not null,sha256 text not null unique,fuentes jsonb not null,reglas jsonb not null,primary key(edicion,sha256)
);

create function public.s911_autorizado(p_academico boolean default false) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(public.get_my_rol()=any(case when p_academico then array['ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR']
 else array['ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO','COORDINADOR RECURSOS HUMANOS','COORDINADOR FINANCIERO'] end),false)
 and auth.uid() is not null;
$$;
do $$ declare t text; begin
 foreach t in array array['s911_expedientes','s911_versiones','s911_respaldos','s911_inscripciones','s911_eventos','s911_complementos','s911_auditoria','s911_exportaciones','s911_campos','s911_catalogos'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy lectura on public.%I for select to authenticated using(public.s911_autorizado(%L))',t,t in('s911_respaldos','s911_inscripciones','s911_eventos'));
 end loop;
end $$;
drop policy lectura on public.s911_complementos;
create policy lectura on public.s911_complementos for select to authenticated using(
 (tipo='ALUMNO' and public.s911_autorizado(true)) or (tipo='PERSONAL' and public.get_my_rol() in('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS')) or (tipo in('INSTITUCION','PLANTEL') and public.s911_autorizado()));

create function public.s911_guardar(p_id uuid, p_revision integer, p_payload jsonb, p_respaldos jsonb default '[]')
returns public.s911_expedientes language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.s911_expedientes; rol text=public.get_my_rol(); i jsonb; anterior jsonb; q text; permitido boolean; catalogo public.s911_catalogos; total integer;rev record;
begin
 if not public.s911_autorizado() then raise exception 'Sin permiso para Estadística 911'; end if;
 if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'instancias')<>'array' then raise exception 'Expediente inválido';end if;
 if p_payload#>>'{config,edicion}' is distinct from '2026-2027' or p_payload#>>'{config,plantel}' is distinct from '09PSU0509Q' or p_payload#>>'{config,institucion}' is distinct from '09MSU0509T' then raise exception 'Edición o claves fuera del piloto homologado';end if;
 select * into catalogo from public.s911_catalogos where edicion='2026-2027' and sha256=p_payload->>'catalogoHash';
 if not found or p_payload->>'catalogoHash' is distinct from catalogo.sha256 then raise exception 'Catálogo oficial no instalado o huella distinta';end if;
 if pg_column_size(p_payload)>20971520 or pg_column_size(p_respaldos)>52428800 then raise exception 'Expediente demasiado grande';end if;
 if jsonb_array_length(p_payload->'instancias')<>16 then raise exception 'Se esperan las 16 instancias del piloto';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_payload->'instancias'))<>16 then raise exception 'Instancias duplicadas';end if;
 for i in select value from jsonb_array_elements(p_payload->'instancias') loop
  q=i->>'cuestionario';
  if q is null or not catalogo.fuentes?q or i->>'id' !~ ('^'||q||'-[1-9][0-9]*$') then raise exception 'Cuestionario no homologado';end if;
  if q in('carrera','posgrado','escuela','institucion') then
   if (catalogo.fuentes#>array[q,'layout','identidades',((split_part(i->>'id','-',2)::integer)-1)::text]) is distinct from i->'identidad' then raise exception 'Identidad oficial distinta de la descarga';end if;
  elsif i->>'id'<>q||'-1' or i->'identidad' is distinct from jsonb_build_object('CV_CCT','09PSU0509Q','CV_TURNO','4') then raise exception 'Identidad de anexo inválida';end if;
  if jsonb_typeof(i->'respuestas')<>'object' or jsonb_typeof(i->'bloques')<>'object' then raise exception 'Estructura de respuestas inválida';end if;
 end loop;
 if p_id is null then
  if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración configura expedientes';end if;
  insert into public.s911_expedientes(nombre,payload) values(coalesce(p_payload->>'nombre','Levantamiento 2026-2027'),p_payload) returning * into e;
 else
  select * into e from public.s911_expedientes where id=p_id for update;
  if not found then raise exception 'Expediente inexistente';end if;
  if e.estado<>'BORRADOR' then raise exception 'El expediente no está en borrador';end if;
  if e.revision<>p_revision then raise exception 'Otro usuario modificó el expediente. Recarga antes de guardar';end if;
  if rol<>'ADMINISTRADOR' and ((p_payload->'config')-'coberturas') is distinct from ((e.payload->'config')-'coberturas') then raise exception 'Configuración restringida a Administración';end if;
  if rol<>'ADMINISTRADOR' and exists(select 1 from jsonb_array_elements(p_payload->'instancias') n join jsonb_array_elements(e.payload->'instancias') a on n->>'id'=a->>'id' where n->'correspondencia' is distinct from a->'correspondencia') then raise exception 'Correspondencias restringidas a Administración';end if;
  if rol<>'ADMINISTRADOR' then
   for rev in select key,value from jsonb_each_text(coalesce(p_payload->'revisiones','{}')) loop
    if nullif(trim(rev.value),'') is not null and rev.value is distinct from e.payload#>>array['revisiones',rev.key] then
     permitido=(rol='COORDINADOR CONTROL ESCOLAR' and rev.key in('carrera','posgrado')) or (rol='COORDINADOR RECURSOS HUMANOS' and rev.key='escuela') or (rol='COORDINADOR FINANCIERO' and rev.key='institucion') or (rol='COORDINADOR ACADEMICO' and rev.key in('carrera','posgrado','tecnologia','infraestructura'));
     if not permitido then raise exception 'No puedes aprobar la revisión de esta sección';end if;
    end if;
   end loop;
  end if;
  if not public.s911_autorizado(true) then
   if (p_payload-'instancias'-'revisiones') is distinct from (e.payload-'instancias'-'revisiones') then raise exception 'Cambio fuera de la sección autorizada';end if;
   if jsonb_array_length(p_payload->'instancias')<>jsonb_array_length(e.payload->'instancias') then raise exception 'No se permite cambiar instancias';end if;
   for i in select value from jsonb_array_elements(p_payload->'instancias') loop
    select value into anterior from jsonb_array_elements(e.payload->'instancias') where value->>'id'=i->>'id';
    q=i->>'cuestionario';permitido=(rol='COORDINADOR RECURSOS HUMANOS' and q='escuela') or (rol='COORDINADOR FINANCIERO' and q='institucion') or (rol='COORDINADOR ACADEMICO' and q in('carrera','posgrado','tecnologia','infraestructura'));
    if anterior is null or (not permitido and i is distinct from anterior) or (i-'respuestas'-'bloques') is distinct from (anterior-'respuestas'-'bloques') then raise exception 'Cambio fuera de la sección autorizada';end if;
   end loop;
  end if;
  update public.s911_expedientes set nombre=p_payload->>'nombre',payload=p_payload,revision=revision+1,actualizado_en=now() where id=p_id returning * into e;
 end if;
 if public.s911_autorizado(true) then
  if jsonb_typeof(p_respaldos)<>'array' then raise exception 'Respaldo inválido';end if;
  if exists(select 1 from jsonb_array_elements(p_respaldos) r cross join lateral jsonb_array_elements(r->'incluidos') p
   where not exists(select 1 from public.s911_inscripciones si join public.alumno_programas ap on ap.id=si.alumno_programa_id where si.id::text=p->>'id' and si.confirmado and ap.id::text=p->>'programa_id' and ap.alumno_id::text=p->>'alumno_id')
   and not exists(select 1 from public.s911_eventos se join public.alumno_programas ap on ap.id=se.alumno_programa_id where se.id::text=p->>'id' and se.confirmado and ap.id::text=p->>'programa_id' and ap.alumno_id::text=p->>'alumno_id')) then raise exception 'El respaldo incluye personas sin inscripción o evento confirmado';end if;
  insert into public.s911_respaldos(expediente_id,version,contenido) values(e.id,e.version,p_respaldos)
  on conflict(expediente_id,version) do update set contenido=excluded.contenido;
 end if;
 insert into public.s911_auditoria(expediente_id,accion) values(e.id,'GUARDAR');return e;
end $$;

-- Intérprete de árboles de operaciones homologados. No usa EXECUTE ni SQL del archivo oficial.
create function public.s911_evaluar_ast(p_ast jsonb,p_valores jsonb,p_nivel integer default 0) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare op text=p_ast->>'op';a jsonb;b jsonb;x numeric;y numeric;an text;bn text;
begin
 if p_ast is null or jsonb_typeof(p_ast)<>'object' or op is null or p_nivel>80 then return null;end if;
 if op='valor' then return nullif(p_ast->'v','null'::jsonb);elsif op='ref' then return nullif(p_valores->(p_ast->>'v'),'null'::jsonb);end if;
 a=public.s911_evaluar_ast(p_ast->'a',p_valores,p_nivel+1);b=public.s911_evaluar_ast(p_ast->'b',p_valores,p_nivel+1);
 an=a#>>'{}';bn=b#>>'{}';
 if op='AND' then return to_jsonb(an::boolean and bn::boolean);elsif op='OR' then return to_jsonb(an::boolean or bn::boolean);end if;
 if a is null then return null;end if;
 if op='len' then return to_jsonb(length(an));elsif op='neg' then return to_jsonb(-an::numeric);end if;
 if b is null then return null;end if;
 if op in('+','-','*','/') then
  x=an::numeric;y=bn::numeric;
  return to_jsonb(case op when '+' then x+y when '-' then x-y when '*' then x*y when '/' then x/nullif(y,0) end);
 end if;
 if an~'^-?[0-9]+(\.[0-9]+)?$' and bn~'^-?[0-9]+(\.[0-9]+)?$' then
  x=an::numeric;y=bn::numeric;
  return to_jsonb(case op when '=' then x=y when '<>' then x<>y when '!=' then x<>y when '>' then x>y when '<' then x<y when '>=' then x>=y when '<=' then x<=y end);
 end if;
 return to_jsonb(case op when '=' then an=bn when '<>' then an<>bn when '!=' then an<>bn when '>' then an>bn when '<' then an<bn when '>=' then an>=bn when '<=' then an<=bn end);
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end $$;

create function public.s911_transicion(p_id uuid,p_revision integer,p_accion text,p_motivo text)
returns public.s911_expedientes language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.s911_expedientes; i jsonb;c record;r jsonb; v text; faltas integer=0;regla jsonb;valores jsonb;veredicto jsonb;excepcion jsonb;clave text;snapshot jsonb;
begin
 if not public.s911_autorizado(true) then raise exception 'Sin permiso para cambiar el estado';end if;
 select * into e from public.s911_expedientes where id=p_id for update;
 if not found or e.revision<>p_revision then raise exception 'Expediente inexistente o revisión desactualizada';end if;
 if length(trim(p_motivo))<5 then raise exception 'Registra un motivo de al menos cinco caracteres';end if;
 if p_accion='REVISAR' and e.estado='BORRADOR' then e.estado='EN_REVISION';
 elsif p_accion='DEVOLVER' and e.estado='EN_REVISION' then e.estado='BORRADOR';
 elsif p_accion='CERRAR' and e.estado='EN_REVISION' then
  if public.get_my_rol()<>'ADMINISTRADOR' then raise exception 'Solo Administración cierra expedientes';end if;
  if not coalesce((e.payload#>>'{config,controlConfirmado}')::boolean,false) or nullif(e.payload#>>'{config,edadReferencia}','') is null or nullif(e.payload#>>'{config,responsable}','') is null then raise exception 'Configuración y responsable pendientes';end if;
  if (e.payload#>>'{config,corte}')::date is distinct from date '2026-09-30' or (e.payload#>>'{config,fiscal}')::integer is distinct from 2025 then raise exception 'Corte o ejercicio fiscal distintos del formato 2026-2027';end if;
  if nullif(e.payload#>>'{config,actualInicio}','') is null or nullif(e.payload#>>'{config,anteriorInicio}','') is null or nullif(e.payload#>>'{config,anteriorFin}','') is null then raise exception 'Periodos de referencia incompletos';end if;
  if (e.payload#>>'{config,actualInicio}')::date>(e.payload#>>'{config,corte}')::date or (e.payload#>>'{config,anteriorInicio}')::date>(e.payload#>>'{config,anteriorFin}')::date then raise exception 'Fechas de referencia invertidas';end if;
  if not exists(select 1 from public.s911_campos where catalogo_sha256=e.payload->>'catalogoHash') then raise exception 'Instala primero el catálogo oficial versionado';end if;
  if exists(select 1 from jsonb_array_elements(e.payload->'instancias') i cross join lateral jsonb_array_elements_text(i#>'{correspondencia,planes}') p
   where i->>'cuestionario' in('carrera','posgrado') group by p having count(distinct i->>'id')>1) then raise exception 'Un plan interno corresponde a varias instancias oficiales';end if;
  for i in select value from jsonb_array_elements(e.payload->'instancias') loop
   if i->>'cuestionario' in('carrera','posgrado') and (i#>>'{correspondencia,confirmada}') is distinct from 'true' then raise exception 'Correspondencia sin confirmar %',i->>'id';end if;
   if nullif(e.payload#>>array['revisiones',i->>'cuestionario'],'') is null then raise exception 'Falta revisión de sección %',i->>'cuestionario';end if;
   for c in select codigo,definicion from public.s911_campos where catalogo_sha256=e.payload->>'catalogoHash' and cuestionario=i->>'cuestionario' and codigo~'^[VE][0-9]+$' loop
    r=i#>array['respuestas',c.codigo];v=coalesce(r->>'declarado',r->>'calculado');
    if v is null or not coalesce((r->>'revisada')::boolean,false) then faltas=faltas+1;end if;
    if r?'declarado' and (nullif(trim(r->>'justificacion'),'') is null or nullif(trim(r->>'evidencia'),'') is null) then raise exception 'Ajuste sin justificación/evidencia %',c.codigo;end if;
    if c.definicion->>'tipo'~'INT' and v is not null and v!~'^\d+$' then raise exception 'Entero inválido %',c.codigo;end if;
    if c.definicion->>'tipo'='SMALLINT' and v is not null and v::numeric>32767 then raise exception 'SMALLINT fuera de rango %',c.codigo;end if;
    if c.definicion->>'tipo'~'(DECIMAL|NUMERIC|REAL|FLOAT|DOUBLE)' and v is not null and v!~'^\d+(\.\d+)?$' then raise exception 'Número inválido %',c.codigo;end if;
    if v~'[|\r\n]' then raise exception 'Separador no permitido %',c.codigo;end if;
   end loop;
   select coalesce(jsonb_object_agg(k,case when dato?'declarado' then dato->'declarado' else dato->'calculado' end),'{}') into valores from jsonb_each(i->'respuestas') t(k,dato);
   valores=valores||(i->'identidad');
   for regla in select value from public.s911_catalogos cat cross join lateral jsonb_array_elements(cat.reglas) where cat.edicion='2026-2027' and cat.sha256=e.payload->>'catalogoHash' and value->>'cuestionario'=i->>'cuestionario' loop
    veredicto=public.s911_evaluar_ast(regla->'ast',valores);
    if veredicto is distinct from 'true'::jsonb then
     clave=(i->>'id')||':R'||(regla->>'linea');excepcion=e.payload#>array['excepciones',clave];
     if coalesce(length(trim(excepcion->>'justificacion')),0)<20 or coalesce(length(trim(excepcion->>'evidencia')),0)<5 then raise exception 'Regla % incumplida, incompleta o no homologada; corrige o documenta su excepción',clave;end if;
    end if;
   end loop;
  end loop;
  if faltas>0 then raise exception 'Hay % respuestas pendientes o sin revisión',faltas;end if;
  snapshot=e.payload||jsonb_build_object('id',e.id,'revision',e.revision+1,'version',e.version,'estado','CERRADO');
  insert into public.s911_versiones(expediente_id,numero,payload,sha256,cerrado_por)
   values(e.id,e.version,snapshot,encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'),auth.uid());
  e.estado='CERRADO';
 elsif p_accion='REABRIR' and e.estado='CERRADO' then
  if public.get_my_rol()<>'ADMINISTRADOR' then raise exception 'Solo Administración reabre';end if;
  insert into public.s911_respaldos(expediente_id,version,contenido) select expediente_id,e.version+1,contenido from public.s911_respaldos where expediente_id=e.id and version=e.version;
  e.version=e.version+1;e.estado='BORRADOR';e.payload=jsonb_set(e.payload,'{revisiones}','{}');
 else raise exception 'Transición no permitida';end if;
 update public.s911_expedientes set estado=e.estado,version=e.version,payload=e.payload,revision=revision+1,actualizado_en=now() where id=e.id returning * into e;
 insert into public.s911_auditoria(expediente_id,accion,motivo,datos) values(e.id,p_accion,p_motivo,jsonb_build_object('version',e.version));return e;
end $$;

create function public.s911_guardar_fuente(p_tabla text,p_fila jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare resultado uuid;
begin
 if not public.s911_autorizado(true) and not(p_tabla='complementos' and p_fila->>'tipo'='PERSONAL' and public.get_my_rol()='COORDINADOR RECURSOS HUMANOS') then raise exception 'Sin permiso para fuentes';end if;
 if p_tabla='complementos' and p_fila->>'tipo'='PERSONAL' and public.get_my_rol() not in('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS') then raise exception 'Datos de personal restringidos a Recursos Humanos';end if;
 if p_tabla='complementos' and p_fila->>'tipo'='PERSONAL' then
  if jsonb_typeof(p_fila#>'{datos,directorios}') is distinct from 'array' or jsonb_array_length(p_fila#>'{datos,directorios}')<1 then raise exception 'Relaciona un registro del directorio laboral';end if;
  if coalesce(p_fila#>>'{datos,funcion_principal}','') not in('DIRECTIVO','DOCENTE','DOCENTE_INVESTIGADOR','INVESTIGADOR','AUXILIAR_INVESTIGADOR','ADMINISTRATIVO','OTRO') or coalesce(p_fila#>>'{datos,sexo}','') not in('H','M') or jsonb_typeof(p_fila#>'{datos,central}') is distinct from 'boolean' then raise exception 'Datos de personal sin confirmar';end if;
 end if;
 if p_tabla='complementos' and p_fila->>'tipo'='ALUMNO' then
  if exists(select 1 from jsonb_object_keys(p_fila->'datos') k where k not in('discapacidad','indigena','pais_nacimiento','entidad_residencia','entidad_nacimiento')) then raise exception 'Característica no homologada';end if;
  if exists(select 1 from jsonb_each(p_fila->'datos') d where d.key in('discapacidad','indigena') and jsonb_typeof(d.value) not in('null','boolean')) then raise exception 'Usa verdadero, falso o desconocido en características';end if;
 end if;
 if p_tabla='inscripciones' then
  insert into public.s911_inscripciones(alumno_programa_id,ciclo_id,desde,hasta,tipo_ingreso,fecha_primer_ingreso,grado_personal,anio_avance_911,situacion,confirmado,evidencia)
  values((p_fila->>'alumno_programa_id')::uuid,(p_fila->>'ciclo_id')::uuid,(p_fila->>'desde')::date,nullif(p_fila->>'hasta','')::date,p_fila->>'tipo_ingreso',nullif(p_fila->>'fecha_primer_ingreso','')::date,p_fila->>'grado_personal',nullif(p_fila->>'anio_avance_911','')::smallint,p_fila->>'situacion',coalesce((p_fila->>'confirmado')::boolean,false),p_fila->>'evidencia')
  on conflict(alumno_programa_id,ciclo_id) do update set desde=excluded.desde,hasta=excluded.hasta,tipo_ingreso=excluded.tipo_ingreso,fecha_primer_ingreso=excluded.fecha_primer_ingreso,grado_personal=excluded.grado_personal,anio_avance_911=excluded.anio_avance_911,situacion=excluded.situacion,confirmado=excluded.confirmado,evidencia=excluded.evidencia,actualizado_por=auth.uid(),actualizado_en=now() returning id into resultado;
 elsif p_tabla='eventos' then
  insert into public.s911_eventos(alumno_programa_id,tipo,fecha,confirmado,evidencia) values((p_fila->>'alumno_programa_id')::uuid,p_fila->>'tipo',(p_fila->>'fecha')::date,coalesce((p_fila->>'confirmado')::boolean,false),p_fila->>'evidencia')
  on conflict(alumno_programa_id,tipo) do update set fecha=excluded.fecha,confirmado=excluded.confirmado,evidencia=excluded.evidencia returning id into resultado;
 elsif p_tabla='complementos' then
  insert into public.s911_complementos(tipo,referencia_id,desde,hasta,datos,evidencia) values(p_fila->>'tipo',p_fila->>'referencia_id',(p_fila->>'desde')::date,nullif(p_fila->>'hasta','')::date,p_fila->'datos',p_fila->>'evidencia')
  on conflict(tipo,referencia_id,desde) do update set hasta=excluded.hasta,datos=excluded.datos,evidencia=excluded.evidencia returning id into resultado;
 else raise exception 'Fuente no admitida';end if;
 insert into public.s911_auditoria(accion,datos) values('FUENTE_'||upper(p_tabla),jsonb_build_object('id',resultado));return resultado;
end $$;

create function public.s911_personal_agregado(p_corte date,p_acreditado boolean) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_datos jsonb; salida jsonb='{}';f text; n integer=0;bloqueado boolean;
begin
 if not public.s911_autorizado() then raise exception 'Sin permiso';end if;
 select coalesce(jsonb_agg(c.datos),'[]') into v_datos from public.s911_complementos c where tipo='PERSONAL' and desde<=p_corte and (hasta is null or hasta>=p_corte);
 bloqueado=p_corte is null or not coalesce(p_acreditado,false) or exists(select 1 from jsonb_array_elements(v_datos) d where d->>'confirmado' is distinct from 'true' or d->>'sexo' is null or d->>'sexo' not in('H','M') or d->>'central' is null or d->>'funcion_principal' is null)
 or exists(select 1 from jsonb_array_elements(v_datos) d cross join lateral jsonb_array_elements_text(d->'directorios') ref group by ref having count(*)>1);
 foreach f in array array['DIRECTIVO','DOCENTE','DOCENTE_INVESTIGADOR','INVESTIGADOR','AUXILIAR_INVESTIGADOR','ADMINISTRATIVO','OTRO'] loop
  salida=salida||jsonb_build_object('V'||(n+1),case when bloqueado then null else (select count(*) from jsonb_array_elements(v_datos) d where d->>'funcion_principal'=f and d->>'central'='false' and d->>'sexo'='H') end,
   'V'||(n+2),case when bloqueado then null else (select count(*) from jsonb_array_elements(v_datos) d where d->>'funcion_principal'=f and d->>'central'='false' and d->>'sexo'='M') end,
   'V'||(n+3),case when bloqueado then null else (select count(*) from jsonb_array_elements(v_datos) d where d->>'funcion_principal'=f and d->>'central'='false') end);
  n=n+5;
 end loop;
 return jsonb_build_object('respuestas',salida,'incidencias',case when bloqueado then jsonb_build_array('Personal: falta acreditar cobertura, confirmar identidad/sexo o resolver duplicidades') else '[]'::jsonb end);
end $$;

create function public.s911_propuestas_inscripcion(p_ciclo uuid) returns table(alumno_programa_id uuid,alumno_id uuid,matricula text,nombre text,plan_id uuid,programa text,grado text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.s911_autorizado(true) then raise exception 'Sin permiso';end if;
 return query with candidatos as (
  select ag.alumno_id,g.plan_id from public.alumnos_grupos ag join public.grupos g on g.id=ag.grupo_id where g.ciclo_id=p_ciclo
  union select ia.alumno_id,a.plan_id from public.inscripciones_academicas ia join public.asignaturas a on a.id=ia.asignatura_id where ia.ciclo_id=p_ciclo
 ) select distinct ap.id,al.id,al.matricula::text,coalesce(al.nombre_completo,concat_ws(' ',al.apellido_paterno,al.apellido_materno,al.nombres)),p.id,(p.clave_legado||' · '||p.nombre)::text,al.grado_actual::text
 from candidatos c join public.alumno_programas ap on ap.alumno_id=c.alumno_id and ap.plan_id=c.plan_id join public.alumnos al on al.id=c.alumno_id join public.planes_estudio p on p.id=c.plan_id
 where not exists(select 1 from public.s911_inscripciones si where si.alumno_programa_id=ap.id and si.ciclo_id=p_ciclo) order by 3;
end $$;
create function public.s911_confirmar_inscripciones(p_filas jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare fila jsonb;total integer=0;
begin
 if not public.s911_autorizado(true) then raise exception 'Sin permiso';end if;
 if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas)>1000 then raise exception 'Lote inválido (máximo 1000)';end if;
 for fila in select value from jsonb_array_elements(p_filas) loop
  if exists(select 1 from public.s911_inscripciones where alumno_programa_id=(fila->>'alumno_programa_id')::uuid and ciclo_id=(fila->>'ciclo_id')::uuid) then raise exception 'Existe una fuente para este alumno y ciclo. Recarga la preselección';end if;
  perform public.s911_guardar_fuente('inscripciones',fila);total=total+1;
 end loop;return total;
end $$;

create function public.s911_registrar_exportacion(p_id uuid,p_version integer,p_revision integer,p_formato text,p_archivo text,p_huella text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.s911_expedientes;r uuid;
begin
 if not public.s911_autorizado() then raise exception 'Sin permiso para exportar';end if;
 select * into e from public.s911_expedientes where id=p_id;
 if not found then raise exception 'Expediente inexistente';end if;
 if not exists(select 1 from public.s911_versiones where expediente_id=p_id and numero=p_version) and (e.version<>p_version or e.revision<>p_revision) then raise exception 'Guarda o recarga el expediente antes de exportar';end if;
 if p_formato='XLSX' and not public.s911_autorizado(true) then raise exception 'Listados individuales restringidos';end if;
 if p_huella!~'^[a-f0-9]{64}$' then raise exception 'Huella inválida';end if;
 insert into public.s911_exportaciones(expediente_id,version,formato,archivo,huella) values(p_id,p_version,p_formato,p_archivo,p_huella) returning id into r;return r;
end $$;

-- Adjuntos privados. No se concede UPDATE/DELETE para conservar evidencias históricas.
do $$ begin if exists(select 1 from storage.buckets where id='estadistica-911' and public) then raise exception 'Ya existe un bucket público con el nombre reservado. Revisa antes de instalar';end if;end $$;
insert into storage.buckets(id,name,public,file_size_limit) values('estadistica-911','estadistica-911',false,15728640) on conflict(id) do nothing;
create policy s911_evidencias_lectura on storage.objects for select to authenticated using(bucket_id='estadistica-911' and public.s911_autorizado() and (
 public.get_my_rol()='ADMINISTRADOR' or ((storage.foldername(name))[2]='academico' and public.get_my_rol() in('COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO'))
 or ((storage.foldername(name))[2]='personal' and public.get_my_rol()='COORDINADOR RECURSOS HUMANOS') or ((storage.foldername(name))[2]='financiero' and public.get_my_rol()='COORDINADOR FINANCIERO')));
create policy s911_evidencias_alta on storage.objects for insert to authenticated with check(bucket_id='estadistica-911' and public.s911_autorizado() and (storage.foldername(name))[1]=auth.uid()::text and (
 public.get_my_rol()='ADMINISTRADOR' or ((storage.foldername(name))[2]='academico' and public.get_my_rol() in('COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO'))
 or ((storage.foldername(name))[2]='personal' and public.get_my_rol()='COORDINADOR RECURSOS HUMANOS') or ((storage.foldername(name))[2]='financiero' and public.get_my_rol()='COORDINADOR FINANCIERO')));

revoke all on function public.s911_guardar(uuid,integer,jsonb,jsonb), public.s911_transicion(uuid,integer,text,text),public.s911_guardar_fuente(text,jsonb) from public,anon;
revoke all on function public.s911_registrar_exportacion(uuid,integer,integer,text,text,text) from public,anon;
revoke all on function public.s911_evaluar_ast(jsonb,jsonb,integer) from public,anon,authenticated;
revoke all on function public.s911_personal_agregado(date,boolean) from public,anon;
grant execute on function public.s911_personal_agregado(date,boolean) to authenticated;
revoke all on function public.s911_propuestas_inscripcion(uuid),public.s911_confirmar_inscripciones(jsonb) from public,anon;
grant execute on function public.s911_propuestas_inscripcion(uuid),public.s911_confirmar_inscripciones(jsonb) to authenticated;
grant execute on function public.s911_registrar_exportacion(uuid,integer,integer,text,text,text) to authenticated;
grant execute on function public.s911_autorizado(boolean),public.s911_guardar(uuid,integer,jsonb,jsonb), public.s911_transicion(uuid,integer,text,text),public.s911_guardar_fuente(text,jsonb) to authenticated;
commit;
