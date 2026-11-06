import assert from 'node:assert/strict';
import test from 'node:test';
import type { CicloEscolar } from '../src/types';
import { elegirCicloModulo } from '../src/utils/cicloModulo';

const ciclos = [
  { id: 'sem', nombre: '2027-1', tipo_periodo: 'Semestral', activo: false },
  { id: 'cuat', nombre: '2027-1', tipo_periodo: 'Cuatrimestral', activo: true },
  { id: 'anterior', nombre: '2026-3', tipo_periodo: 'Cuatrimestral', activo: false },
] as CicloEscolar[];

test('cada módulo conserva su ID exacto aunque haya un ciclo institucional distinto', () => {
  assert.equal(elegirCicloModulo(ciclos, 'sem', 'anterior'), 'anterior');
  assert.equal(elegirCicloModulo(ciclos, 'sem', null), 'cuat');
  assert.equal(elegirCicloModulo(ciclos, 'sem', 'eliminado'), 'cuat');
  assert.equal(elegirCicloModulo(ciclos, 'sem', 'sem'), 'sem');
});

test('todos y un destino explícito no se sustituyen por un ciclo homónimo', () => {
  assert.equal(elegirCicloModulo(ciclos, 'sem', '', { todos: true, valorTodos: '' }), '');
  assert.equal(elegirCicloModulo(ciclos, 'sem', 'sem', { inicialId: 'cuat' }), 'cuat');
});

test('la carga tardía conserva la preferencia hasta poder validar sus ciclos', () => {
  assert.equal(elegirCicloModulo([], 'sem', 'anterior'), 'anterior');
  assert.equal(elegirCicloModulo(ciclos, 'sem', 'anterior'), 'anterior');
  assert.equal(elegirCicloModulo([], 'sem', null), '');
});

test('sin activo ni preferencia un periodo homónimo requiere selección explícita', () => {
  const sinActivo = ciclos.map(ciclo => ({ ...ciclo, activo: false }));
  assert.equal(elegirCicloModulo(sinActivo, 'sem', null), '');
  assert.equal(elegirCicloModulo([...sinActivo].reverse(), 'cuat', null), '');
  assert.equal(elegirCicloModulo([sinActivo[2]], 'sem', null), 'anterior');
  assert.equal(elegirCicloModulo(ciclos.map(c=>({...c,activo:c.nombre==='2027-1'})), 'sem', null), '');
});
