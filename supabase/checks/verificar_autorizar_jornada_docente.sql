-- Solo lectura. Ejecutar después de instalar la migración.
select 'columna de auditoría' as objeto,
  case when c.data_type = 'jsonb' and c.is_nullable = 'NO' then 'OK' else 'REVISAR' end as resultado
from (select 1) base
left join information_schema.columns c on c.table_schema = 'public'
  and c.table_name = 'horarios_versiones' and c.column_name = 'excepciones_jornada_docente';

select 'función de publicación con excepciones' as objeto,
  case when to_regprocedure('public.publicar_horario_academico_con_excepciones(uuid,uuid[],jsonb,jsonb,integer,integer,integer,jsonb)') is not null
    then 'OK' else 'REVISAR' end as resultado;
