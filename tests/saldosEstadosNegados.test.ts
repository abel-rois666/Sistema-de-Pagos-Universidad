import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPaid, getRestanteFromEstatus, calculateStudentTotals } from '../src/utils';
import type { PaymentPlan } from '../src/types';

test('NO PAGADO y CANCELADO nunca liquidan el concepto ni reducen el adeudo', () => {
  for (const estado of ['NO PAGADO', 'no pagado', 'CANCELADO', 'PENDIENTE']) {
    assert.equal(isPaid(estado), false);
    assert.equal(getRestanteFromEstatus(estado, 850), 850);
    const resultado = calculateStudentTotals({ cantidad_1: 850, estatus_1: estado } as PaymentPlan, 'ACTIVO');
    assert.equal(resultado.paid, 0);
    assert.equal(resultado.owed, 850);
  }
});

test('el saldo Resta tiene prioridad sobre la palabra Pagado en un abono histórico', () => {
  assert.equal(isPaid('R-1 (Pagado parcial, Resta $50.00)'), false);
  assert.equal(getRestanteFromEstatus('R-1 (Pagado parcial, Resta $50.00)', 850), 50);
  assert.equal(getRestanteFromEstatus('R-1 (Pagado $850.00)', 850), 0);
});
