import test from 'node:test';
import assert from 'node:assert/strict';
import { formatearCreditos, fuentesResultado, situacionHistorial } from '../src/utils/presentacionHistorial';

test('la situación distingue cero inicial, cero capturado y NP sin cambiar la acreditación',()=>{
  const base={acreditada:false,mejor_calificacion:0,ordinario:{parcial_1:0,parcial_2:null,parcial_3:0}};
  assert.equal(situacionHistorial(base,6),'Por acreditar / Cursando');
  assert.equal(situacionHistorial({...base,ordinario:{parcial_1:8,parcial_2:8,parcial_3:8}},6),'Reprobada');
  assert.equal(situacionHistorial({...base,mejor_calificacion:-555},6),'Reprobada');
  assert.equal(situacionHistorial({...base,mejor_calificacion:9,acreditada:true},6),'Acreditada');
  assert.equal(situacionHistorial({...base,mejor_calificacion:null,ordinario:{parcial_1:5,parcial_2:-555,parcial_3:5}},6),'Reprobada');
});
test('la situación respeta el mínimo del programa y los finales pendientes',()=>{
  assert.equal(situacionHistorial({acreditada:false,mejor_calificacion:7},8),'Reprobada');
  assert.equal(situacionHistorial({acreditada:false,mejor_calificacion:null},8),'Por acreditar / Cursando');
});
test('las fuentes conservan todos los intentos empatados y sus ciclos, sin recalcular la nota',()=>{
  const item={acreditada:true,mejor_calificacion:9,registros:[
    {calificacion_final:5,tipo_evaluacion:'ORDINARIO',ciclo:{nombre:'2026-2'}},
    {calificacion_final:'9',tipo_evaluacion:'EXTRAORDINARIO',ciclo:{nombre:'2026-3'}},
    {calificacion_final:9,tipo_evaluacion:'RECURSAMIENTO',ciclo_legado:'2027-1'},
    {calificacion_final:null,tipo_evaluacion:'ORDINARIO'}
  ]};
  assert.deepEqual(fuentesResultado(item),[{tipo:'EXTRAORDINARIO',ciclo:'2026-3'},{tipo:'RECURSAMIENTO',ciclo:'2027-1'}]);
  assert.deepEqual(fuentesResultado({...item,mejor_calificacion:null}),[]);
  assert.equal(item.mejor_calificacion,9);
});
test('los créditos solo se formatean para lectura y conservan cero y ausencia',()=>{
  assert.equal(formatearCreditos(24.490000000000002),'24.49');
  assert.equal(formatearCreditos(0),'0');
  assert.equal(formatearCreditos(null),'—');
  assert.equal(formatearCreditos('inválido'),'—');
});
