-- Registra el ciclo de la boleta y la procedencia de cada PDF sin alterar
-- emisiones ni documentos ya preparados. Los registros antiguos quedan en NULL
-- y deben regenerarse antes de habilitar un enlace nuevo.
begin;

alter table public.comunicados_emisiones
  add column if not exists ciclo_boleta_id uuid references public.ciclos_escolares(id);

alter table public.comunicados_documentos
  add column if not exists ciclo_id uuid references public.ciclos_escolares(id);

commit;
