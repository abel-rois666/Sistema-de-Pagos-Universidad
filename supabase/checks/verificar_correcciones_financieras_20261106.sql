-- Solo lectura; los booleanos de instalación deben ser true, anon false.
select firma,to_regprocedure(firma) is not null instalada,
 case when to_regprocedure(firma) is not null then has_function_privilege('anon',firma,'EXECUTE') end ejecutable_anon,
 case when to_regprocedure(firma) is not null then has_function_privilege('authenticated',firma,'EXECUTE') end ejecutable_authenticated
from unnest(array['public.guardar_observacion_plan_v1(uuid,integer,text,text)','public.vinculacion_financiera_v1(uuid,jsonb,text,boolean,text)']) firma;
select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'INSERT') insercion_directa_esperada_false,
 has_table_privilege('authenticated',c.oid,'UPDATE') actualizacion_directa_esperada_false,
 has_table_privilege('anon',c.oid,'SELECT') lectura_anon_esperada_false
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='finanzas_operaciones_auditoria';
select position('saldo_concepto_financiero_v1' in pg_get_functiondef(p.oid))>0 v2_saldo_corregido
from pg_proc p where p.oid=to_regprocedure('public.vincular_recibo_detalle_planes_v2(uuid,jsonb)');
