import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoPagoComprobado } from '../src/utils/estadoPagoComprobado';
import { resumirPagoTitulacion } from '../src/reportes/estadoPagoTitulacion';
import type { PaymentPlan } from '../src/types';

test('un texto cualquiera no acredita el pago ni confunde NO PAGADO con PAGADO', () => {
  for (const valor of ['PENDIENTE', 'NO PAGADO', 'R-45 (Abono $20.00, Resta $80.00)', 'BAJA', null]) assert.equal(estadoPagoComprobado(valor), 'pendiente');
  for (const valor of ['PAGADO', 'R-40531 (Pagado $314.00)', 'R-40200', 'R-1; R-2']) assert.equal(estadoPagoComprobado(valor), 'pagado');
  assert.equal(estadoPagoComprobado('Por revisar en caja'), 'revisar');
});

test('reporte distingue estados ambiguos y usa detalles normalizados cuando existen', () => {
  assert.equal(resumirPagoTitulacion({ concepto_1: 'Examen', estatus_1: 'NO PAGADO' } as PaymentPlan), 'Pago en curso');
  assert.equal(resumirPagoTitulacion({ concepto_1: 'Examen', estatus_1: 'Pendiente de revisar con dirección' } as PaymentPlan), 'Pago en curso');
  assert.equal(resumirPagoTitulacion({ concepto_1: 'Examen', estatus_1: 'Observación libre' } as PaymentPlan), 'Revisar estado de pago');
  assert.equal(resumirPagoTitulacion({ concepto_1: 'Examen', estatus_1: 'PENDIENTE', detalles: [{ concepto: 'Examen', estatus: 'R-40531 (Pagado $314.00)' }] } as PaymentPlan), 'Pago completo');
  assert.equal(estadoPagoComprobado('R-40123 (Pagado con beca)'), 'pagado');
});
