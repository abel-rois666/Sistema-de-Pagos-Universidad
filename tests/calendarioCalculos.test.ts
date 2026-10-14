import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularDiasEfectivos } from '../src/calendario/calculos';

test('exámenes ordinarios cuentan y recuperación y extraordinarios quedan fuera', () => {
  const eventos = [
    { fechaInicio: '2027-03-01', fechaFin: '2027-03-01', tipo: 'EXAMENES', suspendeClases: false },
    { fechaInicio: '2027-03-02', fechaFin: '2027-03-02', tipo: 'RECUPERACION', suspendeClases: false },
    { fechaInicio: '2027-03-03', fechaFin: '2027-03-03', tipo: 'EXTRAORDINARIOS', suspendeClases: false },
    { fechaInicio: '2027-03-04', fechaFin: '2027-03-04', tipo: 'VACACIONES', suspendeClases: false },
  ];
  assert.deepEqual(calcularDiasEfectivos('2027-03-01', '2027-03-06', 'MATUTINO', 'ESCOLARIZADA', eventos), {
    presenciales: 2, sincronasEnLinea: 0, total: 2, semanasConClase: 1, semanasEquivalentes: 0.4,
  });
  assert.deepEqual(calcularDiasEfectivos('2027-03-01', '2027-03-06', 'MIXTO', 'MIXTA', eventos), {
    presenciales: 1, sincronasEnLinea: 2, total: 3, semanasConClase: 1, semanasEquivalentes: 0.5,
  });
  assert.deepEqual(calcularDiasEfectivos('2027-03-01', '2027-03-06', 'MIXTO', 'ESCOLARIZADA', eventos), {
    presenciales: 1, sincronasEnLinea: 0, total: 1, semanasConClase: 1, semanasEquivalentes: 1,
  });
});

test('las fechas civiles y los eventos no alteran el conteo por zona horaria', () => {
  assert.equal(calcularDiasEfectivos('2027-01-01', '2027-01-31', 'MIXTO', 'ESCOLARIZADA', []).total, 5);
  assert.equal(calcularDiasEfectivos('2027-01-25', '2027-01-29', 'MATUTINO', 'ESCOLARIZADA', [
    { fechaInicio: '2027-02-01', fechaFin: '2027-02-05', tipo: 'RECUPERACION', suspendeClases: true },
  ]).total, 5);
  assert.throws(() => calcularDiasEfectivos('2027-02-30', '2027-03-01', 'MATUTINO', 'ESCOLARIZADA', []));
});
