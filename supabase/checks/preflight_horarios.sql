-- Auditoría de solo lectura para el proyecto Supabase actual.
-- Ejecutar antes de cualquier migración; no contiene operaciones de escritura.

-- 1. Las tablas y columnas que utiliza el generador deben existir con el tipo esperado.
with esperadas(tabla, columna, tipo) as (
  values
    ('ciclos_escolares', 'id', 'uuid'),
    ('ciclos_escolares', 'fecha_inicio', 'date'),
    ('ciclos_escolares', 'fecha_termino', 'date'),
    ('docentes', 'id', 'uuid'),
    ('docentes', 'nombre_completo', 'texto'),
    ('docentes', 'estatus', 'texto'),
    ('grupos', 'id', 'uuid'),
    ('grupos', 'ciclo_id', 'uuid'),
    ('grupos', 'plan_id', 'uuid'),
    ('grupos', 'codigo_grupo', 'texto'),
    ('grupos', 'turno', 'texto'),
    ('grupos', 'estatus', 'texto'),
    ('asignaturas', 'id', 'uuid'),
    ('asignaturas', 'plan_id', 'uuid'),
    ('asignaturas', 'nombre', 'texto'),
    ('docentes_grupos_asignaturas', 'id', 'uuid'),
    ('docentes_grupos_asignaturas', 'docente_id', 'uuid'),
    ('docentes_grupos_asignaturas', 'grupo_id', 'uuid'),
    ('docentes_grupos_asignaturas', 'asignatura_id', 'uuid')
)
select e.tabla, e.columna, e.tipo as tipo_esperado, c.udt_name as tipo_actual,
  case when c.column_name is null then 'FALTA'
    when e.tipo = 'texto' and c.udt_name in ('text', 'varchar') then 'OK'
    when c.udt_name = e.tipo then 'OK'
    else 'TIPO_INCOMPATIBLE' end as resultado
from esperadas e
left join information_schema.columns c on c.table_schema = 'public'
  and c.table_name = e.tabla and c.column_name = e.columna
order by e.tabla, e.columna;

-- 2. Un campo nuevo existente requiere revisar tipo y valores antes de usar IF NOT EXISTS.
with nuevas(tabla, columna, tipo) as (
  values
    ('asignaturas', 'horas_semanales', 'int4'),
    ('docentes_grupos_asignaturas', 'horas_presenciales', 'int4'),
    ('docentes_grupos_asignaturas', 'horas_asincronas', 'int4'),
    ('grupos', 'aula', 'text'),
    ('grupos', 'sede', 'text')
)
select n.tabla, n.columna, n.tipo as tipo_planeado, c.udt_name as tipo_actual,
  case when c.column_name is null then 'OK: se añadirá'
    when c.udt_name = n.tipo then 'REVISAR: ya existe'
    else 'ALTO: tipo distinto' end as resultado
from nuevas n
left join information_schema.columns c on c.table_schema = 'public'
  and c.table_name = n.tabla and c.column_name = n.columna
order by n.tabla, n.columna;

-- 3. Una tabla nueva o una función con el mismo nombre puede pertenecer a otro cambio.
select 'tabla' as tipo, nombre,
  case when to_regclass('public.' || nombre) is null then 'OK: libre'
    else 'REVISAR: ya existe' end as resultado
from (values ('docente_configuraciones_horario'), ('horarios_versiones'),
  ('horarios_cargas'), ('horarios_sesiones')) as nombres(nombre)
union all
select 'función', nombre,
  case when to_regprocedure('public.' || nombre) is null then 'OK: libre'
    else 'REVISAR: ya existe' end
from (values ('validar_campos_horario_academico()'),
  ('publicar_horario_academico(uuid,uuid[],jsonb,jsonb,integer,integer)')) as nombres(nombre)
union all
select 'función requerida', 'get_my_rol()',
  case when to_regprocedure('public.get_my_rol()') is null then 'ALTO: falta'
    else 'OK' end
order by tipo, nombre;

-- 4. Los nombres de restricciones y disparadores son específicos de la migración.
with reservados(nombre) as (
  values ('asignaturas_horas_semanales_validas'),
    ('dga_horas_presenciales_validas'), ('dga_horas_asincronas_validas'),
    ('trg_asignaturas_horas_horario'), ('trg_dga_horas_horario'),
    ('trg_grupos_ubicacion_horario')
)
select r.nombre,
  case when c.conname is not null then 'REVISAR: restricción existente'
    when t.tgname is not null then 'REVISAR: disparador existente'
    else 'OK: libre' end as resultado
from reservados r
left join pg_constraint c on c.conname = r.nombre
left join pg_trigger t on t.tgname = r.nombre and not t.tgisinternal
order by r.nombre;

-- 5. Inventario de disparadores actuales que comparten tablas con la migración.
select cl.relname as tabla, t.tgname as disparador,
  pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
join pg_class cl on cl.oid = t.tgrelid
join pg_namespace ns on ns.oid = cl.relnamespace
where ns.nspname = 'public' and cl.relname in
  ('asignaturas', 'docentes_grupos_asignaturas', 'grupos')
  and not t.tgisinternal
order by cl.relname, t.tgname;
