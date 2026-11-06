import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promedioCicloTruncado, participaEnPromedio } from '../src/utils/promedioAcademico';

test('complementarias se califican numéricamente pero no modifican el promedio', () => {
  const materias = [
    { calificacion_final: 8, asignaturas: { nombre: 'Derecho', clasificacion_clave: '263' } },
    { calificacion_final: 9, asignaturas: { nombre: 'Optativa', clasificacion_clave: '264' } },
    { calificacion_final: 1, asignaturas: { nombre: 'Taller', clasificacion_clave: '266' } },
  ];
  assert.equal(promedioCicloTruncado(materias), '8.50');
  assert.equal(promedioCicloTruncado([{ calificacion_final: -555, asignaturas: { clasificacion_clave: '263' } }, materias[0]]), '4.00');
  assert.equal(participaEnPromedio({ nombre: 'Inglés I' }), false);
  assert.equal(participaEnPromedio({ nombre: 'Inglés I', clasificacion_clave: '263' }), false);
  assert.equal(participaEnPromedio({ nombre: 'Redacción en Inglés', clasificacion_clave: '263' }), true);
  assert.equal(promedioCicloTruncado([{ calificacion_final: null }, { calificacion_final: 11 }]), '0.00');
  assert.equal(promedioCicloTruncado([{ calificacion_final: ' ' }, { calificacion_final: false }, { calificacion_final: 10 }]), '10.00');
  assert.equal(promedioCicloTruncado([{ calificacion_final: 0 }, { calificacion_final: 10 }]), '5.00');
});
