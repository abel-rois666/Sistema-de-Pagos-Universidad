-- Solo lectura: confirma que la versión instalada de la función contiene la nueva validación.
-- Este chequeo de definición no sustituye una prueba funcional de publicación.
with funcion as (
  select to_regprocedure('public.publicar_horario_academico(uuid,uuid[],jsonb,jsonb,integer,integer)') as oid
)
select 'publicar_horario_academico: continuidad por materia y día' as objeto,
  case
    when oid is null then 'FALTA FUNCIÓN'
    when position('lag(fin) over (partition by carga_id, dia order by inicio, fin)'
      in pg_get_functiondef(oid)) = 0 then 'VERSIÓN ANTERIOR'
    when position('tiene horas discontinuas el día'
      in pg_get_functiondef(oid)) = 0 then 'REVISAR DEFINICIÓN'
    else 'OK: VALIDACIÓN INSTALADA'
  end as resultado
from funcion;
