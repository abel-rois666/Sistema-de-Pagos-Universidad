-- SOLO LECTURA. Ejecutar después de revisar e instalar la migración.
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'execute') acceso_anonimo,
 has_function_privilege('authenticated',p.oid,'execute') acceso_autenticado
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%certificacion%v1' order by p.proname;
select c.relname,c.relrowsecurity,
 has_table_privilege('authenticated',c.oid,'insert,update,delete') escritura_directa,
 has_table_privilege('anon',c.oid,'select') lectura_anonima
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('ficha_certificacion','certificacion_auditoria');
select indexname,indexdef from pg_indexes where schemaname='public' and tablename='ficha_certificacion';
select count(*) fichas_sin_asociar,count(*) filter(where tramite_completado) completadas_sin_asociar from public.ficha_certificacion where alumno_programa_id is null and archivado_en is null;
select count(*) asociaciones_de_otro_alumno from public.ficha_certificacion f join public.alumno_programas p on p.id=f.alumno_programa_id where f.alumno_id<>p.alumno_id;
select count(*) programas_con_multiples_fichas_activas from(select alumno_programa_id from public.ficha_certificacion where alumno_programa_id is not null and archivado_en is null group by alumno_programa_id having count(*)>1)t;
