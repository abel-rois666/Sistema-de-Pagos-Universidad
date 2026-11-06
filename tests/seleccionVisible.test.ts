import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cambiarSeleccionVisible, estadoSeleccionVisible } from '../src/utils/seleccionVisible';

test('seleccionar y desmarcar una página conserva las otras páginas y evita duplicados', () => {
  assert.deepEqual(cambiarSeleccionVisible(['otra', 'a'], ['a', 'b'], true), ['otra', 'a', 'b']);
  assert.deepEqual(cambiarSeleccionVisible(['otra', 'a', 'b'], ['a', 'b'], false), ['otra']);
  assert.deepEqual(estadoSeleccionVisible(['otra'], ['a']), { completa: false, parcial: false });
  assert.deepEqual(estadoSeleccionVisible(['otra', 'a'], ['a', 'b']), { completa: false, parcial: true });
});
