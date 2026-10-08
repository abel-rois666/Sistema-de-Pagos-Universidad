import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { opcionesVistaHorario, seccionesCuadriculaHorario } from '../src/horarios/cuadricula.ts';
import { crearDocxHorario, crearPdfHorario } from '../src/horarios/exportar.ts';
import { crearXlsxHorario } from '../src/horarios/exportarXlsx.ts';
import { aplicarHorasPresencialesMasivas } from '../src/horarios/horasMasivas.ts';
import { agruparVacantes, idVacante } from '../src/horarios/vacantes.ts';
import type { EntradaHorario, SesionHorario } from '../src/horarios/types.ts';

const entrada = (): EntradaHorario => ({
  grupos: [
    { id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO',
      carreraNombre: 'Licenciatura en Derecho', planNombre: 'Plan 2025', rvoe: 'SEP 123' },
    { id: 'g2', codigo: '1B', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO' },
  ],
  docentes: [{ id: 'd1', nombre: 'Ana', activo: true, planes: ['p1'],
    asignaturasPreferidas: ['a1', 'a2'], gruposRestringidos: [],
    disponibilidad: [{ dia: 1, inicio: 7, fin: 13 }] }],
  cargas: [
    { id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Derecho Civil', asignaturaClave: 'DER101',
      horasTotales: 2, horasPresenciales: 2, horasAsincronas: 0, docenteId: 'd1' },
    { id: 'c2', grupoId: 'g2', asignaturaId: 'a2', asignatura: 'Historia del Derecho', asignaturaClave: 'DER102',
      horasTotales: 1, horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' },
  ],
  configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1 },
});
const sesiones = (): SesionHorario[] => [
  { cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1', docenteId: 'd1', dia: 1, inicio: 7, fin: 8 },
  { cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1', docenteId: 'd1', dia: 1, inicio: 9, fin: 10 },
  { cargaId: 'c2', grupoId: 'g2', asignaturaId: 'a2', docenteId: 'd1', dia: 1, inicio: 8, fin: 9 },
];

test('la cuadrícula incluye días y horas del turno, materias, clave y huecos internos', () => {
  const [seccion] = seccionesCuadriculaHorario(entrada(), sesiones(), '2027-1', { tipo: 'grupos', ids: ['g1'] });
  assert.deepEqual(seccion.dias, [1, 2, 3, 4, 5]);
  assert.deepEqual(seccion.horas, [7, 8, 9, 10, 11, 12]);
  assert.equal(seccion.filas[0][1], 'Derecho Civil');
  assert.equal(seccion.filas[1][1], 'HORA LIBRE');
  assert.equal(seccion.materias[0][0], 'DER101');
  assert.ok(seccion.encabezado.some(linea => linea.includes('SEP 123')));
});

test('vista y exportación admiten varios grupos seleccionados', async () => {
  const datos = entrada();
  const horarios = sesiones();
  const vista = { tipo: 'grupos' as const, ids: ['g2'] };
  assert.deepEqual(seccionesCuadriculaHorario(datos, horarios, '2027-1', vista).map(seccion => seccion.id), ['g2']);
  const pdf = crearPdfHorario(datos, horarios, '2027-1', vista);
  assert.equal(pdf.getNumberOfPages(), 1);
  const docx = await crearDocxHorario(datos, horarios, '2027-1', vista);
  const zip = await JSZip.loadAsync(await docx.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  assert.ok(xml?.includes('Historia del Derecho'));
  assert.ok(!xml?.includes('Derecho Civil'));
  assert.equal(crearPdfHorario(datos, horarios, '2027-1', { tipo: 'grupos' }).getNumberOfPages(), 2);
});

test('borrador y versión consultada ordenan grupos por licenciatura, turno y nombre', () => {
  const datos = entrada();
  const base = datos.grupos[0];
  datos.grupos = [
    { ...base, id: 'p1', codigo: '1A', carreraNombre: 'Psicología' },
    { ...base, id: 'a3', codigo: '1A', carreraNombre: 'Administración', turno: 'VESPERTINO' },
    { ...base, id: 'a2', codigo: '10A', carreraNombre: 'administracion' },
    { ...base, id: 'a4', codigo: '1A', carreraNombre: 'Administración', turno: 'MIXTO' },
    { ...base, id: 'a1', codigo: '2A', carreraNombre: 'ADMINISTRACIÓN' },
  ];
  const original = datos.grupos.map(grupo => grupo.id);
  const esperado = ['a1', 'a2', 'a4', 'a3', 'p1'];
  assert.deepEqual(opcionesVistaHorario(datos, 'grupos').map(grupo => grupo.id), esperado);
  assert.deepEqual(seccionesCuadriculaHorario(datos, [], '2027-1', { tipo: 'grupos' })
    .map(seccion => seccion.id), esperado);
  assert.deepEqual(seccionesCuadriculaHorario(datos, [], '2027-1',
    { tipo: 'grupos', ids: ['p1', 'a3', 'a1'] }).map(seccion => seccion.id), ['a1', 'a3', 'p1']);
  assert.deepEqual(datos.grupos.map(grupo => grupo.id), original);
});

test('la cuadrícula docente distingue las materias por grupo', () => {
  const [seccion] = seccionesCuadriculaHorario(entrada(), sesiones(), '2027-1',
    { tipo: 'docentes', ids: ['d1'] });
  assert.deepEqual(seccion.dias, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([seccion.horas[0], seccion.horas.at(-1)], [7, 20]);
  assert.equal(seccion.filas[0][1], 'Derecho Civil\nDER101 · 1A');
  assert.equal(seccion.filas[1][1], 'Historia del Derecho\nDER102 · 1B');
  assert.equal(seccion.filas[10][1], '');
  assert.equal(seccion.noDisponibles[10][0], true);
  assert.equal(seccion.noDisponibles[0][1], true);
  assert.equal(seccion.noDisponibles[3][0], false);
  assert.deepEqual(seccion.totalesDiarios, [3, 0, 0, 0, 0, 0]);
  assert.ok(seccion.materias.some(materia => materia.at(-1) === '1B'));
});

test('la exportación docente marca las horas sin disponibilidad y conserva clave y grupo', async () => {
  const datos = entrada();
  const vista = { tipo: 'docentes' as const, ids: ['d1'] };
  const docx = await crearDocxHorario(datos, sesiones(), '2027-1', vista);
  const zip = await JSZip.loadAsync(await docx.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  assert.ok(xml?.includes('DER101 · 1A'));
  assert.ok(xml?.includes('HORAS POR DÍA'));
  assert.ok(xml?.includes('w:shd w:fill="BEC2C7"'));
  assert.ok(crearPdfHorario(datos, sesiones(), '2027-1', vista).output('arraybuffer').byteLength > 2000);
});

test('Excel exporta la cuadrícula docente, detalle y horas no disponibles', async () => {
  const datos = entrada();
  datos.cargas[0].horasTotales = 4;
  datos.cargas[0].horasAsincronas = 2;
  const archivo = await crearXlsxHorario(datos, sesiones(), '2027-1', { tipo: 'docentes', ids: ['d1'] });
  assert.equal(archivo.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());
  assert.equal(libro.worksheets.length, 1);
  const hoja = libro.worksheets[0];
  const texto = hoja.getSheetValues().map(fila => Array.isArray(fila) ? fila.join(' ') : '').join(' ');
  assert.ok(texto.includes('Docente: Ana'));
  assert.ok(texto.includes('DER101'));
  assert.ok(texto.includes('Historia del Derecho'));
  assert.ok(texto.includes('HORAS POR DÍA'));
  assert.ok(texto.includes('Trabajo asíncrono sin horario fijo'));
  assert.ok(texto.includes('2 h/semana'));
  let filaPrimeraHora = 0;
  hoja.eachRow(fila => { if (fila.getCell(1).value === '07:00 a 08:00') filaPrimeraHora = fila.number; });
  assert.ok(filaPrimeraHora > 0);
  assert.equal(hoja.getCell(filaPrimeraHora, 3).fill.type, 'pattern');
  assert.ok(hoja.views.some(vista => vista.state === 'frozen'));
  await assert.rejects(crearXlsxHorario(datos, sesiones(), '2027-1', { tipo: 'grupos' }), /docentes y vacantes/);
});

test('la vista docente abre otra vacante ante empalmes de la misma licenciatura', async () => {
  const datos = entrada();
  datos.grupos[1].carreraNombre = 'LICENCIATURA EN DERECHO';
  datos.grupos.push({ ...datos.grupos[0], id: 'g3', codigo: '1P', planId: 'p2',
    carreraNombre: 'Licenciatura en Psicología', planNombre: 'Plan Psicología' });
  datos.cargas.push({ ...datos.cargas[0], id: 'c3', grupoId: 'g3', asignaturaId: 'a3',
    asignatura: 'Psicología General', asignaturaClave: 'PSI101' });
  datos.cargas.push({ ...datos.cargas[0], id: 'c4', grupoId: 'g2', asignaturaId: 'a4',
    asignatura: 'Derecho Mercantil', asignaturaClave: 'DER103' });
  datos.cargas.forEach(carga => { carga.docenteId = idVacante(carga.id); });
  const horarios: SesionHorario[] = [
    { cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1', docenteId: idVacante('c1'), dia: 1, inicio: 7, fin: 8 },
    { cargaId: 'c2', grupoId: 'g2', asignaturaId: 'a2', docenteId: idVacante('c2'), dia: 1, inicio: 7, fin: 8 },
    { cargaId: 'c3', grupoId: 'g3', asignaturaId: 'a3', docenteId: idVacante('c3'), dia: 2, inicio: 7, fin: 8 },
    { cargaId: 'c4', grupoId: 'g2', asignaturaId: 'a4', docenteId: idVacante('c4'), dia: 3, inicio: 7, fin: 8 },
  ];
  const agrupadas = agruparVacantes(datos, horarios);
  Object.assign(datos, agrupadas.entrada);
  horarios.splice(0, horarios.length, ...agrupadas.sesiones);
  const opciones = opcionesVistaHorario(datos, 'docentes', horarios);
  assert.equal(opciones.length, 3);
  assert.ok(opciones.every(opcion => opcion.nombre.startsWith('Vacante 1 · Licenciatura')
    || opcion.nombre.startsWith('Vacante 2 · Licenciatura')));
  const derecho = opciones.filter(opcion => opcion.nombre.toLowerCase().includes('derecho'));
  assert.deepEqual(derecho.map(opcion => opcion.nombre.split(' · ')[0]), ['Vacante 1', 'Vacante 2']);
  const secciones = seccionesCuadriculaHorario(datos, horarios, '2027-1', { tipo: 'docentes' });
  const primera = secciones.find(seccion => seccion.id === derecho[0].id)!;
  const segunda = secciones.find(seccion => seccion.id === derecho[1].id)!;
  assert.equal(primera.filas[0][1], 'Derecho Civil\nDER101 · 1A');
  assert.equal(segunda.filas[0][1], 'Historia del Derecho\nDER102 · 1B');
  assert.equal(primera.filas[0][3], 'Derecho Mercantil\nDER103 · 1B');
  assert.equal(primera.totalesDiarios[0], 1);
  assert.equal(primera.noDisponibles[0][0], false);
  assert.ok(primera.encabezado.some(linea => linea.includes('BORRADOR')));
  const vista = { tipo: 'docentes' as const, ids: [derecho[0].id] };
  assert.equal(seccionesCuadriculaHorario(datos, horarios, '2027-1', vista).length, 1);
  const docx = await crearDocxHorario(datos, horarios, '2027-1', vista);
  const zip = await JSZip.loadAsync(await docx.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  assert.ok(xml?.includes('DER101 · 1A'));
  assert.ok(xml?.includes('DER103 · 1B'));
  assert.ok(!xml?.includes('DER102 · 1B'));
  assert.ok(!xml?.includes('Psicología General'));
  assert.ok(crearPdfHorario(datos, horarios, '2027-1', vista).output('arraybuffer').byteLength > 2000);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await (await crearXlsxHorario(datos, horarios, '2027-1', vista)).arrayBuffer());
  assert.equal(libro.worksheets.length, 1);
  const textoExcel = libro.worksheets[0].getSheetValues().map(fila => Array.isArray(fila) ? fila.join(' ') : '').join(' ');
  assert.ok(textoExcel.includes('DER101'));
  assert.ok(textoExcel.includes('DER103'));
  assert.ok(!textoExcel.includes('DER102'));
  assert.ok(!textoExcel.includes('Psicología General'));
  const todos = new ExcelJS.Workbook();
  await todos.xlsx.load(await (await crearXlsxHorario(datos, horarios, '2027-1', { tipo: 'docentes' })).arrayBuffer());
  assert.equal(todos.worksheets.length, 3);
  assert.equal(new Set(todos.worksheets.map(hoja => hoja.name)).size, 3);
  assert.ok(todos.worksheets.every(hoja => hoja.name.length <= 31));
});

test('tres materias simultáneas de una licenciatura necesitan tres vacantes', () => {
  const datos = entrada();
  datos.grupos[1].carreraNombre = datos.grupos[0].carreraNombre;
  datos.grupos.push({ ...datos.grupos[0], id: 'g3', codigo: '1C' });
  datos.cargas.push({ ...datos.cargas[0], id: 'c3', grupoId: 'g3', asignaturaId: 'a3',
    asignatura: 'Derecho Penal', asignaturaClave: 'DER103' });
  datos.cargas.forEach(carga => { carga.docenteId = idVacante(carga.id); });
  const horarios = datos.cargas.map(carga => ({ cargaId: carga.id, grupoId: carga.grupoId,
    asignaturaId: carga.asignaturaId, docenteId: idVacante(carga.id), dia: 1 as const, inicio: 7, fin: 8 }));
  const agrupadas = agruparVacantes(datos, horarios);
  Object.assign(datos, agrupadas.entrada);
  horarios.splice(0, horarios.length, ...agrupadas.sesiones);
  const opciones = opcionesVistaHorario(datos, 'docentes', horarios);
  assert.deepEqual(opciones.map(opcion => opcion.nombre.split(' · ')[0]),
    ['Vacante 1', 'Vacante 2', 'Vacante 3']);
  const secciones = seccionesCuadriculaHorario(datos, horarios, '2027-1', { tipo: 'docentes' });
  assert.ok(secciones.every(seccion => seccion.materias.length === 1));
});

test('sin nombre de carrera, las vacantes de planes distintos quedan separadas', () => {
  const datos = entrada();
  datos.grupos.forEach(grupo => { grupo.carreraNombre = null; });
  datos.grupos[1].planId = 'p2';
  datos.cargas.forEach(carga => { carga.docenteId = idVacante(carga.id); });
  Object.assign(datos, agruparVacantes(datos, []).entrada);
  const opciones = opcionesVistaHorario(datos, 'docentes');
  assert.equal(opciones.length, 2);
  assert.notEqual(opciones[0].id, opciones[1].id);
  assert.ok(opciones.every(opcion => opcion.nombre.includes('licenciatura sin dato')));
});

test('el reparto común de Mixto calcula horas asíncronas sin tocar materias omitidas', () => {
  const datos = entrada();
  datos.grupos[0].turno = 'MIXTO';
  datos.cargas[0].horasTotales = 4;
  datos.cargas[0].horasPresenciales = null;
  datos.cargas[0].horasAsincronas = null;
  datos.cargas.push({ ...datos.cargas[0], id: 'c3', asignaturaId: 'a3', asignatura: 'Ética', horasTotales: 3 });
  const resultado = aplicarHorasPresencialesMasivas(datos, 2, new Set(['g1']), new Set(['c1', 'c3']));
  assert.equal(resultado.cantidad, 2);
  assert.deepEqual(resultado.entrada.cargas.slice(0, 3).map(carga => [carga.horasPresenciales, carga.horasAsincronas]),
    [[2, 2], [1, 0], [2, 1]]);
  assert.equal(datos.cargas[0].horasPresenciales, null);
});

test('el reparto común rechaza materias cortas y exceso de ocho horas por grupo', () => {
  const datos = entrada();
  datos.grupos[0].turno = 'MIXTO';
  datos.cargas.push(...[3, 4, 5].map(numero => ({ ...datos.cargas[0], id: `c${numero}`, asignaturaId: `a${numero}` })));
  assert.throws(() => aplicarHorasPresencialesMasivas(datos, 3, new Set(['g1']),
    new Set(['c1', 'c3', 'c4', 'c5'])), /horas semanales/);
  datos.cargas.forEach(carga => { if (carga.grupoId === 'g1') carga.horasTotales = 4; });
  assert.throws(() => aplicarHorasPresencialesMasivas(datos, 3, new Set(['g1']),
    new Set(['c1', 'c3', 'c4', 'c5'])), /ocho|8/);
  assert.throws(() => aplicarHorasPresencialesMasivas(datos, NaN, new Set(['g1']), new Set(['c1'])), /entero/);
});
