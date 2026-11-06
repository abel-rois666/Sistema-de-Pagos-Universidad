import test from 'node:test';
import assert from 'node:assert/strict';
import { capturaDesdeHistorial, normalizarReferenciaHistorial, proponerDesdeHistorial, type HistorialInscripcion } from '../src/inscripciones/historial';
import type { CandidatoInscripcion } from '../src/inscripciones/types';

const candidato:CandidatoInscripcion={alumno_programa_id:'ap',alumno_id:'a',matricula:'PRUEBA',nombre:'Persona ficticia',plan_id:'p',programa:'Plan ficticio',tipo_periodo:'CUATRIMESTRAL',modalidad:'ESCOLARIZADA',grado_sugerido:'7',total_periodos:10,estatus_programa:'ACTIVO',historico:false,compatible:true,grupos:[],fuentes:[],inscripcion:null};
const historia=():HistorialInscripcion=>({alumno_programa_id:'ap',modelo:'RIGIDO',huella:'h',ciclos:[{id:'anterior',nombre:'2026-3',tipo_periodo:'Cuatrimestral',fecha_inicio:'2026-06-25',materias:[{id:'m1',nombre:'Materia',periodo:4,registros:2}],inscripcion:null}]});
const destino={id:'destino',fecha_inicio:'2026-10-21'};
test('ingreso usa el primer ciclo del mismo plan, sin inventar matrícula ni avance por máximo de materia',()=>{
 const p=proponerDesdeHistorial(candidato,historia(),destino);
 assert.equal(p.ingreso?.id,'anterior');assert.equal(p.tipo,'REINGRESO');assert.equal(p.grado,null);
 const v=capturaDesdeHistorial(candidato,p);assert.equal(v.desde,'');assert.equal(v.grado_personal,'7');assert.equal(v.evidencia,'');
});
test('fechas incompletas, empates y antecedentes posteriores dejan ingreso para revisión',()=>{
 const h=historia();h.ciclos[0].fecha_inicio=null;assert.equal(proponerDesdeHistorial(candidato,h,destino).ingreso,null);
 h.ciclos[0].fecha_inicio='2026-06-25';h.ciclos.push({...h.ciclos[0],id:'duplicado'});assert.equal(proponerDesdeHistorial(candidato,h,destino).ingreso,null);
 assert.equal(proponerDesdeHistorial(candidato,historia(),{id:'viejo',fecha_inicio:'2025-01-01'}).ingreso,null);
 assert.equal(proponerDesdeHistorial(candidato,historia(),{id:'sin-fecha'}).ingreso,null);
});
test('grado rígido homogéneo del destino orienta; periodos mezclados o flexible no',()=>{
 const h=historia();h.ciclos[0].id='destino';h.ciclos[0].fecha_inicio=destino.fecha_inicio;
 assert.equal(proponerDesdeHistorial(candidato,h,destino).grado,'4');
 h.ciclos[0].materias.push({id:'adelantada',nombre:'Adelantada',periodo:8,registros:1});assert.equal(proponerDesdeHistorial(candidato,h,destino).grado,null);
 h.ciclos[0].materias.pop();h.modelo='FLEXIBLE';assert.equal(proponerDesdeHistorial(candidato,h,destino).grado,null);
});
test('continuidad solo desde inscripción acreditada previa; último grado no propone egreso',()=>{
 const h=historia();h.ciclos[0].inscripcion={id:'i',revision:1,grado_personal:'4TO',estado:'CONFIRMADA'};
 assert.equal(proponerDesdeHistorial(candidato,h,destino).grado,'5');
 h.ciclos[0].inscripcion.grado_personal='10';assert.equal(proponerDesdeHistorial(candidato,h,destino).grado,null);
 h.ciclos[0].inscripcion.estado='CANCELADA';assert.equal(proponerDesdeHistorial(candidato,h,destino).grado,null);
});
test('otra periodicidad no se ignora para decidir el primer ingreso',()=>{
 const h=historia();h.ciclos.push({...h.ciclos[0],id:'sem',tipo_periodo:'SEMESTRAL',fecha_inicio:'2025-01-01'});
 assert.equal(proponerDesdeHistorial(candidato,h,destino).ingreso,null);
});
test('aplicar conserva grado, tipo y fecha de ingreso acreditados y deja la vigencia intacta',()=>{
 const c={...candidato,inscripcion:{id:'i',alumno_programa_id:'ap',ciclo_id:'destino',revision:3,estado:'CONFIRMADA' as const,desde:'2026-10-01',hasta:null,grado_personal:'2DO',tipo_ingreso:'REINGRESO' as const,fecha_primer_ingreso:'2025-10-01',evidencia:'Ficha validada',motivo:'Confirmación anterior',procedencia:'CONTROL_ESCOLAR',actualizado_en:'2026-10-29'}};
 const v=capturaDesdeHistorial(c,proponerDesdeHistorial(c,historia(),destino));
 assert.equal(v.grado_personal,'2DO');assert.equal(v.fecha_primer_ingreso,'2025-10-01');assert.equal(v.desde,'2026-10-01');assert.equal(v.tipo_ingreso,'REINGRESO');
});
test('procedencia conserva huella y ciclo; un cambio manual deja de atribuir el valor a la inferencia',()=>{
 const h=historia();h.ciclos[0].inscripcion={id:'origen',revision:1,grado_personal:'2',estado:'CONFIRMADA'};
 const p=proponerDesdeHistorial(candidato,h,destino),v=capturaDesdeHistorial(candidato,p,h);
 assert.equal(v.ciclo_origen_id,'anterior');assert.equal(v.referencia?.huella,'h');assert.equal(v.referencia?.aplicar_ingreso,true);assert.equal(v.referencia?.aplicar_grado,true);
 const manual=normalizarReferenciaHistorial({...v,fecha_primer_ingreso:'2025-01-01',grado_personal:'2DO'});
 assert.equal(manual.referencia?.aplicar_ingreso,false);assert.equal(manual.referencia?.aplicar_grado,false);assert.equal(manual.referencia?.huella,'h');
 const ordinal=normalizarReferenciaHistorial({...v,grado_personal:'3ER'});assert.equal(ordinal.referencia?.aplicar_grado,true);
});
