-- Preparada para revisión. No ejecutada por el agente. No modifica registros existentes.
-- Aplicar después de las dos migraciones base del 911, sin repetirlas.
begin;

do $$ begin
 if to_regprocedure('public.s911_guardar(uuid,integer,jsonb,jsonb)') is null
 or to_regprocedure('public.s911_transicion(uuid,integer,text,text)') is null
 or to_regprocedure('public.s911_registrar_exportacion(uuid,integer,integer,text,text,text)') is null
 then raise exception 'Instala primero las funciones base 911';end if;
end $$;

create or replace function public.s911_validar_corte(p_payload jsonb,p_exigir_calculo boolean default false)
returns void language plpgsql immutable set search_path=public,pg_temp as $$
declare corte text=p_payload#>>'{config,corte}';fecha date;motivo text=trim(p_payload#>>'{config,motivoCorte}');
begin
 if corte is null or corte!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Fecha de corte inválida';end if;
 begin fecha=corte::date;exception when datetime_field_overflow or invalid_datetime_format then raise exception 'Fecha de corte inválida';end;
 if to_char(fecha,'YYYY-MM-DD') is distinct from corte then raise exception 'Fecha de corte inválida';end if;
 if corte<>'2026-09-30' then
  if p_payload#>'{config,cortePersonalizado}' is distinct from 'true'::jsonb then raise exception 'Activa la fecha de corte personalizada';end if;
  if coalesce(length(motivo),0)<20 or length(motivo)>2000 then raise exception 'Justifica el corte personalizado con entre 20 y 2000 caracteres';end if;
 end if;
 if p_exigir_calculo and (corte<>'2026-09-30' or p_payload?'corteCalculado')
 and p_payload->>'corteCalculado' is distinct from corte then raise exception 'Recalcula y aplica las cifras para la fecha de corte elegida';end if;
end $$;
revoke all on function public.s911_validar_corte(jsonb,boolean) from public,anon,authenticated;


create or replace function public.s911_guardar(p_id uuid, p_revision integer, p_payload jsonb, p_respaldos jsonb default '[]')
returns public.s911_expedientes language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.s911_expedientes; rol text=public.get_my_rol(); i jsonb; anterior jsonb; q text; permitido boolean; catalogo public.s911_catalogos; total integer;rev record;corte_anterior text;
begin
 if not public.s911_autorizado() then raise exception 'Sin permiso para Estadística 911'; end if;
 if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'instancias')<>'array' then raise exception 'Expediente inválido';end if;
 if p_payload#>>'{config,edicion}' is distinct from '2026-2027' or p_payload#>>'{config,plantel}' is distinct from '09PSU0509Q' or p_payload#>>'{config,institucion}' is distinct from '09MSU0509T' then raise exception 'Edición o claves fuera del piloto homologado';end if;
 perform public.s911_validar_corte(p_payload,false);
 if (p_payload?'corteCalculado' or p_payload#>>'{config,corte}'<>'2026-09-30') and p_payload->>'corteCalculado' is distinct from p_payload#>>'{config,corte}' and p_respaldos is distinct from '[]'::jsonb then raise exception 'Retira el respaldo del corte anterior y recalcula';end if;
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
  corte_anterior=e.payload#>>'{config,corte}';
  if corte_anterior is distinct from p_payload#>>'{config,corte}' and not (p_payload?'corteCalculado') then raise exception 'Actualiza la aplicación y recalcula al cambiar el corte';end if;
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
 if corte_anterior is not null and corte_anterior is distinct from p_payload#>>'{config,corte}' then
  insert into public.s911_auditoria(expediente_id,accion,motivo,datos) values(e.id,'CAMBIAR_CORTE',coalesce(nullif(trim(p_payload#>>'{config,motivoCorte}'),''),'Restauración de la fecha de referencia de la edición'),jsonb_build_object('anterior',corte_anterior,'nuevo',p_payload#>>'{config,corte}','referencia_edicion','2026-09-30'));
 end if;
 insert into public.s911_auditoria(expediente_id,accion) values(e.id,'GUARDAR');return e;
end $$;

create or replace function public.s911_transicion(p_id uuid,p_revision integer,p_accion text,p_motivo text)
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
  perform public.s911_validar_corte(e.payload,true);
  if (e.payload#>>'{config,fiscal}')::integer is distinct from 2025 then raise exception 'El ejercicio fiscal de la edición sigue siendo 2025';end if;
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

create or replace function public.s911_registrar_exportacion(p_id uuid,p_version integer,p_revision integer,p_formato text,p_archivo text,p_huella text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.s911_expedientes;r uuid;version_payload jsonb;
begin
 if not public.s911_autorizado() then raise exception 'Sin permiso para exportar';end if;
 select * into e from public.s911_expedientes where id=p_id;
 if not found then raise exception 'Expediente inexistente';end if;
 select payload into version_payload from public.s911_versiones where expediente_id=p_id and numero=p_version;
 if not found then
  if e.version<>p_version or e.revision<>p_revision then raise exception 'Guarda o recarga el expediente antes de exportar';end if;
  version_payload=e.payload;
 end if;
 perform public.s911_validar_corte(version_payload,true);
 if p_formato='XLSX' and not public.s911_autorizado(true) then raise exception 'Listados individuales restringidos';end if;
 if p_huella!~'^[a-f0-9]{64}$' then raise exception 'Huella inválida';end if;
 insert into public.s911_exportaciones(expediente_id,version,formato,archivo,huella) values(p_id,p_version,p_formato,p_archivo,p_huella) returning id into r;return r;
end $$;

-- Conserva las firmas, roles, RLS y permisos de las funciones existentes.
revoke all on function public.s911_guardar(uuid,integer,jsonb,jsonb),public.s911_transicion(uuid,integer,text,text),public.s911_registrar_exportacion(uuid,integer,integer,text,text,text) from public,anon;
grant execute on function public.s911_guardar(uuid,integer,jsonb,jsonb),public.s911_transicion(uuid,integer,text,text),public.s911_registrar_exportacion(uuid,integer,integer,text,text,text) to authenticated;
commit;
