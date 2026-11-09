-- SOLO LECTURA. Revisar ANTES de instalar 20261109160000. No expone personas ni credenciales.
select nombre,to_regclass('public.'||nombre) tabla from unnest(array[
 'empleados','docentes','usuarios','personal_personas','personal_vinculos_laborales','personal_formacion','personal_expedientes','personal_gestion_auditoria']) nombre;
with requeridas(tabla,columna) as (values
 ('empleados','id'),('empleados','persona_id'),('empleados','documentos_entregados'),('empleados','enlace_drive'),('empleados','firma_url'),
 ('empleados','firmante_certificados'),('empleados','firmante_titulos'),('empleados','firmante_boletas'),
 ('docentes','id'),('docentes','persona_id'),('usuarios','id'),('usuarios','username'),('usuarios','activo'),('usuarios','auth_id'),('usuarios','docente_id'),
 ('personal_personas','id'),('personal_vinculos_laborales','persona_id'),('personal_formacion','persona_id'),('personal_expedientes','persona_id'))
select r.tabla,coalesce(jsonb_agg(r.columna) filter(where c.column_name is null),'[]'::jsonb) faltantes
from requeridas r left join information_schema.columns c on c.table_schema='public' and c.table_name=r.tabla and c.column_name=r.columna group by r.tabla order by r.tabla;
select p.proname,pg_get_function_identity_arguments(p.oid) argumentos,p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('_personal_rol_v1','personal_consultar_v3','handle_new_user','personal_administrativo_revisar_v1');
select n.nspname esquema,t.relname tabla,c.conname,pg_get_constraintdef(c.oid) definicion
from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
where c.contype='f' and c.confrelid=to_regclass('public.empleados') order by n.nspname,t.relname,c.conname;
select t.tgname,pg_get_triggerdef(t.oid) definicion from pg_trigger t
where t.tgrelid in (to_regclass('public.empleados'),to_regclass('public.usuarios'),to_regclass('public.docentes')) and not t.tgisinternal;
select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name='usuarios'
 and column_name in ('empleado_id','docente_id','auth_id','rol');
