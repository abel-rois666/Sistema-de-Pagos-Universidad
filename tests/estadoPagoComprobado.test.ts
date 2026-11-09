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

test('reconoce folios históricos con formas de pago sin alterar su texto', () => {
  for (const estatus of ['R-83 (Efectivo)', 'R-32474', 'R-12 (Depósito Bancario)', 'R-13 (Transferencia bancaria)', 'R-14 (Tarjeta de Débito)', 'R-15 (Tarjeta de Crédito)', ' r-83  (efectivo) ', 'R-1 (Efectivo); R-2', 'R-1; R-2 (Pagado $ 314.00)']) {
    assert.equal(estadoPagoComprobado(estatus), 'pagado', estatus);
  }
  const plan = { detalles: [{ concepto: 'Concepto 1', estatus: 'R-83 (Efectivo)' }, { concepto: 'Concepto 2', estatus: 'R-32474' }] } as PaymentPlan;
  const original = JSON.stringify(plan);
  assert.equal(resumirPagoTitulacion(plan), 'Pago completo');
  assert.equal(JSON.stringify(plan), original);
  assert.equal(resumirPagoTitulacion({ concepto_1: 'Concepto 1', estatus_1: 'R-83 (Efectivo)', concepto_2: 'Concepto 2', estatus_2: 'R-32474' } as PaymentPlan), 'Pago completo');
});

test('la forma de pago y el folio no liquidan abonos, saldos pendientes o cancelaciones', () => {
  for (const estatus of ['R-83 (Efectivo) PENDIENTE', 'R-83 (Efectivo) NO PAGADO', 'R-83 (Efectivo) CANCELADO', 'R-83 (Abono $100.00, Resta $214.00)', 'R-83 (Efectivo); R-32474 (Abono $100.00, Resta $214.00)', 'R-83 (Efectivo) BAJA']) {
    assert.equal(estadoPagoComprobado(estatus), 'pendiente', estatus);
    assert.equal(resumirPagoTitulacion({ concepto_1: 'Concepto', estatus_1: estatus } as PaymentPlan), 'Pago en curso');
  }
});

test('una anotación desconocida no se convierte en pago por contener un folio', () => {
  for (const estatus of ['R-83 (Por revisar en caja)', 'R-83 (Efectivo por confirmar)', 'R-83 (Forma no registrada)', 'Efectivo', 'R-83 texto libre']) {
    assert.equal(estadoPagoComprobado(estatus), 'revisar', estatus);
  }
  assert.equal(resumirPagoTitulacion({ detalles: [{ concepto: 'Concepto 1', estatus: 'R-83 (Efectivo)' }, { concepto: 'Concepto 2', estatus: 'R-84 (Por revisar en caja)' }] } as PaymentPlan), 'Revisar estado de pago');
});

test('reconoce facturas históricas F-numero y combinaciones con recibos', () => {
  for (const estatus of ['F-12306', 'F-1', ' f-12306 ', 'F-12306 (Efectivo)', 'F-12306 (Transferencia bancaria)', 'F-12306 (Pagado $314.00)', 'F-12306; R-32474', 'R-83 (Efectivo), F-12306', 'F-1; F-2 (Pagado con beca)']) {
    assert.equal(estadoPagoComprobado(estatus), 'pagado', estatus);
  }
  const plan = { detalles: [{ concepto: 'Concepto 1', estatus: 'F-12306' }, { concepto: 'Concepto 2', estatus: 'R-32474' }] } as PaymentPlan;
  const original = JSON.stringify(plan);
  assert.equal(resumirPagoTitulacion(plan), 'Pago completo');
  assert.equal(JSON.stringify(plan), original);
  assert.equal(resumirPagoTitulacion({ concepto_1: 'Concepto', estatus_1: 'F-12306' } as PaymentPlan), 'Pago completo');
});

test('un folio de factura conserva pendientes, abonos, cancelaciones y anotaciones desconocidas', () => {
  for (const estatus of ['F-12306 PENDIENTE', 'F-12306 NO PAGADO', 'F-12306 CANCELADO', 'F-12306 (Abono $100.00, Resta $214.00)', 'R-83; F-12306 (Abono $100.00, Resta $214.00)']) {
    assert.equal(estadoPagoComprobado(estatus), 'pendiente', estatus);
    assert.equal(resumirPagoTitulacion({ concepto_1: 'Concepto', estatus_1: estatus } as PaymentPlan), 'Pago en curso');
  }
  for (const estatus of ['F-12306 (Por revisar en caja)', 'F-12306 (Efectivo por confirmar)', 'F-', 'Factura F-12306', 'X-12306']) {
    assert.equal(estadoPagoComprobado(estatus), 'revisar', estatus);
  }
});
