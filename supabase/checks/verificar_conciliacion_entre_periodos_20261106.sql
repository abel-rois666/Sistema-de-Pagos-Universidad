-- Solo lectura. Si falta una función, regresa NULL en vez de ocultar el problema.
with f as (select to_regprocedure('public.conciliar_recibo_entre_periodos_v1(uuid,uuid,integer,numeric,text,text,text,boolean,text)') oid)
select oid is not null instalada,has_function_privilege('anon',oid,'execute') ejecucion_anonima,
has_function_privilege('authenticated',oid,'execute') ejecucion_autenticada from f;
select p.proname,position('saldo_aplicable_concepto_v1' in pg_get_functiondef(p.oid))>0 limita_por_vinculos
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('vinculacion_financiera_v1','vincular_recibo_detalle_planes_v2');
select has_function_privilege('anon','public.saldo_aplicable_concepto_v1(uuid,integer,numeric,text)','execute') helper_anonimo,
has_function_privilege('authenticated','public.saldo_aplicable_concepto_v1(uuid,integer,numeric,text)','execute') helper_directo;
select c.relrowsecurity rls_auditoria,has_table_privilege('authenticated',c.oid,'insert') escritura_directa,
has_table_privilege('anon',c.oid,'select') lectura_anonima from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='finanzas_operaciones_auditoria';
