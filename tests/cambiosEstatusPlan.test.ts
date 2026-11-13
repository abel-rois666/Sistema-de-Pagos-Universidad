import test from 'node:test';
import assert from 'node:assert/strict';
import type { PaymentPlan } from '../src/types';
import { indicesRestablecidosPlan, referenciaHistoricaRequiereRevision } from '../src/finanzas/cambiosEstatusPlan';
const plan = (datos: Partial<PaymentPlan> = {}) => ({id:'nuevo',tipo_plan:'Titulación',...datos} as PaymentPlan);

test('un recibo de otro plan no se atribuye por posición; ambigüedad y vínculos propios se protegen', () => {
  const otro={plan_id:'ordinario',anulado_en:null};
  assert.equal(referenciaHistoricaRequiereRevision('nuevo',[otro]),false);
  assert.equal(referenciaHistoricaRequiereRevision('nuevo',[]),true);
  assert.equal(referenciaHistoricaRequiereRevision('nuevo',[{...otro,anulado_en:'2026-11-13'}]),true);
  assert.equal(referenciaHistoricaRequiereRevision('nuevo',[otro,{plan_id:'nuevo',anulado_en:null}]),true);
});

test('completar conceptos de un plan nuevo no restablece pagos: vacío y pendiente son equivalentes', () => {
  for (const estado of [undefined, null, '', '  ', 'PENDIENTE', ' pendiente ']) {
    const anterior=plan({estatus_1:estado as string});
    assert.deepEqual(indicesRestablecidosPlan(anterior,{...anterior,concepto_1:'1ER PAGO',cantidad_1:1000,fecha_1:'2026-11-13',estatus_1:'PENDIENTE'}),[]);
  }
});
test('no atribuye un cambio de otro plan al seleccionado', () => {
  assert.throws(()=>indicesRestablecidosPlan(plan(),{id:'otro'}),/no corresponde/);
});
test('conserva folios, abonos y observaciones; detecta solo los que se restablecen', () => {
  for (const estado of ['R-83','F-12306','R-1 (Abono $500)','Revisar pago']) {
    const anterior=plan({concepto_1:'PAGO',estatus_1:estado});
    assert.deepEqual(indicesRestablecidosPlan(anterior,{...anterior,cantidad_1:2000}),[]);
    assert.deepEqual(indicesRestablecidosPlan(anterior,{id:anterior.id}),[]);
    assert.deepEqual(indicesRestablecidosPlan(anterior,{...anterior,estatus_1:''}),[1]);
  }
});
test('detecta cambios en detalles normalizados aunque la columna legada esté pendiente', () => {
  const anterior=plan({estatus_1:'PENDIENTE',detalles:[{indice_concepto:1,concepto:'PAGO',estatus:'R-83'}] as PaymentPlan['detalles']});
  assert.deepEqual(indicesRestablecidosPlan(anterior,{...anterior,estatus_1:''}),[1]);
});
