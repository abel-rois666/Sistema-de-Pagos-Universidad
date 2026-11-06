\set ON_ERROR_STOP on
-- Exclusivamente la base local vacía; el ensayo incluido verifica host y nombre.
\ir fechaInscripcionPropuesta.local.sql
\ir ../../supabase/migrations/20261029160000_fecha_historica_origen_inscripciones.sql
reset role;
insert into ciclos_escolares(id,nombre,tipo_periodo,fecha_inicio) values
 ('00000000-0000-4000-8000-000000000005','2025-1','Cuatrimestral','2024-10-01'),
 ('00000000-0000-4000-8000-000000000006','2026-2','Cuatrimestral','2026-02-25');
insert into alumnos(id,matricula,nombre_completo,grado_actual) values
 ('00000000-0000-4000-8000-000000000121','HIST-1','Persona ficticia histórica 1','3'),
 ('00000000-0000-4000-8000-000000000122','HIST-2','Persona ficticia histórica 2','3'),
 ('00000000-0000-4000-8000-000000000123','HIST-3','Persona ficticia histórica 3','3');
insert into alumno_programas values
 ('00000000-0000-4000-8000-000000000131','00000000-0000-4000-8000-000000000121','00000000-0000-4000-8000-000000000011',true,'ACTIVO'),
 ('00000000-0000-4000-8000-000000000132','00000000-0000-4000-8000-000000000122','00000000-0000-4000-8000-000000000011',true,'ACTIVO'),
 ('00000000-0000-4000-8000-000000000133','00000000-0000-4000-8000-000000000123','00000000-0000-4000-8000-000000000011',true,'ACTIVO');
insert into inscripciones_academicas(id,alumno_id,ciclo_id,asignatura_id,calificacion_final) values
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000121','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000061',0),
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000121','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000061',8),
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000122','00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000061',8),
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000122','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000061',8);
create function fila_historica(ap uuid) returns jsonb language plpgsql as $$declare f jsonb;begin
 f=fila_desde(ap);
 return f||jsonb_build_object('desde','2024-10-01','tipo_ingreso','REINGRESO','ciclo_origen_id','00000000-0000-4000-8000-000000000003',
 'referencia',(f->'referencia')||jsonb_build_object('metodo_desde','HISTORIAL_MAS_ANTIGUO','ciclo_desde_id','00000000-0000-4000-8000-000000000005','fecha_desde_propuesta','2024-10-01','aplicar_origen',true,'ciclo_origen_propuesto_id','00000000-0000-4000-8000-000000000003'));
end$$;
set role authenticated;
select prueba_ic(ic_configuracion()->>'version'='4' and ic_configuracion()->>'propuesta_fecha_historial'='true','Capacidad histórica nueva sin retirar la anterior');
select rechazar_fecha(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000131'),'{referencia,metodo_desde}','"INVENTADO"'),'No acepta método histórico inventado');
select rechazar_fecha(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000131'),'{referencia,ciclo_desde_id}','"00000000-0000-4000-8000-000000000003"'),'No usa último ciclo como primero');
select rechazar_fecha(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000131'),'{desde}','"2024-10-02"'),'Fecha manipulada no es inicio histórico');
select rechazar_fecha(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000131'),'{referencia,ciclo_origen_propuesto_id}','"00000000-0000-4000-8000-000000000005"'),'Origen anterior más antiguo no sustituye último ciclo calificado');
select rechazar_fecha(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000131'),'{referencia,aplicar_origen}','"true"'),'Aceptación de origen no admite texto');
select rechazar_fecha(fila_historica('00000000-0000-4000-8000-000000000133'),'Sin calificaciones no se inventa historial');
select rechazar_fecha(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000131'),'{tipo_ingreso}','"PRIMER_INGRESO"'),'Primer ingreso no acepta ciclo anterior');
select prueba_ic(ic_preparar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_historica('00000000-0000-4000-8000-000000000131')||jsonb_build_object('preparacion_id','00000000-0000-4000-8000-000000000141','preparacion_revision',0)))=1,'Se prepara fecha histórica y último origen sin notas del destino');
select prueba_ic(not exists(select 1 from inscripciones_ciclo where alumno_programa_id='00000000-0000-4000-8000-000000000131'),'Preparar no acredita matrícula actual');
select prueba_ic(ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000141","revision":1}]',false)=1,'Confirma tras revisión sin promoción automática');
select prueba_ic((select i.desde='2024-10-01' and c.contexto#>>'{desde,ciclo_id}'='00000000-0000-4000-8000-000000000005' and c.contexto#>>'{desde,ciclo_destino_id}'=i.ciclo_id::text and c.ciclo_origen_id='00000000-0000-4000-8000-000000000003' from inscripciones_ciclo i join inscripciones_ciclo_contextos c on c.inscripcion_id=i.id and c.revision=i.revision where i.alumno_programa_id='00000000-0000-4000-8000-000000000131'),'Fuente antigua y destino se guardan por separado del último origen');
select prueba_ic((select grado_actual='3' from alumnos where matricula='HIST-1') and not exists(select 1 from planes_pago where alumno_id='00000000-0000-4000-8000-000000000121'),'No promueve ni crea pagos');
select ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000131'),'{referencia}','null')));
select prueba_ic((select c.contexto#>>'{desde,metodo}'='INICIO_HISTORICO_CON_CALIFICACIONES' and c.contexto#>>'{origen_anterior,metodo}'='ULTIMO_CICLO_ANTERIOR_CON_CALIFICACIONES' from inscripciones_ciclo i join inscripciones_ciclo_contextos c on c.inscripcion_id=i.id and c.revision=i.revision where i.alumno_programa_id='00000000-0000-4000-8000-000000000131'),'Editar sin cambiar conserva ambas procedencias');
select ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(jsonb_set(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000131'),'{referencia}','null'),'{desde}','"2026-10-21"'),'{ciclo_origen_id}','"00000000-0000-4000-8000-000000000006"')));
select prueba_ic((select c.contexto->>'desde'='MANUAL' and c.contexto->>'origen_anterior'='MANUAL' from inscripciones_ciclo i join inscripciones_ciclo_contextos c on c.inscripcion_id=i.id and c.revision=i.revision where i.alumno_programa_id='00000000-0000-4000-8000-000000000131'),'Cambios manuales no conservan atribución falsa');
select rechazar_fecha(fila_historica('00000000-0000-4000-8000-000000000131'),'No sobrescribe fecha guardada con inicio histórico');
-- Fecha manual conservada, solo completa origen con calificaciones anteriores.
select ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_ic('00000000-0000-4000-8000-000000000132')||jsonb_build_object('plan_id','00000000-0000-4000-8000-000000000011','desde','2026-10-22')));
select ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(jsonb_set(fila_historica('00000000-0000-4000-8000-000000000132'),'{desde}','"2026-10-22"'),'{referencia,aplicar_desde}','false')));
select prueba_ic((select i.desde='2026-10-22' and c.contexto->>'desde'='MANUAL' and c.ciclo_origen_id='00000000-0000-4000-8000-000000000003' from inscripciones_ciclo i join inscripciones_ciclo_contextos c on c.inscripcion_id=i.id and c.revision=i.revision where i.alumno_programa_id='00000000-0000-4000-8000-000000000132'),'Origen pendiente se completa sin reemplazar fecha manual');
select prueba_ic(ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_desde('00000000-0000-4000-8000-000000000104')))=1,'La propuesta anterior del destino conserva compatibilidad tras la corrección');
reset role;
\ir ../../supabase/checks/verificar_fecha_historica_origen_inscripciones.sql
select 'ENSAYO HISTORICO COMPLETO' resultado;
