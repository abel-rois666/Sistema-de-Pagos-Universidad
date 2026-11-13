import test from 'node:test';
import assert from 'node:assert/strict';
import type { Alumno, PaymentPlan } from '../src/types';
import { fechaFinancieraHoy, fechaVencimientoCivil, saldosPorVencimiento, situacionVencimiento } from '../src/finanzas/vencimientos';
import { construirDeudasVencidas } from '../src/finanzas/deudores';
import { construirReporteFinanciero, ordenarReporteFinanciero } from '../src/utils/consultaAlumnos';
import { tablaSaldosCSV } from '../src/reportes/exportacionSaldos';
const hoy = '2026-11-12';
const alumno = { id: 'a', nombre_completo: 'ALUMNO FICTICIO', estatus: 'ACTIVO' } as Alumno;
const plan = (campos: Partial<PaymentPlan> = {}) => ({ id: 'p', alumno_id: 'a', nombre_alumno: alumno.nombre_completo, tipo_plan: 'Cuatrimestral', concepto_1: 'PAGO', cantidad_1: 1000, estatus_1: 'PENDIENTE', fecha_1: '2026-11-11', ...campos } as PaymentPlan);
test('fecha civil: acepta fechas existentes y rechaza normalización automática y formatos ambiguos', () => {
  assert.equal(fechaVencimientoCivil('29/02/2024'), '2024-02-29');
  assert.equal(fechaVencimientoCivil('1/2/2026'), '2026-02-01');
  for (const f of ['', '31/02/2026', '2026-02-29', '2026-13-01', '2026-00-01', '2026-11-00', '11/12/26', 'texto', '2026-11-12T00:00:00Z']) assert.equal(fechaVencimientoCivil(f), null, f);
});
test('vence al día siguiente: ayer vencido, hoy y mañana en plazo, fecha desconocida aparte', () => {
  assert.equal(situacionVencimiento('2026-11-11', hoy), 'vencido');
  assert.equal(situacionVencimiento('2026-11-11', '12/11/2026'), 'vencido');
  assert.equal(situacionVencimiento(hoy, hoy), 'enPlazo');
  assert.equal(situacionVencimiento('13/11/2026', hoy), 'enPlazo');
  assert.equal(situacionVencimiento('31/11/2026', hoy), 'revisarFecha');
  assert.throws(() => situacionVencimiento(hoy, '2026-02-30'), /no es válida/);
});
test('cambio de día en México independiente de UTC y zona del dispositivo', () => {
  assert.equal(fechaFinancieraHoy(new Date('2026-11-13T05:59:59Z')), '2026-11-12');
  assert.equal(fechaFinancieraHoy(new Date('2026-11-13T06:00:00Z')), '2026-11-13');
});
test('ejemplo: abono de 400, vencido 600 y 1000 aún en plazo conservan 1600 de total', () => {
  const p = plan({ estatus_1: 'R-83 (Abono $400.00, Resta $600.00)', concepto_2: 'SEGUNDO', cantidad_2: 1000, fecha_2: '2026-12-11', estatus_2: 'PENDIENTE' });
  assert.deepEqual(saldosPorVencimiento(p, 'ACTIVO', 'Todos', hoy), { pagado: 400, adeuda: 1600, vencido: 600, enPlazo: 1000, revisarFecha: 0 });
});
test('saldo con fecha inválida se conserva en el total sin inventar vencimiento', () => {
  const p = plan({ fecha_1: '31/11/2026', concepto_2: 'SEGUNDO', cantidad_2: 200, fecha_2: '', estatus_2: 'PENDIENTE' });
  const r = saldosPorVencimiento(p, 'ACTIVO', 'Todos', hoy);
  assert.equal(r.revisarFecha, 1200); assert.equal(r.adeuda, 1200); assert.equal(r.vencido + r.enPlazo, 0);
});
test('pagados por recibo o factura y excedente no se vuelven deuda ni acreditan monedero', () => {
  for (const estado of ['R-83 (Efectivo)', 'R-32474', 'F-12306', 'R-1 (Pagado $1,200.00)']) {
    const p = Object.freeze(plan({ estatus_1: estado }));
    const r = saldosPorVencimiento(p, 'ACTIVO', 'Todos', hoy);
    assert.equal(r.pagado, 1000); assert.equal(r.adeuda, 0); assert.equal(r.revisarFecha + r.vencido + r.enPlazo, 0);
  }
});
test('se conserva la regla BAJA y el filtro de mes del concepto, no del recibo', () => {
  assert.equal(saldosPorVencimiento(plan(), 'BAJA', 'Todos', hoy).adeuda, 0);
  assert.equal(saldosPorVencimiento(plan(), 'ACTIVO', 'DICIEMBRE 2026', hoy).adeuda, 0);
  assert.equal(saldosPorVencimiento(plan(), 'ACTIVO', 'NOVIEMBRE 2026', hoy).vencido, 1000);
});
test('Deudores usa el mismo corte, excluye sin fecha/futuros y conserva el saldo parcial', () => {
  const planes = [plan({ id: 'antes', estatus_1: 'R-1 (Abono $400.00, Resta $600.00)' }), plan({ id: 'hoy', fecha_1: hoy }), plan({ id: 'futuro', fecha_1: '2026-11-13' }), plan({ id: 'sinfecha', fecha_1: '31/11/2026' })];
  const deudas = construirDeudasVencidas(planes, [alumno], hoy);
  assert.deepEqual(deudas.map(d => [d.id, d.monto]), [['antes-1', 600]]);
  assert.equal(construirDeudasVencidas(planes, [{ ...alumno, estatus: 'BAJA' }], hoy).length, 0);
  assert.equal(construirDeudasVencidas(planes, [alumno], '2026-11-13').length, 2);
});
test('conceptos con nombres iguales se conservan con IDs distintos y sin filas con saldo cero', () => {
  const p = plan({ concepto_2: 'PAGO', cantidad_2: 200, estatus_2: 'PENDIENTE', fecha_2: '2026-11-11', concepto_3: 'OTRO', cantidad_3: 500, estatus_3: 'R-1 (Resta $0.00)', fecha_3: '2026-11-11' });
  assert.deepEqual(construirDeudasVencidas([p], [alumno], hoy).map(d => d.id), ['p-1', 'p-2']);
});
test('reporte agrega varios planes por ID y permite ordenar cada categoría antes de paginar', () => {
  const otros = { ...alumno, id: 'b' };
  const opciones = { tipo: 'Todos', mes: 'Todos', omitirSinPlan: false, fechaReferencia: hoy };
  const r = construirReporteFinanciero([alumno, otros], [alumno, otros], [plan(), plan({ id: 't', tipo_plan: 'Titulación', fecha_1: hoy })], opciones).registros;
  assert.equal(r[0].vencido, 1000); assert.equal(r[0].enPlazo, 1000); assert.equal(r[0].adeuda, 2000);
  assert.deepEqual([r[1].vencido, r[1].enPlazo, r[1].revisarFecha, r[1].adeuda], [0, 0, 0, 0]);
  assert.equal(ordenarReporteFinanciero(r, 'vencido', 'desc')[0].id, 'a');
  assert.equal(construirReporteFinanciero([alumno, otros], [], [plan()], opciones).registros.length, 0);
});
test('CSV conserva las siete columnas originales y añade el desglose con el mismo alcance', () => {
  const registros = construirReporteFinanciero([alumno], [alumno], [plan({estatus_1:'R-1 (Abono $400.00, Resta $600.00)',cantidad_2:1000,fecha_2:hoy,estatus_2:'PENDIENTE',cantidad_3:200,fecha_3:'',estatus_3:'PENDIENTE'})], {tipo:'Todos',mes:'Todos',omitirSinPlan:false,fechaReferencia:hoy}).registros;
  const t = tablaSaldosCSV(registros);
  assert.deepEqual(t.headers.slice(0,7), ['ALUMNO','LICENCIATURA','GRADO','ESTATUS','TIENE_PLAN','HA_PAGADO','ADEUDA']);
  assert.deepEqual(t.rows[0].slice(5), ['400','1800','600','1000','200']);
  assert.equal(t.rows[0].length, t.headers.length);
  assert.equal(tablaSaldosCSV([]).rows.length, 0);
});
