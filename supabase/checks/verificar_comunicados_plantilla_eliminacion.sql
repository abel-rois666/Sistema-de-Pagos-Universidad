-- Solo lectura. Esperado: OK en ambas comprobaciones.
select case when exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'comunicados_plantilla_mensaje'
    and c.relrowsecurity
) and not has_table_privilege('anon', 'public.comunicados_plantilla_mensaje', 'SELECT')
  and not has_table_privilege('authenticated', 'public.comunicados_plantilla_mensaje', 'SELECT')
  and not has_table_privilege('authenticated', 'public.comunicados_plantilla_mensaje', 'UPDATE')
then 'OK' else 'REVISAR' end as plantilla_privada;

select case when exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'comunicados_emisiones'
    and column_name = 'eliminada_en'
) and exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'comunicados_emisiones'
    and column_name = 'eliminada_por'
) and exists (
  select 1 from pg_constraint
  where conrelid = 'public.comunicados_emisiones'::regclass
    and conname = 'comunicados_emisiones_estado_check'
    and pg_get_constraintdef(oid) like '%ELIMINADO%'
) then 'OK' else 'REVISAR' end as eliminacion_auditable;
