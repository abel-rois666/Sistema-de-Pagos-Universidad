-- Propuestas históricas: primer ciclo con notas y último ciclo anterior con notas.
-- SQL autorizado/preparado: no ejecutar automáticamente ni modificar registros existentes.
begin;
do $$begin
 if to_regprocedure('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)') is null
  or to_regclass('public.inscripciones_ciclo_contextos') is null then raise exception 'Instala primero 20261029100000_preparaciones_historial_inscripciones.sql';end if;
 if position('INICIO_CICLO_DESTINO_CON_CALIFICACIONES' in pg_get_functiondef('public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)'::regprocedure))=0 then raise exception 'Instala primero 20261029140000_fecha_inscripcion_propuesta.sql y revisa el preflight';end if;
end$$;
create or replace function public.ic_contexto_revisado(p_programa uuid,p_ciclo uuid,p_datos jsonb,p_ref jsonb) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare h jsonb;primero jsonb;ultimo jsonb;actual jsonb;inicio date;periodo text;modelo text;periodo_plan text;grado integer;propuesto integer;limite integer;ctx jsonb;
 anterior public.inscripciones_ciclo;metadatos public.inscripciones_ciclo_contextos;
begin
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

create or replace function public.ic_configuracion() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para inscripciones';end if;
 return (select jsonb_build_object('version',4,'integrar_promocion',integrar_promocion,'puente_911',to_regprocedure('public.ic_acreditar_911(jsonb)') is not null,'preparaciones',true,'propuesta_fecha_inscripcion',true,'propuesta_fecha_historial',true) from public.inscripciones_ciclo_config where id);
end$$;

revoke all on function public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.ic_configuracion() from public,anon;
grant execute on function public.ic_configuracion() to authenticated;
commit;
