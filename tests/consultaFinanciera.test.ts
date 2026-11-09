import assert from 'node:assert/strict';
import test from 'node:test';
import { conceptosFinancieros, describirPlan, filtrarPeriodoPlanes, periodosFinancieros, saldoConcepto, TODOS_PERIODOS } from '../src/finanzas/consulta';
import type { CicloEscolar, PaymentPlan } from '../src/types';
const ciclos = [
  { id:'cs', nombre:'2027-1', tipo_periodo:'Semestral' },
  { id:'cc', nombre:'2027-1', tipo_periodo:'Cuatrimestral' },
  { id:'prev', nombre:'2026-3', tipo_periodo:'Cuatrimestral' },
] as CicloEscolar[];
const planes = [{ id:'p1', ciclo_id:'cc', tipo_plan:'Cuatrimestral', no_plan_pagos:'271-1' },{ id:'p2', ciclo_id:'cs', tipo_plan:'Semestral' },{ id:'p3', ciclo_id:'prev' }] as PaymentPlan[];
test('consulta agrupa homónimos conservando ambos IDs y orden descendente', () => {
  assert.deepEqual(periodosFinancieros(ciclos, planes),['2027-1','2026-3']);
  assert.deepEqual(filtrarPeriodoPlanes(planes,ciclos,'2027-1').map(p=>p.id),['p1','p2']);
  assert.equal(filtrarPeriodoPlanes(planes,ciclos,TODOS_PERIODOS).length,3);
  assert.equal(filtrarPeriodoPlanes(planes,ciclos,'2029-1').length,0);
  assert.match(describirPlan(planes[0],ciclos), /2027-1.*Ciclo Cuatrimestral.*271-1/);
});
test('no reconstruye filas residuales cuando existen detalles normalizados', () => {
  const p = { concepto_1:'RESIDUAL',cantidad_1:900,detalles:[{indice_concepto:2,concepto:'USADO',cantidad:100,estatus:'PENDIENTE'}] } as PaymentPlan;
  assert.deepEqual(conceptosFinancieros(p).map(c=>c.indice),[2]);
  assert.equal(conceptosFinancieros({concepto_18:'Último',cantidad_18:5} as PaymentPlan)[0].indice,18);
});
test('NO PAGADO no liquida, pagos anteriores con resta siguen parciales y texto ambiguo requiere revisión', () => {
  assert.deepEqual(saldoConcepto(1000,'NO PAGADO'),{pendiente:1000,estado:'pendiente'});
  assert.deepEqual(saldoConcepto(1000,'R-1 (Pagado $200); R-2 (Abono $300, Resta $500.00)'),{pendiente:500,estado:'parcial'});
  assert.deepEqual(saldoConcepto(1000,'R-1 (Pagado con beca)'),{pendiente:0,estado:'pagado'});
  for(const s of ['Por revisar','R-40200','Resta $2,000.00','CANCELADO','BAJA']) assert.equal(saldoConcepto(1000,s).estado,'revisar');
});
