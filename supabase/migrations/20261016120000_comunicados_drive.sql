-- Preparación aditiva. Ejecutar después de comprobar el esquema en el proyecto destino.
-- Las tablas no conceden acceso directo a anon/authenticated: todas las operaciones pasan por la Edge Function.
create table if not exists public.comunicados_drive_conexion (
  id boolean primary key default true check (id),
  correo text not null,
  carpeta_raiz_id text not null,
  token_cifrado text not null,
  token_iv text not null,
  conectado_por uuid not null,
  conectado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.comunicados_oauth_estados (
  estado_hash text primary key,
  verificador_pkce text not null,
  iniciado_por uuid not null,
  vence_en timestamptz not null,
  utilizado_en timestamptz
);
create index if not exists comunicados_oauth_estados_vencimiento
  on public.comunicados_oauth_estados(vence_en);

create table if not exists public.comunicados_emisiones (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references public.alumnos(id),
  ciclo_id uuid not null references public.ciclos_escolares(id),
  numero integer not null check (numero > 0),
  estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR','LISTO','ENVIADO','REVOCADO')),
  carpeta_id text not null,
  permiso_id text,
  enlace text,
  creada_por uuid not null,
  creada_en timestamptz not null default now(),
  lista_en timestamptz,
  enviada_por uuid,
  enviada_en timestamptz,
  revocada_por uuid,
  revocada_en timestamptz,
  unique (alumno_id, ciclo_id, numero),
  check ((permiso_id is null) = (enlace is null)),
  check (estado not in ('LISTO','ENVIADO') or permiso_id is not null)
);
create index if not exists comunicados_emisiones_ciclo_alumno
  on public.comunicados_emisiones(ciclo_id, alumno_id, numero desc);

create table if not exists public.comunicados_documentos (
  id uuid primary key default gen_random_uuid(),
  emision_id uuid not null references public.comunicados_emisiones(id) on delete cascade,
  tipo text not null check (tipo in ('BOLETA','CALENDARIO','HORARIO','PAGOS')),
  nombre text not null,
  archivo_id text not null,
  subido_por uuid not null,
  subido_en timestamptz not null default now(),
  unique (emision_id, tipo)
);

alter table public.comunicados_drive_conexion enable row level security;
alter table public.comunicados_oauth_estados enable row level security;
alter table public.comunicados_emisiones enable row level security;
alter table public.comunicados_documentos enable row level security;

revoke all on public.comunicados_drive_conexion from public, anon, authenticated;
revoke all on public.comunicados_oauth_estados from public, anon, authenticated;
revoke all on public.comunicados_emisiones from public, anon, authenticated;
revoke all on public.comunicados_documentos from public, anon, authenticated;
grant all on public.comunicados_drive_conexion, public.comunicados_oauth_estados,
  public.comunicados_emisiones, public.comunicados_documentos to service_role;
