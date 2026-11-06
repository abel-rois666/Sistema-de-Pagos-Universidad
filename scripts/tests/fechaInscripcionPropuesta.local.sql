\set ON_ERROR_STOP on
-- SOLO la base local VACÍA ic_pruebas_local. El ensayo base comprueba localhost y nombre.
\ir preparacionesInscripciones.local.sql
\ir ../../supabase/migrations/20261029140000_fecha_inscripcion_propuesta.sql
insert into alumnos(id,matricula,nombre_completo,grado_actual) values
 ('00000000-0000-4000-8000-000000000091','FECHA-1','Persona ficticia fecha 1','3'),
 ('00000000-0000-4000-8000-000000000092','FECHA-2','Persona ficticia fecha 2','3'),
 ('00000000-0000-4000-8000-000000000093','FECHA-3','Persona ficticia fecha 3','3'),
 ('00000000-0000-4000-8000-000000000094','FECHA-4','Persona ficticia fecha 4','3');
insert into alumno_programas values
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000011',true,'ACTIVO'),
 ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000011',true,'ACTIVO'),
 ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000011',true,'ACTIVO'),
 ('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000011',true,'ACTIVO');
insert into inscripciones_academicas(id,alumno_id,ciclo_id,asignatura_id,calificacion_final) values
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000061',0),
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000061',8),
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000094','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000061',9);
create function fila_desde(ap uuid) returns jsonb language plpgsql as $$
declare i public.inscripciones_ciclo;h jsonb;begin
 h=ic_trayectorias(array[ap])->0;
 select * into i from inscripciones_ciclo where alumno_programa_id=ap and ciclo_id='00000000-0000-4000-8000-000000000001';
 return fila_ic(ap)||jsonb_build_object('plan_id','00000000-0000-4000-8000-000000000011','desde','2026-10-21','grado_personal','3',
  'inscripcion_id',i.id,'revision',coalesce(i.revision,0),'fecha_primer_ingreso',null,
  'referencia',jsonb_build_object('huella',h->>'huella','aplicar_ingreso',false,'aplicar_grado',false,'aplicar_desde',true,
   'ciclo_desde_id','00000000-0000-4000-8000-000000000001','fecha_desde_propuesta','2026-10-21'));
end$$;
create function rechazar_fecha(f jsonb,descripcion text) returns void language plpgsql as $$
declare fallo boolean=false;begin
 begin perform ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(f));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo,descripcion);
end$$;
set role authenticated;
select prueba_ic(ic_configuracion()->>'propuesta_fecha_inscripcion'='true' and ic_configuracion()->>'version'='3','Capacidad de fecha propuesta habilitada sin alterar integración');
select prueba_ic(not has_function_privilege('authenticated','public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)','EXECUTE') and not has_function_privilege('anon','public.ic_contexto_revisado(uuid,uuid,jsonb,jsonb)','EXECUTE'),'Procedencia sigue privada a RPC autorizadas');
select rechazar_fecha(fila_desde('00000000-0000-4000-8000-000000000102'),'Calificaciones solo del ciclo anterior no acreditan fecha del destino');
select rechazar_fecha(jsonb_set(fila_desde('00000000-0000-4000-8000-000000000101'),'{referencia,ciclo_desde_id}','"00000000-0000-4000-8000-000000000002"'),'Ciclo semestral homónimo no sustituye destino cuatrimestral');
select rechazar_fecha(jsonb_set(fila_desde('00000000-0000-4000-8000-000000000101'),'{desde}','"2026-10-22"'),'Fecha diferente del inicio se registra manual, no como propuesta');
select rechazar_fecha(jsonb_set(fila_desde('00000000-0000-4000-8000-000000000101'),'{referencia,aplicar_desde}','"true"'),'Aceptación debe ser booleano explícito');
select rechazar_fecha(jsonb_set(fila_desde('00000000-0000-4000-8000-000000000101'),'{referencia,huella}','"inventada"'),'Huella inventada no acredita procedencia');
select rechazar_fecha(jsonb_set(fila_desde('00000000-0000-4000-8000-000000000101'),'{fecha_primer_ingreso}','"2026-10-28"'),'Ingreso posterior exige fecha real de inscripción');
select prueba_ic(ic_preparar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_desde('00000000-0000-4000-8000-000000000101')||jsonb_build_object('preparacion_id','00000000-0000-4000-8000-000000000111','preparacion_revision',0)))=1,'Se prepara fecha inferida de notas incluso con calificación cero');
select prueba_ic(not exists(select 1 from inscripciones_ciclo where alumno_programa_id='00000000-0000-4000-8000-000000000101' and ciclo_id='00000000-0000-4000-8000-000000000001'),'Proponer y preparar no acredita matrícula');
select prueba_ic(ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000111","revision":1}]',false)=1,'Preparación se confirma sin promoción');
select prueba_ic((select c.contexto#>>'{desde,aproximado}'='true' and c.contexto#>>'{desde,fecha}'=i.desde::text and c.contexto#>>'{desde,ciclo_id}'=i.ciclo_id::text from inscripciones_ciclo_contextos c join inscripciones_ciclo i on i.id=c.inscripcion_id and i.revision=c.revision where i.alumno_programa_id='00000000-0000-4000-8000-000000000101'),'Fecha, destino y procedencia coinciden en la revisión confirmada');
select prueba_ic((select grado_actual='3' from alumnos where matricula='FECHA-1') and not exists(select 1 from planes_pago where alumno_id='00000000-0000-4000-8000-000000000091'),'La propuesta no modifica grado general ni crea pagos');
select ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(fila_desde('00000000-0000-4000-8000-000000000101'),'{referencia}','null')));
select prueba_ic((select c.contexto#>>'{desde,aproximado}'='true' from inscripciones_ciclo_contextos c join inscripciones_ciclo i on i.id=c.inscripcion_id and i.revision=c.revision where i.alumno_programa_id='00000000-0000-4000-8000-000000000101'),'Editar sin cambiar la fecha conserva procedencia anterior');
select ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(jsonb_set(fila_desde('00000000-0000-4000-8000-000000000101'),'{referencia}','null'),'{desde}','"2026-10-26"')));
select prueba_ic((select c.contexto->>'desde'='MANUAL' from inscripciones_ciclo_contextos c join inscripciones_ciclo i on i.id=c.inscripcion_id and i.revision=c.revision where i.alumno_programa_id='00000000-0000-4000-8000-000000000101'),'Cambiar la fecha deja de atribuirla a la inferencia');
select rechazar_fecha(fila_desde('00000000-0000-4000-8000-000000000101'),'La fecha guardada no se sobrescribe con una propuesta posterior');
select ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_set(fila_desde('00000000-0000-4000-8000-000000000103'),'{referencia}','null')));
select prueba_ic((select c.contexto->>'desde'='MANUAL' from inscripciones_ciclo_contextos c join inscripciones_ciclo i on i.id=c.inscripcion_id and i.revision=c.revision where i.alumno_programa_id='00000000-0000-4000-8000-000000000103'),'Captura manual previa sigue disponible sin calificaciones');
do $$declare fallo boolean=false;begin
 begin perform ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_desde('00000000-0000-4000-8000-000000000104'),fila_desde('00000000-0000-4000-8000-000000000102')));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and not exists(select 1 from inscripciones_ciclo where alumno_programa_id='00000000-0000-4000-8000-000000000104' and ciclo_id='00000000-0000-4000-8000-000000000001'),'Un caso inválido conserva todo el lote sin guardados parciales');
end$$;
reset role;
insert into inscripciones_academicas(id,alumno_id,ciclo_id,asignatura_id,calificacion_final) values(gen_random_uuid(),'00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000061',7);
set role authenticated;
select ic_preparar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_desde('00000000-0000-4000-8000-000000000102')||jsonb_build_object('preparacion_id','00000000-0000-4000-8000-000000000112','preparacion_revision',0)));
reset role;
insert into inscripciones_academicas(id,alumno_id,ciclo_id,asignatura_id,calificacion_final) values(gen_random_uuid(),'00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000061',8);
set role authenticated;
do $$declare fallo boolean=false;begin
 begin perform ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000112","revision":1}]',false);exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and (select estado='PENDIENTE' and revision=1 from inscripciones_ciclo_preparaciones where id='00000000-0000-4000-8000-000000000112'),'Historial cambiado exige revisar la propuesta antes de confirmar');
end$$;
reset role;
\ir ../../supabase/checks/verificar_fecha_inscripcion_propuesta.sql
select 'ENSAYO FECHA PROPUESTA COMPLETO' resultado;
