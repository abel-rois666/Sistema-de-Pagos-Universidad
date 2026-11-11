import test from 'node:test';
import assert from 'node:assert/strict';
import type { Alumno, PaymentPlan } from '../src/types';
import { columnasEgresadosCSV, tituloEgresadosCSV } from '../src/reportes/exportacionEgresados';
import { detallePagosTitulacionCSV, detalleProgramasCSV, serializarTablaCSV, tablaAlumnosCSV, type ProgramaCSV } from '../src/reportes/detallesListadoCSV';
import { columnasListado, csvListado } from '../src/reportes/listadoGeneral';

const alumno = { id: 'a', nombre_completo: 'MARÍA DE LA CRUZ', matricula: '001', licenciatura: 'DERECHO', estatus: 'EGRESADO', email: 'FICTICIO@EXAMPLE.INVALID' } as Alumno;
const visibles = { nombre: true, licenciatura: true, estatus: true, ciclo: true, telefonos: true, email: false, pagoTitulacion: true, pagoCertificado: false, certificacion: true };
const contexto = { ciclosEgresoMap: { a: '2026-2' }, tieneKardexMap: { a: true }, pagoTitulacionMap: { a: 'Pago completo' }, pagoCertificadoMap: {}, certificacionMap: { a: 'DERECHO: Completado · OTRO: Sin registro' } };

test('egresados: el CSV por alumno conserva cabeceras, selección visible, orden recibido y presentación anterior', () => {
  const columnas = columnasEgresadosCSV(visibles, contexto);
  const tabla = tablaAlumnosCSV([alumno, { ...alumno, id: 'b', nombre_completo: 'OTRA PERSONA' }], columnas, '2026-11-10');
  assert.deepEqual(tabla.cabeceras, ['Nombre completo', 'Licenciatura', 'Estatus', 'Ciclo de egreso', 'Teléfonos', 'Pago de titulación', 'Trámite de certificación']);
  assert.equal(tabla.filas[0][0], 'María de la Cruz'); assert.equal(tabla.filas[1][0], 'Otra Persona');
  assert.equal(tabla.filas[0][3], '2026-2'); assert.equal(tabla.filas[1][3], 'Sin Kardex');
  assert.equal(tabla.filas[0][6], contexto.certificacionMap.a);
  assert.ok(!serializarTablaCSV(tabla).includes('Correo electrónico'));
  assert.equal(tituloEgresadosCSV('MARÍA DE LA CRUZ'), 'María de la Cruz');
});

test('egresados: varios programas mantienen estados independientes y el ciclo del alumno se rotula como referencia', () => {
  const programas: ProgramaCSV[] = ['2017_LD', '2001_LD'].map((clave, i) => ({ id: `p${i}`, alumno_id: 'a', plan_id: `plan${i}`, estatus: i ? 'CURSANDO' : 'EGRESADO', es_vigente: !i, planes_estudio: { nombre: `PLAN_${i}`, clave_legado: clave, tipo_periodo: 'SEMESTRAL', modalidad: 'ESCOLARIZADA', carreras: { nombre: 'DERECHO' } } }));
  const tabla = detalleProgramasCSV([alumno], programas, [{ alumno_id: 'a', alumno_programa_id: 'p0', id: 'f0', pago_certificado: 'COMPLETADO', tramite_completado: true }, { alumno_id: 'a', alumno_programa_id: 'p1', id: null, sin_ficha: true, tramite_completado: null }], columnasEgresadosCSV(visibles, contexto), '2026-11-10', true);
  assert.equal(tabla.filas.length, 2);
  assert.ok(tabla.cabeceras.includes('Último ciclo del historial del alumno (referencia)'));
  assert.ok(!tabla.cabeceras.includes('Ciclo de egreso'));
  assert.ok(!tabla.cabeceras.includes('Pago de titulación'));
  const p0 = tabla.filas.find(f => f.includes('p0'))!, p1 = tabla.filas.find(f => f.includes('p1'))!;
  assert.equal(p0[tabla.cabeceras.indexOf('Trámite del certificado')], 'Completado');
  assert.equal(p1[tabla.cabeceras.indexOf('Trámite del certificado')], 'Sin registro');
  assert.equal(p1[tabla.cabeceras.indexOf('Estatus del programa')], 'CURSANDO');
  assert.equal(p0[tabla.cabeceras.indexOf('Último ciclo del historial del alumno (referencia)')], '2026-2');
});

test('egresados: el detalle financiero usa únicamente alumnos filtrados y conserva varios planes y ciclos', () => {
  const plan = { id: 'pago1', alumno_id: 'a', no_plan_pagos: 'FOLIO', ciclo_escolar: '2027-1', tipo_plan: 'Titulación', concepto_1: 'PAGO', estatus_1: 'R-32474' } as PaymentPlan;
  const tabla = detallePagosTitulacionCSV([alumno], [plan, { ...plan, id: 'pago2', ciclo_escolar: '2025-2' }, { ...plan, id: 'excluido', alumno_id: 'b' }], [], true);
  assert.equal(tabla.filas.length, 2); assert.ok(tabla.filas.every(f => f.includes('Sin asociación a programa')));
  assert.ok(tabla.filas.flat().includes('2025-2')); assert.ok(!tabla.filas.flat().includes('excluido'));
});

test('el exportador compartido conserva exactamente el CSV anterior del Listado General, incluidas edad y fórmulas', () => {
  const alumnos = [{ ...alumno, nombre_completo: '=TEXTO, "PRUEBA"', fecha_nacimiento: '2000-11-11' }];
  const columnas = columnasListado(['email', 'edad', 'sexo', 'pagoTitulacion'], { pagoTitulacion: () => 'R-83' });
  assert.equal(serializarTablaCSV(tablaAlumnosCSV(alumnos, columnas, '2026-11-10')), csvListado(alumnos, columnas, '2026-11-10'));
});
