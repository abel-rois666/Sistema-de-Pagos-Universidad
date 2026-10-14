import test from 'node:test';
import assert from 'node:assert/strict';
import { capacidadPorMedio, medioSesion, ventanasPorMedio } from '../src/horarios/medios';

test('solo la modalidad Mixta con turno Mixto añade clases en línea vespertinas', () => {
  assert.equal(capacidadPorMedio('MIXTO', 'MIXTA', 'PRESENCIAL'), 8);
  assert.equal(capacidadPorMedio('MIXTO', 'MIXTA', 'EN_LINEA'), 25);
  assert.deepEqual(ventanasPorMedio('MIXTO', 'Mixta', 'EN_LINEA').map(ventana => ventana.dia), [1, 2, 3, 4, 5]);
  assert.equal(capacidadPorMedio('MIXTO', 'ESCOLARIZADA', 'EN_LINEA'), 0);
  assert.equal(capacidadPorMedio('MATUTINO', 'MIXTA', 'EN_LINEA'), 0);
  assert.equal(capacidadPorMedio('VESPERTINO', 'MIXTA', 'PRESENCIAL'), 25);
});

test('sesiones antiguas sin medio conservan la interpretación presencial', () => {
  assert.equal(medioSesion(undefined), 'PRESENCIAL');
  assert.equal(medioSesion(null), 'PRESENCIAL');
  assert.equal(medioSesion('EN_LINEA'), 'EN_LINEA');
});
