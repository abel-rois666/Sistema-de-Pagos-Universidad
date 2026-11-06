-- Conserva las emisiones y plantillas existentes. La omisión de boleta se valida
-- nuevamente en la Edge Function antes de preparar y compartir una emisión.
begin;

alter table public.comunicados_emisiones
  add column if not exists boleta_no_aplica boolean not null default false;

alter table public.comunicados_emisiones
  drop constraint if exists comunicados_emisiones_boleta_no_aplica_check;
alter table public.comunicados_emisiones
  add constraint comunicados_emisiones_boleta_no_aplica_check
  check (not boleta_no_aplica or ciclo_boleta_id is null);

alter table public.comunicados_plantilla_mensaje
  add column if not exists contenido_nuevo_ingreso text,
  add column if not exists contenido_ingles text;

alter table public.comunicados_plantilla_mensaje
  drop constraint if exists comunicados_plantilla_mensaje_nuevo_ingreso_check;
alter table public.comunicados_plantilla_mensaje
  add constraint comunicados_plantilla_mensaje_nuevo_ingreso_check
  check (contenido_nuevo_ingreso is null or char_length(contenido_nuevo_ingreso) between 20 and 3000);

alter table public.comunicados_plantilla_mensaje
  drop constraint if exists comunicados_plantilla_mensaje_ingles_check;
alter table public.comunicados_plantilla_mensaje
  add constraint comunicados_plantilla_mensaje_ingles_check
  check (contenido_ingles is null or char_length(contenido_ingles) <= 1000);

commit;
