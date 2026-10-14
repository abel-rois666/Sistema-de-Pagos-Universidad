-- Solo lectura; ejecutar después de ambas migraciones.
select objeto, case when existe then 'OK' else 'FALTA' end as resultado from (
  select 'planes_estudio.modalidad' as objeto, exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='planes_estudio' and column_name='modalidad') as existe
  union all select 'docentes_grupos_asignaturas.horas_en_linea', exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='docentes_grupos_asignaturas' and column_name='horas_en_linea')
  union all select 'horarios_cargas.horas_en_linea', exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='horarios_cargas' and column_name='horas_en_linea')
  union all select 'horarios_sesiones.medio', exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='horarios_sesiones' and column_name='medio')
  union all select 'calendarios_academicos', to_regclass('public.calendarios_academicos') is not null
  union all select 'calendarios_planes', to_regclass('public.calendarios_planes') is not null
  union all select 'calendario_eventos', to_regclass('public.calendario_eventos') is not null
  union all select 'guardar_calendario_academico',
    to_regprocedure('public.guardar_calendario_academico(uuid,uuid,text,text,text,date,date,text[],uuid[])') is not null
  union all select 'publicar_horario_academico_modalidad',
    to_regprocedure('public.publicar_horario_academico_modalidad(uuid,uuid[],jsonb,jsonb,integer,integer,integer,jsonb)') is not null
) revision order by objeto;

select 'sin conversion de sesiones historicas' as comprobacion,
  count(*) filter (where medio <> 'PRESENCIAL') as sesiones_no_presenciales
from public.horarios_sesiones;
