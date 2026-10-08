import assert from 'node:assert/strict';
import test from 'node:test';
import { asignarDocentesYGenerar } from '../src/horarios/asignacionAutomatica.ts';
import { crearDocxHorario } from '../src/horarios/exportar.ts';
import { generarHorario, validarSesiones } from '../src/horarios/motor.ts';
import { esMateriaComplementaria, prepararBorradorHorario, seleccionCompletaHorario } from '../src/horarios/seleccion.ts';
import JSZip from 'jszip';
import type { EntradaHorario } from '../src/horarios/types.ts';

const entrada = (): EntradaHorario => ({
  grupos: [
    { id: 'g1', codigo: '1A', cicloId: 'ciclo', planId: 'plan', turno: 'MATUTINO' },
    { id: 'g2', codigo: '1B', cicloId: 'ciclo', planId: 'plan', turno: 'MATUTINO' },
  ],
  docentes: [{ id: 'd1', nombre: 'Ana', activo: true, planes: ['plan'],
    asignaturasPreferidas: ['a1', 'a2', 'a3'], gruposRestringidos: [],
    disponibilidad: [{ dia: 1, inicio: 7, fin: 13 }] }],
  cargas: [
    { id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Historia', horasTotales: 1,
      horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' },
    { id: 'c2', grupoId: 'g1', asignaturaId: 'a2', asignatura: 'Matemáticas', horasTotales: 1,
      horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' },
    { id: 'c3', grupoId: 'g2', asignaturaId: 'a3', asignatura: 'Inglés', clasificacionClave: '266',
      clasificacionNombre: 'Complementaria', horasTotales: 1,
      horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' },
  ],
  configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1 },
});

test('omitir un grupo y una materia filtra el borrador sin cambiar la carga original', () => {
  const datos = entrada();
  const borrador = prepararBorradorHorario(datos, new Set(['g1']), new Set(['c1', 'c3']));
  assert.deepEqual(borrador.grupos.map(grupo => grupo.id), ['g1']);
  assert.deepEqual(borrador.cargas.map(carga => carga.id), ['c1']);
  assert.equal(datos.grupos.length, 2);
  assert.equal(datos.cargas.length, 3);
  const horario = generarHorario(borrador);
  assert.deepEqual(horario.sesiones.map(sesion => sesion.cargaId), ['c1']);
  assert.deepEqual(validarSesiones(horario.sesiones, borrador), []);
});

test('la generación automática solo propone docentes para materias incluidas', async () => {
  const datos = entrada();
  datos.cargas.forEach(carga => { carga.docenteId = null; });
  const borrador = prepararBorradorHorario(datos, new Set(['g1']), new Set(['c2']));
  const resultado = await asignarDocentesYGenerar(borrador, { permitirNoPreferidas: false, cargasFijas: new Set() });
  assert.equal(resultado.completo, true);
  assert.deepEqual(resultado.detalle.map(item => item.cargaId), ['c2']);
  assert.deepEqual(resultado.sesiones.map(sesion => sesion.cargaId), ['c2']);
  assert.ok(datos.cargas.every(carga => carga.docenteId === null));
});

test('una selección parcial no cumple la condición de publicación completa', () => {
  const datos = entrada();
  const todosGrupos = new Set(datos.grupos.map(grupo => grupo.id));
  const todasMaterias = new Set(datos.cargas.map(carga => carga.id));
  assert.equal(seleccionCompletaHorario(datos, todosGrupos, todasMaterias), true);
  assert.equal(seleccionCompletaHorario(datos, new Set(['g1']), todasMaterias), false);
  assert.equal(seleccionCompletaHorario(datos, todosGrupos, new Set(['c1', 'c3'])), false);
  assert.equal(seleccionCompletaHorario(datos, todosGrupos, new Set(['c1', 'c2'])), true);
});

test('la clave de clasificación decide qué materias son complementarias', () => {
  const ingles = entrada().cargas[2];
  assert.equal(esMateriaComplementaria(ingles), true);
  assert.equal(esMateriaComplementaria({ ...ingles, clasificacionClave: '263' }), false);
  assert.equal(esMateriaComplementaria({ ...ingles, clasificacionClave: null }), true);
});

test('un grupo con solo complementarias puede quedar sin sesiones si otras materias siguen incluidas', () => {
  const datos = entrada();
  datos.grupos[1].soloComplementarias = true;
  const borrador = prepararBorradorHorario(datos, new Set(['g1', 'g2']), new Set(['c1', 'c2']));
  const resultado = generarHorario(borrador);
  assert.ok(resultado.sesiones.length > 0);
  assert.deepEqual(validarSesiones(resultado.sesiones, borrador), []);
  assert.equal(seleccionCompletaHorario(datos, new Set(['g1', 'g2']), new Set(['c1', 'c2'])), true);
  const vacio = prepararBorradorHorario(datos, new Set(['g2']), new Set());
  assert.ok(generarHorario(vacio).incidencias.some(incidencia => incidencia.codigo === 'SIN_ASIGNATURAS'));
});

test('la exportación del borrador parcial solo muestra materias incluidas', async () => {
  const borrador = prepararBorradorHorario(entrada(), new Set(['g1']), new Set(['c1']));
  const sesiones = generarHorario(borrador).sesiones;
  const docx = await crearDocxHorario(borrador, sesiones, '2027-1', { tipo: 'grupos' });
  const zip = await JSZip.loadAsync(await docx.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  assert.ok(xml?.includes('Historia'));
  assert.ok(!xml?.includes('Matemáticas'));
  assert.ok(!xml?.includes('Inglés'));
});
