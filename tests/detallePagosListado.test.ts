import test from 'node:test';
import assert from 'node:assert/strict';
import type { Alumno, PaymentPlan, Recibo, ReciboDetalle } from '../src/types';
import { alcanceAlumnosPagos, movimientosCertificado, movimientosPlan, resumenPlanPagos, tablasDetallePagos, type DatosPagosListado } from '../src/reportes/detallePagosListado';
import { consultarPagosListado, type FuentePagosListado } from '../src/reportes/consultaPagosListado';

const alumno = (id = 'a') => ({ id, nombre_completo: `ALUMNO ${id}`, matricula: '0001' } as Alumno);
const plan = (id = 'p', estado = 'R-1; R-2 (Abono $40.00, Resta $30.00)') => ({ id, alumno_id: 'a', tipo_plan: 'Titulación', ciclo_id: 'actual', no_plan_pagos: 'NUMERO REPETIDO', concepto_1: 'Titulación', cantidad_1: 100, estatus_1: estado } as PaymentPlan);
const recibo = (id = 'r1', folio = 1) => ({ id, folio, alumno_id: 'a', ciclo_id: 'anterior', estatus: 'ACTIVO', forma_pago: 'TRANSFERENCIA', total: 150, fecha_pago: '2026-11-12', folio_fiscal: id === 'r1' ? '12306' : null } as Recibo);
const detalle = (id = 'd1', r = 'r1', concepto = 'CERTIFICADO TOTAL', importe = 60) => ({ id, recibo_id: r, concepto, subtotal: importe } as ReciboDetalle);
const datos = (): DatosPagosListado => ({ planes: [plan()], recibos: [recibo(), recibo('r2', 2)], detalles: [detalle(), detalle('d2', 'r2', 'OTRO', 40)], vinculos: [
  { id: 'v1', plan_id: 'p', recibo_detalle_id: 'd1', indice_concepto: 1, importe: 30, anulado_en: null },
  { id: 'v2', plan_id: 'p', recibo_detalle_id: 'd2', indice_concepto: 1, importe: 40, anulado_en: null },
], certificaciones: [] });

test('alcance: filtros sin selección; selección entre páginas/filtros conserva IDs sin ampliar a otros', () => {
  const todos = [alumno(), alumno('b'), alumno('c')];
  assert.deepEqual(alcanceAlumnosPagos(todos, [todos[1]], []).map(a => a.id), ['b']);
  assert.deepEqual(alcanceAlumnosPagos(todos, [todos[1]], ['a', 'c']).map(a => a.id), ['a', 'c']);
  assert.deepEqual(alcanceAlumnosPagos(todos, [], []).map(a => a.id), []);
});
test('abonos: suma importes aplicados, no totales de recibos ni excedentes; respeta ciclos distintos', () => {
  const d = datos(), m = movimientosPlan(d.planes[0], d);
  assert.equal(m.vinculado, 70); assert.equal(m.movimientos.length, 2);
  assert.equal(resumenPlanPagos(d.planes[0]).pagadoSegunPlan, 70);
  assert.equal(resumenPlanPagos(d.planes[0]).total, 100);
  assert.equal(m.movimientos[0].recibo.ciclo_id, 'anterior');
  assert.equal(d.recibos[0].total, 150);
});
test('factura y recibo no duplican el pago; referencia histórica no implica asignación de monto', () => {
  const d = datos(); d.planes = [plan('p', 'R-1 / F-12306')];
  assert.equal(movimientosPlan(d.planes[0], d).movimientos.length, 2); // Dos vínculos reales, sin filas adicionales por folio.
  d.vinculos = [];
  const m = movimientosPlan(d.planes[0], d);
  assert.equal(m.movimientos.length, 1); assert.equal(m.movimientos[0].importe, null); assert.equal(m.vinculado, 0);
  assert.equal(resumenPlanPagos(plan('p', 'F-12306')).pagadoSegunPlan, 100);
});
test('recibos cancelados, otros alumnos y vínculos anulados no aportan importes', () => {
  const d = datos(); d.recibos[0].estatus = 'CANCELADO'; d.vinculos[1].anulado_en = '2026-11-12';
  assert.equal(movimientosPlan(d.planes[0], d).vinculado, 0);
  d.recibos[0].estatus = 'ACTIVO'; d.recibos[0].alumno_id = 'otro';
  assert.equal(movimientosPlan(d.planes[0], d).vinculado, 0);
});
test('certificado: todos los abonos de conceptos identificados, sin duplicarlos por programa', () => {
  const d = datos(); d.vinculos = []; d.detalles[1].concepto = 'PAGO DE CERTIFICACIÓN';
  d.certificaciones = ['uno', 'dos'].map(id => ({ alumno_id: 'a', alumno_programa_id: id, id, programa: id, pago_certificado: 'COMPLETADO', tramite_completado: false }));
  assert.equal(movimientosCertificado('a', d).length, 2);
  const t = tablasDetallePagos([alumno()], d, [], 'certificados');
  assert.equal(t['certificados_estados.csv'].filas.length, 2); assert.equal(t['recibos_detalle.csv'].filas.length, 2);
  assert.ok(!Object.keys(t).includes('titulacion_planes.csv'));
});
test('un reparto explícito a otro concepto evita atribuir el subtotal al certificado por su texto', () => {
  const d = datos(); assert.equal(movimientosCertificado('a', d).length, 0);
  d.planes[0].concepto_1 = 'CERTIFICADO TOTAL';
  const m = movimientosCertificado('a', d);
  assert.equal(m.length, 2); assert.equal(m[0].importe, 30); // No el subtotal de 60 ni el total de 150.
});
test('fuente normalizada prioritaria, estados desconocidos o vacíos no inventan total pagado', () => {
  const p = { ...plan(), detalles: [{ id: 'n', indice_concepto: 1, concepto: 'Derechos', cantidad: 80, estatus: 'R-83 (Efectivo)' }] } as PaymentPlan;
  assert.equal(resumenPlanPagos(p).total, 80); assert.equal(resumenPlanPagos(p).pagadoSegunPlan, 80);
  assert.equal(resumenPlanPagos(plan('p', 'Abono $20')).pagadoSegunPlan, null);
  assert.equal(resumenPlanPagos({ ...plan(), concepto_1: '0' }).total, null);
});
test('CSV: varios planes con mismo número conservan sus filas, conceptos y estados separados', () => {
  const d = datos(); d.planes.push(plan('segundo', 'F-12306'));
  const t = tablasDetallePagos([alumno()], d, [{ id: 'actual', nombre: '2027-1', tipo_periodo: 'Cuatrimestral' }], 'ambos');
  assert.equal(t['titulacion_planes.csv'].filas.length, 2);
  assert.ok(Object.values(t).every(t => t.filas.every(f => f.length === t.cabeceras.length)));
  assert.ok(t['recibos_detalle.csv'].filas.every(f => f[2] === 'Titulación'));
});
const fuente = (d: DatosPagosListado): FuentePagosListado => {
  // Simula un servidor con tope de una fila, inferior a la página solicitada.
  const pagina = <T>(filas: T[]) => async ({ desde }: { desde: number }) => filas.slice(desde, desde + 1);
  return { planes: pagina(d.planes), recibos: pagina(d.recibos), detalles: pagina(d.detalles), vinculos: pagina(d.vinculos), certificaciones: async () => d.certificaciones };
};
test('consulta pagina hasta vacío aunque el servidor devuelva menos de 500, sin limitar a ciclos', async () => {
  const d = datos(), r = await consultarPagosListado(['a', 'a'], fuente(d), new AbortController().signal);
  assert.equal(r.recibos.length, 2); assert.equal(r.detalles.length, 2); assert.equal(r.vinculos.length, 2);
});
test('errores, duplicados, permisos incompletos o respaldo cruzado rechazan todo el detalle', async () => {
  const d = datos(); const f = fuente(d);
  await assert.rejects(consultarPagosListado(['a'], { ...f, detalles: async () => { throw new Error('permiso'); } }, new AbortController().signal), /permiso/);
  await assert.rejects(consultarPagosListado(['a'], { ...f, detalles: async () => [] }, new AbortController().signal), /respaldo/);
  await assert.rejects(consultarPagosListado(['a'], { ...f, recibos: async () => [recibo()] }, new AbortController().signal), /cambiaron/);
  d.recibos[0].alumno_id = 'b';
  await assert.rejects(consultarPagosListado(['a'], fuente(d), new AbortController().signal), /fuera/);
});
test('cancelar no devuelve una consulta parcial', async () => {
  const c = new AbortController(); c.abort();
  await assert.rejects(consultarPagosListado(['a'], fuente(datos()), c.signal), { name: 'AbortError' });
});
test('exportar titulación conserva los alumnos sin plan, sin inventar pagos o importes cero', () => {
  const tabla = tablasDetallePagos([alumno('sin-plan')], datos(), [], 'titulacion')['titulacion_planes.csv'];
  assert.equal(tabla.filas.length, 1);
  assert.equal(tabla.filas[0][tabla.cabeceras.indexOf('Estado del pago')], 'Sin plan');
  assert.equal(tabla.filas[0][tabla.cabeceras.indexOf('Pagado según estatus del plan')], '');
  assert.equal(tabla.filas[0].length, tabla.cabeceras.length);
});
