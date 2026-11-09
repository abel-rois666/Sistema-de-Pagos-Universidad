-- Solo metadatos: no afirma haber probado operaciones con sesiones reales.
select c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'SELECT') as lectura_anonima,
 has_table_privilege('authenticated',c.oid,'SELECT') as lectura_directa,
 has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as escritura_directa
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in
 ('personal_personas','personal_vinculos_laborales','personal_formacion','personal_expedientes','personal_auditoria') order by c.relname;

select p.proname,pg_get_function_identity_arguments(p.oid) as argumentos,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') as ejecutable_anonimo,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as ejecutable_autenticado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^_?personal_.*_v1$' order by p.proname;

select c.relname,t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal and t.tgname like 'personal_%' order by c.relname,t.tgname;

select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in ('docentes','empleados') and column_name='persona_id';
