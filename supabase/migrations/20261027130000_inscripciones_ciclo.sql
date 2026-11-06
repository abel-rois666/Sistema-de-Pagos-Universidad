-- PREPARADA, NO EJECUTADA. Registro operativo independiente de grupos y pagos.
-- No crea inscripciones históricas ni modifica los estatus institucionales existentes.
begin;
do $$ begin
 if to_regprocedure('public.get_my_rol()') is null then raise exception 'Revisa el preflight: falta get_my_rol()';end if;
 if to_regclass('public.inscripciones_ciclo') is not null then raise exception 'Inscripciones por ciclo ya existe; verifica su versión antes de instalar';end if;
end $$;

create table public.inscripciones_ciclo (
 id uuid primary key default gen_random_uuid(),
 alumno_programa_id uuid not null references public.alumno_programas(id) on delete restrict,
 ciclo_id uuid not null references public.ciclos_escolares(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 estado text not null check(estado in('CONFIRMADA','BAJA','CANCELADA')),
 desde date not null,hasta date,grado_personal text not null,
 tipo_ingreso text not null check(tipo_ingreso in('PRIMER_INGRESO','REINGRESO','DESCONOCIDO')),
 fecha_primer_ingreso date,evidencia text not null,motivo text not null,
 procedencia text not null default 'CONTROL_ESCOLAR',
 creado_por uuid not null default auth.uid(),creado_en timestamptz not null default clock_timestamp(),
 actualizado_por uuid not null default auth.uid(),actualizado_en timestamptz not null default clock_timestamp(),
 unique(alumno_programa_id,ciclo_id),
 check(hasta is null or hasta>=desde),check(estado<>'BAJA' or hasta is not null),
 check(fecha_primer_ingreso is null or fecha_primer_ingreso<=desde),
 check(tipo_ingreso<>'PRIMER_INGRESO' or fecha_primer_ingreso is not null),
 check(length(trim(evidencia))>=5),check(length(trim(motivo))>=10)
);
create index on public.inscripciones_ciclo(ciclo_id,estado);
create table public.inscripciones_ciclo_historial (
 id uuid primary key default gen_random_uuid(),inscripcion_id uuid not null references public.inscripciones_ciclo(id) on delete restrict,
 creado_por uuid not null default auth.uid(),creado_en timestamptz not null default clock_timestamp(),
 motivo text not null,antes jsonb,despues jsonb not null
);
create index on public.inscripciones_ciclo_historial(inscripcion_id,creado_en);
create table public.inscripciones_ciclo_config (
 id boolean primary key default true check(id),integrar_promocion boolean not null default false,
 actualizado_por uuid,actualizado_en timestamptz not null default clock_timestamp()
);
insert into public.inscripciones_ciclo_config(id) values(true);
create table public.inscripciones_ciclo_config_historial (
 id uuid primary key default gen_random_uuid(),creado_por uuid not null default auth.uid(),
 creado_en timestamptz not null default clock_timestamp(),integrar_promocion boolean not null
);

create function public.ic_autorizado() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and coalesce(public.get_my_rol() in('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR'),false)
$$;
revoke all on function public.ic_autorizado() from public,anon;
grant execute on function public.ic_autorizado() to authenticated;
do $$ declare t text;begin
 foreach t in array array['inscripciones_ciclo','inscripciones_ciclo_historial','inscripciones_ciclo_config','inscripciones_ciclo_config_historial'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy lectura_control_escolar on public.%I for select to authenticated using(public.ic_autorizado())',t);
 end loop;
end $$;

create function public.ic_configuracion() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para inscripciones';end if;
 return (select jsonb_build_object('version',1,'integrar_promocion',integrar_promocion,
  'puente_911',to_regprocedure('public.ic_acreditar_911(jsonb)') is not null) from public.inscripciones_ciclo_config where id);
end $$;

create function public.ic_consultar(p_ciclo uuid,p_historicos boolean default false)
returns table(alumno_programa_id uuid,alumno_id uuid,matricula text,nombre text,plan_id uuid,
 programa text,tipo_periodo text,modalidad text,grado_sugerido text,total_periodos integer,
 estatus_programa text,historico boolean,compatible boolean,grupos jsonb,fuentes text[],inscripcion jsonb)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare periodo text;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para inscripciones';end if;
 select upper(trim(c.tipo_periodo)) into periodo from public.ciclos_escolares c where c.id=p_ciclo;
 if not found then raise exception 'Ciclo inexistente';end if;
 return query
 select ap.id,a.id,a.matricula::text,coalesce(a.nombre_completo,concat_ws(' ',a.apellido_paterno,a.apellido_materno,a.nombres))::text,
  p.id,concat_ws(' · ',p.clave_legado,p.nombre)::text,p.tipo_periodo::text,p.modalidad::text,a.grado_actual::text,p.total_periodos::integer,
  ap.estatus::text,not(ap.es_vigente and coalesce(upper(ap.estatus) in('ACTIVO','CURSANDO'),false)),
  coalesce(upper(trim(p.tipo_periodo))=periodo,false),
  coalesce(gs.lista,'[]'::jsonb),
  array_remove(array[case when gs.lista is not null then 'Grupo' end,
   case when exists(select 1 from public.inscripciones_academicas ia join public.asignaturas asi on asi.id=ia.asignatura_id where ia.alumno_id=a.id and ia.ciclo_id=p_ciclo and asi.plan_id=p.id) then 'Materias' end,
   case when exists(select 1 from public.planes_pago pp where pp.alumno_id=a.id and pp.ciclo_id=p_ciclo) then 'Plan de pagos (indicio)' end],null),
  case when ic.id is null then null else to_jsonb(ic) end
 from public.alumno_programas ap join public.alumnos a on a.id=ap.alumno_id join public.planes_estudio p on p.id=ap.plan_id
 left join public.inscripciones_ciclo ic on ic.alumno_programa_id=ap.id and ic.ciclo_id=p_ciclo
 left join lateral(select jsonb_agg(distinct g.codigo_grupo order by g.codigo_grupo) lista from public.alumnos_grupos ag join public.grupos g on g.id=ag.grupo_id
   where ag.alumno_id=a.id and g.plan_id=p.id and g.ciclo_id=p_ciclo) gs on true
 where (coalesce(upper(trim(p.tipo_periodo))=periodo,false) or ic.id is not null)
 and (p_historicos or (ap.es_vigente and upper(ap.estatus) in('ACTIVO','CURSANDO')) or ic.id is not null)
 order by 4,1;
end $$;

create function public.ic_resumen(p_ciclo uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare hoy date=(clock_timestamp() at time zone 'America/Mexico_City')::date;r jsonb;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para inscripciones';end if;
 select jsonb_build_object('inscritos',count(*) filter(where inscripcion->>'estado'<>'CANCELADA' and (inscripcion->>'desde')::date<=hoy and (inscripcion->>'hasta' is null or (inscripcion->>'hasta')::date>=hoy)),
 'sin_grupo',count(*) filter(where inscripcion->>'estado'<>'CANCELADA' and (inscripcion->>'desde')::date<=hoy and (inscripcion->>'hasta' is null or (inscripcion->>'hasta')::date>=hoy) and jsonb_array_length(grupos)=0),
 'pendientes',count(*) filter(where inscripcion is null)) into r from public.ic_consultar(p_ciclo,false);
 return r;
end $$;

create function public.ic_guardar_lote(p_ciclo uuid,p_filas jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare fila jsonb;previa public.inscripciones_ciclo;nueva public.inscripciones_ciclo;ap public.alumno_programas;
 plan public.planes_estudio;periodo text;grado integer;fecha_desde date;fecha_hasta date;primer_ingreso date;total integer=0;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para confirmar inscripciones';end if;
 if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Formato de lote inválido';end if;
 if jsonb_array_length(p_filas) not between 1 and 500 then raise exception 'Selecciona entre 1 y 500 inscripciones';end if;
 if (select count(distinct value->>'alumno_programa_id') from jsonb_array_elements(p_filas))<>jsonb_array_length(p_filas) then raise exception 'Programa repetido en el lote';end if;
 select upper(trim(c.tipo_periodo)) into periodo from public.ciclos_escolares c where c.id=p_ciclo for share;
 if not found or nullif(periodo,'') is null then raise exception 'Elige un ciclo con periodicidad definida';end if;
 for fila in select value from jsonb_array_elements(p_filas) order by value->>'alumno_programa_id' loop
  perform pg_advisory_xact_lock(hashtextextended((fila->>'alumno_programa_id')::uuid::text||':'||p_ciclo::text,271300));
  select * into ap from public.alumno_programas where id=(fila->>'alumno_programa_id')::uuid for share;
  if not found then raise exception 'El programa del alumno ya no existe';end if;
  select * into plan from public.planes_estudio where id=ap.plan_id for share;
  if not found or upper(trim(plan.tipo_periodo)) is distinct from periodo then raise exception 'La periodicidad del programa no corresponde al ID del ciclo';end if;
  if not(ap.es_vigente and coalesce(upper(ap.estatus) in('ACTIVO','CURSANDO'),false)) and
   (fila->'admitir_historico' is distinct from 'true'::jsonb or coalesce(length(trim(fila->>'motivo')),0)<20) then
   raise exception 'Confirma y justifica la revisión del programa histórico o no cursable';end if;
  if coalesce(fila->>'estado','') not in('CONFIRMADA','BAJA','CANCELADA') or coalesce(fila->>'tipo_ingreso','') not in('PRIMER_INGRESO','REINGRESO','DESCONOCIDO') then raise exception 'Situación o tipo de ingreso inválido';end if;
  if coalesce(length(trim(fila->>'motivo')),0)<10 or coalesce(length(trim(fila->>'evidencia')),0)<5 then raise exception 'Completa el motivo y la evidencia de inscripción';end if;
  if upper(trim(coalesce(fila->>'grado_personal',''))) !~ '^([0-9]+)(ER|RO|DO|TO|VO|MO|NO|º|°)?$' then raise exception 'Grado personal inválido';end if;
  grado=substring(trim(fila->>'grado_personal') from '^([0-9]+)')::integer;
  if grado<1 or (plan.total_periodos is not null and grado>plan.total_periodos) then raise exception 'El grado personal excede la duración del plan';end if;
  fecha_desde=nullif(fila->>'desde','')::date;fecha_hasta=nullif(fila->>'hasta','')::date;primer_ingreso=nullif(fila->>'fecha_primer_ingreso','')::date;
  if fecha_desde is null or fecha_hasta<fecha_desde or primer_ingreso>fecha_desde or (fila->>'estado'='BAJA' and fecha_hasta is null)
    or (fila->>'tipo_ingreso'='PRIMER_INGRESO' and primer_ingreso is null) then raise exception 'Revisa vigencia y fecha de primer ingreso';end if;
  select * into previa from public.inscripciones_ciclo where alumno_programa_id=ap.id and ciclo_id=p_ciclo for update;
  if found then
   if fila->>'inscripcion_id' is distinct from previa.id::text or coalesce((fila->>'revision')::integer,0)<>previa.revision then raise exception 'Otra sesión cambió la inscripción. Recarga antes de guardar';end if;
   update public.inscripciones_ciclo set estado=fila->>'estado',desde=fecha_desde,hasta=fecha_hasta,grado_personal=trim(fila->>'grado_personal'),
    tipo_ingreso=fila->>'tipo_ingreso',fecha_primer_ingreso=primer_ingreso,evidencia=trim(fila->>'evidencia'),motivo=trim(fila->>'motivo'),
    revision=revision+1,actualizado_por=auth.uid(),actualizado_en=clock_timestamp() where id=previa.id returning * into nueva;
  else
   if coalesce((fila->>'revision')::integer,0)<>0 or nullif(fila->>'inscripcion_id','') is not null then raise exception 'La inscripción cambió. Recarga el lote';end if;
   insert into public.inscripciones_ciclo(alumno_programa_id,ciclo_id,estado,desde,hasta,grado_personal,tipo_ingreso,fecha_primer_ingreso,evidencia,motivo)
    values(ap.id,p_ciclo,fila->>'estado',fecha_desde,fecha_hasta,trim(fila->>'grado_personal'),fila->>'tipo_ingreso',primer_ingreso,trim(fila->>'evidencia'),trim(fila->>'motivo')) returning * into nueva;
  end if;
  insert into public.inscripciones_ciclo_historial(inscripcion_id,motivo,antes,despues) values(nueva.id,nueva.motivo,case when previa.id is null then null else to_jsonb(previa) end,to_jsonb(nueva));
  total=total+1;
 end loop;
 return total;
end $$;

create function public.ic_integrar_promocion(p_activar boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or public.get_my_rol() is distinct from 'ADMINISTRADOR' then raise exception 'Solo Administración puede cambiar esta integración';end if;
 if p_activar is null then raise exception 'Valor de integración inválido';end if;
 if p_activar and to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)') is null then raise exception 'Verifica primero la función de promoción instalada';end if;
 update public.inscripciones_ciclo_config set integrar_promocion=p_activar,actualizado_por=auth.uid(),actualizado_en=clock_timestamp() where id;
 insert into public.inscripciones_ciclo_config_historial(integrar_promocion) values(p_activar);
end $$;

-- Cliente actualizado: una sola llamada mantiene avance, finanzas e inscripción en la misma transacción.
-- La integración queda APAGADA de inicio y no altera la función anterior ni sus contratos.
create function public.ic_promover_alumno(p_alumno_id uuid,p_ciclo_id uuid,p_programa_id uuid,p_grado_esperado text,
 p_plan_pago_id uuid,p_copiar_conceptos boolean default false,p_crear_plan boolean default true) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare resultado jsonb;actual public.inscripciones_ciclo;integrar boolean;hoy date=(clock_timestamp() at time zone 'America/Mexico_City')::date;
begin
 if not public.ic_autorizado() then raise exception 'Sin permiso para reinscribir';end if;
 select integrar_promocion into integrar from public.inscripciones_ciclo_config where id;
 -- El bloqueo usa el mismo orden que el guardado de fuentes del nuevo módulo.
 if integrar then perform pg_advisory_xact_lock(hashtextextended(p_programa_id::text||':'||p_ciclo_id::text,271300));end if;
 resultado=public.promover_alumno_ciclo(p_alumno_id,p_ciclo_id,p_programa_id,p_grado_esperado,p_plan_pago_id,p_copiar_conceptos,p_crear_plan);
 if integrar and resultado->>'tipo'='AVANCE' then
  select * into actual from public.inscripciones_ciclo where alumno_programa_id=p_programa_id and ciclo_id=p_ciclo_id;
  if found then
   if actual.estado<>'CONFIRMADA' or substring(actual.grado_personal from '^([0-9]+)')::integer<>substring(resultado->>'grado' from '^([0-9]+)')::integer then raise exception 'Revisa la inscripción existente antes de promover; la operación completa se revierte';end if;
   -- Conserva fechas, evidencia y grado ya acreditados por Control Escolar.
  else
   perform public.ic_guardar_lote(p_ciclo_id,jsonb_build_array(jsonb_build_object('alumno_programa_id',p_programa_id,'revision',0,
    'estado','CONFIRMADA','desde',hoy,'hasta',null,'grado_personal',resultado->>'grado','tipo_ingreso',
    case when substring(resultado->>'grado' from '^([0-9]+)')::integer>1 then 'REINGRESO' else 'DESCONOCIDO' end,
    'fecha_primer_ingreso',null,'evidencia','Acto administrativo de reinscripción y promoción confirmado por Control Escolar',
    'motivo','Inscripción registrada al confirmar la promoción; fecha efectiva del acto administrativo','admitir_historico',false)));
  end if;
  resultado=resultado||jsonb_build_object('inscripcion_registrada',true);
 else resultado=resultado||jsonb_build_object('inscripcion_registrada',false);end if;
 return resultado;
end $$;
revoke all on function public.ic_configuracion(),public.ic_consultar(uuid,boolean),public.ic_resumen(uuid),public.ic_guardar_lote(uuid,jsonb),public.ic_integrar_promocion(boolean),public.ic_promover_alumno(uuid,uuid,uuid,text,uuid,boolean,boolean) from public,anon;
grant execute on function public.ic_configuracion(),public.ic_consultar(uuid,boolean),public.ic_resumen(uuid),public.ic_guardar_lote(uuid,jsonb),public.ic_integrar_promocion(boolean),public.ic_promover_alumno(uuid,uuid,uuid,text,uuid,boolean,boolean) to authenticated;

-- Las notificaciones respetan RLS. La pantalla refresca sin sustituir un formulario abierto.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.inscripciones_ciclo;
 end if;
end $$;
commit;
