-- Solo lectura. Revisar ANTES de aplicar 20261108180000_ficha_unica_y_funciones_personal.sql.
select nombre,to_regclass('public.'||nombre) tabla from unnest(array['empleados','docentes','personal_personas','personal_auditoria','usuarios']) nombre;
with requeridas(tabla,columna) as (values
 ('empleados','id'),('empleados','persona_id'),('empleados','estatus'),('empleados','clave_puesto'),('empleados','puesto'),('empleados','departamento'),('empleados','firmante_certificados'),('empleados','firmante_titulos'),('empleados','firmante_boletas'),('empleados','titulo_academico'),('empleados','firma_url'),
 ('personal_personas','revision'),('personal_personas','nombre_original'),('docentes','persona_id'),('docentes','clave_legado'),('docentes','estatus'))
select r.tabla,jsonb_agg(r.columna) filter(where c.column_name is null) faltantes from requeridas r left join information_schema.columns c on c.table_schema='public' and c.table_name=r.tabla and c.column_name=r.columna group by r.tabla order by r.tabla;
select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('personal_consultar_v2','personal_guardar_v1','personal_vincular_v1','_personal_rol_v1','_personal_fuente_v1','personal_consultar_v3','personal_anadir_funcion_v1');
-- No muestra personas ni firmas. Los cupos heredados fuera del límite requieren revisión individual.
select count(*) filter(where firmante_certificados) firmantes_certificados_maximo_1,count(*) filter(where firmante_titulos) firmantes_titulos_maximo_2 from public.empleados;
select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name in ('empleados','docentes') order by table_name,ordinal_position;
select c.relname,t.tgname,pg_get_triggerdef(t.oid) definicion from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('empleados','docentes','personal_personas') and not t.tgisinternal order by c.relname,t.tgname;
