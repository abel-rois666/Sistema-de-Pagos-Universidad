-- Ejecutar antes de 20261017120000_comunicados_ciclos_documentos.sql.
select 'tabla' as objeto, nombre,
  case when to_regclass('public.' || nombre) is not null then 'OK' else 'FALTA' end as resultado
from (values ('comunicados_emisiones'), ('comunicados_documentos'), ('ciclos_escolares')) as base(nombre);

select tabla, columna,
  case when count(data_type) = 0 then 'LIBRE: se añadirá'
       when bool_and(data_type = 'uuid') then 'OK: uuid existente'
       else 'REVISAR: tipo distinto' end as resultado
from (values ('comunicados_emisiones', 'ciclo_boleta_id'),
             ('comunicados_documentos', 'ciclo_id')) as esperado(tabla, columna)
left join information_schema.columns on table_schema = 'public'
  and table_name = tabla and column_name = columna
group by tabla, columna order by tabla, columna;
