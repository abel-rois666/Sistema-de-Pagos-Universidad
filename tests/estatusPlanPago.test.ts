import assert from 'node:assert/strict';
import test from 'node:test';
import { estatusVisiblePlanPago } from '../src/utils/estatusPlanPago';

test('un recibo vinculado cubre el concepto con el formato de texto tradicional', () => {
  assert.equal(estatusVisiblePlanPago('PENDIENTE', 850, [{ folio: '40123', importe: 850 }]),
    'R-40123 (Pagado $850.00)');
});

test('los abonos parciales conservan folios y saldo restante', () => {
  assert.equal(estatusVisiblePlanPago('NO PAGADO', 1000, [{ folio:'40',importe:400 }]), 'R-40 (Abono $400.00, Resta $600.00)');
  assert.equal(estatusVisiblePlanPago('PENDIENTE', 1850, [
    { folio: '40123', importe: 500 }, { folio: '40124', importe: 350 },
  ]), 'R-40123; R-40124 (Abono $850.00, Resta $1,000.00)');
});

test('una observación editada conserva su texto y un concepto sin vínculo sigue pendiente', () => {
  assert.equal(estatusVisiblePlanPago('R-40123 (Pagado con beca)', 850,
    [{ folio: '40123', importe: 850 }]), 'R-40123 (Pagado con beca)');
  assert.equal(estatusVisiblePlanPago('PENDIENTE', 850, []), 'PENDIENTE');
});
