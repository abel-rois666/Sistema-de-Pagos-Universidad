-- SOLO LECTURA. Ejecutar antes de instalar 20261118150000. No devuelve datos personales.
select current_database() base,version();
select nombre,to_regclass('public.'||nombre) tabla from unnest(array['ficha_titulacion','ficha_certificacion','alumno_programas','planes_estudio','carreras','asignaturas','inscripciones_academicas','servicio_social','planes_pago','planes_pago_detalles','planes_pago_vinculos_recibo','recibos','recibos_detalles','titulacion_auditoria']) nombre;
select p.proname,p.prosecdef,p.proconfig,md5(btrim(replace(p.prosrc,E'\r',''),E' \n\t')) huella,
 md5(btrim(replace(p.prosrc,E'\r',''),E' \n\t'))='9c2be376908ca437e2818ff17888c92d' base_revisada,
 position('requisitos_verificados' in p.prosrc)>0 requisitos_instalados
from pg_proc p where p.oid=to_regprocedure('public.titulacion_guardar_v1(uuid,uuid,uuid,integer,jsonb,text,text)');
select table_name,column_name,data_type from information_schema.columns where table_schema='public' and
 ((table_name='ficha_titulacion' and column_name in ('alumno_programa_id','revision','archivado_en','plan_pago_requisito_id','servicio_social_requisito_id','requisitos_verificados'))
 or (table_name='carreras' and column_name like 'calificacion_%')
 or (table_name='asignaturas' and column_name in ('activo','plan_id','clasificacion_clave','clasificacion_nombre')))
order by table_name,column_name;

-- Todas las columnas consumidas por la nueva consulta deben existir antes de instalar.
with requeridas(tabla,campo) as (
 select tabla,unnest(campos) from (values
 ('alumno_programas',array['id','alumno_id','plan_id']),
 ('planes_estudio',array['id','carrera_id']),
 ('carreras',array['id','nivel_educativo','calificacion_minima_aprobatoria']),
 ('asignaturas',array['id','plan_id','nombre','activo','clasificacion_clave','clasificacion_nombre']),
 ('inscripciones_academicas',array['id','alumno_id','asignatura_id','calificacion_final']),
 ('ficha_certificacion',array['id','alumno_id','alumno_programa_id','archivado_en','tipo_certificado','tramite_completado','created_at']),
 ('servicio_social',array['id','alumno_id','estatus','nombre_empresa','fecha_inicio']),
 ('planes_pago',array['id','alumno_id','tipo_plan','no_plan_pagos','licenciatura','ciclo_id']),
 ('ciclos_escolares',array['id','nombre','tipo_periodo']),
 ('planes_pago_detalles',array['id','plan_id','indice_concepto','concepto','cantidad','estatus']),
 ('planes_pago_vinculos_recibo',array['id','plan_id','indice_concepto','recibo_detalle_id','importe','anulado_en']),
 ('recibos',array['id','estatus']),('recibos_detalles',array['id','recibo_id'])
 ) r(tabla,campos)
)
select r.tabla,r.campo,c.data_type,c.column_name is not null existe
from requeridas r left join information_schema.columns c on c.table_schema='public' and c.table_name=r.tabla and c.column_name=r.campo
order by r.tabla,r.campo;
