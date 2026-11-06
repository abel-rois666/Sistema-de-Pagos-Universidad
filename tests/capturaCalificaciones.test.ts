import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarCambioCaptura, normalizarValorCaptura } from '../src/calificaciones/captura';

test('captura numérica preserva NP, promedio calculado y redondeo oficial', () => {
  const registro = aplicarCambioCaptura({ parcial_1: 8, parcial_2: 9 }, 'parcial_3', 9, 'Licenciatura', 6);
  assert.equal(registro.promedio_calculado, 8.67);
  assert.equal(registro.calificacion_final, 9);
  assert.equal(registro.bloqueo_final, true);
  const np = aplicarCambioCaptura({ parcial_1: -555, parcial_2: -555 }, 'parcial_3', -555, 'Licenciatura', 6);
  assert.equal(np.calificacion_final, -555);
  assert.equal(np.estatus, 'REPROBADA');
});

test('una final manual se conserva hasta restaurar; quitar un parcial limpia el promedio', () => {
  const actual = { parcial_1: 8, parcial_2: 8, parcial_3: 8, calificacion_final: 10, modificada_manualmente: true };
  assert.equal(aplicarCambioCaptura(actual, 'parcial_1', 7, 'Licenciatura', 6).calificacion_final, 10);
  assert.equal(aplicarCambioCaptura(actual, 'calificacion_final', null, 'Licenciatura', 6, true).calificacion_final, 8);
  assert.equal(aplicarCambioCaptura({ ...actual, modificada_manualmente: false }, 'parcial_1', null, 'Licenciatura', 6).calificacion_final, null);
});

test('especialidad conserva captura final y no admite NaN ni valores fuera de rango', () => {
  assert.equal(aplicarCambioCaptura({}, 'calificacion_final', 9, 'Especialidad', 8).parcial_1, 9);
  assert.equal(normalizarValorCaptura('calificacion_final', null), null);
  assert.equal(normalizarValorCaptura('parcial_1', '-555'), -555);
  for (const valor of ['texto', 'NaN', 11, -1, true]) assert.throws(() => normalizarValorCaptura('parcial_1', valor));
});
