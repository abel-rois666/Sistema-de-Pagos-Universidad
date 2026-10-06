import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { leerArchivoAsignaturas, leerCSV, prepararAsignaturas } from '../src/utils/asignaturasImport.ts';

test('horas semanales opcionales se validan sin afectar archivos anteriores', () => {
  const anterior = prepararAsignaturas(leerCSV('clave,nombre,creditos,clasificacion,periodo\nA1,Historia,2,Obligatoria,1'))[0];
  assert.equal('horas_semanales' in anterior.asignatura!, false);
  const nueva = prepararAsignaturas(leerCSV('clave,nombre,creditos,clasificacion,periodo,horas_semanales\nA1,Historia,2,Obligatoria,1,4'))[0];
  assert.equal(nueva.asignatura?.horas_semanales, 4);
  const invalida = prepararAsignaturas(leerCSV('clave,nombre,creditos,clasificacion,periodo,horas_semanales\nA1,Historia,2,Obligatoria,1,0'))[0];
  assert.ok(invalida.errores.includes('Horas semanales inválidas'));
});

test('CSV con separador, comillas, salto de línea y crédito cero', () => {
  const filas = leerCSV('\uFEFFclave;nombre;creditos;clasificacion;periodo\r\nMAT01;"Historia; ""Universal""";0;Obligatoria;1\r\n');
  assert.equal(filas[0][0], 'clave');
  assert.equal(filas[1][1], 'Historia; "Universal"');
  const preparada = prepararAsignaturas(filas);
  assert.equal(preparada[0].asignatura?.creditos, 0);
  assert.equal(preparada[0].asignatura?.etapa_nombre, 'Bloque 1');
});

test('valida clasificación, periodo y duplicados sin descartar una clave de fila inválida', () => {
  const filas = prepararAsignaturas([
    ['clave', 'nombre', 'creditos', 'clasificacion', 'periodo'],
    ['MAT01', '', '5', '263', '1'],
    ['MAT01', 'Álgebra', '5,5', 'Optativa', '2'],
    ['MAT01', 'Otra', '3', '266', '3'],
    ['MAT02', 'Cálculo', '-1', 'Desconocida', '0'],
  ]);
  assert.deepEqual(filas[0].errores, ['Falta el nombre']);
  assert.equal(filas[1].asignatura?.creditos, 5.5);
  assert.equal(filas[1].asignatura?.clasificacion_clave, '264');
  assert.ok(filas[2].errores.includes('Clave repetida en el archivo'));
  assert.deepEqual(filas[3].errores, ['Créditos inválidos', 'Periodo inválido', 'Clasificación inválida']);
});

test('lee la primera hoja XLSX y exige encabezados', async () => {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([
    ['CLAVE_LEGADO', 'NOMBRE_ASIGNATURA', 'CREDITOS', 'CLASIFICACION_CLAVE', 'NUMERO_PERIODO', 'ETAPA_NOMBRE', 'CLAVE_CERTIFICACION'],
    ['MAT03', 'Ética', 0, 263, 4, 'Cuarto cuatrimestre', 456],
  ]), 'Retícula');
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['otra hoja']]), 'Ignorar');
  const datos = XLSX.write(libro, { bookType: 'xlsx', type: 'buffer' });
  const archivo = new File([datos], 'reticula.xlsx') as unknown as globalThis.File;
  const filas = prepararAsignaturas(await leerArchivoAsignaturas(archivo));
  assert.equal(filas.length, 1);
  assert.equal(filas[0].asignatura?.numero_periodo, 4);
  assert.equal(filas[0].asignatura?.creditos, 0);
  assert.equal(filas[0].asignatura?.etapa_nombre, 'Cuarto cuatrimestre');
  assert.equal(filas[0].asignatura?.clave_certificacion, 456);
  assert.throws(() => prepararAsignaturas([['clave', 'nombre'], ['1', 'Materia']]), /Faltan columnas/);
});
