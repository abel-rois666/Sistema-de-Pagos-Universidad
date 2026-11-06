-- Solo lectura. Ejecutar antes de la migración; no muestra datos personales.
select to_regclass('public.comunicados_emisiones') as emisiones,
       to_regclass('public.comunicados_plantilla_mensaje') as plantilla,
       to_regclass('public.inscripciones_academicas') as inscripciones,
       to_regclass('public.alumnos') as alumnos;

select count(*) as emisiones_existentes,
       count(*) filter (where ciclo_boleta_id is null) as emisiones_sin_ciclo_boleta
from public.comunicados_emisiones;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and
      ((table_name = 'alumnos' and column_name = 'grado_actual') or
       (table_name = 'comunicados_emisiones' and column_name = 'ciclo_boleta_id') or
       (table_name = 'comunicados_plantilla_mensaje' and column_name = 'contenido'))
order by table_name, column_name;
