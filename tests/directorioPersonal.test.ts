import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarFilasDirectorio, estadoCuentaPersonal, paginaDirectorio, type FilaDirectorioPersonal } from '../src/personal/directorio';

const filas: FilaDirectorioPersonal[] = [
  { id: 'd3', nombre: 'Ñúñez López Ana', estatus: 'inactivo', area: 'Rectoría', puesto: 'Coordinación', funcionVinculada: true, busqueda: 'Ñúñez López Ana PF10 Rectoría RFC333', detalles: [] },
  { id: 'd1', nombre: 'Álvarez Pérez Lucía', estatus: 'activo', area: 'Finanzas', puesto: 'Auxiliar', funcionVinculada: false, busqueda: 'Álvarez Pérez Lucía PF2 Finanzas RFC111', detalles: [] },
  { id: 'd2', nombre: 'Álvarez Pérez Luis', estatus: 'activo', area: 'Finanzas', puesto: 'Coordinación', busqueda: 'Álvarez Pérez Luis PF3 Finanzas RFC222', detalles: [] },
];
const consulta = { busqueda: '', estado: '', area: '', puesto: '', vinculo: '', cuenta: '', orden: 'nombre', direccion: 'asc' as const };
test('directorio: combina palabras, acentos y filtros antes de paginar sin alterar registros', () => {
  const resultado = consultarFilasDirectorio(filas, { ...consulta, busqueda: 'alvarez rfc111', estado: 'activo', area: 'Finanzas' });
  assert.deepEqual(resultado.map(f => f.id), ['d1']);
  assert.equal(filas[0].id, 'd3');
  assert.deepEqual(consultarFilasDirectorio(filas, { ...consulta, busqueda: 'inexistente' }), []);
});
test('directorio: una relación desconocida no se atribuye como ausencia de función', () => {
  assert.deepEqual(consultarFilasDirectorio(filas, { ...consulta, vinculo: 'sin' }).map(f => f.id), ['d1']);
  assert.deepEqual(consultarFilasDirectorio(filas, { ...consulta, vinculo: 'con' }).map(f => f.id), ['d3']);
});
test('directorio: filtra cargo y ordena nombres en español con desempate estable', () => {
  assert.deepEqual(consultarFilasDirectorio(filas, { ...consulta, puesto: 'Coordinación', direccion: 'desc' }).map(f => f.id), ['d3', 'd2']);
});
test('directorio: corrige página fuera de rango y representa cero resultados', () => {
  assert.deepEqual(paginaDirectorio(0, 12, 10), { actual: 1, paginas: 1, desde: 0, hasta: 0 });
  assert.deepEqual(paginaDirectorio(11, 9, 10), { actual: 2, paginas: 2, desde: 10, hasta: 11 });
  assert.equal(paginaDirectorio(3, NaN, 10).actual, 1);
});
test('directorio: existencia de usuario no significa cuenta activa', () => {
  assert.equal(estadoCuentaPersonal([])?.texto, 'Sin cuenta');
  assert.equal(estadoCuentaPersonal([{}])?.texto, 'Cuenta por verificar');
  assert.equal(estadoCuentaPersonal([{ activo: true, auth_id: null }])?.texto, 'Cuenta por verificar');
  assert.equal(estadoCuentaPersonal([{ activo: false, auth_id: 'auth1' }])?.texto, 'Cuenta desactivada');
  assert.equal(estadoCuentaPersonal([{ activo: true, auth_id: 'auth1' }])?.texto, 'Cuenta activa');
});
