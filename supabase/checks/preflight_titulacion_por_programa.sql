-- Solo lectura; ejecutar antes de instalar y revisar todas las filas.
select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.ficha_titulacion'::regclass;
select alumno_programa_id,count(*) from public.ficha_titulacion where alumno_programa_id is not null group by alumno_programa_id having count(*)>1;
select count(*) fichas_sin_programa from public.ficha_titulacion where alumno_programa_id is null;
select t.tgname,pg_get_triggerdef(t.oid),pg_get_functiondef(t.tgfoid) from pg_trigger t where not t.tgisinternal and t.tgrelid in ('public.ficha_titulacion'::regclass,'public.alumno_programas'::regclass);
select policyname,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='ficha_titulacion';
select f.id,f.alumno_id,f.alumno_programa_id from public.ficha_titulacion f left join public.alumno_programas p on p.id=f.alumno_programa_id where f.alumno_programa_id is not null and (p.id is null or p.alumno_id<>f.alumno_id);
