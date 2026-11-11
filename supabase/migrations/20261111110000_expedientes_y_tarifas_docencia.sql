-- Preparada, NO ejecutada. No altera publicaciones, recibos, saldos ni nómina.
begin;
create table public.docencia_expedientes (
 id uuid primary key default gen_random_uuid(), docente_id uuid not null references public.docentes(id) on delete restrict,
 ciclo_id uuid not null references public.ciclos_escolares(id) on delete restrict,
 carpeta_drive text, revision integer not null default 1 check(revision>0), actualizado_en timestamptz not null default now(), unique(docente_id,ciclo_id),
 check(carpeta_drive is null or carpeta_drive ~ '^https://(drive|docs)\.google\.com/[^[:space:]]*$')
);
create table public.docencia_entregas (
 expediente_id uuid not null references public.docencia_expedientes(id) on delete restrict,
 asignatura_id uuid not null references public.asignaturas(id) on delete restrict,
 nombre_asignatura text not null, clave_asignatura text, plan_referencia text,
 examenes text[] not null, entregados text[] not null,
 primary key(expediente_id,asignatura_id),
 check(cardinality(examenes) between 1 and 4 and examenes <@ array['P1','P2','P3','EXTRA']::text[]),
 check(entregados <@ (array['PLANEACION','CRITERIOS','POLITICAS']::text[] || examenes))
);
create table public.docencia_tarifas_generales (
 ciclo_id uuid primary key references public.ciclos_escolares(id) on delete restrict,
 monto numeric(12,2) check(monto>=0), cortes jsonb not null default '[]' check(jsonb_typeof(cortes)='array'),
 revision integer not null default 1 check(revision>0), actualizado_en timestamptz not null default now()
);
create table public.docencia_tarifas_docentes (
 ciclo_id uuid not null references public.ciclos_escolares(id) on delete restrict,
 docente_id uuid not null references public.docentes(id) on delete restrict,
 monto numeric(12,2) check(monto>=0), revision integer not null default 1 check(revision>0), actualizado_en timestamptz not null default now(),primary key(ciclo_id,docente_id)
);
create table public.docencia_auditoria (
 id uuid primary key default gen_random_uuid(), ciclo_id uuid not null, docente_id uuid, seccion text not null,
 motivo text not null, antes jsonb, despues jsonb, creado_por uuid, rol text not null, creado_en timestamptz not null default now()
);
alter table public.docencia_expedientes enable row level security;
alter table public.docencia_entregas enable row level security;
alter table public.docencia_tarifas_generales enable row level security;
alter table public.docencia_tarifas_docentes enable row level security;
alter table public.docencia_auditoria enable row level security;
revoke all on public.docencia_expedientes,public.docencia_entregas,public.docencia_tarifas_generales,public.docencia_tarifas_docentes,public.docencia_auditoria from public,anon,authenticated;

-- Lectura acotada a un docente y ciclo, sin borradores ni datos de otros docentes.
create function public.docencia_consultar_v1(p_docente uuid,p_ciclo uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); ciclo jsonb; h public.horarios_versiones; ex public.docencia_expedientes; cargas jsonb; sesiones jsonb; calendarios jsonb; eventos jsonb; financiero jsonb;
begin
 if p_docente is null or p_ciclo is null or not exists(select 1 from public.docentes where id=p_docente) then raise exception 'Selecciona un docente y ciclo válidos';end if;
 select jsonb_build_object('id',id,'nombre',nombre,'tipo_periodo',tipo_periodo,'fecha_inicio',fecha_inicio,'fecha_termino',fecha_termino) into ciclo from public.ciclos_escolares where id=p_ciclo;
 if ciclo is null then raise exception 'Ciclo no encontrado';end if;
 select * into h from public.horarios_versiones where ciclo_id=p_ciclo and estado='publicado';
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('asignatura',case when a.id is null then null else jsonb_build_object('clave_legado',a.clave_legado,'plan_id',a.plan_id,'planes_estudio',case when e.id is null then null else to_jsonb(e)||jsonb_build_object('carreras',case when ca.id is null then null else jsonb_build_object('nombre',ca.nombre) end) end) end) order by c.id),'[]') into cargas
 from public.horarios_cargas c left join public.asignaturas a on a.id=c.asignatura_id left join public.planes_estudio e on e.id=a.plan_id left join public.carreras ca on ca.id=e.carrera_id where c.horario_id=h.id and c.docente_id=p_docente;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.dia_semana,s.hora_inicio,s.id),'[]') into sesiones from public.horarios_sesiones s join public.horarios_cargas c on c.id=s.carga_id and c.horario_id=s.horario_id where s.horario_id=h.id and c.docente_id=p_docente;
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('plan_ids',coalesce((select jsonb_agg(cp.plan_id order by cp.plan_id) from public.calendarios_planes cp where cp.calendario_id=c.id),'[]')) order by c.id),'[]') into calendarios from public.calendarios_academicos c where c.ciclo_id=p_ciclo;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.fecha_inicio,e.id),'[]') into eventos from public.calendario_eventos e join public.calendarios_academicos c on c.id=e.calendario_id where c.ciclo_id=p_ciclo;
 select * into ex from public.docencia_expedientes where docente_id=p_docente and ciclo_id=p_ciclo;
 if rol in ('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS') then
  financiero=jsonb_build_object('puede_editar',rol='ADMINISTRADOR','general',coalesce((select jsonb_build_object('monto',monto,'revision',revision,'cortes',cortes) from public.docencia_tarifas_generales where ciclo_id=p_ciclo),jsonb_build_object('monto',null,'revision',0,'cortes','[]'::jsonb)),
  'excepcion',coalesce((select jsonb_build_object('monto',monto,'revision',revision) from public.docencia_tarifas_docentes where ciclo_id=p_ciclo and docente_id=p_docente),jsonb_build_object('monto',null,'revision',0)));
 end if;
 return jsonb_build_object('ciclo',ciclo,'publicacion',case when h.id is null then null else jsonb_build_object('id',h.id,'version',h.version) end,'cargas',cargas,'sesiones',sesiones,'calendarios',calendarios,'eventos',eventos,
 'puede_editar_expediente',rol in ('ADMINISTRADOR','COORDINADOR ACADEMICO'),'financiero',financiero,'expediente',jsonb_build_object('revision',coalesce(ex.revision,0),'carpeta_drive',ex.carpeta_drive,'entregas',coalesce((select jsonb_agg(to_jsonb(d)-'expediente_id' order by d.asignatura_id) from public.docencia_entregas d where expediente_id=ex.id),'[]')));
end $$;

create function public.docencia_expediente_guardar_v1(p_docente uuid,p_ciclo uuid,p_horario uuid,p_revision integer,p_entregas jsonb,p_carpeta text,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); ex public.docencia_expedientes; h uuid; fila jsonb; aid uuid; examenes text[]; entregados text[]; antes jsonb;
begin
 if rol not in ('ADMINISTRADOR','COORDINADOR ACADEMICO') then raise exception 'Sin permiso de edición académica' using errcode='42501';end if;
 if p_motivo is null or length(trim(p_motivo)) not between 5 and 1000 or p_revision is null or p_revision<0 then raise exception 'Revisa el motivo y la revisión';end if;
 -- Serializa altas y ediciones del mismo expediente, incluso cuando aún no hay cabecera.
 perform pg_advisory_xact_lock(hashtextextended(p_docente::text||':'||p_ciclo::text,0));
 perform 1 from public.ciclos_escolares where id=p_ciclo for share;
 select id into h from public.horarios_versiones where ciclo_id=p_ciclo and estado='publicado' for share;
 if p_horario is null or h is distinct from p_horario then raise exception 'El horario publicado cambió. Actualiza la consulta antes de guardar' using errcode='40001';end if;
 if not exists(select 1 from public.horarios_cargas where horario_id=h and docente_id=p_docente) then raise exception 'No hay asignaciones publicadas para este docente';end if;
 if p_carpeta is not null and (length(p_carpeta)>2048 or p_carpeta !~ '^https://(drive|docs)\.google\.com/[^[:space:]]*$') then raise exception 'Indica un enlace HTTPS de Google Drive';end if;
 if p_entregas is null or jsonb_typeof(p_entregas)<>'array' or jsonb_array_length(p_entregas)>300 then raise exception 'Revisa las entregas';end if;
 if (select count(*) from jsonb_array_elements(p_entregas))<>(select count(distinct x->>'asignatura_id') from jsonb_array_elements(p_entregas) x) then raise exception 'Asignaturas repetidas o sin ID';end if;
 select * into ex from public.docencia_expedientes where docente_id=p_docente and ciclo_id=p_ciclo for update;
 if coalesce(ex.revision,0)<>p_revision then raise exception 'El expediente cambió. Conserva la captura y vuelve a consultar' using errcode='40001';end if;
 antes=jsonb_build_object('cabecera',to_jsonb(ex),'entregas',coalesce((select jsonb_agg(to_jsonb(d)) from public.docencia_entregas d where expediente_id=ex.id),'[]'));
 insert into public.docencia_expedientes(docente_id,ciclo_id,carpeta_drive,revision) values(p_docente,p_ciclo,p_carpeta,p_revision+1) on conflict(docente_id,ciclo_id) do update set carpeta_drive=excluded.carpeta_drive,revision=excluded.revision,actualizado_en=now() returning * into ex;
 for fila in select value from jsonb_array_elements(p_entregas) loop
  if jsonb_typeof(fila)<>'object' or fila-array['asignatura_id','examenes','entregados']<>'{}' then raise exception 'Campos de entrega no reconocidos';end if;
  aid=(fila->>'asignatura_id')::uuid;
  if not exists(select 1 from public.horarios_cargas where horario_id=h and docente_id=p_docente and asignatura_id=aid) then raise exception 'La asignatura no está publicada para este docente';end if;
  if jsonb_typeof(fila->'examenes') is distinct from 'array' or jsonb_typeof(fila->'entregados') is distinct from 'array' then raise exception 'Revisa los documentos';end if;
  select coalesce(array_agg(value),'{}') into examenes from jsonb_array_elements_text(fila->'examenes');
  select coalesce(array_agg(value),'{}') into entregados from jsonb_array_elements_text(fila->'entregados');
  if cardinality(examenes) not between 1 and 4 or not examenes<@array['P1','P2','P3','EXTRA']::text[] or cardinality(examenes)<>(select count(distinct v) from unnest(examenes) v) or not entregados<@(array['PLANEACION','CRITERIOS','POLITICAS']::text[]||examenes) or cardinality(entregados)<>(select count(distinct v) from unnest(entregados) v) then raise exception 'Documentos no válidos o repetidos';end if;
  insert into public.docencia_entregas(expediente_id,asignatura_id,nombre_asignatura,clave_asignatura,plan_referencia,examenes,entregados)
  select ex.id,a.id,a.nombre,a.clave_legado,concat_ws(' · ',e.clave_legado,e.nombre),examenes,entregados from public.asignaturas a join public.planes_estudio e on e.id=a.plan_id where a.id=aid
  on conflict(expediente_id,asignatura_id) do update set examenes=excluded.examenes,entregados=excluded.entregados;
 end loop;
 -- No elimina entregas de asignaturas retiradas o no incluidas en el guardado.
 insert into public.docencia_auditoria(ciclo_id,docente_id,seccion,motivo,antes,despues,creado_por,rol) values(p_ciclo,p_docente,'expediente',trim(p_motivo),antes,jsonb_build_object('revision',ex.revision,'horario_id',h,'carpeta_drive',p_carpeta,'entregas',p_entregas),auth.uid(),rol);
 return jsonb_build_object('revision',ex.revision);
end $$;

create function public.docencia_tarifa_guardar_v1(p_ciclo uuid,p_docente uuid,p_revision integer,p_monto numeric,p_cortes jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare rol text=public._personal_rol_v1(); rev integer; tipo text; cantidad integer; fila jsonb; ini date; fin date; anterior_fin date; desde date; hasta date; antes jsonb;
begin
 if rol<>'ADMINISTRADOR' then raise exception 'Solo Administración configura tarifas y cortes' using errcode='42501';end if;
 if p_motivo is null or length(trim(p_motivo)) not between 5 and 1000 or p_revision is null or p_revision<0 then raise exception 'Revisa el motivo y la revisión';end if;
 if p_monto is not null and (p_monto::text in ('NaN','Infinity','-Infinity') or p_monto<0 or p_monto>9999999999.99 or p_monto<>round(p_monto,2)) then raise exception 'La tarifa debe ser no negativa y tener hasta dos decimales';end if;
 -- El ciclo serializa también primeras altas; una excepción no cambia los cortes generales.
 select upper(trim(tipo_periodo)),fecha_inicio,fecha_termino into tipo,desde,hasta from public.ciclos_escolares where id=p_ciclo for update;
 if not found then raise exception 'Ciclo no encontrado';end if;
 cantidad=case tipo when 'CUATRIMESTRAL' then 7 when 'SEMESTRAL' then 8 end;
 if cantidad is null then raise exception 'Periodicidad del ciclo sin identificar';end if;
 if p_docente is null then
  select to_jsonb(t),revision into antes,rev from public.docencia_tarifas_generales t where ciclo_id=p_ciclo for update;
  if p_cortes is null or jsonb_typeof(p_cortes)<>'array' then raise exception 'Revisa las fechas de corte';end if;
  if jsonb_array_length(p_cortes)>0 then
   if jsonb_array_length(p_cortes)<>cantidad then raise exception 'Define % cortes',cantidad;end if;
   select coalesce(min(fecha_inicio),desde),coalesce(max(fecha_fin),hasta) into desde,hasta from public.calendarios_academicos where ciclo_id=p_ciclo;
   for fila in select value from jsonb_array_elements(p_cortes) loop
    if jsonb_typeof(fila)<>'object' or fila-array['inicio','fin']<>'{}' or coalesce(fila->>'inicio','')!~ '^\d{4}-\d{2}-\d{2}$' or coalesce(fila->>'fin','')!~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fechas de corte no válidas';end if;
    ini=(fila->>'inicio')::date;fin=(fila->>'fin')::date;
    if ini>fin or (anterior_fin is not null and ini<>anterior_fin+1) then raise exception 'Los cortes deben ser consecutivos, sin huecos ni superposiciones';end if;
    anterior_fin=fin;
   end loop;
   if desde is null or hasta is null or (p_cortes->0->>'inicio')::date>desde or fin<hasta then raise exception 'Los cortes deben cubrir todo el calendario del ciclo';end if;
  end if;
  if coalesce(rev,0)<>p_revision then raise exception 'La configuración cambió. Vuelve a consultar' using errcode='40001';end if;
  insert into public.docencia_tarifas_generales(ciclo_id,monto,cortes,revision) values(p_ciclo,p_monto,p_cortes,p_revision+1) on conflict(ciclo_id) do update set monto=excluded.monto,cortes=excluded.cortes,revision=excluded.revision,actualizado_en=now();
 else
  if not exists(select 1 from public.docentes where id=p_docente) then raise exception 'Docente no encontrado';end if;
  if p_cortes is distinct from '[]'::jsonb then raise exception 'Los cortes se configuran para todo el ciclo';end if;
  select to_jsonb(t),revision into antes,rev from public.docencia_tarifas_docentes t where ciclo_id=p_ciclo and docente_id=p_docente for update;
  if coalesce(rev,0)<>p_revision then raise exception 'La excepción cambió. Vuelve a consultar' using errcode='40001';end if;
  insert into public.docencia_tarifas_docentes(ciclo_id,docente_id,monto,revision) values(p_ciclo,p_docente,p_monto,p_revision+1) on conflict(ciclo_id,docente_id) do update set monto=excluded.monto,revision=excluded.revision,actualizado_en=now();
 end if;
 insert into public.docencia_auditoria(ciclo_id,docente_id,seccion,motivo,antes,despues,creado_por,rol) values(p_ciclo,p_docente,'tarifa',trim(p_motivo),antes,jsonb_build_object('monto',p_monto,'cortes',p_cortes,'revision',p_revision+1),auth.uid(),rol);
 return jsonb_build_object('revision',p_revision+1);
end $$;
revoke all on function public.docencia_consultar_v1(uuid,uuid),public.docencia_expediente_guardar_v1(uuid,uuid,uuid,integer,jsonb,text,text),public.docencia_tarifa_guardar_v1(uuid,uuid,integer,numeric,jsonb,text) from public,anon;
grant execute on function public.docencia_consultar_v1(uuid,uuid),public.docencia_expediente_guardar_v1(uuid,uuid,uuid,integer,jsonb,text,text),public.docencia_tarifa_guardar_v1(uuid,uuid,integer,numeric,jsonb,text) to authenticated;
commit;
