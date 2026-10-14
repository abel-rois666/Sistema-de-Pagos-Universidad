import test from 'node:test';
import assert from 'node:assert/strict';
import { mesesInvolucrados } from '../src/calendario/meses';

test('la vista general incluye eventos después de las clases y cruza de año', () => {
  assert.deepEqual(mesesInvolucrados('2026-10-21', '2027-01-29', [
    { fecha_inicio: '2027-02-17', fecha_fin: '2027-02-17' },
  ]), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
});

test('también muestra actividades previas al inicio de clases', () => {
  assert.deepEqual(mesesInvolucrados('2027-01-10', '2027-03-20', [
    { fecha_inicio: '2026-12-15', fecha_fin: '2027-01-05' },
  ]), ['2026-12', '2027-01', '2027-02', '2027-03']);
});
