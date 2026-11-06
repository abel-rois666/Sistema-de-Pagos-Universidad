-- Configuración del mensaje y retirada auditable de emisiones anteriores.
-- Aplicar después de las dos migraciones iniciales de Comunicados.
begin;

create table if not exists public.comunicados_plantilla_mensaje (
  id boolean primary key default true check (id),
  contenido text not null check (char_length(contenido) between 20 and 3000),
  actualizada_por uuid not null,
  actualizada_en timestamptz not null default now()
);

alter table public.comunicados_plantilla_mensaje enable row level security;
revoke all on public.comunicados_plantilla_mensaje from public, anon, authenticated;
grant all on public.comunicados_plantilla_mensaje to service_role;

alter table public.comunicados_emisiones
  add column if not exists eliminada_por uuid,
  add column if not exists eliminada_en timestamptz;

alter table public.comunicados_emisiones
  drop constraint if exists comunicados_emisiones_estado_check;
alter table public.comunicados_emisiones
  add constraint comunicados_emisiones_estado_check
  check (estado in ('BORRADOR', 'LISTO', 'ENVIADO', 'REVOCADO', 'ELIMINADO'));

commit;
