-- Solo lectura. Ejecutar antes de crear o actualizar promover_alumno_ciclo.
with requeridas(tabla, columna, tipo) as (
  values
    ('alumnos','id','uuid'), ('alumnos','estatus','texto'), ('alumnos','grado_actual','texto'),
    ('alumnos','ciclo_ultima_asignacion_grado','uuid'), ('alumnos','nombre_completo','texto'),
    ('alumnos','licenciatura','texto'), ('alumnos','turno','texto'),
    ('alumno_programas','id','uuid'), ('alumno_programas','alumno_id','uuid'),
    ('alumno_programas','plan_id','uuid'), ('alumno_programas','es_vigente','bool'),
    ('alumno_programas','estatus','texto'), ('alumno_programas','fecha_ultimo_cambio','timestamptz'),
    ('planes_estudio','id','uuid'), ('planes_estudio','total_periodos','int4'),
    ('ciclos_escolares','id','uuid'), ('ciclos_escolares','nombre','texto'),
    ('ciclos_escolares','tipo_periodo','texto'),
    ('planes_pago','id','uuid'), ('planes_pago','alumno_id','uuid'),
    ('planes_pago','ciclo_id','uuid'), ('planes_pago','no_plan_pagos','texto'),
    ('planes_pago','fecha_plan','texto'), ('planes_pago','created_at','timestamptz'),
    ('planes_pago','beca_porcentaje','texto'), ('planes_pago','beca_tipo','texto'),
    ('planes_pago','tipo_plan','texto'), ('planes_pago','licenciatura','texto'),
    ('planes_pago','grado_turno_inscrito','texto'), ('planes_pago','grado','texto'),
    ('planes_pago','turno','texto'),
    ('planes_pago_detalles','plan_id','uuid'), ('planes_pago_detalles','indice_concepto','int4'),
    ('planes_pago_detalles','concepto','texto'), ('planes_pago_detalles','cantidad','numeric'),
    ('planes_pago_detalles','fecha_vencimiento','date'), ('planes_pago_detalles','estatus','texto')
)
select r.tabla, r.columna, r.tipo as tipo_esperado, c.udt_name as tipo_actual,
  case when c.column_name is null then 'FALTA'
    when r.tipo = 'texto' and c.data_type in ('text','character varying') then 'OK'
    when r.tipo = c.udt_name then 'OK' else 'REVISAR' end as resultado
from requeridas r left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = r.tabla and c.column_name = r.columna
order by r.tabla, r.columna;

with campos as (
  select 'concepto_' || n as columna, 'texto' as tipo from generate_series(1,18) n
  union all select 'cantidad_' || n, 'numeric' from generate_series(1,18) n
  union all select 'estatus_' || n, 'texto' from generate_series(1,18) n
)
select campos.columna, campos.tipo as tipo_esperado, c.udt_name as tipo_actual,
  case when c.column_name is null then 'FALTA'
    when campos.tipo = 'texto' and c.data_type in ('text','character varying') then 'OK'
    when campos.tipo = c.udt_name then 'OK' else 'REVISAR' end as resultado
from campos left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = 'planes_pago' and c.column_name = campos.columna
order by campos.columna;

select 'get_my_rol()' as nombre,
  case when to_regprocedure('public.get_my_rol()') is null then 'FALTA' else 'OK' end as resultado
union all
select 'promover_alumno_ciclo' as nombre,
  case
    when to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)') is null
      and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'promover_alumno_ciclo')
      then 'REVISAR: existe otra firma'
    when to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)') is null
      then 'OK: libre'
    when exists (select 1 from pg_proc p
      where p.oid = to_regprocedure('public.promover_alumno_ciclo(uuid,uuid,uuid,text,uuid,boolean,boolean)')
        and position('promocion_alumnos_folio' in p.prosrc) > 0
        and position('El grado cambió desde la previsualización' in p.prosrc) > 0)
      then 'OK: versión reemplazable'
    else 'REVISAR: definición distinta'
  end as resultado;

select 'uq_alumno_programa_vigente_unico' as nombre,
  case when exists (select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'alumno_programas'
      and indexname = 'uq_alumno_programa_vigente_unico'
      and indexdef ilike '%unique%') then 'OK' else 'REVISAR' end as resultado;

select cl.relname as tabla, t.tgname as disparador, pg_get_triggerdef(t.oid) as definicion
from pg_trigger t join pg_class cl on cl.oid = t.tgrelid
join pg_namespace ns on ns.oid = cl.relnamespace
where ns.nspname = 'public' and cl.relname in ('alumnos', 'alumno_programas', 'planes_pago', 'planes_pago_detalles')
  and not t.tgisinternal order by cl.relname, t.tgname;

select tabla,
  has_table_privilege('authenticated', 'public.' || tabla, 'SELECT') as puede_leer,
  has_table_privilege('authenticated', 'public.' || tabla, 'INSERT') as puede_insertar,
  has_table_privilege('authenticated', 'public.' || tabla, 'UPDATE') as puede_actualizar
from (values ('alumnos'), ('alumno_programas'), ('planes_pago'), ('planes_pago_detalles')) as tablas(tabla);
