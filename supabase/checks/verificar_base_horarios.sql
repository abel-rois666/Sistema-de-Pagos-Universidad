-- Comprobación de solo lectura tras instalar 20261006120000_horarios_academicos.sql.
-- Cada resultado debe ser OK antes de instalar la función de publicación.

with columnas(tabla, columna, tipo) as (
  values ('asignaturas', 'horas_semanales', 'int4'),
    ('docentes_grupos_asignaturas', 'horas_presenciales', 'int4'),
    ('docentes_grupos_asignaturas', 'horas_asincronas', 'int4'),
    ('grupos', 'aula', 'text'), ('grupos', 'sede', 'text')
), tablas(nombre) as (
  values ('docente_configuraciones_horario'), ('horarios_versiones'),
    ('horarios_cargas'), ('horarios_sesiones')
), disparadores(tabla, nombre) as (
  values ('asignaturas', 'trg_asignaturas_horas_horario'),
    ('docentes_grupos_asignaturas', 'trg_dga_horas_horario'),
    ('grupos', 'trg_grupos_ubicacion_horario')
), politicas(tabla, nombre) as (
  values ('docente_configuraciones_horario', 'horarios: configuración académica'),
    ('horarios_versiones', 'horarios: consulta de versiones'),
    ('horarios_cargas', 'horarios: consulta de cargas'),
    ('horarios_sesiones', 'horarios: consulta de sesiones')
)
select 'columna' as objeto, c.tabla || '.' || c.columna as nombre,
  case when ic.udt_name = c.tipo then 'OK' else 'FALTA O TIPO DISTINTO' end as resultado
from columnas c left join information_schema.columns ic
  on ic.table_schema = 'public' and ic.table_name = c.tabla and ic.column_name = c.columna
union all
select 'tabla', t.nombre,
  case when to_regclass('public.' || t.nombre) is not null then 'OK' else 'FALTA' end
from tablas t
union all
select 'RLS', t.nombre,
  case when cl.relrowsecurity then 'OK' else 'FALTA' end
from tablas t left join pg_class cl on cl.oid = to_regclass('public.' || t.nombre)
union all
select 'disparador', d.tabla || '.' || d.nombre,
  case when tr.oid is not null then 'OK' else 'FALTA' end
from disparadores d left join pg_trigger tr on tr.tgrelid = to_regclass('public.' || d.tabla)
  and tr.tgname = d.nombre and not tr.tgisinternal
union all
select 'política', p.tabla || '.' || p.nombre,
  case when pol.policyname is not null then 'OK' else 'FALTA' end
from politicas p left join pg_policies pol
  on pol.schemaname = 'public' and pol.tablename = p.tabla and pol.policyname = p.nombre
union all
select 'función', 'validar_campos_horario_academico()',
  case when to_regprocedure('public.validar_campos_horario_academico()') is not null
    then 'OK' else 'FALTA' end
order by objeto, nombre;
