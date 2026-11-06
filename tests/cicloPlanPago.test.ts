import assert from 'node:assert/strict';
import test from 'node:test';
import { coincideConceptoReciboPlan, resolverCicloPlanPagoImportado, validarPeriodicidadAcademicaPlanPago } from '../src/utils/cicloPlanPago';
import type { CicloEscolar } from '../src/types';

const ciclos: CicloEscolar[] = [
  { id: 'sem', nombre: '2027-1', tipo_periodo: 'Semestral', meses_abarca: '', anio: 2027, activo: true },
  { id: 'cuat', nombre: '2027-1', tipo_periodo: 'Cuatrimestral', meses_abarca: '', anio: 2027, activo: false },
];

test('la importación resuelve un ciclo homónimo por nombre y periodicidad', () => {
  assert.equal(resolverCicloPlanPagoImportado(ciclos, '2027-1', 'Cuatrimestral')?.id, 'cuat');
  assert.equal(resolverCicloPlanPagoImportado(ciclos, '2027-1', 'Semestral')?.id, 'sem');
  assert.equal(resolverCicloPlanPagoImportado([...ciclos, { ...ciclos[1], id: 'otro' }],
    '2027-1', 'Cuatrimestral'), undefined);
});

test('el alta rechaza un plan financiero incompatible con el plan académico', () => {
  assert.match(validarPeriodicidadAcademicaPlanPago(ciclos[0], 'Semestral', 'Cuatrimestral') || '',
    /plan de estudios/);
  assert.match(validarPeriodicidadAcademicaPlanPago(ciclos[0], 'Cuatrimestral', 'Cuatrimestral') || '',
    /no corresponde/);
  assert.equal(validarPeriodicidadAcademicaPlanPago(ciclos[1], 'Cuatrimestral', 'CUATRIMESTRAL'), null);
});

test('un recibo del ID homónimo puede mostrarse como candidato sin atribuir un trámite distinto', () => {
  assert.equal(coincideConceptoReciboPlan('1ER PAGO (Plan Semestral - 2027-1)', '1ER PAGO'), true);
  assert.equal(coincideConceptoReciboPlan('Constancias  renovación-de beca (Plan Semestral - 2027-1)',
    'CONSTANCIAS RENOVACIÓN DE BECA'), true);
  assert.equal(coincideConceptoReciboPlan('PRIMER PAGO CON COSTO PROMOCIONAL', 'PRIMER PAGO'), true);
  assert.equal(coincideConceptoReciboPlan('SEGUNDO PAGO CON COSTO PROMOCIONAL', 'PRIMER PAGO'), false);
  assert.equal(coincideConceptoReciboPlan('CONSTANCIA DE ESTUDIOS', '1ER PAGO'), false);
});
