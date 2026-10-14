-- Calendarios académicos y medio de sesiones. Aditiva: no modifica borradores ni sesiones históricas.
begin;

alter table public.planes_estudio
  add column if not exists modalidad text not null default 'ESCOLARIZADA';
alter table public.planes_estudio
  add constraint planes_estudio_modalidad_valida check (modalidad in
    ('ESCOLARIZADA', 'MIXTA', 'NO_ESCOLARIZADA', 'COMBINADA'));

alter table public.docentes_grupos_asignaturas
  add column if not exists horas_en_linea integer not null default 0;
alter table public.docentes_grupos_asignaturas
  add constraint dga_horas_en_linea_validas check (horas_en_linea >= 0
    and horas_en_linea <= coalesce(horas_presenciales, 0));

alter table public.horarios_cargas
  add column if not exists horas_en_linea integer not null default 0;
alter table public.horarios_cargas
  add constraint horarios_cargas_horas_en_linea_validas check (horas_en_linea >= 0
    and horas_en_linea <= horas_presenciales);

alter table public.horarios_sesiones
  add column if not exists medio text not null default 'PRESENCIAL';
alter table public.horarios_sesiones
  add constraint horarios_sesiones_medio_valido check (medio in ('PRESENCIAL', 'EN_LINEA'));

create table if not exists public.calendarios_academicos (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_escolares(id),
  nombre text not null check (length(trim(nombre)) between 3 and 160),
  tipo_periodo text not null check (tipo_periodo in ('SEMESTRAL', 'CUATRIMESTRAL')),
  modalidad text not null check (modalidad in ('ESCOLARIZADA', 'MIXTA', 'NO_ESCOLARIZADA', 'COMBINADA')),
  fecha_inicio date not null,
  fecha_fin date not null,
  turnos text[] not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint calendarios_fechas_validas check (fecha_inicio <= fecha_fin),
  constraint calendarios_turnos_validos check (cardinality(turnos) between 1 and 3
    and turnos <@ array['MATUTINO','VESPERTINO','MIXTO']::text[]
    and array_position(turnos, null) is null
    and not (turnos[1] = turnos[2] or turnos[1] = turnos[3] or turnos[2] = turnos[3]))
);

create table if not exists public.calendarios_planes (
  calendario_id uuid not null references public.calendarios_academicos(id) on delete cascade,
  plan_id uuid not null references public.planes_estudio(id),
  primary key (calendario_id, plan_id)
);

create table if not exists public.calendario_eventos (
  id uuid primary key default gen_random_uuid(),
  calendario_id uuid not null references public.calendarios_academicos(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 2 and 160),
  tipo text not null check (tipo in ('INICIO','TERMINO','FESTIVO','VACACIONES','EXAMENES',
    'RECUPERACION','EXTRAORDINARIOS','CAPTURA','OTRO')),
  fecha_inicio date not null,
  fecha_fin date not null,
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  suspende_clases boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint calendario_evento_fechas_validas check (fecha_inicio <= fecha_fin),
  constraint calendario_examenes_no_lectivos check (tipo not in ('FESTIVO','VACACIONES','RECUPERACION','EXTRAORDINARIOS')
    or suspende_clases)
);
create index if not exists calendarios_academicos_ciclo_idx on public.calendarios_academicos(ciclo_id);
create index if not exists calendario_eventos_calendario_fechas_idx
  on public.calendario_eventos(calendario_id, fecha_inicio, fecha_fin);

create or replace function public.guardar_calendario_academico(
  p_id uuid, p_ciclo_id uuid, p_nombre text, p_tipo_periodo text, p_modalidad text,
  p_fecha_inicio date, p_fecha_fin date, p_turnos text[], p_plan_ids uuid[]
) returns uuid language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_id uuid; v_ciclo public.ciclos_escolares%rowtype;
begin
  if auth.uid() is null or coalesce(public.get_my_rol(), '')
    not in ('ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR') then
    raise exception 'No tiene permiso para modificar calendarios';
  end if;
  perform pg_advisory_xact_lock(hashtext('calendarios_academicos'), hashtext(p_ciclo_id::text));
  select * into v_ciclo from public.ciclos_escolares where id = p_ciclo_id;
  if not found or p_nombre is null or length(trim(p_nombre)) not between 3 and 160
    or p_fecha_inicio is null or p_fecha_fin is null or p_fecha_inicio > p_fecha_fin
    or p_fecha_inicio < v_ciclo.fecha_inicio or p_fecha_fin > v_ciclo.fecha_termino
    or p_plan_ids is null or cardinality(p_plan_ids) = 0
    or cardinality(p_plan_ids) <> (select count(distinct elegido.plan_id)
      from unnest(p_plan_ids) as elegido(plan_id))
    or p_turnos is null or cardinality(p_turnos) = 0 then
    raise exception 'Revisa fechas, turnos y planes del calendario';
  end if;
  if exists (select 1 from unnest(p_plan_ids) as elegido(id)
    left join public.planes_estudio p on p.id = elegido.id
    where p.id is null or upper(coalesce(p.tipo_periodo, '')) <> p_tipo_periodo
      or coalesce(p.modalidad, 'ESCOLARIZADA') <> p_modalidad) then
    raise exception 'Los planes deben coincidir con el tipo y la modalidad del calendario';
  end if;
  if exists (select 1 from public.calendarios_academicos cal
    join public.calendarios_planes rel on rel.calendario_id = cal.id
    where cal.ciclo_id = p_ciclo_id and (p_id is null or cal.id <> p_id)
      and rel.plan_id = any(p_plan_ids) and cal.turnos && p_turnos) then
    raise exception 'Un plan y turno ya están asociados a otro calendario de este ciclo';
  end if;
  if p_id is null then
    insert into public.calendarios_academicos(ciclo_id,nombre,tipo_periodo,modalidad,fecha_inicio,fecha_fin,turnos)
    values (p_ciclo_id,trim(p_nombre),p_tipo_periodo,p_modalidad,p_fecha_inicio,p_fecha_fin,p_turnos)
    returning id into v_id;
  else
    -- No se puede mover un calendario existente a otro ciclo.
    update public.calendarios_academicos set nombre=trim(p_nombre), tipo_periodo=p_tipo_periodo,
      modalidad=p_modalidad, fecha_inicio=p_fecha_inicio, fecha_fin=p_fecha_fin,
      turnos=p_turnos, actualizado_en=now()
    where id=p_id and ciclo_id=p_ciclo_id returning id into v_id;
    if v_id is null then raise exception 'El calendario no pertenece al ciclo seleccionado'; end if;
    delete from public.calendarios_planes where calendario_id=v_id;
  end if;
  insert into public.calendarios_planes(calendario_id,plan_id)
    select v_id, elegido.plan_id from unnest(p_plan_ids) as elegido(plan_id);
  return v_id;
end; $$;

alter table public.calendarios_academicos enable row level security;
alter table public.calendarios_planes enable row level security;
alter table public.calendario_eventos enable row level security;

create policy "calendarios: lectura académica" on public.calendarios_academicos for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO'));
create policy "calendarios planes: lectura académica" on public.calendarios_planes for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO'));
create policy "calendario eventos: lectura académica" on public.calendario_eventos for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO'));
create policy "calendario eventos: escritura escolar" on public.calendario_eventos for all to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR'))
  with check (public.get_my_rol() in ('ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR'));

revoke all on public.calendarios_academicos, public.calendarios_planes, public.calendario_eventos from anon;
revoke all on public.calendarios_academicos, public.calendarios_planes from authenticated;
grant select on public.calendarios_academicos, public.calendarios_planes to authenticated;
grant select, insert, update, delete on public.calendario_eventos to authenticated;
revoke all on function public.guardar_calendario_academico(uuid,uuid,text,text,text,date,date,text[],uuid[]) from public;
grant execute on function public.guardar_calendario_academico(uuid,uuid,text,text,text,date,date,text[],uuid[]) to authenticated;

commit;
