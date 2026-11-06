import test from 'node:test';
import assert from 'node:assert/strict';
import { capturaInicial, validarCapturaInscripcion } from '../src/inscripciones/dominio';
import { normalizarReferenciaHistorial, type HistorialInscripcion } from '../src/inscripciones/historial';
import { aplicarFechaInscripcion, conservarReferenciaFecha, fechaInscripcionPropuesta, proponerFechaInscripcion } from '../src/inscripciones/fechaPropuesta';
import type { CandidatoInscripcion } from '../src/inscripciones/types';
const c:CandidatoInscripcion={alumno_programa_id:'ap',alumno_id:'a',plan_id:'p',matricula:'PRUEBA',nombre:'Persona ficticia',programa:'Plan',tipo_periodo:'CUATRIMESTRAL',modalidad:'ESCOLARIZADA',grado_sugerido:'3',total_periodos:10,estatus_programa:'ACTIVO',historico:false,compatible:true,grupos:['G'],fuentes:['Grupo'],inscripcion:null};
const d={id:'cuat',nombre:'2027-1',tipo_periodo:'Cuatrimestral',fecha_inicio:'2026-10-21'};
const historia=():HistorialInscripcion=>({alumno_programa_id:'ap',alumno_id:'a',plan_id:'p',huella:'h',modelo:'FLEXIBLE',ciclos:[
 {id:'viejo',nombre:'2025-1',tipo_periodo:'Cuatrimestral',fecha_inicio:'2024-10-01',materias:[{id:'m1',nombre:'Materia anterior',periodo:1,registros:1}],inscripcion:null},
 {id:'cuat',nombre:'2027-1',tipo_periodo:'Cuatrimestral',fecha_inicio:'2026-10-21',materias:[{id:'m2',nombre:'Materia destino',periodo:3,registros:1}],inscripcion:null},
]});
test('el ingreso acreditado en la ficha prevalece sobre la propuesta de notas y no completa vigencia',()=>{
 const candidato={...c,ingreso_programa:{fecha:'2024-09-25',calidad:'DOCUMENTADA',ciclo_id:'viejo'}};
 const captura=capturaInicial(candidato);
 assert.equal(captura.fecha_primer_ingreso,'2024-09-25');
 const propuesta=aplicarFechaInscripcion(candidato,captura,historia(),d);
 assert.equal(propuesta.fecha_primer_ingreso,'2024-09-25');
 assert.equal(propuesta.desde,'');
 assert.equal(propuesta.ciclo_origen_id,'viejo');
});
test('sin notas en el destino propone el ciclo más antiguo y el último anterior por separado',()=>{
 const h=historia();h.ciclos.pop();
 h.ciclos.push({...h.ciclos[0],id:'anterior',nombre:'2026-3',fecha_inicio:'2026-06-25'});
 const p=proponerFechaInscripcion(c,capturaInicial(c),h,d);
 assert.equal(p.fecha,'2024-10-01');assert.equal(p.cicloFecha?.id,'viejo');assert.equal(p.origen?.id,'anterior');
 const v=aplicarFechaInscripcion(c,capturaInicial(c),h,d);assert.equal(v.desde,'');assert.equal(v.fecha_primer_ingreso,p.fecha);assert.equal(v.ciclo_origen_id,'anterior');
});
test('el origen ignora el destino, los futuros y los ciclos sin notas aunque estén confirmados',()=>{
 const h=historia();h.ciclos.push({...h.ciclos[1],id:'futuro',fecha_inicio:'2027-02-20'},
 {...h.ciclos[1],id:'confirmado',fecha_inicio:'2026-09-01',materias:[],inscripcion:{id:'i',revision:1,grado_personal:'2',estado:'CONFIRMADA'}});
 assert.equal(proponerFechaInscripcion(c,capturaInicial(c),h,d).origen?.id,'viejo');
});
test('se conserva la fecha efectiva guardada o capturada pero se puede aplicar solo el origen pendiente',()=>{
 const v={...capturaInicial(c),desde:'2026-10-28'};
 const propuesta=proponerFechaInscripcion(c,v,historia(),d);assert.equal(propuesta.fecha,'2024-10-01');assert.equal(propuesta.origen?.id,'viejo');
 const resultado=aplicarFechaInscripcion(c,v,historia(),d);assert.equal(resultado.desde,v.desde);assert.equal(resultado.ciclo_origen_id,'viejo');assert.equal(resultado.referencia?.aplicar_desde,false);
 const existente={...c,inscripcion:{id:'i',alumno_programa_id:'ap',ciclo_id:'cuat',revision:1,estado:'CONFIRMADA' as const,desde:'2026-10-25',hasta:null,grado_personal:'3',tipo_ingreso:'REINGRESO' as const,fecha_primer_ingreso:null,evidencia:'Ficha',motivo:'Registro revisado',procedencia:'CONTROL_ESCOLAR',actualizado_en:'2026-10-29'}};
 assert.equal(proponerFechaInscripcion(existente,{...v,desde:'',fecha_primer_ingreso:'2024-10-01'},historia(),d).fecha,null);
});
test('conserva el origen capturado o la decisión de no registrar origen; primer ingreso no propone origen',()=>{
 for(const cambio of [{ciclo_origen_id:'elegido'},{ciclo_origen_id:'__NINGUNO__'},{tipo_ingreso:'PRIMER_INGRESO' as const}]){
  const v={...capturaInicial(c),...cambio};assert.equal(proponerFechaInscripcion(c,v,historia(),d).origen,null);
 }
});
test('cada alumno conserva su captura en lote; propone ingreso sin avanzar grado ni inventar evidencia o motivo',()=>{
 const base=capturaInicial(c),conFecha={...base,desde:'2026-10-28'};
 const resultados=[base,conFecha].map(v=>aplicarFechaInscripcion(c,v,historia(),d));
 assert.deepEqual(resultados.map(v=>v.desde),['','2026-10-28']);assert.equal(resultados[0].grado_personal,base.grado_personal);
 assert.equal(resultados[0].fecha_primer_ingreso,'2024-10-01');assert.equal(resultados[0].evidencia,'');assert.equal(resultados[0].motivo,'');
});
test('no usa historial de otro alumno, programa o plan, sin huella ni ciclos de otra periodicidad',()=>{
 for(const cambio of [{alumno_id:'otro'},{plan_id:'otro'},{alumno_programa_id:'otro'},{huella:''}])assert.equal(proponerFechaInscripcion(c,capturaInicial(c),{...historia(),...cambio},d).fecha,null);
 const h=historia();h.ciclos[0].tipo_periodo='Semestral';h.ciclos[0].nombre=d.nombre;
 assert.equal(proponerFechaInscripcion(c,capturaInicial(c),h,d).origen,null);assert.equal(proponerFechaInscripcion(c,capturaInicial(c),h,d).fecha,null);
});
test('sin notas o con fechas ausentes, inválidas y ciclos duplicados no inventa antecedentes',()=>{
 for(const fecha_inicio of [undefined,'2026-02-30'])assert.equal(proponerFechaInscripcion(c,capturaInicial(c),historia(),{...d,fecha_inicio}).fecha,null);
 const h=historia();h.ciclos.forEach(x=>x.materias=[]);assert.equal(proponerFechaInscripcion(c,capturaInicial(c),h,d).fecha,null);
 h.ciclos=historia().ciclos;h.ciclos[0].fecha_inicio=null;assert.equal(proponerFechaInscripcion(c,capturaInicial(c),h,d).fecha,null);
 h.ciclos=historia().ciclos;h.ciclos.push({...h.ciclos[0]});assert.equal(proponerFechaInscripcion(c,capturaInicial(c),h,d).fecha,null);
});
test('empates de fechas bloquean solo la propuesta ambigua; futuro no se usa como primer antecedente',()=>{
 const h=historia();h.ciclos.push({...h.ciclos[0],id:'empate'});
 const p=proponerFechaInscripcion(c,capturaInicial(c),h,d);assert.equal(p.fecha,null);assert.equal(p.origen,null);
 h.ciclos=[{...h.ciclos[0],fecha_inicio:'2027-02-20'}];assert.equal(proponerFechaInscripcion(c,capturaInicial(c),h,d).fecha,null);
});
test('primer ingreso posterior o término anterior impiden fecha histórica; cancelación bloquea ambas propuestas',()=>{
 for(const cambio of [{fecha_primer_ingreso:'2026-10-28'},{hasta:'2024-09-30'}])assert.equal(proponerFechaInscripcion(c,{...capturaInicial(c),...cambio},historia(),d).fecha,null);
 const p=proponerFechaInscripcion(c,{...capturaInicial(c),estado:'CANCELADA'},historia(),d);assert.equal(p.fecha,null);assert.equal(p.origen,null);
});
test('procedencia distingue fuente histórica y destino; corregir fecha u origen deja de atribuir ese campo',()=>{
 const v=aplicarFechaInscripcion(c,capturaInicial(c),historia(),d);
 assert.equal(v.referencia?.aplicar_desde,false);assert.equal(v.referencia?.ciclo_ingreso_id,'viejo');assert.equal(v.referencia?.fecha_ingreso_propuesta,'2024-10-01');assert.equal(v.referencia?.aplicar_origen,true);
 const editada=normalizarReferenciaHistorial({...v,desde:'2026-10-22',ciclo_origen_id:'otro'});
 assert.equal(editada.referencia?.aplicar_desde,false);assert.equal(editada.referencia?.aplicar_origen,false);
 assert.equal(normalizarReferenciaHistorial(v).referencia?.aplicar_ingreso,true);
});
test('no combina trayectorias con huellas distintas y permite origen sin fecha utilizable',()=>{
 const v=aplicarFechaInscripcion(c,capturaInicial(c),historia(),d);
 assert.throws(()=>aplicarFechaInscripcion(c,{...v,desde:'',ciclo_origen_id:''},{...historia(),huella:'nueva'},d),/historial cambió/);
});
test('el distintivo solo se muestra para procedencias explícitamente aproximadas',()=>{
 assert.equal(fechaInscripcionPropuesta({desde:'MANUAL'}),false);assert.equal(fechaInscripcionPropuesta(),false);
 assert.equal(fechaInscripcionPropuesta({desde:{aproximado:true}}),true);
});
test('refrescar historial de una preparación conserva fecha y origen sin cambiar decisiones manuales',()=>{
 const anterior={...aplicarFechaInscripcion(c,capturaInicial(c),historia(),d).referencia!,aplicar_desde:true,metodo_desde:'HISTORIAL_MAS_ANTIGUO' as const,ciclo_desde_id:'viejo',fecha_desde_propuesta:'2024-10-01'};
 const nueva={...anterior,huella:'h-nueva',aplicar_desde:undefined,metodo_desde:undefined,ciclo_desde_id:undefined,fecha_desde_propuesta:undefined,aplicar_origen:undefined,ciclo_origen_propuesto_id:undefined};
 const combinada=conservarReferenciaFecha(nueva,anterior,'2024-10-01');
 assert.equal(combinada?.huella,'h-nueva');assert.equal(combinada?.metodo_desde,'HISTORIAL_MAS_ANTIGUO');assert.equal(combinada?.ciclo_desde_id,'viejo');assert.equal(combinada?.aplicar_origen,true);
 assert.equal(conservarReferenciaFecha(nueva,anterior,'2026-10-22')?.aplicar_desde,undefined);
 assert.equal(conservarReferenciaFecha({...nueva,aplicar_desde:false,aplicar_origen:false},anterior,'2024-10-01')?.aplicar_desde,false);
});

test('primer ingreso sin día exacto requiere acreditar el mismo ciclo, no un homónimo',()=>{
 const candidato={...c,ingreso_programa:{fecha:null,calidad:'DOCUMENTADA',ciclo_id:'cuat'}};
 const v={...capturaInicial(candidato),tipo_ingreso:'PRIMER_INGRESO' as const,desde:'2026-10-21',grado_personal:'1',evidencia:'Lista acreditada',motivo:'Confirmación acreditada de ingreso'};
 assert.deepEqual(validarCapturaInscripcion(candidato,v,'cuat'),[]);
 assert.ok(validarCapturaInscripcion(candidato,v,'sem').length);
 assert.ok(validarCapturaInscripcion({...candidato,ingreso_programa:{...candidato.ingreso_programa,calidad:'PENDIENTE'}},v,'cuat').length);
});
