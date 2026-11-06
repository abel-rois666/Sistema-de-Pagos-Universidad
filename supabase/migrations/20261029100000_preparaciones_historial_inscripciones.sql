-- PREPARADA, NO EJECUTADA EN SUPABASE. No carga ni corrige datos operativos.
-- Requiere solamente la base 20261027130000_inscripciones_ciclo.sql.
begin;
do $$begin
 if to_regprocedure('public.ic_guardar_lote(uuid,jsonb)') is null then raise exception 'Instala primero Inscripciones por ciclo';end if;
 if to_regclass('public.inscripciones_ciclo_preparaciones') is not null then raise exception 'Preparaciones ya existe: verifica la versión instalada';end if;
end$$;

create table public.inscripciones_ciclo_contextos (
 id uuid primary key default gen_random_uuid(),inscripcion_id uuid not null references public.inscripciones_ciclo(id) on delete restrict,
 revision integer not null, ciclo_origen_id uuid references public.ciclos_escolares(id) on delete restrict,
 contexto jsonb not null, creado_por uuid not null default auth.uid(),creado_en timestamptz not null default clock_timestamp(),
 unique(inscripcion_id,revision)
);
create table public.inscripciones_ciclo_preparaciones (
 id uuid primary key,alumno_programa_id uuid not null references public.alumno_programas(id) on delete restrict,
 plan_id uuid not null references public.planes_estudio(id) on delete restrict,
 ciclo_id uuid not null references public.ciclos_escolares(id) on delete restrict,
 ciclo_origen_id uuid references public.ciclos_escolares(id) on delete restrict,
 origen_inscripcion_id uuid references public.inscripciones_ciclo(id) on delete restrict,origen_revision integer,
 estado text not null check(estado in('PENDIENTE','CONFIRMADA','CANCELADA')),revision integer not null check(revision>0),
 datos jsonb not null,referencia jsonb,contexto jsonb not null,
 inscripcion_esperada_id uuid,inscripcion_esperada_revision integer not null,
 inscripcion_confirmada_id uuid references public.inscripciones_ciclo(id) on delete restrict,
 creado_por uuid not null default auth.uid(),creado_en timestamptz not null default clock_timestamp(),
 actualizado_por uuid not null default auth.uid(),actualizado_en timestamptz not null default clock_timestamp()
);
create unique index ic_una_preparacion_pendiente on public.inscripciones_ciclo_preparaciones(alumno_programa_id,ciclo_id) where estado='PENDIENTE';
create index on public.inscripciones_ciclo_preparaciones(ciclo_id,estado);
create table public.inscripciones_ciclo_preparaciones_historial (
 id uuid primary key default gen_random_uuid(),preparacion_id uuid not null references public.inscripciones_ciclo_preparaciones(id) on delete restrict,
 creado_por uuid not null default auth.uid(),creado_en timestamptz not null default clock_timestamp(),
 motivo text not null,antes jsonb,despues jsonb not null
);
do $$declare t text;begin
 foreach t in array array['inscripciones_ciclo_contextos','inscripciones_ciclo_preparaciones','inscripciones_ciclo_preparaciones_historial'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy lectura_control_escolar on public.%I for select to authenticated using(public.ic_autorizado())',t);
 end loop;
end$$;

-- El servidor produce la trayectoria y su huella; el cliente no envía un historial inventado.
create function public.ic_trayectorias(p_programas uuid[]) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r jsonb;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para consultar trayectorias';end if;
 if p_programas is null or cardinality(p_programas) not between 1 and 500 or array_position(p_programas,null) is not null then raise exception 'Selecciona entre 1 y 500 programas';end if;
 if (select count(*) from public.alumno_programas where id=any(p_programas))<>(select count(distinct x) from unnest(p_programas) x) then raise exception 'Un programa ya no existe';end if;
 with programas as (
  select ap.id,ap.alumno_id,ap.plan_id,pe.modelo from public.alumno_programas ap join public.planes_estudio pe on pe.id=ap.plan_id where ap.id=any(p_programas)
 ), notas as (
  select p.id ap_id,ia.ciclo_id,a.id,a.nombre,a.numero_periodo,count(*) registros
  from programas p join public.inscripciones_academicas ia on ia.alumno_id=p.alumno_id
  join public.asignaturas a on a.id=ia.asignatura_id and a.plan_id=p.plan_id
  where ia.calificacion_final is not null or ia.parcial_1 is not null or ia.parcial_2 is not null or ia.parcial_3 is not null or ia.promedio_calculado is not null
  group by p.id,ia.ciclo_id,a.id,a.nombre,a.numero_periodo
 ), pares as (
  select ap_id,ciclo_id from notas union select alumno_programa_id,ciclo_id from public.inscripciones_ciclo where alumno_programa_id=any(p_programas)
 ), trayectorias as (
  select p.id,jsonb_build_object('alumno_programa_id',p.id,'alumno_id',p.alumno_id,'plan_id',p.plan_id,'modelo',p.modelo,
   'ciclos',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.nombre,'tipo_periodo',c.tipo_periodo,'fecha_inicio',c.fecha_inicio,
    'materias',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'nombre',n.nombre,'periodo',n.numero_periodo,'registros',n.registros) order by n.id) from notas n where n.ap_id=p.id and n.ciclo_id=c.id),'[]'::jsonb),
    'inscripcion',case when ic.id is null then null else jsonb_build_object('id',ic.id,'revision',ic.revision,'grado_personal',ic.grado_personal,'estado',ic.estado) end)
    order by c.fecha_inicio desc nulls last,c.nombre desc,c.id)
   from pares par join public.ciclos_escolares c on c.id=par.ciclo_id left join public.inscripciones_ciclo ic on ic.alumno_programa_id=p.id and ic.ciclo_id=c.id where par.ap_id=p.id),'[]'::jsonb)) datos
  from programas p
 ) select coalesce(jsonb_agg(datos||jsonb_build_object('huella',md5(datos::text)) order by id),'[]'::jsonb) into r from trayectorias;
 return r;
end$$;

-- Privada: reconstruye procedencia a partir de una trayectoria vigente y parámetros revisados.
create function public.ic_contexto_revisado(p_programa uuid,p_ciclo uuid,p_datos jsonb,p_ref jsonb) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare h jsonb;primero jsonb;ultimo jsonb;actual jsonb;inicio date;periodo text;modelo text;grado integer;propuesto integer;limite integer;ctx jsonb;
 anterior public.inscripciones_ciclo;metadatos public.inscripciones_ciclo_contextos;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para revisar procedencia';end if;
 if p_ref is null or p_ref='null'::jsonb then
  select * into anterior from public.inscripciones_ciclo where alumno_programa_id=p_programa and ciclo_id=p_ciclo;
  select * into metadatos from public.inscripciones_ciclo_contextos where inscripcion_id=anterior.id and revision=anterior.revision;
  if metadatos.id is null then return jsonb_build_object('origen','MANUAL');end if;
  return (metadatos.contexto-ARRAY['preparacion_id','preparacion_revision','avance_confirmado'])||jsonb_build_object('contexto_previo_id',metadatos.id,
   'ingreso',case when anterior.fecha_primer_ingreso is not distinct from nullif(p_datos->>'fecha_primer_ingreso','')::date then coalesce(metadatos.contexto->'ingreso','"MANUAL"'::jsonb) else '"MANUAL"'::jsonb end,
   'grado',case when anterior.grado_personal is not distinct from p_datos->>'grado_personal' then coalesce(metadatos.contexto->'grado','"MANUAL"'::jsonb) else '"MANUAL"'::jsonb end);
 end if;
 h=public.ic_trayectorias(array[p_programa])->0;
 if nullif(p_ref->>'huella','') is null or p_ref->>'huella' is distinct from h->>'huella' then raise exception 'El historial cambió; vuelve a revisarlo antes de guardar';end if;
 select c.fecha_inicio,upper(trim(c.tipo_periodo)) into inicio,periodo from public.ciclos_escolares c where c.id=p_ciclo;
 select upper(coalesce(p.modelo,'')),p.total_periodos into modelo,limite from public.planes_estudio p where p.id=(h->>'plan_id')::uuid;
 ctx=jsonb_build_object('origen','REVISION_HISTORIAL','huella',h->>'huella','historial',h,'ingreso','MANUAL','grado','MANUAL',
  'advertencia','El historial disponible orienta la revisión; no acredita por sí solo ingreso real, promoción ni egreso');
 if p_ref->'aplicar_ingreso'='true'::jsonb then
  if inicio is null or exists(select 1 from jsonb_array_elements(h->'ciclos') c where upper(trim(c->>'tipo_periodo')) is distinct from periodo)
   or exists(select 1 from jsonb_array_elements(h->'ciclos') c where jsonb_array_length(c->'materias')>0 and nullif(c->>'fecha_inicio','') is null) then raise exception 'El historial no permite proponer ingreso de forma única';end if;
  select c into primero from jsonb_array_elements(h->'ciclos') c where jsonb_array_length(c->'materias')>0 order by c->>'fecha_inicio',c->>'id' limit 1;
  if primero is null or (primero->>'fecha_inicio')::date>inicio
   or (select count(*) from jsonb_array_elements(h->'ciclos') c where jsonb_array_length(c->'materias')>0 and c->>'fecha_inicio'=primero->>'fecha_inicio')<>1
   or p_ref->>'ciclo_ingreso_id' is distinct from primero->>'id' or p_datos->>'fecha_primer_ingreso' is distinct from primero->>'fecha_inicio' then raise exception 'La fecha de ingreso inferida no coincide con la propuesta vigente';end if;
  ctx=ctx||jsonb_build_object('ingreso',jsonb_build_object('metodo','INICIO_CICLO_CON_CALIFICACIONES','ciclo_id',primero->>'id','fecha',primero->>'fecha_inicio','aproximado',true));
 end if;
 if p_ref->'aplicar_grado'='true'::jsonb then
  select c into actual from jsonb_array_elements(h->'ciclos') c where c->>'id'=p_ciclo::text;
  if actual#>>'{inscripcion,estado}'='CONFIRMADA' then propuesto=substring(actual#>>'{inscripcion,grado_personal}' from '^([0-9]+)')::integer;
  elsif modelo='RIGIDO' and jsonb_array_length(coalesce(actual->'materias','[]'::jsonb))>0
   and not exists(select 1 from jsonb_array_elements(actual->'materias') m where m->>'periodo' is null)
   and (select count(distinct m->>'periodo') from jsonb_array_elements(actual->'materias') m)=1 then propuesto=(actual#>>'{materias,0,periodo}')::integer;
  elsif inicio is not null and jsonb_array_length(coalesce(actual->'materias','[]'::jsonb))=0 then
   select c into ultimo from jsonb_array_elements(h->'ciclos') c where upper(trim(c->>'tipo_periodo'))=periodo and (c->>'fecha_inicio')::date<inicio
    and (jsonb_array_length(c->'materias')>0 or c#>>'{inscripcion,estado}'='CONFIRMADA') order by c->>'fecha_inicio' desc,c->>'id' limit 1;
   if ultimo#>>'{inscripcion,estado}'='CONFIRMADA' and (select count(*) from jsonb_array_elements(h->'ciclos') c where upper(trim(c->>'tipo_periodo'))=periodo and c->>'fecha_inicio'=ultimo->>'fecha_inicio'
    and (jsonb_array_length(c->'materias')>0 or c#>>'{inscripcion,estado}'='CONFIRMADA'))=1 then propuesto=substring(ultimo#>>'{inscripcion,grado_personal}' from '^([0-9]+)')::integer+1;end if;
  end if;
  grado=substring(p_datos->>'grado_personal' from '^([0-9]+)')::integer;
  if propuesto is null or propuesto<1 or limite is null or propuesto>limite or grado is distinct from propuesto then raise exception 'El grado inferido cambió o requiere revisión manual';end if;
  ctx=ctx||jsonb_build_object('grado',jsonb_build_object('metodo','ORIENTACION_HISTORIAL','valor',grado,'requiere_decision_academica',true));
 end if;
 return ctx;
end$$;

create function public.ic_validar_preparacion(p_programa uuid,p_plan uuid,p_ciclo uuid,p_origen uuid,p_datos jsonb) returns void
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare ap public.alumno_programas;pe public.planes_estudio;destino public.ciclos_escolares;origen public.ciclos_escolares;grado integer;desde date;hasta date;primero date;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para preparar inscripciones';end if;
 select * into ap from public.alumno_programas where id=p_programa;
 if not found or ap.plan_id is distinct from p_plan then raise exception 'El programa cambió desde la consulta';end if;
 select * into pe from public.planes_estudio where id=p_plan;
 select * into destino from public.ciclos_escolares where id=p_ciclo;
 if destino.id is null or upper(trim(pe.tipo_periodo)) is distinct from upper(trim(destino.tipo_periodo)) or nullif(trim(pe.tipo_periodo),'') is null then raise exception 'Revisa el ID y la periodicidad del ciclo de destino';end if;
 if p_origen is not null then
  select * into origen from public.ciclos_escolares where id=p_origen;
  if origen.id is null or upper(trim(origen.tipo_periodo)) is distinct from upper(trim(destino.tipo_periodo)) or origen.fecha_inicio is null or destino.fecha_inicio is null or origen.fecha_inicio>=destino.fecha_inicio then raise exception 'El origen debe ser un ciclo anterior de la misma periodicidad con fechas definidas';end if;
 end if;
 if not(ap.es_vigente and coalesce(upper(ap.estatus) in('ACTIVO','CURSANDO'),false)) and (p_datos->'admitir_historico' is distinct from 'true'::jsonb or coalesce(length(trim(p_datos->>'motivo')),0)<20) then raise exception 'Confirma y justifica la revisión histórica';end if;
 if coalesce(p_datos->>'estado','') not in('CONFIRMADA','BAJA','CANCELADA') or coalesce(p_datos->>'tipo_ingreso','') not in('PRIMER_INGRESO','REINGRESO','DESCONOCIDO') then raise exception 'Situación o ingreso inválido';end if;
 if coalesce(length(trim(p_datos->>'motivo')),0)<10 or coalesce(length(trim(p_datos->>'evidencia')),0)<5 then raise exception 'Completa motivo y evidencia';end if;
 if upper(trim(coalesce(p_datos->>'grado_personal',''))) !~ '^([0-9]+)(ER|RO|DO|TO|VO|MO|NO|º|°)?$' then raise exception 'Grado de destino inválido';end if;
 grado=substring(trim(p_datos->>'grado_personal') from '^([0-9]+)')::integer;
 if grado<1 or pe.total_periodos is not null and grado>pe.total_periodos then raise exception 'El grado excede la duración del plan';end if;
 desde=nullif(p_datos->>'desde','')::date;hasta=nullif(p_datos->>'hasta','')::date;primero=nullif(p_datos->>'fecha_primer_ingreso','')::date;
 if desde is null or hasta<desde or primero>desde or (p_datos->>'estado'='BAJA' and hasta is null) or (p_datos->>'tipo_ingreso'='PRIMER_INGRESO' and primero is null) then raise exception 'Revisa las fechas de inscripción e ingreso';end if;
end$$;

create function public.ic_guardar_revision(p_ciclo uuid,p_filas jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare f jsonb;ctx jsonb;contextos jsonb='{}';i public.inscripciones_ciclo;n integer;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para guardar inscripciones';end if;
 if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) not between 1 and 500 then raise exception 'Lote inválido';end if;
 -- Mismo orden de bloqueos que la base: ciclo, programa-ciclo, programa.
 perform 1 from public.ciclos_escolares where id=p_ciclo for share;
 for f in select value from jsonb_array_elements(p_filas) order by value->>'alumno_programa_id' loop
  perform pg_advisory_xact_lock(hashtextextended((f->>'alumno_programa_id')::uuid::text||':'||p_ciclo::text,271300));
  perform 1 from public.alumno_programas where id=(f->>'alumno_programa_id')::uuid for share;
  perform public.ic_validar_preparacion((f->>'alumno_programa_id')::uuid,(f->>'plan_id')::uuid,p_ciclo,nullif(f->>'ciclo_origen_id','')::uuid,f);
  ctx=public.ic_contexto_revisado((f->>'alumno_programa_id')::uuid,p_ciclo,f,f->'referencia');
  contextos=contextos||jsonb_build_object(f->>'alumno_programa_id',ctx);
 end loop;
 n=public.ic_guardar_lote(p_ciclo,p_filas);
 for f in select value from jsonb_array_elements(p_filas) loop
  select * into i from public.inscripciones_ciclo where alumno_programa_id=(f->>'alumno_programa_id')::uuid and ciclo_id=p_ciclo;
  insert into public.inscripciones_ciclo_contextos(inscripcion_id,revision,ciclo_origen_id,contexto)
   values(i.id,i.revision,nullif(f->>'ciclo_origen_id','')::uuid,contextos->(f->>'alumno_programa_id'));
 end loop;
 return n;
end$$;

create function public.ic_preparar_lote(p_ciclo uuid,p_filas jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare f jsonb;previa public.inscripciones_ciclo_preparaciones;nueva public.inscripciones_ciclo_preparaciones;
 i public.inscripciones_ciclo;origen public.inscripciones_ciclo;ctx jsonb;total integer=0;ap uuid;co uuid;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para preparar inscripciones';end if;
 if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) not between 1 and 500 then raise exception 'Selecciona entre 1 y 500 preparaciones';end if;
 if (select count(distinct value->>'alumno_programa_id') from jsonb_array_elements(p_filas))<>jsonb_array_length(p_filas) then raise exception 'Programa repetido en la preparación';end if;
 perform 1 from public.ciclos_escolares where id=p_ciclo for share;
 for f in select value from jsonb_array_elements(p_filas) order by value->>'alumno_programa_id' loop
  ap=(f->>'alumno_programa_id')::uuid;co=nullif(f->>'ciclo_origen_id','')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(ap::text||':'||p_ciclo::text,271300));
  perform 1 from public.alumno_programas where id=ap for share;
  perform public.ic_validar_preparacion(ap,(f->>'plan_id')::uuid,p_ciclo,co,f);
  select * into i from public.inscripciones_ciclo where alumno_programa_id=ap and ciclo_id=p_ciclo;
  if nullif(f->>'inscripcion_id','')::uuid is distinct from i.id or coalesce((f->>'revision')::integer,0)<>coalesce(i.revision,0) then raise exception 'La inscripción cambió. Recarga antes de preparar';end if;
  ctx=public.ic_contexto_revisado(ap,p_ciclo,f,f->'referencia');
  select * into origen from public.inscripciones_ciclo where alumno_programa_id=ap and ciclo_id=co;
  select * into previa from public.inscripciones_ciclo_preparaciones where id=(f->>'preparacion_id')::uuid for update;
  if previa.id is not null then
   if previa.estado<>'PENDIENTE' or previa.alumno_programa_id<>ap or previa.ciclo_id<>p_ciclo or previa.revision<>coalesce((f->>'preparacion_revision')::integer,0) then raise exception 'La preparación cambió o ya se resolvió. Recarga antes de editar';end if;
   update public.inscripciones_ciclo_preparaciones set plan_id=(f->>'plan_id')::uuid,ciclo_origen_id=co,
    origen_inscripcion_id=origen.id,origen_revision=origen.revision,datos=f-ARRAY['referencia','preparacion_id','preparacion_revision'],referencia=f->'referencia',contexto=ctx,
    inscripcion_esperada_id=i.id,inscripcion_esperada_revision=coalesce(i.revision,0),revision=revision+1,actualizado_por=auth.uid(),actualizado_en=clock_timestamp()
    where id=previa.id returning * into nueva;
  else
   if coalesce((f->>'preparacion_revision')::integer,0)<>0 then raise exception 'La preparación ya no existe';end if;
   insert into public.inscripciones_ciclo_preparaciones(id,alumno_programa_id,plan_id,ciclo_id,ciclo_origen_id,origen_inscripcion_id,origen_revision,estado,revision,datos,referencia,contexto,inscripcion_esperada_id,inscripcion_esperada_revision)
    values((f->>'preparacion_id')::uuid,ap,(f->>'plan_id')::uuid,p_ciclo,co,origen.id,origen.revision,'PENDIENTE',1,f-ARRAY['referencia','preparacion_id','preparacion_revision'],f->'referencia',ctx,i.id,coalesce(i.revision,0)) returning * into nueva;
  end if;
  insert into public.inscripciones_ciclo_preparaciones_historial(preparacion_id,motivo,antes,despues)
   values(nueva.id,f->>'motivo',case when previa.id is null then null else to_jsonb(previa) end,to_jsonb(nueva));
  total=total+1;
 end loop;
 return total;
end$$;

-- Bloquea y revalida sin confirmar. Es público para que el orquestador INVOKER conserve permisos de promoción.
create function public.ic_preparacion_bloqueada(p_id uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.inscripciones_ciclo_preparaciones;i public.inscripciones_ciclo;o public.inscripciones_ciclo;alumno uuid;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para confirmar preparaciones';end if;
 select * into p from public.inscripciones_ciclo_preparaciones where id=p_id;
 if not found then raise exception 'La preparación no existe';end if;
 perform 1 from public.ciclos_escolares where id=p.ciclo_id for share;
 perform pg_advisory_xact_lock(hashtextextended(p.alumno_programa_id::text||':'||p.ciclo_id::text,271300));
 select * into p from public.inscripciones_ciclo_preparaciones where id=p_id for update;
 if p.estado='CONFIRMADA' and p.revision=p_revision+1 then return to_jsonb(p);end if;
 if p.estado<>'PENDIENTE' or p.revision is distinct from p_revision then raise exception 'La preparación cambió. Recarga antes de confirmar';end if;
 perform 1 from public.alumno_programas where id=p.alumno_programa_id for share;
 perform public.ic_validar_preparacion(p.alumno_programa_id,p.plan_id,p.ciclo_id,p.ciclo_origen_id,p.datos);
 perform public.ic_contexto_revisado(p.alumno_programa_id,p.ciclo_id,p.datos,p.referencia);
 select * into i from public.inscripciones_ciclo where alumno_programa_id=p.alumno_programa_id and ciclo_id=p.ciclo_id;
 if i.id is distinct from p.inscripcion_esperada_id or coalesce(i.revision,0)<>p.inscripcion_esperada_revision then raise exception 'La inscripción destino cambió. Revisa y guarda nuevamente la preparación';end if;
 select * into o from public.inscripciones_ciclo where alumno_programa_id=p.alumno_programa_id and ciclo_id=p.ciclo_origen_id;
 if o.id is distinct from p.origen_inscripcion_id or o.revision is distinct from p.origen_revision then raise exception 'La inscripción de origen cambió. Revisa la preparación';end if;
 select alumno_id into alumno from public.alumno_programas where id=p.alumno_programa_id;
 return to_jsonb(p)||jsonb_build_object('alumno_id',alumno,'origen_inscripcion',case when o.id is null then null else to_jsonb(o) end);
end$$;

create function public.ic_confirmar_preparacion(p_id uuid,p_revision integer,p_avanzado boolean default false) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.inscripciones_ciclo_preparaciones;antes jsonb;i public.inscripciones_ciclo;a public.alumnos;ctx jsonb;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para confirmar preparaciones';end if;
 antes=public.ic_preparacion_bloqueada(p_id,p_revision);
 select * into p from public.inscripciones_ciclo_preparaciones where id=p_id;
 if p.estado='CONFIRMADA' then return p.inscripcion_confirmada_id;end if;
 if p_avanzado then
  if not coalesce((select integrar_promocion from public.inscripciones_ciclo_config where id),false) then raise exception 'Activa la integración de promoción después de verificar su función';end if;
  select * into a from public.alumnos where id=(antes->>'alumno_id')::uuid;
  if a.ciclo_ultima_asignacion_grado is distinct from p.ciclo_id or substring(a.grado_actual from '^([0-9]+)')::integer is distinct from substring(p.datos->>'grado_personal' from '^([0-9]+)')::integer then raise exception 'El avance no se confirmó en el ciclo destino';end if;
 end if;
 perform public.ic_guardar_lote(p.ciclo_id,jsonb_build_array(p.datos||jsonb_build_object('alumno_programa_id',p.alumno_programa_id,'inscripcion_id',p.inscripcion_esperada_id,'revision',p.inscripcion_esperada_revision)));
 select * into i from public.inscripciones_ciclo where alumno_programa_id=p.alumno_programa_id and ciclo_id=p.ciclo_id;
 ctx=p.contexto||jsonb_build_object('preparacion_id',p.id,'preparacion_revision',p.revision,'avance_confirmado',p_avanzado);
 insert into public.inscripciones_ciclo_contextos(inscripcion_id,revision,ciclo_origen_id,contexto) values(i.id,i.revision,p.ciclo_origen_id,ctx);
 update public.inscripciones_ciclo_preparaciones set estado='CONFIRMADA',revision=revision+1,inscripcion_confirmada_id=i.id,
  actualizado_por=auth.uid(),actualizado_en=clock_timestamp() where id=p_id returning * into p;
 insert into public.inscripciones_ciclo_preparaciones_historial(preparacion_id,motivo,antes,despues)
  values(p.id,'Confirmación de inscripción preparada; avance general: '||p_avanzado::text,antes-ARRAY['alumno_id','origen_inscripcion'],to_jsonb(p));
 return i.id;
end$$;

create function public.ic_confirmar_lote_preparado(p_fuentes jsonb,p_avanzar boolean default false) returns integer
language plpgsql security invoker set search_path=public,pg_temp as $$
declare f jsonb;p jsonb;alumno uuid;grado_actual text;grado_origen integer;grado_destino integer;pp uuid;resultado jsonb;total integer=0;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para confirmar inscripciones';end if;
 if p_avanzar is null then raise exception 'Indica si confirmas solo matrícula o también el avance';end if;
 if jsonb_typeof(p_fuentes) is distinct from 'array' or jsonb_array_length(p_fuentes) not between 1 and 500 then raise exception 'Selecciona entre 1 y 500 preparaciones';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_fuentes))<>jsonb_array_length(p_fuentes) then raise exception 'Preparación repetida';end if;
 -- El avance sigue siendo INVOKER: nunca obtiene privilegios financieros del dueño de la función.
 for f in select v.value from jsonb_array_elements(p_fuentes) v join public.inscripciones_ciclo_preparaciones ps on ps.id=(v.value->>'id')::uuid order by ps.alumno_programa_id,ps.id loop
  if p_avanzar then
   select ap.alumno_id into alumno from public.inscripciones_ciclo_preparaciones ps join public.alumno_programas ap on ap.id=ps.alumno_programa_id where ps.id=(f->>'id')::uuid;
   perform 1 from public.alumnos where id=alumno for update;
  end if;
  p=public.ic_preparacion_bloqueada((f->>'id')::uuid,(f->>'revision')::integer);
  if p->>'estado'='CONFIRMADA' then total=total+1;continue;end if;
  if p_avanzar then
   if not coalesce((public.ic_configuracion()->>'integrar_promocion')::boolean,false) then raise exception 'La integración de promoción está desactivada';end if;
   if (p#>>'{datos,desde}')::date>(clock_timestamp() at time zone 'America/Mexico_City')::date then raise exception 'Guarda la preparación futura y confirma el avance cuando llegue su fecha efectiva';end if;
   if p#>>'{datos,estado}'<>'CONFIRMADA' or p#>>'{datos,tipo_ingreso}'<>'REINGRESO' or p#>>'{origen_inscripcion,estado}' is distinct from 'CONFIRMADA' then raise exception 'Avanzar requiere reinscripción confirmada e inscripción de origen acreditada';end if;
   grado_origen=substring(p#>>'{origen_inscripcion,grado_personal}' from '^([0-9]+)')::integer;
   grado_destino=substring(p#>>'{datos,grado_personal}' from '^([0-9]+)')::integer;
   select a.grado_actual into grado_actual from public.alumnos a where a.id=(p->>'alumno_id')::uuid;
   if grado_destino is distinct from grado_origen+1 or substring(grado_actual from '^([0-9]+)')::integer is distinct from grado_origen then raise exception 'El avance requiere el grado actual igual al origen y el destino exactamente siguiente. Para conservar grado confirma solo la inscripción';end if;
   if (select count(*) from public.planes_pago where alumno_id=(p->>'alumno_id')::uuid and ciclo_id=(p->>'ciclo_id')::uuid)>1 then raise exception 'Hay varios planes de pago en destino; revísalos antes de avanzar';end if;
   select id into pp from public.planes_pago where alumno_id=(p->>'alumno_id')::uuid and ciclo_id=(p->>'ciclo_id')::uuid;
   resultado=public.promover_alumno_ciclo((p->>'alumno_id')::uuid,(p->>'ciclo_id')::uuid,(p->>'alumno_programa_id')::uuid,grado_actual,coalesce(pp,(p->>'id')::uuid),false,false);
   if resultado->>'tipo' is distinct from 'AVANCE' or substring(resultado->>'grado' from '^([0-9]+)')::integer is distinct from grado_destino then raise exception 'El resultado de promoción no coincide con la preparación; se revierte la operación';end if;
  end if;
  perform public.ic_confirmar_preparacion((f->>'id')::uuid,(f->>'revision')::integer,p_avanzar);
  total=total+1;
 end loop;
 if total<>jsonb_array_length(p_fuentes) then raise exception 'Falta alguna preparación o no es accesible';end if;
 return total;
end$$;

create function public.ic_cancelar_preparacion(p_id uuid,p_revision integer,p_motivo text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.inscripciones_ciclo_preparaciones;antes jsonb;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para cancelar preparaciones';end if;
 if coalesce(length(trim(p_motivo)),0)<10 then raise exception 'Explica el motivo de cancelación (10 caracteres)';end if;
 select * into p from public.inscripciones_ciclo_preparaciones where id=p_id;
 if not found then raise exception 'La preparación no existe';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.alumno_programa_id::text||':'||p.ciclo_id::text,271300));
 select * into p from public.inscripciones_ciclo_preparaciones where id=p_id for update;
 if p.estado<>'PENDIENTE' or p.revision is distinct from p_revision then raise exception 'La preparación cambió o ya fue resuelta';end if;
 antes=to_jsonb(p);
 update public.inscripciones_ciclo_preparaciones set estado='CANCELADA',revision=revision+1,actualizado_por=auth.uid(),actualizado_en=clock_timestamp() where id=p_id returning * into p;
 insert into public.inscripciones_ciclo_preparaciones_historial(preparacion_id,motivo,antes,despues) values(p.id,trim(p_motivo),antes,to_jsonb(p));
end$$;

create or replace function public.ic_configuracion() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para inscripciones';end if;
 return (select jsonb_build_object('version',2,'integrar_promocion',integrar_promocion,'puente_911',to_regprocedure('public.ic_acreditar_911(jsonb)') is not null,'preparaciones',true) from public.inscripciones_ciclo_config where id);
end$$;

revoke all on function public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb),public.ic_validar_preparacion(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.ic_trayectorias(uuid[]),public.ic_guardar_revision(uuid,jsonb),public.ic_preparar_lote(uuid,jsonb),public.ic_preparacion_bloqueada(uuid,integer),public.ic_confirmar_preparacion(uuid,integer,boolean),public.ic_confirmar_lote_preparado(jsonb,boolean),public.ic_cancelar_preparacion(uuid,integer,text) from public,anon;
grant execute on function public.ic_trayectorias(uuid[]),public.ic_guardar_revision(uuid,jsonb),public.ic_preparar_lote(uuid,jsonb),public.ic_preparacion_bloqueada(uuid,integer),public.ic_confirmar_preparacion(uuid,integer,boolean),public.ic_confirmar_lote_preparado(jsonb,boolean),public.ic_cancelar_preparacion(uuid,integer,text) to authenticated;
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.inscripciones_ciclo_preparaciones;end if;
end$$;
commit;
