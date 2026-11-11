-- SOLO LECTURA. No invoca el borrado ni nextval/setval; no modifica la secuencia.
-- Comparar la definición instalada antes de preparar o aplicar su sustitución.
-- UNA tabla de cinco filas: el SQL Editor puede mostrar solo la última consulta.
with funciones as (
 select p.proname funcion,pg_get_function_identity_arguments(p.oid) argumentos,
        p.prosecdef security_definer,p.proconfig configuracion,p.proacl permisos,
        pg_get_functiondef(p.oid) definicion
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('borrar_recibo_admin','borrar_recibo_prueba_v2','sync_secuencia_folios')
), secuencia as (
 select schemaname,sequencename,last_value,increment_by,cycle
 from pg_sequences where schemaname='public' and sequencename='recibos_folio_seq'
), dependencias as (
 select conrelid::regclass::text tabla,conname restriccion,pg_get_constraintdef(oid) definicion
 from pg_constraint where confrelid in (to_regclass('public.recibos'),to_regclass('public.recibos_detalles'))
), disparadores as (
 select t.tgrelid::regclass::text tabla,t.tgname,t.tgenabled habilitado,
        pg_get_triggerdef(t.oid) definicion,pg_get_functiondef(t.tgfoid) funcion_del_disparador
 from pg_trigger t where not t.tgisinternal and t.tgrelid in
   (to_regclass('public.recibos'),to_regclass('public.recibos_detalles'))
)
select '1_firmas_exactas' seccion,jsonb_build_object(
 'borrar_recibo_admin',to_regprocedure('public.borrar_recibo_admin(uuid)')::text,
 'borrar_recibo_prueba_v2',to_regprocedure('public.borrar_recibo_prueba_v2(uuid)')::text) datos
union all
select '2_funciones',coalesce(jsonb_agg(to_jsonb(f) order by funcion,argumentos),'[]'::jsonb) from funciones f
union all
select '3_secuencia',coalesce(jsonb_agg(to_jsonb(s) order by sequencename),'[]'::jsonb) from secuencia s
union all
select '4_dependencias',coalesce(jsonb_agg(to_jsonb(d) order by tabla,restriccion),'[]'::jsonb) from dependencias d
union all
select '5_disparadores',coalesce(jsonb_agg(to_jsonb(t) order by tabla,tgname),'[]'::jsonb) from disparadores t
order by seccion;
