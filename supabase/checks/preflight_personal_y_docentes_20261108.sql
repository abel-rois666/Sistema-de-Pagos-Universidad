-- Solo lectura de metadatos. No crea perfiles, no vincula personas y no cambia permisos.
select t.nombre,to_regclass('public.'||t.nombre) as tabla
from unnest(array['docentes','empleados','usuarios','docentes_grupos_asignaturas','docente_configuraciones_horario',
 'personal_personas','personal_vinculos_laborales','personal_formacion','personal_expedientes','personal_auditoria']) t(nombre);

with necesarias(tabla,columna) as (values
 ('docentes','id'),('docentes','clave_legado'),('docentes','nombre_completo'),('docentes','rfc'),('docentes','curp'),('docentes','email'),('docentes','estatus'),
 ('empleados','id'),('empleados','nombres'),('empleados','apellido_paterno'),('empleados','apellido_materno'),('empleados','rfc'),('empleados','curp'),('empleados','fecha_nacimiento'),('empleados','sexo'),('empleados','estado_civil'),('empleados','direccion'),('empleados','telefono'),('empleados','documentos_entregados'),('empleados','enlace_drive'),
 ('usuarios','auth_id'),('usuarios','rol'),('usuarios','activo'))
select n.tabla,jsonb_agg(n.columna order by n.columna) filter(where c.column_name is null) as faltantes
from necesarias n left join information_schema.columns c on c.table_schema='public' and c.table_name=n.tabla and c.column_name=n.columna group by n.tabla order by n.tabla;

select c.relname as tabla,t.tgname as trigger,pg_get_triggerdef(t.oid) as definicion
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('empleados','docentes') and not t.tgisinternal order by c.relname,t.tgname;

select c.relname as tabla,con.conname,pg_get_constraintdef(con.oid) as restriccion
from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('docentes','empleados','usuarios') order by c.relname,con.conname;

select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('empleados','docentes') and column_name='persona_id';
