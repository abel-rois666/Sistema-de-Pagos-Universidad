-- Solo lectura. Debe devolver las cuatro tablas nuevas como LIBRE.
select objeto, to_regclass('public.' || objeto) as existente,
  case when to_regclass('public.' || objeto) is null then 'LIBRE' else 'REVISAR' end as resultado
from (values ('comunicados_drive_conexion'), ('comunicados_oauth_estados'),
  ('comunicados_emisiones'), ('comunicados_documentos')) as t(objeto);

-- Dependencias indispensables del flujo; la ausencia requiere revisar el esquema antes de aplicar.
select objeto, to_regclass('public.' || objeto) as existente,
  case when to_regclass('public.' || objeto) is not null then 'OK' else 'FALTA' end as resultado
from (values ('alumnos'), ('ciclos_escolares'), ('grupos'), ('alumnos_grupos'),
  ('inscripciones_academicas'), ('planes_estudio'), ('planes_pago'), ('planes_pago_detalles'),
  ('horarios_versiones'), ('horarios_sesiones'), ('calendarios_academicos')) as t(objeto);

select case when to_regprocedure('public.get_my_rol()') is not null then 'OK' else 'FALTA' end
  as permiso_rol;

select case when exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'planes_estudio' and column_name = 'modalidad')
  then 'OK' else 'FALTA' end as modalidad_del_plan;
