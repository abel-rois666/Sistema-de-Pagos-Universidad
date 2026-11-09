import test from 'node:test';
import assert from 'node:assert/strict';
import { crearFiltrosColumnasListado, filtrarColumnasListado, resumenFiltrosColumnas } from '../src/reportes/filtrosColumnasListado';
import { columnasListado, csvListado } from '../src/reportes/listadoGeneral';
import { pdfListadoGeneral } from '../src/reportes/exportarListadoGeneral';
import type { Alumno, PaymentPlan } from '../src/types';
import type { ResumenCertificacion } from '../src/certificacion/seguimiento';

const alumnos = [
  { id: 'a', nombre_completo: 'Ana', email: 'a@example.test', grado_actual: '2DO', sexo: 'M', fecha_nacimiento: '2000-11-10', estado_nacimiento: 'DF', estado_escolaridad: '15', estado: 'PUE' },
  { id: 'b', nombre_completo: 'Beto', email: '  ', grado_actual: '10MO', id_sexo: 251, fecha_nacimiento: '1990-11-09', estado_nacimiento: 'CDMX', estado_escolaridad: 'PUE', estado: '15' },
  { id: 'c', nombre_completo: 'Celia', grado_actual: null, sexo: 'OTRO', fecha_nacimiento: '2000-02-31', estado_nacimiento: null },
] as Alumno[];
const planes = [
  { id: 'p1', alumno_id: 'a', tipo_plan: 'Titulación', concepto_1: 'Pago', estatus_1: 'R-83 (Abono $500.00, Resta $1000.00)' },
  { id: 'p2', alumno_id: 'a', tipo_plan: 'Titulación', concepto_1: 'Pago', estatus_1: 'F-12306' },
  { id: 'p3', alumno_id: 'b', tipo_plan: 'Titulación', concepto_1: 'Pago', estatus_1: 'Texto sin comprobar' },
  { id: 'p4', alumno_id: 'c', tipo_plan: 'Cuatrimestral', concepto_1: 'Pago', estatus_1: 'PAGADO' },
] as PaymentPlan[];
const fichas: ResumenCertificacion[] = [
  { alumno_id: 'a', alumno_programa_id: 'ap1', programa: 'Programa: En trámite', pago_certificado: 'COMPLETADO', tramite_completado: false },
  { alumno_id: 'a', alumno_programa_id: null, pago_certificado: 'EN_CURSO', tramite_completado: true },
  { alumno_id: 'b', alumno_programa_id: 'ap2', pago_certificado: 'SIN_INICIAR', tramite_completado: false, fecha_inicio_tramite: '2026-10-01' },
];
const fecha = '2026-11-09';
const ids = (filas: readonly Alumno[]) => filas.map(a => a.id);

test('filtros opcionales: solo aparecen las columnas activadas y un filtro oculto no restringe', () => {
  const filtros = crearFiltrosColumnasListado(alumnos, ['email', 'sexo'], fecha, [], []);
  assert.deepEqual(filtros.map(f => f.id), ['email', 'sexo']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { grado: ['99'] })), ['a', 'b', 'c']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { email: ['Sin dato'], sexo: ['Hombre'] })), ['b']);
});

test('datos personales: entidades equivalentes, sexo legado, grados ordinales y faltantes conservan el valor mostrado', () => {
  const filtros = crearFiltrosColumnasListado(alumnos, ['grado', 'sexo', 'nacimiento', 'procedencia', 'residencia'], fecha, [], []);
  assert.deepEqual(filtros.find(f => f.id === 'grado')!.opciones, ['2', '10', 'Sin dato']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { nacimiento: ['Ciudad de México'] })), ['a', 'b']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { sexo: ['Mujer', 'Hombre'], residencia: ['Puebla'] })), ['a']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { procedencia: ['Puebla', 'Estado de México'] })), ['a', 'b']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { grado: ['Sin dato'] })), ['c']);
});

test('edad: años cumplidos, fecha de referencia, edad inválida y selección sin coincidencias', () => {
  const filtros = crearFiltrosColumnasListado(alumnos, ['edad'], fecha, [], []);
  assert.deepEqual(filtros[0].opciones, ['25', '36', 'Sin dato']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { edad: ['25', '36'] })), ['a', 'b']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { edad: ['Sin dato'] })), ['c']);
  const manana = crearFiltrosColumnasListado(alumnos, ['edad'], '2026-11-10', [], []);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, manana, { edad: ['25'] })), []);
  assert.deepEqual(resumenFiltrosColumnas(filtros, { edad: ['25', '36'] }), ['Edad: 25 años, 36 años']);
});

test('pago de titulación: varios planes unen estados sin duplicar y conservan abonos y folios F-', () => {
  const filtros = crearFiltrosColumnasListado(alumnos, ['pagoTitulacion'], fecha, planes, []);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { pagoTitulacion: ['Pago completo', 'Pago en curso'] })), ['a']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { pagoTitulacion: ['Revisar estado de pago'] })), ['b']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { pagoTitulacion: ['Sin plan'] })), ['c']);
});

test('certificado: pago y trámite independientes, coincidencia por estado estructurado y legado identificado', () => {
  const copia = JSON.stringify(fichas);
  const filtros = crearFiltrosColumnasListado(alumnos, ['pagoCertificado', 'certificacion'], fecha, [], fichas);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { pagoCertificado: ['Completado'], certificacion: ['En preparación'] })), ['a']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { certificacion: ['En trámite'] })), ['b']); // No coincide por texto del nombre del programa.
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { certificacion: ['Completado'] })), ['a']); // Ficha legada, sin reasignarla.
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { pagoCertificado: ['Sin registro'] })), ['c']);
  assert.deepEqual(ids(filtrarColumnasListado(alumnos, filtros, { pagoCertificado: ['Sin iniciar'], certificacion: ['En preparación'] })), []);
  assert.equal(JSON.stringify(fichas), copia);
});

test('exportación: usa todas las filas filtradas y omite filtros de columnas ocultas en el resumen', () => {
  const filtros = crearFiltrosColumnasListado(alumnos, ['sexo', 'email'], fecha, [], []);
  const seleccion = { sexo: ['Mujer'], edad: ['99'] };
  const filtrados = filtrarColumnasListado(alumnos, filtros, seleccion);
  const csv = csvListado(filtrados, columnasListado(['sexo', 'email']), fecha);
  assert.deepEqual(resumenFiltrosColumnas(filtros, seleccion), ['Sexo: Mujer']);
  assert.match(csv, /Ana/); assert.doesNotMatch(csv, /Beto|Celia/);
  assert.equal(csv.split('\r\n').length, 2);
});

test('PDF: muchos valores de filtros pasan de página antes de la tabla sin perder sus extremos', () => {
  const filtros = Array.from({ length: 85 }, (_, i) => `Filtro ${i}: Ciudad de México, Estado de México, Puebla, Sin dato`);
  const doc = pdfListadoGeneral([alumnos[0]], columnasListado(['sexo']), fecha, filtros);
  assert.ok(doc.getNumberOfPages() > 1);
  const salida = doc.output();
  assert.ok(salida.includes('Filtro 0:')); assert.ok(salida.includes('Filtro 84:')); assert.ok(salida.includes('Ana'));
});
