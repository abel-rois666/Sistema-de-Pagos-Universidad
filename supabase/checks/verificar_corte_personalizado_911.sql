-- SOLO LECTURA: ejecutar después de 20261026120000_corte_personalizado_911.sql.
select to_regprocedure('public.s911_validar_corte(jsonb,boolean)') helper_instalado,
 position('s911_validar_corte' in pg_get_functiondef('public.s911_guardar(uuid,integer,jsonb,jsonb)'::regprocedure))>0 guardar_valida,
 position('s911_validar_corte' in pg_get_functiondef('public.s911_transicion(uuid,integer,text,text)'::regprocedure))>0 cierre_valida,
 position('version_payload' in pg_get_functiondef('public.s911_registrar_exportacion(uuid,integer,integer,text,text,text)'::regprocedure))>0 exportacion_por_version;

-- Datos sintéticos: no inserta ni modifica expedientes ni otras tablas.
do $$
declare caso record;aceptado boolean;diagnostico text;
begin
 for caso in select * from (values
  ('Original sin metadatos', '{"config":{"corte":"2026-09-30"}}'::jsonb, true),
  ('Personalizado acreditado', '{"config":{"corte":"2026-10-31","cortePersonalizado":true,"motivoCorte":"Corte autorizado al cierre de octubre."},"corteCalculado":"2026-10-31"}'::jsonb, true),
  ('Sin opción explícita', '{"config":{"corte":"2026-10-31","motivoCorte":"Corte autorizado al cierre de octubre."},"corteCalculado":"2026-10-31"}'::jsonb, false),
  ('Sin motivo', '{"config":{"corte":"2026-10-31","cortePersonalizado":true},"corteCalculado":"2026-10-31"}'::jsonb, false),
  ('Cálculo anterior', '{"config":{"corte":"2026-10-31","cortePersonalizado":true,"motivoCorte":"Corte autorizado al cierre de octubre."},"corteCalculado":"2026-09-30"}'::jsonb, false),
  ('Fecha inexistente', '{"config":{"corte":"2026-02-30"}}'::jsonb, false),
  ('Retorno pendiente al original', '{"config":{"corte":"2026-09-30"},"corteCalculado":""}'::jsonb, false)
 ) t(nombre,payload,esperado) loop
  aceptado=true;diagnostico=null;
  begin perform public.s911_validar_corte(caso.payload,true);
  exception when others then aceptado=false;diagnostico=sqlerrm;end;
  if aceptado is distinct from caso.esperado then raise exception 'FALLO: %, %',caso.nombre,diagnostico;end if;
  raise notice 'OK: %',caso.nombre;
 end loop;
end $$;

select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT') escritura_directa,
 has_table_privilege('authenticated',c.oid,'UPDATE') cambio_directo,
 has_table_privilege('anon',c.oid,'SELECT') lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 's911_%' and c.relkind='r' order by c.relname;
