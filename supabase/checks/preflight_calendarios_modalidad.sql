-- Solo lectura. Revisar antes de aplicar las dos migraciones 20261010.
select objeto, resultado from (
  select 'planes_estudio.modalidad' as objeto,
    case when exists (select 1 from information_schema.columns where table_schema='public'
      and table_name='planes_estudio' and column_name='modalidad') then 'REVISAR: ya existe' else 'OK: libre' end as resultado
  union all select 'docentes_grupos_asignaturas.horas_en_linea',
    case when exists (select 1 from information_schema.columns where table_schema='public'
      and table_name='docentes_grupos_asignaturas' and column_name='horas_en_linea') then 'REVISAR: ya existe' else 'OK: libre' end
  union all select 'horarios_cargas.horas_en_linea',
    case when exists (select 1 from information_schema.columns where table_schema='public'
      and table_name='horarios_cargas' and column_name='horas_en_linea') then 'REVISAR: ya existe' else 'OK: libre' end
  union all select 'horarios_sesiones.medio',
    case when exists (select 1 from information_schema.columns where table_schema='public'
      and table_name='horarios_sesiones' and column_name='medio') then 'REVISAR: ya existe' else 'OK: libre' end
  union all select 'calendarios_academicos',
    case when to_regclass('public.calendarios_academicos') is null then 'OK: libre' else 'REVISAR: ya existe' end
  union all select 'calendarios_planes',
    case when to_regclass('public.calendarios_planes') is null then 'OK: libre' else 'REVISAR: ya existe' end
  union all select 'calendario_eventos',
    case when to_regclass('public.calendario_eventos') is null then 'OK: libre' else 'REVISAR: ya existe' end
  union all select 'guardar_calendario_academico',
    case when to_regprocedure('public.guardar_calendario_academico(uuid,uuid,text,text,text,date,date,text[],uuid[])') is null
      then 'OK: libre' else 'REVISAR: ya existe' end
  union all select 'get_my_rol()',
    case when to_regprocedure('public.get_my_rol()') is not null then 'OK' else 'FALTA' end
  union all select 'publicar_horario_academico',
    case when to_regprocedure('public.publicar_horario_academico(uuid,uuid[],jsonb,jsonb,integer,integer)') is not null
      then 'OK: se actualizará' else 'FALTA' end
) revision order by objeto;

-- Las restricciones nuevas deben tener nombres libres; si no, compara su definición.
select conname as restriccion_existente, conrelid::regclass as tabla
from pg_constraint
where conname in ('planes_estudio_modalidad_valida', 'dga_horas_en_linea_validas',
  'horarios_cargas_horas_en_linea_validas', 'horarios_sesiones_medio_valido',
  'calendarios_fechas_validas', 'calendarios_turnos_validos',
  'calendario_evento_fechas_validas', 'calendario_examenes_no_lectivos');
