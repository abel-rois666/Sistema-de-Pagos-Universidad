import test from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNAS_INICIALES, resolverColumnasHistorial, valorEvaluacionHistorial } from '../src/utils/columnasHistorial';

test('los parciales y el resultado permanecen visibles aunque se retiren todas las opcionales',()=>{
  assert.deepEqual(resolverColumnasHistorial(false,[],true,[]).map(c=>c.id),['ciclo','p1','p2','p3','final']);
});
test('la configuración inicial conserva ordinario, extras, recursamiento y créditos sin columnas redundantes',()=>{
  const ids=resolverColumnasHistorial(false,COLUMNAS_INICIALES,false,[]).map(c=>c.id);
  assert.ok(['ordinario','extra1','extra2','recursamiento','creditos'].every(c=>ids.includes(c as typeof ids[number])));
  assert.ok(!ids.includes('letra')&&!ids.includes('promedio')&&!ids.includes('situacion'));
});
test('cero y NP mantienen columnas de evaluación; solo se ocultan valores ausentes',()=>{
  const poblacion=[{ordinario:{calificacion_final:0},extras:[{calificacion_final:-555},{calificacion_final:null},{calificacion_final:undefined}]}];
  const ids=resolverColumnasHistorial(false,COLUMNAS_INICIALES,true,poblacion).map(c=>c.id);
  assert.ok(ids.includes('ordinario')&&ids.includes('extra1'));
  assert.ok(!ids.includes('extra2')&&!ids.includes('recursamiento'));
  assert.ok(ids.includes('p1')&&ids.includes('p2')&&ids.includes('p3')&&ids.includes('creditos'));
});
test('ocultar columnas vacías considera toda la población recibida, sin cambiar sus evaluaciones',()=>{
  const poblacion=[{ordinario:{calificacion_final:8},extras:[]},{ordinario:{calificacion_final:5},extras:[{calificacion_final:9}]}];
  const antes=JSON.stringify(poblacion);
  assert.ok(resolverColumnasHistorial(false,COLUMNAS_INICIALES,true,poblacion).some(c=>c.id==='extra1'));
  assert.equal(JSON.stringify(poblacion),antes);
});
test('las especialidades conservan una evaluación final y su alternativa ordinaria sin inventar parciales',()=>{
  const poblacion=[{ordinario:{parcial_1:0,calificacion_final:null},extras:[{calificacion_final:8}]}];
  const ids=resolverColumnasHistorial(true,COLUMNAS_INICIALES,true,poblacion).map(c=>c.id);
  assert.ok(ids.includes('evaluacion')&&ids.includes('ordinario')&&ids.includes('recursamiento'));
  assert.ok(!ids.some(id=>['p1','p2','p3','extra1','extra2'].includes(id)));
  assert.equal(valorEvaluacionHistorial(poblacion[0],'ordinario',true),0);
  assert.equal(valorEvaluacionHistorial(poblacion[0],'recursamiento',true),8);
});
test('habilitar promedio o letra no afecta la correspondencia de las evaluaciones existentes',()=>{
  const item={ordinario:{promedio_calculado:7.33,calificacion_final:8},extras:[{calificacion_final:9},{calificacion_final:-555},{calificacion_final:10}]};
  assert.equal(valorEvaluacionHistorial(item,'extra1',false),9);
  assert.equal(valorEvaluacionHistorial(item,'extra2',false),-555);
  assert.equal(valorEvaluacionHistorial(item,'recursamiento',false),10);
  assert.ok(resolverColumnasHistorial(false,['promedio','letra'],true,[item]).some(c=>c.id==='promedio'));
});
