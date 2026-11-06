\set ON_ERROR_STOP on
-- Solo cluster local desechable y base vacía; el ensayo base verifica ambos antes de crear tablas.
\ir inscripcionesCiclo.local.sql
alter table ciclos_escolares add column fecha_inicio date,add column fecha_termino date;
alter table planes_estudio add column modelo text default 'RIGIDO';
alter table asignaturas add column nombre text,add column numero_periodo integer;
alter table inscripciones_academicas add column calificacion_final numeric,add column parcial_1 numeric,add column parcial_2 numeric,add column parcial_3 numeric,add column promedio_calculado numeric;
update ciclos_escolares set fecha_inicio='2026-10-21';
insert into ciclos_escolares(id,nombre,tipo_periodo,fecha_inicio) values
 ('00000000-0000-4000-8000-000000000003','2026-3','Cuatrimestral','2026-06-25'),
 ('00000000-0000-4000-8000-000000000004','2027-2','Cuatrimestral','2027-02-24');
insert into alumnos(id,matricula,nombre_completo,grado_actual) values
 ('00000000-0000-4000-8000-000000000025','PRUEBA-5','Persona ficticia 5','2'),
 ('00000000-0000-4000-8000-000000000026','PRUEBA-6','Persona ficticia 6','2');
insert into alumno_programas values
 ('00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000025','00000000-0000-4000-8000-000000000011',true,'ACTIVO'),
 ('00000000-0000-4000-8000-000000000036','00000000-0000-4000-8000-000000000026','00000000-0000-4000-8000-000000000011',true,'ACTIVO');
insert into asignaturas values('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000011','Materia ficticia',2);
insert into inscripciones_academicas(id,alumno_id,ciclo_id,asignatura_id,calificacion_final) values
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000025','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000061',0),
 (gen_random_uuid(),'00000000-0000-4000-8000-000000000026','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000061',8);
\ir ../../supabase/migrations/20261029100000_preparaciones_historial_inscripciones.sql
set role authenticated;
select ic_guardar_lote('00000000-0000-4000-8000-000000000003',jsonb_build_array(fila_ic('00000000-0000-4000-8000-000000000035'),fila_ic('00000000-0000-4000-8000-000000000036')));
select prueba_ic(ic_configuracion()->>'version'='2','Configuración detecta preparaciones sin cambiar la bandera de integración');
select prueba_ic(ic_trayectorias(array['00000000-0000-4000-8000-000000000035'::uuid])#>>'{0,ciclos,0,materias,0,registros}'='1','Nota cero es antecedente; trayectoria trae materias');
reset role;
create function fila_preparacion(ap uuid,operacion uuid,con_historial boolean default true,fecha text default '2026-10-21') returns jsonb language plpgsql as $$
declare h jsonb;begin
 h=ic_trayectorias(array[ap])->0;
 return fila_ic(ap)||jsonb_build_object('preparacion_id',operacion,'preparacion_revision',0,'plan_id','00000000-0000-4000-8000-000000000011',
  'ciclo_origen_id','00000000-0000-4000-8000-000000000003','desde',fecha,'grado_personal','3','fecha_primer_ingreso','2026-06-25',
  'referencia',case when con_historial then jsonb_build_object('huella',h->>'huella','aplicar_ingreso',true,'aplicar_grado',true,'ciclo_ingreso_id','00000000-0000-4000-8000-000000000003') else null end);
end$$;
set role authenticated;
select prueba_ic(ic_preparar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_preparacion('00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000071')))=1,'Preparación pendiente se guarda');
select prueba_ic((select grado_actual='2' from alumnos where matricula='PRUEBA-5') and not exists(select 1 from inscripciones_ciclo where alumno_programa_id='00000000-0000-4000-8000-000000000035' and ciclo_id='00000000-0000-4000-8000-000000000001'),'Preparar no cambia grado general ni acredita matrícula');
select prueba_ic((select contexto#>>'{ingreso,aproximado}'='true' and contexto#>>'{historial,alumno_programa_id}'=alumno_programa_id::text from inscripciones_ciclo_preparaciones where id='00000000-0000-4000-8000-000000000071'),'Snapshot y procedencia inferida calculados por el servidor');
do $$declare fallo boolean=false;begin
 begin perform ic_preparar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_preparacion('00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000071')));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo,'Revisión obsoleta no sobrescribe preparación');
 fallo=false;begin perform ic_guardar_revision('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_preparacion('00000000-0000-4000-8000-000000000036','00000000-0000-4000-8000-000000000072')||jsonb_build_object('referencia',jsonb_build_object('huella','inventada'))));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo,'Procedencia inventada rechazada');
end$$;
select prueba_ic(ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000071","revision":1}]',false)=1,'Confirmación central con fecha efectiva explícita');
select prueba_ic((select desde='2026-10-21' and grado_personal='3' from inscripciones_ciclo where alumno_programa_id='00000000-0000-4000-8000-000000000035' and ciclo_id='00000000-0000-4000-8000-000000000001') and (select grado_actual='2' from alumnos where matricula='PRUEBA-5'),'Confirmar solo matrícula conserva grado actual');
select prueba_ic((select count(*)=1 from inscripciones_ciclo_contextos),'Procedencia vinculada a ID y revisión exactos');
select prueba_ic(ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000071","revision":1}]',false)=1 and (select count(*)=1 from inscripciones_ciclo_contextos),'Reintento de confirmación no duplica ni sobrescribe');
select ic_preparar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(fila_preparacion('00000000-0000-4000-8000-000000000036','00000000-0000-4000-8000-000000000072')));
reset role;
insert into planes_pago values('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000026','00000000-0000-4000-8000-000000000001');
set role authenticated;
select prueba_ic(ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000072","revision":1}]',true)=1,'Avance integrado confirmado mediante promoción existente');
select prueba_ic((select grado_actual='3' from alumnos where matricula='PRUEBA-6') and (select count(*)=1 from planes_pago where alumno_id='00000000-0000-4000-8000-000000000026'),'Avance respeta grado preparado y conserva plan financiero');
select prueba_ic((select not prosecdef from pg_proc where oid='public.ic_confirmar_lote_preparado(jsonb,boolean)'::regprocedure),'Orquestación conserva SECURITY INVOKER');
select ic_preparar_lote('00000000-0000-4000-8000-000000000004',jsonb_build_array(fila_preparacion('00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000073',false,'2027-02-24')));
do $$declare fallo boolean=false;begin
 begin perform ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000073","revision":1}]',true);exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and (select estado='PENDIENTE' from inscripciones_ciclo_preparaciones where id='00000000-0000-4000-8000-000000000073'),'Preparación futura no adelanta el grado general');
end$$;
select ic_cancelar_preparacion('00000000-0000-4000-8000-000000000073',1,'Cancelación ficticia para comprobar auditoría');
select prueba_ic((select estado='CANCELADA' and revision=2 from inscripciones_ciclo_preparaciones where id='00000000-0000-4000-8000-000000000073'),'Cancelar conserva preparación y bitácora');
set request.jwt.claim.rol='CAJERO';
select prueba_ic((select count(*)=0 from inscripciones_ciclo_preparaciones) and (select count(*)=0 from inscripciones_ciclo_contextos),'RLS oculta preparaciones y procedencia a rol financiero');
do $$declare fallo boolean=false;begin
 begin perform ic_trayectorias(array['00000000-0000-4000-8000-000000000035'::uuid]);exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo,'RPC de trayectoria verifica rol');
end$$;
reset role;
select prueba_ic(not has_table_privilege('authenticated','inscripciones_ciclo_preparaciones','UPDATE') and not has_table_privilege('anon','inscripciones_ciclo_contextos','SELECT'),'Sin escrituras directas ni lectura anónima');
set role authenticated;set request.jwt.claim.rol='ADMINISTRADOR';
do $$declare i inscripciones_ciclo;f jsonb;fallo boolean=false;begin
 select * into i from inscripciones_ciclo where alumno_programa_id='00000000-0000-4000-8000-000000000035' and ciclo_id='00000000-0000-4000-8000-000000000001';
 f=fila_preparacion(i.alumno_programa_id,'00000000-0000-4000-8000-000000000079')||jsonb_build_object('revision',i.revision,'inscripcion_id',i.id);
 perform ic_guardar_revision(i.ciclo_id,jsonb_build_array(f));
 perform prueba_ic((select contexto#>>'{ingreso,aproximado}'='true' from inscripciones_ciclo_contextos where inscripcion_id=i.id and revision=2),'Guardado directo registra procedencia verificada');
 select * into i from inscripciones_ciclo where id=i.id;
 f=f||jsonb_build_object('revision',i.revision,'referencia',null,'motivo','Corrección ficticia conservando ingreso y grado');
 perform ic_guardar_revision(i.ciclo_id,jsonb_build_array(f));
 perform prueba_ic((select contexto#>>'{ingreso,aproximado}'='true' and contexto->>'contexto_previo_id' is not null from inscripciones_ciclo_contextos where inscripcion_id=i.id and revision=3),'Editar evidencia conserva procedencia de los valores acreditados');
 select * into i from inscripciones_ciclo where id=i.id;
 f=fila_preparacion(i.alumno_programa_id,'00000000-0000-4000-8000-000000000079')||jsonb_build_object('revision',i.revision,'inscripcion_id',i.id,'fecha_primer_ingreso','2025-01-01');
 begin perform ic_guardar_revision(i.ciclo_id,jsonb_build_array(f));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and (select revision=3 from inscripciones_ciclo where id=i.id),'Fecha cambiada manualmente no se atribuye a inferencia');
 perform ic_guardar_lote(i.ciclo_id,jsonb_build_array(fila_ic(i.alumno_programa_id,i.revision,i.id)||jsonb_build_object('grado_personal','4')));
 perform prueba_ic(not exists(select 1 from inscripciones_ciclo_contextos where inscripcion_id=i.id and revision=4) and exists(select 1 from inscripciones_ciclo_contextos where inscripcion_id=i.id and revision=3),'Cliente anterior no arrastra procedencia obsoleta a una revisión nueva');
end$$;
do $$declare fallo boolean=false;begin
 begin perform ic_preparar_lote('00000000-0000-4000-8000-000000000004',jsonb_build_array(
 fila_preparacion('00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000074',false,'2027-02-24'),
 fila_preparacion('00000000-0000-4000-8000-000000000036','00000000-0000-4000-8000-000000000075',false,'2027-02-24')||jsonb_build_object('grado_personal','99')));exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and not exists(select 1 from inscripciones_ciclo_preparaciones where id='00000000-0000-4000-8000-000000000074'),'Fila inválida revierte preparación y auditoría de todo el lote');
end$$;
select ic_preparar_lote('00000000-0000-4000-8000-000000000004',jsonb_build_array(fila_preparacion('00000000-0000-4000-8000-000000000035','00000000-0000-4000-8000-000000000074',true,'2027-02-24')||jsonb_build_object('grado_personal','5')));
reset role;
insert into inscripciones_academicas(id,alumno_id,ciclo_id,asignatura_id,calificacion_final) values(gen_random_uuid(),'00000000-0000-4000-8000-000000000025','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000061',7);
set role authenticated;
do $$declare fallo boolean=false;begin
 begin perform ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000074","revision":1}]',false);exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and (select estado='PENDIENTE' from inscripciones_ciclo_preparaciones where id='00000000-0000-4000-8000-000000000074'),'Historial modificado exige volver a revisar la preparación');
end$$;
reset role;
insert into alumnos(id,matricula,nombre_completo,grado_actual) values
 ('00000000-0000-4000-8000-000000000027','PRUEBA-7','Persona ficticia 7','2'),('00000000-0000-4000-8000-000000000028','PRUEBA-8','Persona ficticia 8','2');
insert into alumno_programas values
 ('00000000-0000-4000-8000-000000000037','00000000-0000-4000-8000-000000000027','00000000-0000-4000-8000-000000000011',true,'ACTIVO'),
 ('00000000-0000-4000-8000-000000000038','00000000-0000-4000-8000-000000000028','00000000-0000-4000-8000-000000000011',true,'ACTIVO');
set role authenticated;
select ic_guardar_lote('00000000-0000-4000-8000-000000000003',jsonb_build_array(fila_ic('00000000-0000-4000-8000-000000000037')));
select ic_preparar_lote('00000000-0000-4000-8000-000000000001',jsonb_build_array(
 fila_preparacion('00000000-0000-4000-8000-000000000037','00000000-0000-4000-8000-000000000076',false),
 fila_preparacion('00000000-0000-4000-8000-000000000038','00000000-0000-4000-8000-000000000077',false)));
do $$declare fallo boolean=false;begin
 begin perform ic_confirmar_lote_preparado('[{"id":"00000000-0000-4000-8000-000000000076","revision":1},{"id":"00000000-0000-4000-8000-000000000077","revision":1}]',true);exception when raise_exception then fallo=true;end;
 perform prueba_ic(fallo and (select grado_actual='2' from alumnos where matricula='PRUEBA-7')
  and not exists(select 1 from inscripciones_ciclo where alumno_programa_id='00000000-0000-4000-8000-000000000037' and ciclo_id='00000000-0000-4000-8000-000000000001')
  and (select estado='PENDIENTE' and revision=1 from inscripciones_ciclo_preparaciones where id='00000000-0000-4000-8000-000000000076'),
  'Error posterior revierte avance general, inscripción, contexto y preparación del primer alumno');
end$$;
reset role;
select 'ENSAYO PREPARACIONES COMPLETO' resultado;
