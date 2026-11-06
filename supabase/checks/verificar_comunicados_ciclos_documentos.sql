-- Ambas columnas deben devolver OK y los registros antiguos pueden seguir en NULL.
select tabla, columna,
  case when count(data_type) = 1 and bool_and(data_type = 'uuid') then 'OK' else 'FALTA O TIPO INCORRECTO' end as resultado
from (values ('comunicados_emisiones', 'ciclo_boleta_id'),
             ('comunicados_documentos', 'ciclo_id')) as esperado(tabla, columna)
left join information_schema.columns on table_schema = 'public'
  and table_name = tabla and column_name = columna
group by tabla, columna order by tabla, columna;
