-- SOLO LECTURA. Estas comprobaciones de instalación no prueban el comportamiento transaccional.
select p.proname,p.prosecdef,p.proconfig,
  position('NOMBRES_SIN_DATOS_FISCALES_V1' in p.prosrc)>0 correccion_presente,
  has_function_privilege('anon',p.oid,'EXECUTE') ejecutable_anon,
  has_function_privilege('authenticated',p.oid,'EXECUTE') ejecutable_autenticado,
  pg_get_function_identity_arguments(p.oid) argumentos
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('_personal_reflejar_v1','personal_nombres_revisar_lote_v1') order by p.proname;

select t.tgname,t.tgenabled,t.tgfoid='public._personal_reflejar_v1()'::regprocedure proyeccion_vigente
from pg_trigger t where t.tgrelid='public.personal_personas'::regclass and t.tgname='personal_reflejar';

select p.proname,
  position('Revisa el formato del RFC' in p.prosrc)>0 valida_rfc,
  position('Revisa el formato de la CURP' in p.prosrc)>0 valida_curp
from pg_proc p where p.oid=to_regprocedure('public._personal_guardar_base_v1(text,uuid,integer,jsonb,text,jsonb,text)');
