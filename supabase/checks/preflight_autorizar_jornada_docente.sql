-- Solo lectura. Revisar los tres resultados antes de instalar la migración.
select 'horarios_versiones' as objeto,
  case when to_regclass('public.horarios_versiones') is not null then 'OK' else 'FALTA' end as resultado;

select 'excepciones_jornada_docente' as objeto,
  case when c.column_name is null then 'OK: se añadirá'
    when c.data_type = 'jsonb' and c.is_nullable = 'NO' then 'OK: ya existe jsonb'
    else 'REVISAR: columna incompatible' end as resultado
from (select 1) base
left join information_schema.columns c on c.table_schema = 'public'
  and c.table_name = 'horarios_versiones' and c.column_name = 'excepciones_jornada_docente';

select 'publicar_horario_academico' as objeto,
  case when to_regprocedure('public.publicar_horario_academico(uuid,uuid[],jsonb,jsonb,integer,integer)') is not null
    then 'OK: función previa presente' else 'FALTA' end as resultado
union all
select 'publicar_horario_academico_con_excepciones',
  case when to_regprocedure('public.publicar_horario_academico_con_excepciones(uuid,uuid[],jsonb,jsonb,integer,integer,integer,jsonb)') is null
    then 'OK: nombre libre' else 'REVISAR: ya existe' end;
