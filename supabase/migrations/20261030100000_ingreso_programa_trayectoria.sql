-- PREPARADA: aplicar tras las migraciones de inscripciones del 29/10.
-- No rellena antecedentes ni modifica inscripciones o recibos existentes.
begin;
create table public.inscripciones_programa_ingreso (
 alumno_programa_id uuid primary key references public.alumno_programas(id) on delete restrict,
 ciclo_id uuid references public.ciclos_escolares(id) on delete restrict,
 fecha date, calidad text not null check(calidad in('DOCUMENTADA','APROXIMADA','PENDIENTE')),
 evidencia text not null check(length(trim(evidencia))>=5), motivo text not null check(length(trim(motivo))>=10),
 revision integer not null check(revision>0),
 actualizado_en timestamptz not null default clock_timestamp(), actualizado_por uuid not null default auth.uid(),
 check(calidad='PENDIENTE' or fecha is not null or ciclo_id is not null),
 check(calidad<>'PENDIENTE' or fecha is null)
);
create table public.inscripciones_programa_ingreso_historial (
 id uuid primary key default gen_random_uuid(), alumno_programa_id uuid not null references public.alumno_programas(id),
 antes jsonb, despues jsonb not null, creado_en timestamptz not null default clock_timestamp(), creado_por uuid not null default auth.uid()
);
do $$declare t text;begin
 foreach t in array array['inscripciones_programa_ingreso','inscripciones_programa_ingreso_historial'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy lectura_control_escolar on public.%I for select to authenticated using(public.ic_autorizado())',t);
 end loop;
end$$;
create function public.ic_guardar_ingreso_programa(p_programa uuid,p_revision integer,p_ciclo uuid,p_fecha date,p_calidad text,p_evidencia text,p_motivo text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare anterior public.inscripciones_programa_ingreso; nuevo public.inscripciones_programa_ingreso; periodo text;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para inscripciones';end if;
 select upper(trim(pe.tipo_periodo)) into periodo from public.alumno_programas ap join public.planes_estudio pe on pe.id=ap.plan_id where ap.id=p_programa for update of ap;
 if not found then raise exception 'Programa inexistente';end if;
 select * into anterior from public.inscripciones_programa_ingreso where alumno_programa_id=p_programa for update;
 if p_revision is distinct from coalesce(anterior.revision,0) then raise exception 'El ingreso cambió; actualiza la ficha antes de guardar';end if;
 if p_ciclo is not null and not exists(select 1 from public.ciclos_escolares c where c.id=p_ciclo and upper(trim(c.tipo_periodo))=periodo) then raise exception 'El ciclo de ingreso no corresponde a la periodicidad del programa';end if;
 if p_fecha>(clock_timestamp() at time zone 'America/Mexico_City')::date then raise exception 'El ingreso histórico no puede estar en el futuro';end if;
 if exists(select 1 from public.inscripciones_ciclo i where i.alumno_programa_id=p_programa and i.estado<>'CANCELADA' and p_fecha>i.desde) then raise exception 'El ingreso no puede ser posterior a una inscripción acreditada; revisa la discrepancia';end if;
 insert into public.inscripciones_programa_ingreso values(p_programa,p_ciclo,p_fecha,p_calidad,trim(p_evidencia),trim(p_motivo),coalesce(anterior.revision,0)+1,clock_timestamp(),auth.uid())
 on conflict(alumno_programa_id) do update set ciclo_id=excluded.ciclo_id,fecha=excluded.fecha,calidad=excluded.calidad,evidencia=excluded.evidencia,motivo=excluded.motivo,revision=excluded.revision,actualizado_en=excluded.actualizado_en,actualizado_por=excluded.actualizado_por returning * into nuevo;
 insert into public.inscripciones_programa_ingreso_historial(alumno_programa_id,antes,despues) values(p_programa,case when anterior.revision is null then null else to_jsonb(anterior) end,to_jsonb(nuevo));
end$$;
revoke all on function public.ic_guardar_ingreso_programa(uuid,integer,uuid,date,text,text,text) from public,anon;
grant execute on function public.ic_guardar_ingreso_programa(uuid,integer,uuid,date,text,text,text) to authenticated;

-- Un ciclo de ingreso acreditado no obliga a inventar un día exacto.
create function public.ic_ingreso_ciclo_acreditado(p_programa uuid,p_ciclo uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.inscripciones_programa_ingreso i where i.alumno_programa_id=p_programa and i.ciclo_id=p_ciclo and i.calidad in('DOCUMENTADA','APROXIMADA'))
$$;
revoke all on function public.ic_ingreso_ciclo_acreditado(uuid,uuid) from public,anon,authenticated;
do $$declare c record; n integer=0;begin
 for c in select conname from pg_constraint where conrelid='public.inscripciones_ciclo'::regclass and contype='c'
  and pg_get_constraintdef(oid) like '%tipo_ingreso%' and pg_get_constraintdef(oid) like '%fecha_primer_ingreso%' loop
  n=n+1;execute format('alter table public.inscripciones_ciclo drop constraint %I',c.conname);
 end loop;
 if n<>1 then raise exception 'Revisa el esquema instalado: se esperaba una regla de primer ingreso';end if;
end$$;
-- Sustitución acotada: aborta ante definiciones distintas, conserva el resto de
-- las validaciones instaladas, firmas y privilegios.
do $$declare d text;buscar text;begin
 d=pg_get_functiondef('public.ic_guardar_lote(uuid,jsonb)'::regprocedure);
 buscar=$q$(fila->>'tipo_ingreso'='PRIMER_INGRESO' and primer_ingreso is null)$q$;
 if strpos(d,buscar)=0 then raise exception 'Versión de ic_guardar_lote no homologada';end if;
 execute replace(d,buscar,$q$(fila->>'tipo_ingreso'='PRIMER_INGRESO' and primer_ingreso is null and not public.ic_ingreso_ciclo_acreditado(ap.id,p_ciclo))$q$);
 d=pg_get_functiondef('public.ic_validar_preparacion(uuid,uuid,uuid,uuid,jsonb)'::regprocedure);
 buscar=$q$(p_datos->>'tipo_ingreso'='PRIMER_INGRESO' and primero is null)$q$;
 if strpos(d,buscar)=0 then raise exception 'Versión de preparación no homologada';end if;
 execute replace(d,buscar,$q$(p_datos->>'tipo_ingreso'='PRIMER_INGRESO' and primero is null and not public.ic_ingreso_ciclo_acreditado(p_programa,p_ciclo))$q$);
end$$;

create function public.ic_validar_ingreso_canonico() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare ingreso public.inscripciones_programa_ingreso;
begin
 if new.estado='CANCELADA' then return new;end if;
 if new.tipo_ingreso='PRIMER_INGRESO' and new.fecha_primer_ingreso is null and not public.ic_ingreso_ciclo_acreditado(new.alumno_programa_id,new.ciclo_id) then raise exception 'Acredita el ciclo de ingreso del programa o registra su fecha de ingreso';end if;
 select * into ingreso from public.inscripciones_programa_ingreso where alumno_programa_id=new.alumno_programa_id;
 if ingreso.fecha is not null and new.fecha_primer_ingreso is not null and ingreso.fecha<>new.fecha_primer_ingreso then
 raise exception 'El primer ingreso difiere del acreditado en la ficha. Revisa el ingreso del programa antes de continuar';end if;
 if ingreso.fecha is not null and new.desde<ingreso.fecha then raise exception 'La inscripción del ciclo no puede ser anterior al ingreso acreditado al programa';end if;
 return new;
end$$;
revoke all on function public.ic_validar_ingreso_canonico() from public,anon,authenticated;
create trigger validar_ingreso_canonico before insert or update on public.inscripciones_ciclo for each row execute function public.ic_validar_ingreso_canonico();

-- Conserva la validación de huellas y antecedentes; retira únicamente el método
-- que usaba el primer ciclo histórico como fecha efectiva de un destino posterior.
create or replace function public.ic_contexto_revisado(p_programa uuid,p_ciclo uuid,p_datos jsonb,p_ref jsonb) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare h jsonb;primero jsonb;ultimo jsonb;actual jsonb;inicio date;periodo text;modelo text;periodo_plan text;grado integer;propuesto integer;limite integer;ctx jsonb;
 anterior public.inscripciones_ciclo;metadatos public.inscripciones_ciclo_contextos;
begin
 if p_ref->>'metodo_desde'='HISTORIAL_MAS_ANTIGUO' and p_ref->'aplicar_desde'='true'::jsonb then raise exception 'El inicio histórico corresponde al ingreso al programa; revisa la fecha efectiva del destino';end if;
 if not public.ic_autorizado() then raise exception 'Sin permiso para revisar procedencia';end if;
 select * into anterior from public.inscripciones_ciclo where alumno_programa_id=p_programa and ciclo_id=p_ciclo;
 select * into metadatos from public.inscripciones_ciclo_contextos where inscripcion_id=anterior.id and revision=anterior.revision;
 if p_ref is null or p_ref='null'::jsonb then
  if metadatos.id is null then return jsonb_build_object('origen','MANUAL','desde','MANUAL');end if;
  return (metadatos.contexto-ARRAY['preparacion_id','preparacion_revision','avance_confirmado'])||jsonb_build_object('contexto_previo_id',metadatos.id,
   'origen_anterior',case when metadatos.ciclo_origen_id is not distinct from nullif(p_datos->>'ciclo_origen_id','')::uuid then coalesce(metadatos.contexto->'origen_anterior','"MANUAL"'::jsonb) else '"MANUAL"'::jsonb end,
   'desde',case when anterior.desde is not distinct from nullif(p_datos->>'desde','')::date then coalesce(metadatos.contexto->'desde','"MANUAL"'::jsonb) else '"MANUAL"'::jsonb end,
   'ingreso',case when anterior.fecha_primer_ingreso is not distinct from nullif(p_datos->>'fecha_primer_ingreso','')::date then coalesce(metadatos.contexto->'ingreso','"MANUAL"'::jsonb) else '"MANUAL"'::jsonb end,
   'grado',case when anterior.grado_personal is not distinct from p_datos->>'grado_personal' then coalesce(metadatos.contexto->'grado','"MANUAL"'::jsonb) else '"MANUAL"'::jsonb end);
 end if;
 h=public.ic_trayectorias(array[p_programa])->0;
 if nullif(p_ref->>'huella','') is null or p_ref->>'huella' is distinct from h->>'huella' then raise exception 'El historial cambió; vuelve a revisarlo antes de guardar';end if;
 select c.fecha_inicio,upper(trim(c.tipo_periodo)) into inicio,periodo from public.ciclos_escolares c where c.id=p_ciclo;
 select upper(coalesce(p.modelo,'')),p.total_periodos,upper(trim(p.tipo_periodo)) into modelo,limite,periodo_plan from public.planes_estudio p where p.id=(h->>'plan_id')::uuid;
 ctx=jsonb_build_object('origen','REVISION_HISTORIAL','huella',h->>'huella','historial',h,'ingreso','MANUAL','grado','MANUAL',
  'origen_anterior',case when anterior.id is not null and metadatos.ciclo_origen_id is not distinct from nullif(p_datos->>'ciclo_origen_id','')::uuid then coalesce(metadatos.contexto->'origen_anterior','"MANUAL"'::jsonb) else '"MANUAL"'::jsonb end,
  'desde',case when anterior.id is not null and anterior.desde is not distinct from nullif(p_datos->>'desde','')::date then coalesce(metadatos.contexto->'desde','"MANUAL"'::jsonb) else '"MANUAL"'::jsonb end,
  'advertencia','El historial disponible orienta la revisión; no acredita el día exacto de inscripción, ingreso real, promoción ni egreso');
 if p_ref ? 'aplicar_desde' and jsonb_typeof(p_ref->'aplicar_desde') is distinct from 'boolean' then raise exception 'La aceptación de la fecha propuesta debe ser explícita';end if;
 if p_ref ? 'aplicar_origen' and jsonb_typeof(p_ref->'aplicar_origen') is distinct from 'boolean' then raise exception 'La aceptación del origen debe ser explícita';end if;
 if p_ref->'aplicar_desde'='true'::jsonb and p_ref ? 'metodo_desde' and p_ref->>'metodo_desde' is distinct from 'HISTORIAL_MAS_ANTIGUO' then raise exception 'Método de fecha propuesto no reconocido';end if;
 if (p_ref->'aplicar_desde'='true'::jsonb and p_ref->>'metodo_desde'='HISTORIAL_MAS_ANTIGUO') or p_ref->'aplicar_origen'='true'::jsonb then
  if inicio is null or periodo_plan is distinct from periodo then raise exception 'El destino y el programa deben tener la misma periodicidad y fechas';end if;
  if exists(select 1 from jsonb_array_elements(h->'ciclos') c where jsonb_array_length(c->'materias')>0
    and (upper(trim(c->>'tipo_periodo')) is distinct from periodo or nullif(c->>'fecha_inicio','') is null)) then raise exception 'Hay antecedentes con periodicidad distinta o sin fecha; revisa la trayectoria';end if;
  if p_datos->>'estado'='CANCELADA' then raise exception 'Una inscripción cancelada requiere revisión manual';end if;
 end if;
 if p_ref->'aplicar_desde'='true'::jsonb and p_ref->>'metodo_desde'='HISTORIAL_MAS_ANTIGUO' then
  select c into primero from jsonb_array_elements(h->'ciclos') c where jsonb_array_length(c->'materias')>0 order by c->>'fecha_inicio',c->>'id' limit 1;
  if primero is null or (primero->>'fecha_inicio')::date>inicio
   or (select count(*) from jsonb_array_elements(h->'ciclos') c where jsonb_array_length(c->'materias')>0 and c->>'fecha_inicio'=primero->>'fecha_inicio')<>1
   or p_ref->>'ciclo_desde_id' is distinct from primero->>'id'
   or p_ref->>'fecha_desde_propuesta' is distinct from primero->>'fecha_inicio'
   or p_datos->>'desde' is distinct from primero->>'fecha_inicio' then raise exception 'La fecha histórica no coincide con el primer ciclo con calificaciones';end if;
  if nullif(p_datos->>'fecha_primer_ingreso','')::date>(primero->>'fecha_inicio')::date
   or nullif(p_datos->>'hasta','')::date<(primero->>'fecha_inicio')::date then raise exception 'La fecha histórica contradice el primer ingreso o término capturado';end if;
  if anterior.id is not null and (anterior.desde is distinct from (primero->>'fecha_inicio')::date
   or metadatos.contexto#>>'{desde,metodo}' is distinct from 'INICIO_HISTORICO_CON_CALIFICACIONES') then raise exception 'La fecha guardada se conserva; no se sustituye ni reclasifica con una propuesta histórica';end if;
  ctx=ctx||jsonb_build_object('desde',jsonb_build_object('metodo','INICIO_HISTORICO_CON_CALIFICACIONES','ciclo_id',primero->>'id','ciclo_destino_id',p_ciclo,'fecha',primero->>'fecha_inicio','aproximado',true,'materias',jsonb_array_length(primero->'materias')));
 elsif p_ref->'aplicar_desde'='true'::jsonb then
  if inicio is null or periodo_plan is distinct from periodo
   or p_ref->>'ciclo_desde_id' is distinct from p_ciclo::text
   or p_ref->>'fecha_desde_propuesta' is distinct from inicio::text
   or p_datos->>'desde' is distinct from inicio::text then raise exception 'La fecha propuesta no corresponde al inicio del ciclo de destino';end if;
  if (select count(*) from jsonb_array_elements(h->'ciclos') c where c->>'id'=p_ciclo::text)<>1 then raise exception 'No hay un antecedente único del destino para proponer la fecha';end if;
  select c into actual from jsonb_array_elements(h->'ciclos') c where c->>'id'=p_ciclo::text;
  if upper(trim(actual->>'tipo_periodo')) is distinct from periodo or actual->>'fecha_inicio' is distinct from inicio::text
   or jsonb_array_length(coalesce(actual->'materias','[]'::jsonb))=0 then raise exception 'Se requieren calificaciones del mismo alumno y plan en el ciclo de destino';end if;
  if p_datos->>'estado'='CANCELADA' or nullif(p_datos->>'fecha_primer_ingreso','')::date>inicio or nullif(p_datos->>'hasta','')::date<inicio then raise exception 'La fecha real requiere revisión manual por su vigencia o primer ingreso';end if;
  if anterior.id is not null then
   if anterior.desde is distinct from inicio then raise exception 'La fecha guardada se conserva; no se sustituye con una propuesta';end if;
   if metadatos.contexto#>>'{desde,metodo}' is distinct from 'INICIO_CICLO_DESTINO_CON_CALIFICACIONES' then raise exception 'Una fecha ya acreditada no se reclasifica como inferida';end if;
  end if;
  ctx=ctx||jsonb_build_object('desde',jsonb_build_object('metodo','INICIO_CICLO_DESTINO_CON_CALIFICACIONES','ciclo_id',p_ciclo,'fecha',inicio,'aproximado',true,'materias',jsonb_array_length(actual->'materias')));
 end if;
 if p_ref->'aplicar_origen'='true'::jsonb then
  select c into ultimo from jsonb_array_elements(h->'ciclos') c where jsonb_array_length(c->'materias')>0
   and (c->>'fecha_inicio')::date<inicio and c->>'id'<>p_ciclo::text order by c->>'fecha_inicio' desc,c->>'id' limit 1;
  if ultimo is null or p_datos->>'tipo_ingreso'='PRIMER_INGRESO'
   or (select count(*) from jsonb_array_elements(h->'ciclos') c where jsonb_array_length(c->'materias')>0 and c->>'fecha_inicio'=ultimo->>'fecha_inicio')<>1
   or p_ref->>'ciclo_origen_propuesto_id' is distinct from ultimo->>'id'
   or p_datos->>'ciclo_origen_id' is distinct from ultimo->>'id' then raise exception 'El origen propuesto no coincide con el último ciclo anterior con calificaciones';end if;
  if metadatos.ciclo_origen_id is not null and metadatos.ciclo_origen_id::text is distinct from ultimo->>'id' then raise exception 'Se conserva el origen guardado; una corrección distinta requiere revisión manual';end if;
  ctx=ctx||jsonb_build_object('origen_anterior',jsonb_build_object('metodo','ULTIMO_CICLO_ANTERIOR_CON_CALIFICACIONES','ciclo_id',ultimo->>'id','ciclo_destino_id',p_ciclo,'requiere_revision',true));
 end if;
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


revoke all on function public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 alter publication supabase_realtime add table public.inscripciones_programa_ingreso;
 end if;
end$$;
commit;
