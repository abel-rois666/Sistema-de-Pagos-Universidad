-- Solo lectura: ejecutar antes de instalar la función de alta atómica.
with requeridas(tabla, columna, tipo) as (
  values
    ('grupos','id','uuid'), ('grupos','codigo_grupo','texto'), ('grupos','ciclo_id','uuid'),
    ('grupos','plan_id','uuid'), ('grupos','grado','int4'), ('grupos','turno','texto'),
    ('grupos','estatus','texto'), ('asignaturas','id','uuid'), ('asignaturas','plan_id','uuid'),
    ('asignaturas','numero_periodo','int4'), ('asignaturas','activo','bool'),
    ('docentes_grupos_asignaturas','grupo_id','uuid'),
    ('docentes_grupos_asignaturas','asignatura_id','uuid'),
    ('docentes_grupos_asignaturas','docente_id','uuid'),
    ('alumnos','id','uuid'), ('alumnos','estatus','texto'),
    ('alumnos_grupos','grupo_id','uuid'), ('alumnos_grupos','alumno_id','uuid'),
    ('alumnos_grupos','asignatura_id','uuid')
)
select r.tabla, r.columna, r.tipo as tipo_esperado, c.udt_name as tipo_actual,
  case when c.column_name is null then 'FALTA'
    when r.tipo = 'texto' and c.data_type in ('text','character varying') then 'OK'
    when r.tipo = c.udt_name then 'OK'
    else 'REVISAR' end as resultado
from requeridas r
left join information_schema.columns c on c.table_schema = 'public'
  and c.table_name = r.tabla and c.column_name = r.columna
order by r.tabla, r.columna;

select 'get_my_rol()' as nombre,
  case when to_regprocedure('public.get_my_rol()') is null then 'FALTA' else 'OK' end as resultado
union all
select 'crear_grupo_completo (cualquier firma)',
  case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'crear_grupo_completo')
    then 'OK: libre' else 'REVISAR: ya existe' end;

select tabla, has_table_privilege('authenticated', 'public.' || tabla, 'INSERT') as puede_insertar
from (values ('grupos'), ('docentes_grupos_asignaturas'), ('alumnos_grupos')) as tablas(tabla);

select cl.relname as tabla, t.tgname as disparador, pg_get_triggerdef(t.oid) as definicion
from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
join pg_namespace ns on ns.oid = cl.relnamespace
where ns.nspname = 'public' and cl.relname in ('grupos', 'docentes_grupos_asignaturas', 'alumnos_grupos')
  and not t.tgisinternal
order by cl.relname, t.tgname;
