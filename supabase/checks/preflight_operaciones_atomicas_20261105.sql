-- Solo lectura. Un único resultado con todas las secciones, aun si faltan tablas.
with requeridas(nombre) as (values
 ('alumnos'),('alumno_programas'),('usuarios'),('planes_estudio'),('carreras'),
 ('grupos'),('alumnos_grupos'),('docentes_grupos_asignaturas'),('inscripciones_academicas')
), objetos as (
 select nombre,to_regclass('public.'||nombre)::text tabla from requeridas
), politicas as (
 select tablename,policyname,roles,cmd,qual,with_check from pg_policies
 where schemaname='public' and tablename in (select nombre from requeridas)
), columnas as (
 select table_name,column_name,data_type from information_schema.columns
 where table_schema='public' and table_name in ('alumno_programas','usuarios','inscripciones_academicas')
), relacionadas as (
 select n.nspname esquema,c.relname relacion,c.relkind tipo from pg_class c
 join pg_namespace n on n.oid=c.relnamespace
 where n.nspname not in ('pg_catalog','information_schema')
 and (c.relname ilike '%inscrip%' or c.relname ilike '%califica%' or c.relname ilike '%alumno_program%')
), funciones as (
 select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.prosecdef,p.proconfig
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('get_my_rol','activar_programa_principal_v1','eliminar_grupos_lote_v1','guardar_calificaciones_lote_v1')
), restricciones as (
 select conrelid::regclass::text tabla,conname nombre,pg_get_constraintdef(oid) definicion
 from pg_constraint where confrelid=to_regclass('public.grupos')
), disparadores as (
 select tgrelid::regclass::text tabla,tgname nombre,pg_get_triggerdef(oid) definicion from pg_trigger
 where not tgisinternal and tgrelid in (to_regclass('public.alumno_programas'),to_regclass('public.inscripciones_academicas'))
)
select '1_contexto' seccion,jsonb_build_object('base',current_database(),'version',current_setting('server_version'),
 'faltan_tablas',(select count(*) from objetos where tabla is null)) resultado
union all select '2_tablas',coalesce(jsonb_agg(to_jsonb(o) order by nombre),'[]') from objetos o
union all select '3_relaciones_en_otros_esquemas',coalesce(jsonb_agg(to_jsonb(r) order by esquema,relacion),'[]') from relacionadas r
union all select '4_columnas',coalesce(jsonb_agg(to_jsonb(c) order by table_name,column_name),'[]') from columnas c
union all select '5_politicas',coalesce(jsonb_agg(to_jsonb(p) order by tablename,policyname),'[]') from politicas p
union all select '6_funciones',coalesce(jsonb_agg(to_jsonb(f) order by proname),'[]') from funciones f
union all select '7_restricciones',coalesce(jsonb_agg(to_jsonb(r) order by tabla,nombre),'[]') from restricciones r
union all select '8_disparadores',coalesce(jsonb_agg(to_jsonb(d) order by tabla,nombre),'[]') from disparadores d
order by seccion;
