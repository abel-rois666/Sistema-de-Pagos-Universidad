-- Preparada para revisión. No se aplica automáticamente a la base de datos real.
-- La retícula y las asignaciones anteriores siguen siendo válidas: las nuevas horas son opcionales
-- hasta que cada materia y grupo se configure para generar un horario.

alter table public.asignaturas add column if not exists horas_semanales integer;
alter table public.docentes_grupos_asignaturas add column if not exists horas_presenciales integer;
alter table public.docentes_grupos_asignaturas add column if not exists horas_asincronas integer;
alter table public.grupos add column if not exists aula text;
alter table public.grupos add column if not exists sede text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'asignaturas_horas_semanales_validas') then
    alter table public.asignaturas add constraint asignaturas_horas_semanales_validas
      check (horas_semanales is null or horas_semanales between 1 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dga_horas_presenciales_validas') then
    alter table public.docentes_grupos_asignaturas add constraint dga_horas_presenciales_validas
      check (horas_presenciales is null or horas_presenciales between 0 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dga_horas_asincronas_validas') then
    alter table public.docentes_grupos_asignaturas add constraint dga_horas_asincronas_validas
      check (horas_asincronas is null or horas_asincronas between 0 and 40);
  end if;
end $$;

-- Una configuración por docente y ciclo. El formulario la guarda en una operación atómica.
create table if not exists public.docente_configuraciones_horario (
  docente_id uuid not null references public.docentes(id) on delete cascade,
  ciclo_id uuid not null references public.ciclos_escolares(id) on delete cascade,
  disponibilidad jsonb not null default '[]'::jsonb,
  plan_ids uuid[] not null default '{}'::uuid[],
  asignatura_ids_preferidas uuid[] not null default '{}'::uuid[],
  grupo_ids_restringidos uuid[] not null default '{}'::uuid[],
  actualizado_en timestamptz not null default now(),
  primary key (docente_id, ciclo_id),
  constraint docente_disponibilidad_array check (jsonb_typeof(disponibilidad) = 'array')
);
create index if not exists idx_docente_config_horario_ciclo on public.docente_configuraciones_horario(ciclo_id);

create table if not exists public.horarios_versiones (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_escolares(id) on delete cascade,
  version integer not null,
  estado text not null default 'publicado' check (estado in ('publicado', 'sustituido')),
  grupos_id uuid[] not null,
  max_hueco_grupo integer not null default 1 check (max_hueco_grupo between 0 and 8),
  max_hueco_docente integer not null default 1 check (max_hueco_docente between 0 and 8),
  creado_por uuid default auth.uid(),
  creado_en timestamptz not null default now(),
  unique (ciclo_id, version)
);
create unique index if not exists idx_horario_publicado_unico
  on public.horarios_versiones(ciclo_id) where estado = 'publicado';

create table if not exists public.horarios_cargas (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references public.horarios_versiones(id) on delete cascade,
  asignacion_id uuid references public.docentes_grupos_asignaturas(id) on delete set null,
  grupo_id uuid references public.grupos(id) on delete set null,
  asignatura_id uuid references public.asignaturas(id) on delete set null,
  docente_id uuid references public.docentes(id) on delete set null,
  grupo_codigo text not null,
  grupo_turno text not null,
  asignatura_nombre text not null,
  docente_nombre text not null,
  horas_totales integer not null,
  horas_presenciales integer not null,
  horas_asincronas integer not null,
  max_bloque integer not null default 4 check (max_bloque between 1 and 4),
  aula text,
  sede text
);
create index if not exists idx_horarios_cargas_horario on public.horarios_cargas(horario_id);

create table if not exists public.horarios_sesiones (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references public.horarios_versiones(id) on delete cascade,
  carga_id uuid not null references public.horarios_cargas(id) on delete cascade,
  grupo_id uuid references public.grupos(id) on delete set null,
  docente_id uuid references public.docentes(id) on delete set null,
  dia_semana integer not null check (dia_semana between 1 and 6),
  hora_inicio integer not null check (hora_inicio between 7 and 20),
  hora_fin integer not null check (hora_fin between 8 and 21 and hora_fin > hora_inicio and hora_fin - hora_inicio <= 4),
  aula text,
  sede text
);
create index if not exists idx_horarios_sesiones_horario on public.horarios_sesiones(horario_id);
create index if not exists idx_horarios_sesiones_docente on public.horarios_sesiones(docente_id, dia_semana, hora_inicio, hora_fin);

alter table public.docente_configuraciones_horario enable row level security;
alter table public.horarios_versiones enable row level security;
alter table public.horarios_cargas enable row level security;
alter table public.horarios_sesiones enable row level security;

grant select, insert, update, delete on public.docente_configuraciones_horario to authenticated;
grant select on public.horarios_versiones, public.horarios_cargas, public.horarios_sesiones to authenticated;

create policy "horarios: configuración académica" on public.docente_configuraciones_horario
  for all to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'))
  with check (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'));
create policy "horarios: consulta de versiones" on public.horarios_versiones
  for select to authenticated using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'));
create policy "horarios: consulta de cargas" on public.horarios_cargas
  for select to authenticated using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'));
create policy "horarios: consulta de sesiones" on public.horarios_sesiones
  for select to authenticated using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'));

-- Las tablas existentes tienen políticas amplias. Protege los nuevos campos sin alterar
-- los permisos heredados de sus demás columnas.
create or replace function public.validar_campos_horario_academico()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare v_rol text := public.get_my_rol();
begin
  if tg_table_name = 'asignaturas' then
    if (tg_op = 'INSERT' and new.horas_semanales is not null) then
      if coalesce(v_rol, '') not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR') then
        raise exception 'No tiene permiso para cambiar horas semanales';
      end if;
    elsif tg_op = 'UPDATE' and new.horas_semanales is distinct from old.horas_semanales then
      if coalesce(v_rol, '') not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR') then
        raise exception 'No tiene permiso para cambiar horas semanales';
      end if;
    end if;
  elsif tg_table_name = 'docentes_grupos_asignaturas' then
    if tg_op = 'INSERT' and (new.horas_presenciales is not null or new.horas_asincronas is not null) then
      if coalesce(v_rol, '') not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR') then
        raise exception 'No tiene permiso para cambiar el reparto de horas';
      end if;
    elsif tg_op = 'UPDATE' and (new.horas_presenciales is distinct from old.horas_presenciales
        or new.horas_asincronas is distinct from old.horas_asincronas) then
      if coalesce(v_rol, '') not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR') then
        raise exception 'No tiene permiso para cambiar el reparto de horas';
      end if;
    end if;
  elsif tg_table_name = 'grupos' then
    if (tg_op = 'INSERT' and (new.aula is not null or new.sede is not null)) then
      if coalesce(v_rol, '') not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR') then
        raise exception 'No tiene permiso para cambiar la ubicación del grupo';
      end if;
    elsif tg_op = 'UPDATE' and (new.aula is distinct from old.aula or new.sede is distinct from old.sede) then
      if coalesce(v_rol, '') not in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR') then
        raise exception 'No tiene permiso para cambiar la ubicación del grupo';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_asignaturas_horas_horario on public.asignaturas;
create trigger trg_asignaturas_horas_horario before insert or update on public.asignaturas
  for each row execute function public.validar_campos_horario_academico();
drop trigger if exists trg_dga_horas_horario on public.docentes_grupos_asignaturas;
create trigger trg_dga_horas_horario before insert or update on public.docentes_grupos_asignaturas
  for each row execute function public.validar_campos_horario_academico();
drop trigger if exists trg_grupos_ubicacion_horario on public.grupos;
create trigger trg_grupos_ubicacion_horario before insert or update on public.grupos
  for each row execute function public.validar_campos_horario_academico();

revoke all on function public.validar_campos_horario_academico() from public;

-- La publicación se define en la migración siguiente; ninguna tabla nueva permite
-- insertar horarios directamente desde el cliente.
