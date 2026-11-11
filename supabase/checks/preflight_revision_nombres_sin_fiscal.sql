-- SOLO LECTURA. No incluye valores fiscales, nombres ni identificadores personales.
select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.prosecdef,p.proconfig,
  md5(regexp_replace(p.prosrc,'[[:space:]]','','g')) huella_revisar,
  has_function_privilege('anon',p.oid,'EXECUTE') ejecutable_anon,
  has_function_privilege('authenticated',p.oid,'EXECUTE') ejecutable_autenticado,
  pg_get_functiondef(p.oid) definicion
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('_personal_reflejar_v1','personal_nombres_revisar_lote_v1','_personal_rol_v1','_personal_fuente_v1') order by p.proname;

select c.relname tabla,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) definicion
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('personal_personas','docentes','empleados') and not t.tgisinternal
order by c.relname,t.tgname;

select column_name,data_type from information_schema.columns
where table_schema='public' and table_name='personal_personas'
and column_name in ('datos','revision','nombre_original','nombre_confirmado_en','nombre_confirmado_por','nombre_fuente') order by column_name;

-- Conteos orientativos: los defectos históricos no son criterio de identidad para la revisión nominal.
select count(*) pendientes,
  count(*) filter(where nullif(trim(coalesce(p.datos->>'rfc',d.rfc)),'') is not null
    and coalesce(p.datos->>'rfc',d.rfc) !~* '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$') con_rfc_por_revisar,
  count(*) filter(where d.persona_id is not null) con_persona_compartida
from public.docentes d left join public.personal_personas p on p.id=d.persona_id
where nullif(trim(p.datos->>'nombres'),'') is null or nullif(trim(p.datos->>'apellido_paterno'),'') is null;
