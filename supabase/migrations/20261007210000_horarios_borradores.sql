-- Borradores independientes de las versiones publicadas. No modifica datos existentes.
create table if not exists public.horarios_borradores (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_escolares(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 100),
  contenido jsonb not null check (jsonb_typeof(contenido) = 'object'),
  creado_por uuid not null default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_horarios_borradores_ciclo_actualizado
  on public.horarios_borradores(ciclo_id, actualizado_en desc);

alter table public.horarios_borradores enable row level security;
revoke all on public.horarios_borradores from anon;
grant select, insert, delete on public.horarios_borradores to authenticated;
grant update (nombre, contenido, actualizado_en) on public.horarios_borradores to authenticated;

create policy "horarios: consultar borradores" on public.horarios_borradores
  for select to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'));
create policy "horarios: crear borradores" on public.horarios_borradores
  for insert to authenticated
  with check (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO')
    and creado_por = auth.uid());
create policy "horarios: editar borradores" on public.horarios_borradores
  for update to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'))
  with check (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'));
create policy "horarios: eliminar borradores" on public.horarios_borradores
  for delete to authenticated
  using (public.get_my_rol() in ('ADMINISTRADOR', 'COORDINADOR ACADEMICO'));
