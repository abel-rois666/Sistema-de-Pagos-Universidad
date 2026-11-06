import test from 'node:test';
import assert from 'node:assert/strict';
import { capturaInicial, esFechaInscripcion, fechaInstitucionalInscripciones, filtrarInscripciones, normalizarOrigenInscripcion, seleccionarPaginaInscripciones, situacionInscripcion, validarCapturaInscripcion } from '../src/inscripciones/dominio';
import type { CandidatoInscripcion, InscripcionCiclo } from '../src/inscripciones/types';
const inscripcion:InscripcionCiclo={id:'i1',alumno_programa_id:'ap1',ciclo_id:'CUAT',revision:2,estado:'CONFIRMADA',desde:'2026-09-01',hasta:null,grado_personal:'2DO',tipo_ingreso:'REINGRESO',fecha_primer_ingreso:null,evidencia:'Ficha de reinscripción',motivo:'Revisión documentada',procedencia:'CONTROL_ESCOLAR',actualizado_en:'2026-10-27T00:00:00Z'};
const persona=(cambio:Partial<CandidatoInscripcion>={}):CandidatoInscripcion=>({alumno_programa_id:'ap1',alumno_id:'a1',matricula:'PRUEBA-1',nombre:'Persona de prueba',plan_id:'p1',programa:'Derecho',tipo_periodo:'CUATRIMESTRAL',modalidad:'ESCOLARIZADA',grado_sugerido:'3',total_periodos:10,estatus_programa:'ACTIVO',historico:false,compatible:true,grupos:[],fuentes:[],inscripcion:null,...cambio});
test('nuevo ingreso usa el ciclo destino sin exigir origen, conservando fechas reales y grado personal',()=>{
 const v={...capturaInicial(persona()),tipo_ingreso:'PRIMER_INGRESO' as const,ciclo_origen_id:'2026-3',grado_personal:'1ER',desde:'2026-10-20',fecha_primer_ingreso:'2026-10-20',evidencia:'Ficha de primer ingreso',motivo:'Alta acreditada de nuevo ingreso'};
 const lista=normalizarOrigenInscripcion(v);assert.equal(lista.ciclo_origen_id,'');assert.equal(lista.desde,v.desde);assert.equal(lista.fecha_primer_ingreso,v.fecha_primer_ingreso);assert.equal(lista.grado_personal,'1ER');assert.deepEqual(validarCapturaInscripcion(persona(),lista),[]);
 assert.equal(normalizarOrigenInscripcion({...v,tipo_ingreso:'REINGRESO'}).ciclo_origen_id,'2026-3');
 assert.equal(normalizarOrigenInscripcion({...v,tipo_ingreso:'REINGRESO',ciclo_origen_id:'__NINGUNO__'}).ciclo_origen_id,'');
});
test('grupo y pagos no confirman inscripción; inscripción vigente admite alumno sin grupo',()=>{
 assert.equal(situacionInscripcion(persona({grupos:['G1'],fuentes:['Grupo','Plan de pagos (indicio)']}),'2026-09-30'),'PENDIENTE');
 assert.equal(situacionInscripcion(persona({inscripcion}),'2026-09-30'),'SIN_GRUPO');
 assert.equal(situacionInscripcion(persona({inscripcion,grupos:['G1','G1']}),'2026-09-30'),'CON_GRUPO');
});
test('baja conserva vigencia hasta el último día y cancelación anula el registro',()=>{
 const c=persona({inscripcion:{...inscripcion,estado:'BAJA',hasta:'2026-10-01'}});
 assert.equal(situacionInscripcion(c,'2026-09-30'),'SIN_GRUPO');
 assert.equal(situacionInscripcion(c,'2026-10-01'),'SIN_GRUPO');
 assert.equal(situacionInscripcion(c,'2026-10-02'),'BAJA');
 assert.equal(situacionInscripcion({...c,inscripcion:{...inscripcion,estado:'CANCELADA'}},'2026-09-30'),'CANCELADA');
 assert.equal(situacionInscripcion(persona({inscripcion}),'2026-08-30'),'FUERA_FECHA');
});
test('preparación conserva grado del ciclo, sin convertir primer grado en primer ingreso',()=>{
 assert.equal(capturaInicial(persona({inscripcion})).grado_personal,'2DO');
 const v=capturaInicial(persona({grado_sugerido:'1ER'}));
 assert.equal(v.tipo_ingreso,'DESCONOCIDO');assert.equal(v.desde,'');assert.equal(v.fecha_primer_ingreso,'');
});
test('captura exige periodicidad, evidencia, fecha real y duración del programa',()=>{
 const c=persona({inscripcion}),v={...capturaInicial(c),motivo:'Revisión de la inscripción'};
 assert.deepEqual(validarCapturaInscripcion(c,v),[]);
 assert.ok(validarCapturaInscripcion({...c,compatible:false},v).some(e=>e.includes('periodicidades')));
 assert.ok(validarCapturaInscripcion(c,{...v,grado_personal:'11'}).length);
 assert.ok(validarCapturaInscripcion(c,{...v,desde:'2026-02-30'}).length);
 assert.ok(validarCapturaInscripcion(c,{...v,tipo_ingreso:'PRIMER_INGRESO'}).some(e=>e.includes('fecha histórica')));
 assert.ok(validarCapturaInscripcion(c,{...v,fecha_primer_ingreso:'2027-01-01'}).length);
 assert.ok(validarCapturaInscripcion(c,{...v,estado:'BAJA'}).length);
});
test('programas históricos se confirman explícitamente sin cambiar su estatus actual',()=>{
 const c=persona({historico:true,estatus_programa:'EGRESADO',inscripcion}),v={...capturaInicial(c),motivo:'Ficha histórica revisada para este ciclo'};
 assert.ok(validarCapturaInscripcion(c,v).length);
 assert.deepEqual(validarCapturaInscripcion(c,{...v,admitir_historico:true}),[]);
 assert.equal(c.estatus_programa,'EGRESADO');
});
test('filtrar y ordenar antes de paginar conserva selecciones de otras páginas y programas',()=>{
 const a=persona({nombre:'Zeta',alumno_programa_id:'ap1'}),b=persona({nombre:'Ana',alumno_programa_id:'ap2',plan_id:'p2',inscripcion});
 const orden=filtrarInscripciones([a,b],'','','','2026-09-30');assert.deepEqual(orden.map(c=>c.alumno_programa_id),['ap2','ap1']);
 assert.deepEqual(filtrarInscripciones([a,b],'','p2','SIN_GRUPO','2026-09-30').map(c=>c.alumno_programa_id),['ap2']);
 assert.deepEqual(seleccionarPaginaInscripciones(['otra'],[a,b],true),['otra','ap1','ap2']);
 assert.deepEqual(seleccionarPaginaInscripciones(['otra','ap1','ap2'],[a],false),['otra','ap2']);
});
test('fechas válidas y fecha administrativa en México no dependen de UTC',()=>{
 assert.ok(esFechaInscripcion('2024-02-29'));assert.equal(esFechaInscripcion('2026-02-29'),false);
 assert.equal(fechaInstitucionalInscripciones(new Date('2026-10-27T02:00:00Z')),'2026-10-26');
});
