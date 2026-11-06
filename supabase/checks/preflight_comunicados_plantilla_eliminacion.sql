-- Solo lectura. Revisar antes de añadir plantilla y eliminación auditable.
select
  case when to_regclass('public.comunicados_emisiones') is not null then 'OK' else 'FALTA' end as emisiones,
  case when to_regclass('public.comunicados_documentos') is not null then 'OK' else 'FALTA' end as documentos,
  case when to_regclass('public.comunicados_plantilla_mensaje') is null then 'LIBRE' else 'REVISAR' end as plantilla,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comunicados_emisiones'
      and column_name = 'ciclo_boleta_id'
  ) then 'OK' else 'FALTA' end as ciclo_boleta;
