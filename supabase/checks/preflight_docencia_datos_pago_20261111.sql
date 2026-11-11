-- Solo lectura. Ejecutar antes de instalar las dos migraciones nuevas.
with requeridas(tabla,columnas) as(values
 ('personal_personas',array['id','revision','datos']),('personal_auditoria',array['persona_id','seccion','motivo','antes','despues','creado_por','rol']),
 ('docentes',array['id','persona_id']),('empleados',array['id','persona_id']),('usuarios',array['auth_id','rol','activo']),
 ('ciclos_escolares',array['id','nombre','tipo_periodo','fecha_inicio','fecha_termino']),
 ('horarios_versiones',array['id','ciclo_id','version','estado']),
 ('horarios_cargas',array['id','horario_id','docente_id','asignatura_id','grupo_id','grupo_codigo','grupo_turno','asignatura_nombre','horas_presenciales','horas_asincronas']),
 ('horarios_sesiones',array['id','horario_id','carga_id','dia_semana','hora_inicio','hora_fin']),
 ('asignaturas',array['id','plan_id','nombre','clave_legado']),('planes_estudio',array['id','nombre','clave_legado','modalidad','tipo_periodo','carrera_id']),('carreras',array['id','nombre']),
 ('calendarios_academicos',array['id','ciclo_id','fecha_inicio','fecha_fin','modalidad','turnos']),('calendarios_planes',array['calendario_id','plan_id']),
 ('calendario_eventos',array['id','calendario_id','fecha_inicio','fecha_fin','tipo','suspende_clases'])
)
select r.tabla,to_regclass('public.'||r.tabla) presente,coalesce((select jsonb_agg(col) from unnest(r.columnas) col where not exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=r.tabla and c.column_name=col)),'[]') faltantes from requeridas r order by r.tabla;
select nombre,to_regprocedure(nombre) presente from (values('public._personal_rol_v1()'),('public._personal_fuente_v1(text,uuid,boolean)')) f(nombre);
-- Revisar el cuerpo real de autorización; no basta con la existencia del helper.
select p.oid::regprocedure funcion,pg_get_functiondef(p.oid) definicion from pg_proc p where p.oid=to_regprocedure('public._personal_rol_v1()');
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename in ('horarios_versiones','horarios_cargas','horarios_sesiones','personal_personas') order by tablename,policyname;
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('horarios_versiones','horarios_cargas','horarios_sesiones') order by tablename,indexname;
