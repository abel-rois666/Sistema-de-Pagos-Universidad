import assert from 'node:assert/strict';
import test from 'node:test';
import type { Alumno, CicloEscolar, PaymentPlan } from '../src/types';
import { buildPlanCoverage, countPlanObservations, filterPlanCoverage, inspectPlan, summarizeCoverage } from '../src/utils/planCoverageUtils';
import { createPlanCoveragePdf } from '../src/utils/planCoveragePdf';

const ciclo = (id: string) => ({ id, nombre: `Ciclo ${id}`, activo: id === 'actual' }) as CicloEscolar;
const alumno = (id: string, cycle: string, estatus = 'ACTIVO') => ({
  id, nombre_completo: `Alumno ${id}`, licenciatura: 'Derecho', ciclo_ultima_asignacion_grado: cycle, estatus,
}) as Alumno;
const plan = (id: string, alumnoId: string, cycle: string, fields: Record<string, unknown> = {}) => ({
  id, alumno_id: alumnoId, ciclo_id: cycle, ciclo_escolar: `Ciclo ${cycle}`,
  nombre_alumno: `Alumno ${alumnoId}`, licenciatura: 'Derecho', no_plan_pagos: id,
  tipo_plan: 'Cuatrimestral', ...fields,
}) as PaymentPlan;

test('solo las celdas vacías impiden contar un plan como completo; cero es un monto capturado', () => {
  const result = inspectPlan(plan('p1', 'a1', 'actual', {
    concepto_1: 'Inscripción', fecha_1: '2026-02-30', cantidad_1: 1200,
    concepto_2: 'Mensualidad', cantidad_2: 0,
  }));
  assert.equal(result.completo, false);
  assert.equal(result.conceptos, 2);
  assert.deepEqual(result.faltantes, ['#2: fecha']);
  assert.equal(result.monto, 1200);
  assert.equal(inspectPlan(plan('cero', 'a1', 'actual', {
    concepto_1: 'RVOE', fecha_1: '13/08/2027', cantidad_1: 0,
  })).completo, true);
  assert.deepEqual(inspectPlan(plan('sin-monto', 'a1', 'actual', {
    concepto_1: 'RVOE', fecha_1: '13/08/2027', cantidad_1: '',
  })).faltantes, ['#1: monto']);
  assert.equal(inspectPlan(plan('vacío', 'a1', 'actual')).completo, false);
});

test('omite espacios finales vacíos y ceros predeterminados, pero detecta filas parciales', () => {
  const complete = inspectPlan(plan('con-espacios', 'a1', 'actual', {
    concepto_1: 'Inscripción', fecha_1: '2026-10-13', cantidad_1: 0,
    concepto_2: '   ', fecha_2: '', cantidad_2: 0,
    concepto_3: null, fecha_3: null, cantidad_3: null,
    detalles: [
      { id: 'd1', plan_id: 'con-espacios', indice_concepto: 1, concepto: 'Inscripción', fecha_vencimiento: '2026-10-13', cantidad: 0, estatus: 'PENDIENTE' },
      { id: 'd2', plan_id: 'con-espacios', indice_concepto: 4, concepto: '', fecha_vencimiento: null, cantidad: 0, estatus: 'PENDIENTE' },
    ],
  }));
  assert.equal(complete.completo, true);
  assert.equal(complete.conceptos, 1);
  assert.deepEqual(complete.faltantes, []);

  const onlyAmount = inspectPlan(plan('solo-monto', 'a1', 'actual', { cantidad_5: 250 }));
  assert.equal(onlyAmount.completo, false);
  assert.equal(onlyAmount.conceptos, 1);
  assert.deepEqual(onlyAmount.faltantes, ['#5: concepto', '#5: fecha']);

  const onlyDate = inspectPlan(plan('solo-fecha', 'a1', 'actual', { fecha_6: '2026-12-01' }));
  assert.deepEqual(onlyDate.faltantes, ['#6: concepto', '#6: monto']);
});

test('usa solo detalles normalizados cuando existen, sin crear filas fantasmas desde campos antiguos', () => {
  const planNormalizado = plan('p1', 'a1', 'actual', {
    detalles: Array.from({ length: 6 }, (_, index) => ({
      id: `d${index + 1}`, plan_id: 'p1', indice_concepto: index + 1,
      concepto: `Pago ${index + 1}`, fecha_vencimiento: '2026-10-01', cantidad: index === 0 ? 0 : 1000, estatus: 'PENDIENTE',
    })),
    cantidad_7: 1222,
    concepto_18: 'Concepto antiguo', fecha_18: '2026-12-15', cantidad_18: 200,
  });
  const result = inspectPlan(planNormalizado);
  assert.equal(result.completo, true);
  assert.equal(result.conceptos, 6);
  assert.equal(result.monto, 5000);
  assert.deepEqual(result.faltantes, []);
  const report = buildPlanCoverage([ciclo('actual')], [alumno('a1', 'actual')], [planNormalizado]);
  assert.equal(report[0].entries[0].estado, 'COMPLETO');

  const legacy = inspectPlan(plan('p2', 'a1', 'actual', {
    concepto_1: 'Inscripción', fecha_1: '2026-10-01', cantidad_1: 1500,
    concepto_18: 'Examen', fecha_18: '2026-12-15', cantidad_18: 200,
    detalles: [],
  }));
  assert.equal(legacy.completo, true);
  assert.equal(legacy.conceptos, 2);
  assert.equal(legacy.monto, 1700);
});

test('cuenta varios planes por alumno y limita los sin plan a la última asignación', () => {
  const report = buildPlanCoverage(
    [ciclo('actual'), ciclo('anterior')],
    [alumno('a1', 'actual'), alumno('a2', 'actual'), alumno('a3', 'anterior')],
    [
      plan('completo', 'a1', 'actual', { concepto_1: 'Colegiatura', fecha_1: '2026-10-15', cantidad_1: 1000 }),
      plan('incompleto', 'a1', 'actual', { concepto_1: 'Titulación' }),
      plan('histórico', 'a1', 'anterior', { concepto_1: 'Colegiatura', fecha_1: '2025-10-15', cantidad_1: 900 }),
    ],
  );
  assert.equal(report[0].alumnos, 2);
  assert.equal(report[0].planes, 2);
  assert.equal(report[0].alumnosConPlanCompleto, 1);
  assert.equal(report[0].alumnosSinPlan, 1);
  assert.equal(report[0].entries.filter(row => row.alumnoId === 'a1').length, 2);
  assert.equal(report[1].entries.some(row => row.alumnoId === 'a3' && row.estado === 'SIN_PLAN'), true);
  assert.equal(report[1].entries.some(row => row.alumnoId === 'a1' && row.estado === 'SIN_PLAN'), false);
});

test('excluye bajas y prospectos; titulados solo aparecen donde tienen plan', () => {
  const report = buildPlanCoverage(
    [ciclo('actual')],
    [
      alumno('activo', 'actual'), alumno('baja-completo', 'actual', 'BAJA'),
      alumno('baja-incompleto', 'actual', 'BAJA'), alumno('egresado', 'actual', 'EGRESADO'),
      alumno('sin-plan-activo', 'actual'), alumno('sin-plan-baja', 'actual', 'BAJA'),
      alumno('prospecto', 'actual', 'PENDIENTE_APROBACION'),
      alumno('titulado-con-plan', 'actual', 'TITULADO'), alumno('titulado-sin-plan', 'actual', 'TITULADO'),
    ],
    [
      plan('p-activo', 'activo', 'actual', { concepto_1: 'Pago', fecha_1: '2026-10-01', cantidad_1: 100 }),
      plan('p-baja-completo', 'baja-completo', 'actual', { concepto_1: 'Pago', fecha_1: '2026-10-01', cantidad_1: 100 }),
      plan('p-baja-incompleto', 'baja-incompleto', 'actual', { concepto_1: 'Pago' }),
      plan('p-egresado', 'egresado', 'actual', { concepto_1: 'Pago' }),
      plan('p-prospecto', 'prospecto', 'actual', { concepto_1: 'Pago', fecha_1: '2026-10-01', cantidad_1: 100 }),
      plan('p-titulado', 'titulado-con-plan', 'actual', { concepto_1: 'Pago', fecha_1: '2026-10-01', cantidad_1: 100 }),
      plan('p-sin-alumno', 'desconocido', 'actual', { concepto_1: 'Pago' }),
    ],
  );
  const rows = report[0].entries;
  assert.deepEqual(rows.map(row => row.alumnoId).sort(), ['activo', 'egresado', 'sin-plan-activo', 'titulado-con-plan']);
  assert.equal(report[0].planes, 3);
  assert.equal(report[0].planesCompletos, 2);
  assert.equal(report[0].planesIncompletos, 1);
  assert.equal(report[0].alumnosSinPlan, 1);
  assert.deepEqual(summarizeCoverage(report), {
    alumnos: 4, alumnosConCompleto: 2, alumnosSinCompleto: 2,
    planesCompletos: 2, planesIncompletos: 1, alumnosSinPlan: 1,
    planesIntegrales: 0, alumnosConIntegral: 0,
  });
});

test('conserva planes históricos de activos y titulados solo en el ciclo del plan', () => {
  const report = buildPlanCoverage(
    [ciclo('actual'), ciclo('anterior')],
    [alumno('activo', 'actual'), alumno('titulado', 'actual', 'EGRESADO TITULADO')],
    [
      plan('p-activo-anterior', 'activo', 'anterior', { concepto_1: 'Pago', fecha_1: '2025-10-01', cantidad_1: 100 }),
      plan('p-titulado-anterior', 'titulado', 'anterior', { concepto_1: 'Pago', fecha_1: '2025-10-01', cantidad_1: 100 }),
    ],
  );
  assert.deepEqual(report[1].entries.map(row => row.alumnoId).sort(), ['activo', 'titulado']);
  assert.equal(report[0].entries.some(row => row.alumnoId === 'titulado'), false);
  assert.equal(report[0].entries.some(row => row.alumnoId === 'activo' && row.estado === 'SIN_PLAN'), true);
});

test('filtra varios tipos de plan antes de calcular totales y excluye sin plan al seleccionar tipos', () => {
  const report = buildPlanCoverage(
    [ciclo('actual')],
    [alumno('a1', 'actual'), alumno('a2', 'actual')],
    [
      plan('p1', 'a1', 'actual', { tipo_plan: 'Cuatrimestral', concepto_1: 'Pago', fecha_1: '2026-10-01', cantidad_1: 0 }),
      plan('p2', 'a1', 'actual', { tipo_plan: 'Semestral', concepto_1: 'Pago', fecha_1: '2026-10-01', cantidad_1: 100 }),
      plan('p3', 'a1', 'actual', { tipo_plan: 'Titulación', concepto_1: 'Pago', cantidad_1: 200 }),
    ],
  );
  const unfiltered = filterPlanCoverage(report, {
    cicloId: 'actual', licenciaturas: [], tipos: [], observaciones: [], integral: 'TODOS', busqueda: '', estado: 'TODOS',
  });
  assert.equal(unfiltered[0].entries.some(entry => entry.estado === 'SIN_PLAN'), true);
  const filtered = filterPlanCoverage(report, {
    cicloId: 'actual', licenciaturas: [], tipos: ['Cuatrimestral', 'Titulación'], observaciones: [], integral: 'TODOS', busqueda: '', estado: 'TODOS',
  });
  assert.deepEqual(filtered[0].entries.map(entry => entry.planId).sort(), ['p1', 'p3']);
  assert.deepEqual(summarizeCoverage(filtered), {
    alumnos: 1, alumnosConCompleto: 1, alumnosSinCompleto: 0,
    planesCompletos: 1, planesIncompletos: 1, alumnosSinPlan: 0,
    planesIntegrales: 0, alumnosConIntegral: 0,
  });
  const incomplete = filterPlanCoverage(report, {
    cicloId: 'actual', licenciaturas: [], tipos: ['Cuatrimestral', 'Titulación'], observaciones: [], integral: 'TODOS', busqueda: '', estado: 'INCOMPLETO',
  });
  assert.deepEqual(incomplete[0].entries.map(entry => entry.planId), ['p3']);
});

test('una observación vuelve integral al plan elegible; quitar todas lo retira sin alterar su completitud', () => {
  const students = [alumno('a1', 'actual'), alumno('a2', 'actual'), alumno('a3', 'actual')];
  const plans = [
    plan('p1', 'a1', 'actual', { tipo_plan: 'Semestral', observaciones: ['Inglés', '4 Diplomados'], concepto_1: 'Pago', fecha_1: '2026-10-01', cantidad_1: 0 }),
    plan('p2', 'a1', 'actual', { observaciones: ['4 Diplomados'], concepto_1: 'Pago' }),
    plan('p3', 'a2', 'actual', { tipo_plan: 'Titulación', observaciones: ['Inglés'], concepto_1: 'Pago', fecha_1: '2026-10-01', cantidad_1: 100 }),
  ];
  const report = buildPlanCoverage([ciclo('actual')], students, plans);
  assert.deepEqual(report[0].entries.filter(entry => entry.integral).map(entry => entry.planId).sort(), ['p1', 'p2']);
  assert.equal(report[0].entries.find(entry => entry.planId === 'p1')?.estado, 'COMPLETO');
  assert.deepEqual(countPlanObservations(report[0].entries), [
    { nombre: '4 Diplomados', planes: 2 }, { nombre: 'Inglés', planes: 1 },
  ]);
  assert.equal(summarizeCoverage(report).planesIntegrales, 2);
  assert.equal(summarizeCoverage(report).alumnosConIntegral, 1);

  const filtered = filterPlanCoverage(report, {
    cicloId: 'actual', licenciaturas: [], tipos: [], observaciones: ['Inglés', '4 Diplomados'], integral: 'INTEGRAL', busqueda: '', estado: 'TODOS',
  });
  assert.deepEqual(filtered[0].entries.map(entry => entry.planId).sort(), ['p1', 'p2']);
  const onlyEnglish = filterPlanCoverage(report, {
    cicloId: 'actual', licenciaturas: [], tipos: [], observaciones: ['Inglés'], integral: 'INTEGRAL', busqueda: '', estado: 'TODOS',
  });
  assert.deepEqual(onlyEnglish[0].entries.map(entry => entry.planId), ['p1']);
  const notIntegral = filterPlanCoverage(report, {
    cicloId: 'actual', licenciaturas: [], tipos: [], observaciones: [], integral: 'NO_INTEGRAL', busqueda: '', estado: 'TODOS',
  });
  assert.deepEqual(notIntegral[0].entries.map(entry => entry.planId), ['p3']);
  const withoutObservations = buildPlanCoverage([ciclo('actual')], students, [
    { ...plans[0], observaciones: [] }, plans[1], plans[2],
  ]);
  assert.equal(withoutObservations[0].entries.find(entry => entry.planId === 'p1')?.integral, false);
  assert.equal(withoutObservations[0].entries.find(entry => entry.planId === 'p1')?.estado, 'COMPLETO');
  assert.equal(summarizeCoverage(withoutObservations).planesIntegrales, 1);
});

test('genera un PDF con detalles y un ciclo sin planes', () => {
  const manyPlans = Array.from({ length: 65 }, (_, index) => plan(`p${index}`, 'a1', 'actual', {
    concepto_1: 'Colegiatura', fecha_1: '2026-10-15', cantidad_1: 1000,
  }));
  const report = buildPlanCoverage(
    [ciclo('actual'), ciclo('vacío')],
    [alumno('a1', 'actual')],
    manyPlans,
  );
  const pdf = createPlanCoveragePdf(report, { ciclo: 'Todos', licenciatura: 'Todas', busqueda: '' });
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 8)).startsWith('%PDF-'), true);
  assert.ok(bytes.length > 3000);
  assert.ok(pdf.getNumberOfPages() > 1);
  const selectedColumns = createPlanCoveragePdf(report, { ciclo: 'Todos', licenciatura: 'Todas', busqueda: '', observaciones: 'Inglés' }, ['alumnoNombre', 'integral', 'observaciones']);
  assert.ok(new Uint8Array(selectedColumns.output('arraybuffer')).length > 1000);
});
