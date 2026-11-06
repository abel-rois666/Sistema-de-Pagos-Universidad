import assert from 'node:assert/strict';
import test from 'node:test';
import type { CicloEscolar } from '../src/types';
import { ciclosBoletaElegibles, sugerirCicloBoletaId } from '../src/comunicados/ciclos';

const ciclo = (id: string, nombre: string, tipo_periodo: string): CicloEscolar => ({
  id, nombre, tipo_periodo, meses_abarca: '', anio: 2027, activo: false,
});

test('2027-1 cuatrimestral propone 2026-3 y excluye semestrales homónimos', () => {
  const actual = ciclo('actual', '2027-1', 'Cuatrimestral');
  const disponibles = [actual, ciclo('semestral', '2027-1', 'Semestral'),
    ciclo('previo', '2026-3', 'CUATRIMESTRAL'), ciclo('anterior', '2026-2', 'Cuatrimestral')];
  assert.equal(sugerirCicloBoletaId(disponibles, actual), 'previo');
  assert.deepEqual(ciclosBoletaElegibles(disponibles, actual).map(item => item.id), ['previo', 'anterior']);
});

test('un periodo previo duplicado no se elige sin intervención', () => {
  const actual = ciclo('actual', '2027-1', 'Cuatrimestral');
  assert.equal(sugerirCicloBoletaId([actual, ciclo('a', '2026-3', 'Cuatrimestral'),
    ciclo('b', '2026-3', 'Cuatrimestral')], actual), '');
});
