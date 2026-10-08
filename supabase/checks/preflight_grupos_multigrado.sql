-- Solo lectura. Ejecutar antes de 20261007100000_grupos_multigrado.sql.
with esperados(columna, tipo) as (
  values ('es_multigrado', 'boolean'), ('grado_inicio', 'integer'), ('grado_fin', 'integer')
)
select e.columna, e.tipo as tipo_esperado, c.data_type as tipo_actual,
  case when c.column_name is null then 'OK: se añadirá'
       when c.data_type = e.tipo then 'Existe: revisar antes de migrar'
       else 'Conflicto: detener' end as resultado
from esperados e
left join information_schema.columns c on c.table_schema = 'public'
  and c.table_name = 'grupos' and c.column_name = e.columna
order by e.columna;

select 'función crear_grupo_multigrado_completo' as objeto,
  case when to_regprocedure('public.crear_grupo_multigrado_completo(uuid,text,uuid,uuid,integer,text,text,uuid[],uuid[],integer,integer)') is null
    then 'OK: libre' else 'Existe: detener y revisar' end as resultado
union all
select 'función validar_alumno_grupo_multigrado',
  case when to_regprocedure('public.validar_alumno_grupo_multigrado()') is null
    then 'OK: libre' else 'Existe: detener y revisar' end
union all
select 'restricción grupos_rango_multigrado_valido',
  case when not exists (select 1 from pg_constraint where conname = 'grupos_rango_multigrado_valido')
    then 'OK: libre' else 'Existe: detener y revisar' end
union all
select 'disparador trg_validar_alumno_grupo_multigrado',
  case when not exists (select 1 from pg_trigger where tgname = 'trg_validar_alumno_grupo_multigrado')
    then 'OK: libre' else 'Existe: detener y revisar' end;

select 'función requerida crear_grupo_completo' as objeto,
  case when to_regprocedure('public.crear_grupo_completo(uuid,text,uuid,uuid,integer,text,text,uuid[],uuid[])') is not null
    then 'OK' else 'Falta: aplicar primero la migración de alta de grupos' end as resultado
union all
select 'función requerida get_my_rol',
  case when to_regprocedure('public.get_my_rol()') is not null then 'OK' else 'Falta: detener' end;
