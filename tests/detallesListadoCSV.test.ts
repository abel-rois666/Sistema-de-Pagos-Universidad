import test from 'node:test';
import assert from 'node:assert/strict';
import type { Alumno, PaymentPlan } from '../src/types';
import type { ResumenCertificacion } from '../src/certificacion/seguimiento';
import { columnasListado } from '../src/reportes/listadoGeneral';
import { detallePagosTitulacionCSV, detalleProgramasCSV, serializarTablaCSV, type ProgramaCSV, type TablaCSV } from '../src/reportes/detallesListadoCSV';
import { consultarProgramasCSV, type FuenteProgramasCSV } from '../src/reportes/consultaProgramasCSV';

const alumno = { id: 'a', matricula: '00123', nombre_completo: 'PERSONA FICTICIA', estatus: 'ACTIVO' } as Alumno;
const programa = (id: string, clave = '2017_LD'): ProgramaCSV => ({ id, alumno_id: 'a', plan_id: `plan-${id}`, estatus: 'EGRESADO', es_vigente: true, planes_estudio: { nombre: 'PLAN · CON SEPARADORES', clave_legado: clave, tipo_periodo: 'CUATRIMESTRAL', modalidad: 'ESCOLARIZADA', carreras: { nombre: 'DERECHO' } } });
const ficha = (id: string): ResumenCertificacion => ({ id: `f-${id}`, alumno_id: 'a', alumno_programa_id: id, programa: 'No debe dividirse este texto', pago_certificado: 'COMPLETADO', tramite_completado: true });
const columnas = columnasListado(['email', 'pagoTitulacion', 'pagoCertificado', 'certificacion']);
const celda = (t: TablaCSV, fila: number, nombre: string) => t.filas[fila][t.cabeceras.indexOf(nombre)];

test('tres programas: estados y plan salen en columnas separadas, sin producto cartesiano ni parsear etiquetas', () => {
  const t = detalleProgramasCSV([alumno], [programa('p1'), programa('p2', '2001_LD'), programa('p3', '2009_DU')], [ficha('p1'), { ...ficha('p2'), id: null, sin_ficha: true }, { ...ficha('p3'), tramite_completado: false, fecha_inicio_tramite: null, pago_certificado: 'EN_CURSO' }], columnas, '2026-11-10', true);
  assert.equal(t.filas.length, 3);
  const p1 = t.filas.findIndex(f => f.includes('p1'));
  assert.equal(celda(t, p1, 'Pago del certificado'), 'Completado');
  assert.equal(celda(t, p1, 'Trámite del certificado'), 'Completado');
  assert.equal(celda(t, p1, 'Nombre del plan de estudios'), 'PLAN · CON SEPARADORES');
  assert.equal(celda(t, p1, 'plan_estudios_id'), 'plan-p1');
  const p2 = t.filas.findIndex(f => f.includes('p2'));
  assert.equal(celda(t, p2, 'Tiene ficha de certificación'), 'No');
  assert.equal(celda(t, p2, 'Pago del certificado'), 'Sin registro');
  const p3 = t.filas.findIndex(f => f.includes('p3'));
  assert.equal(celda(t, p3, 'Trámite del certificado'), 'En preparación');
  assert.equal(celda(t, p3, 'Pago del certificado'), 'En curso');
  assert.ok(t.cabeceras.includes('Estatus institucional'));
  assert.ok(!t.cabeceras.includes('Pago de titulación'));
  assert.ok(t.filas.every(f => f.length === t.cabeceras.length));
});

test('ficha sin programa y alumno sin programas se distinguen sin inventar asociaciones ni ocultar personas', () => {
  const legado = { ...ficha('p'), alumno_programa_id: null };
  const t = detalleProgramasCSV([alumno, { ...alumno, id: 'sin-programa' }], [programa('p')], [ficha('p'), legado], columnas, '2026-11-10', true);
  assert.deepEqual(t.filas.map(f => f[0]), ['ALUMNO_PROGRAMA', 'FICHA_SIN_PROGRAMA', 'ALUMNO_SIN_PROGRAMA']);
  assert.equal(celda(t, 1, 'alumno_programa_id'), '');
  assert.equal(celda(t, 1, 'ficha_certificacion_id'), legado.id);
  assert.equal(celda(t, 2, 'Pago del certificado'), 'Sin registro');
  assert.ok(t.filas.every(f => f.length === t.cabeceras.length));
});

test('la lectura cruzada o incompleta se rechaza, en lugar de exportar Sin registro falso', () => {
  assert.throws(() => detalleProgramasCSV([alumno], [programa('p')], [], columnas, '', false), /incompleto/);
  assert.throws(() => detalleProgramasCSV([alumno], [], [ficha('p')], columnas, '', false), /cambiaron/);
  assert.throws(() => detalleProgramasCSV([alumno], [programa('p')], [ficha('p'), ficha('p')], columnas, '', false), /cambió/);
  assert.throws(() => detalleProgramasCSV([alumno], [], [{ ...ficha('p'), alumno_programa_id: null, id: null }], columnas, '', false), /ficha anterior/);
  assert.throws(() => detalleProgramasCSV([alumno], [programa('p'), programa('p')], [ficha('p')], columnas, '', false), /cambiaron/);
});

test('pago no iniciado es distinto de ausencia y la principal desconocida no se convierte en No', () => {
  const t = detalleProgramasCSV([alumno], [{ ...programa('p'), es_vigente: null }], [{ ...ficha('p'), pago_certificado: 'SIN_INICIAR', tramite_completado: false }], columnas, '2026-11-10');
  assert.equal(celda(t, 0, 'Tiene ficha de certificación'), 'Sí');
  assert.equal(celda(t, 0, 'Pago del certificado'), 'Sin iniciar');
  assert.equal(celda(t, 0, 'Programa principal'), 'Sin dato');
  assert.ok(!t.cabeceras.includes('alumno_id'));
});

const planPago = (id: string, ciclo: string, estatus: string): PaymentPlan => ({ id, alumno_id: 'a', ciclo_id: ciclo, ciclo_escolar: '2026-2', no_plan_pagos: 'FOLIO REPETIDO', tipo_plan: 'Titulación', concepto_1: 'Pago', cantidad_1: 1000, estatus_1: estatus } as PaymentPlan);
test('detalle financiero conserva IDs distintos con mismo folio, todos los ciclos y las reglas de abonos y facturas', () => {
  const t = detallePagosTitulacionCSV([alumno], [planPago('uno', 'sem', 'F-12306'), planPago('dos', 'cuat', 'Abono $500'), { ...planPago('fuera', 'sem', 'R-32474'), alumno_id: 'otro' }, { ...planPago('ordinario', 'sem', 'R-83 (Efectivo)'), tipo_plan: 'Semestral' }], [{ id: 'sem', nombre: '2026-2', tipo_periodo: 'Semestral' }, { id: 'cuat', nombre: '2026-2', tipo_periodo: 'Cuatrimestral' }], true);
  assert.equal(t.filas.length, 2);
  const uno = t.filas.findIndex(f => f.includes('uno')), dos = t.filas.findIndex(f => f.includes('dos'));
  assert.equal(celda(t, uno, 'Estado del pago de titulación'), 'Pago completo');
  assert.equal(celda(t, dos, 'Estado del pago de titulación'), 'Pago en curso');
  assert.equal(celda(t, uno, 'Tipo del ciclo'), 'Semestral');
  assert.equal(celda(t, dos, 'Tipo del ciclo'), 'Cuatrimestral');
  assert.ok(t.filas.every(f => f.includes('Sin asociación a programa') && f.length === t.cabeceras.length));
  assert.ok(!t.cabeceras.includes('plan_estudios_id'));
  assert.equal(detallePagosTitulacionCSV([{ ...alumno, id: 'ninguno' }], [planPago('x', 'sem', 'R-83')], []).filas.length, 0);
});

test('CSV conserva comillas, saltos y matrícula, protege fórmulas y utiliza UTF-8 con BOM', () => {
  const csv = serializarTablaCSV({ cabeceras: ['Matrícula', 'Texto'], filas: [['00123', 'ÁRBOL, "PRUEBA"\nLÍNEA'], ['  =1+1', '@FORMULA']] });
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"00123"'));
  assert.ok(csv.includes('"ÁRBOL, ""PRUEBA""\nLÍNEA"'));
  assert.ok(csv.includes('"\'  =1+1"'));
  assert.ok(csv.includes('"\'@FORMULA"'));
});

test('consulta todos los alumnos únicos en lotes y pagina programas y fichas sin truncar a 500', async () => {
  const llamadas: { ids: string[]; desde: number }[] = [];
  const fuente: FuenteProgramasCSV = {
    programas: async p => { llamadas.push(p); if (p.ids[0] === '0') return p.desde === 0 ? Array.from({ length: 500 }, (_, n) => programa(String(n))) : p.desde === 500 ? [programa('ultimo-0')] : []; return p.desde === 0 ? [programa(`ultimo-${p.ids[0]}`)] : []; },
    certificaciones: async () => []
  };
  const ids = [...Array.from({ length: 201 }, (_, n) => String(n)), '0'];
  const datos = await consultarProgramasCSV(ids, fuente, new AbortController().signal);
  assert.equal(datos.programas.length, 503);
  assert.deepEqual(llamadas.map(l => [l.ids.length, l.desde]), [[100, 0], [100, 500], [100, 501], [100, 0], [100, 1], [1, 0], [1, 1]]);
});

test('un límite instalado menor a la página no trunca el detalle académico', async () => {
  const registros = Array.from({ length: 7 }, (_, i) => programa(String(i))), offsets: number[] = [];
  const datos = await consultarProgramasCSV(['a'], { programas: async p => { offsets.push(p.desde); return registros.slice(p.desde, p.desde + 2); }, certificaciones: async () => [] }, new AbortController().signal);
  assert.equal(datos.programas.length, 7); assert.deepEqual(offsets, [0, 2, 4, 6, 7]);
});

test('fallo o cancelación no devuelve datos parciales ni inicia peticiones de alumnos vacíos', async () => {
  let lecturas = 0;
  const fuente: FuenteProgramasCSV = { programas: async () => { lecturas++; return []; }, certificaciones: async () => { throw new Error('Fallo de lectura'); } };
  assert.deepEqual(await consultarProgramasCSV([], fuente, new AbortController().signal), { programas: [], certificaciones: [] });
  assert.equal(lecturas, 0);
  await assert.rejects(consultarProgramasCSV(['a'], fuente, new AbortController().signal), /Fallo de lectura/);
  const control = new AbortController(); control.abort();
  await assert.rejects(consultarProgramasCSV(['a'], fuente, control.signal), { name: 'AbortError' });
});
