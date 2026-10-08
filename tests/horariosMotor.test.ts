import assert from 'node:assert/strict';
import test from 'node:test';
import { docentesElegibles, evaluarHoras, generarHorario, validarEntradas, validarSesiones } from '../src/horarios/motor.ts';
import { horasLibresEntreClases } from '../src/horarios/reglasJornada.ts';
import { idVacante } from '../src/horarios/vacantes.ts';
import { crearDocxHorario, crearPdfHorario } from '../src/horarios/exportar.ts';
import JSZip from 'jszip';
import type { CargaHorario, DocenteHorario, EntradaHorario, GrupoHorario } from '../src/horarios/types.ts';

const grupo = (turno: GrupoHorario['turno'] = 'MATUTINO'): GrupoHorario => ({ id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno });
const docente = (): DocenteHorario => ({
  id: 'd1', nombre: 'Ana', activo: true, planes: ['p1'], asignaturasPreferidas: ['a1'], gruposRestringidos: [],
  disponibilidad: [1, 2, 3, 4, 5, 6].map(dia => ({ dia: dia as 1 | 2 | 3 | 4 | 5 | 6, inicio: 7, fin: 21 })),
});
const carga = (horas = 3): CargaHorario => ({ id: 'ca1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Historia', horasTotales: horas, horasPresenciales: horas, horasAsincronas: 0, docenteId: 'd1' });
const entrada = (turno: GrupoHorario['turno'] = 'MATUTINO', horas = 3): EntradaHorario => ({ grupos: [grupo(turno)], docentes: [docente()], cargas: [carga(horas)], configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1 } });

test('genera bloques de 60 minutos dentro del turno y no más de cuatro horas continuas por sesión', () => {
  const datos = entrada('MATUTINO', 5);
  const resultado = generarHorario(datos);
  assert.equal(resultado.incidencias.filter(i => !i.codigo.startsWith('HUECO_')).length, 0);
  assert.equal(resultado.sesiones.reduce((n, s) => n + s.fin - s.inicio, 0), 5);
  assert.ok(resultado.sesiones.every(s => s.inicio >= 7 && s.fin <= 13 && s.fin - s.inicio <= 4));
  assert.deepEqual(validarSesiones(resultado.sesiones, datos), []);
  assert.equal(resultado.incidencias.some(i => i.codigo.startsWith('JORNADA_CORTA_')), false);
  assert.deepEqual([...new Set(resultado.sesiones.map(s => s.dia))].map(dia =>
    resultado.sesiones.filter(s => s.dia === dia).reduce((n, s) => n + s.fin - s.inicio, 0)), [3, 2]);
});

test('informa jornadas cortas por nombre y día sin bloquear el horario', () => {
  const datos = entrada('MATUTINO', 1);
  datos.docentes[0].disponibilidad = [{ dia: 1, inicio: 7, fin: 8 }];
  datos.configuracion.minHorasGrupo = 3;
  datos.configuracion.minHorasDocente = 2;
  const resultado = generarHorario(datos);
  assert.equal(resultado.sesiones.length, 1);
  assert.match(resultado.incidencias.find(i => i.codigo === 'JORNADA_CORTA_GRUPO')?.mensaje || '', /1A.*Lunes/);
  assert.match(resultado.incidencias.find(i => i.codigo === 'JORNADA_CORTA_DOCENTE')?.mensaje || '', /Ana.*Lunes/);
  assert.deepEqual(validarSesiones(resultado.sesiones, datos), []);
  datos.configuracion.minHorasGrupo = 0;
  assert.ok(validarEntradas(datos).some(i => i.codigo === 'JORNADA_INVALIDA'));
  datos.configuracion.minHorasGrupo = 1;
  datos.configuracion.minHorasDocente = 1;
  assert.equal(validarEntradas(datos).some(i => i.codigo === 'JORNADA_INVALIDA'), false);
  assert.equal(generarHorario(datos).incidencias.some(i => i.codigo.startsWith('JORNADA_CORTA_')), false);
});

test('los avisos de huecos identifican al docente y el día', () => {
  const datos = entrada('MATUTINO', 1);
  datos.cargas.push({ ...carga(1), id: 'ca2', asignaturaId: 'a2', asignatura: 'Geografía' });
  datos.docentes[0].disponibilidad = [
    { dia: 1, inicio: 7, fin: 8 }, { dia: 1, inicio: 11, fin: 12 },
  ];
  const resultado = generarHorario(datos);
  assert.equal(resultado.sesiones.length, 2);
  assert.match(resultado.incidencias.find(i => i.codigo === 'HUECO_DOCENTE')?.mensaje || '', /Ana.*3.*Lunes/);
  assert.match(resultado.incidencias.find(i => i.codigo === 'HUECO_GRUPO')?.mensaje || '', /1A.*3.*Lunes/);
});

test('una materia no se divide con horas libres entre sus clases del mismo día', () => {
  const datos = entrada('VESPERTINO', 3);
  datos.docentes[0].disponibilidad = [
    { dia: 2, inicio: 16, fin: 17 }, { dia: 2, inicio: 18, fin: 20 },
  ];
  const resultado = generarHorario(datos);
  assert.equal(resultado.sesiones.length, 0);
  assert.ok(resultado.incidencias.some(incidencia => incidencia.codigo === 'SIN_ESPACIO'));
  const separadas = [
    { cargaId: 'ca1', grupoId: 'g1', asignaturaId: 'a1', docenteId: 'd1', dia: 2 as const, inicio: 16, fin: 17 },
    { cargaId: 'ca1', grupoId: 'g1', asignaturaId: 'a1', docenteId: 'd1', dia: 2 as const, inicio: 18, fin: 20 },
  ];
  assert.equal(validarSesiones(separadas, datos).filter(i => i.codigo === 'MATERIA_DISCONTINUA').length, 1);
  assert.equal(evaluarHoras(datos, separadas).incidencias.filter(i => i.codigo === 'MATERIA_DISCONTINUA').length, 1);
  datos.docentes[0].disponibilidad.push({ dia: 3, inicio: 16, fin: 18 });
  const repartido = generarHorario(datos);
  assert.equal(repartido.sesiones.reduce((total, sesion) => total + sesion.fin - sesion.inicio, 0), 3);
  assert.deepEqual(validarSesiones(repartido.sesiones, datos), []);
});

test('los huecos docentes se miden por turno, sin unir sus clases matutinas y vespertinas', () => {
  assert.deepEqual(horasLibresEntreClases([12, 16], 1), []);
  assert.deepEqual(horasLibresEntreClases([7, 20], 1), []);
  assert.deepEqual(horasLibresEntreClases([7, 10, 16, 20], 1), [8, 9, 17, 18, 19]);
  assert.deepEqual(horasLibresEntreClases([7, 10], 1, 'MATUTINO'), [8, 9]);
  const datos = entrada('MATUTINO', 1);
  datos.grupos.push({ ...grupo('VESPERTINO'), id: 'g2', codigo: '1B' });
  datos.cargas.push({ ...carga(1), id: 'ca2', grupoId: 'g2', asignaturaId: 'a2', asignatura: 'Geografía' });
  datos.configuracion.maxHuecoDocente = 0;
  const sesiones = [
    { cargaId: 'ca1', grupoId: 'g1', asignaturaId: 'a1', docenteId: 'd1', dia: 1 as const, inicio: 7, fin: 8 },
    { cargaId: 'ca2', grupoId: 'g2', asignaturaId: 'a2', docenteId: 'd1', dia: 1 as const, inicio: 20, fin: 21 },
  ];
  const resultado = evaluarHoras(datos, sesiones);
  assert.equal(resultado.huecosDocente.d1, 0);
  assert.equal(resultado.incidencias.some(i => i.codigo === 'HUECO_DOCENTE'), false);
});

test('respeta el máximo de duración elegido para una materia', () => {
  const datos = entrada('MATUTINO', 3);
  datos.cargas[0].maxBloque = 1;
  const resultado = generarHorario(datos);
  assert.ok(resultado.sesiones.length >= 3);
  assert.ok(resultado.sesiones.every(s => s.fin - s.inicio === 1));
  assert.deepEqual(validarSesiones(resultado.sesiones, datos), []);
});

test('retrocede cuando la primera hora elegida impide ubicar otras materias', () => {
  const datos = entrada('MATUTINO', 1);
  datos.cargas = [1, 2, 3].map(numero => ({ ...carga(1), id: `ca${numero}`,
    asignaturaId: `a${numero}`, docenteId: `d${numero}` }));
  datos.docentes = [
    { ...docente(), id: 'd1', disponibilidad: [{ dia: 1, inicio: 7, fin: 9 }] },
    { ...docente(), id: 'd2', disponibilidad: [{ dia: 1, inicio: 7, fin: 8 }, { dia: 1, inicio: 9, fin: 10 }] },
    { ...docente(), id: 'd3', disponibilidad: [{ dia: 1, inicio: 7, fin: 8 }, { dia: 1, inicio: 9, fin: 10 }] },
  ];
  const resultado = generarHorario(datos);
  assert.equal(resultado.sesiones.length, 3);
  assert.ok(resultado.evaluaciones > 3);
  assert.equal(resultado.sesiones.find(sesion => sesion.cargaId === 'ca1')?.inicio, 8);
  assert.deepEqual(validarSesiones(resultado.sesiones, datos), []);
});

test('distingue restricciones imposibles del límite de búsqueda agotado', () => {
  const datos = entrada('MATUTINO', 1);
  datos.cargas = [1, 2, 3].map(numero => ({ ...carga(1), id: `ca${numero}`,
    asignaturaId: `a${numero}`, docenteId: `d${numero}` }));
  datos.docentes = [1, 2, 3].map(numero => ({ ...docente(), id: `d${numero}`,
    disponibilidad: [{ dia: 1 as const, inicio: 7, fin: 9 }] }));
  const imposible = generarHorario(datos);
  assert.equal(imposible.sesiones.length, 0);
  assert.equal(imposible.busquedaAgotada, false);
  assert.ok(imposible.incidencias.some(incidencia => incidencia.codigo === 'SIN_ESPACIO'));
  const agotada = generarHorario(datos, 1);
  assert.equal(agotada.sesiones.length, 0);
  assert.equal(agotada.busquedaAgotada, true);
  assert.ok(agotada.incidencias.some(incidencia => incidencia.codigo === 'BUSQUEDA_AGOTADA'));
});

test('permite dos sesiones el sábado para cubrir ocho horas de una misma materia Mixta', () => {
  const datos = entrada('MIXTO', 8);
  const resultado = generarHorario(datos);
  assert.equal(resultado.incidencias.filter(i => !i.codigo.startsWith('HUECO_')).length, 0);
  assert.deepEqual(resultado.sesiones.map(s => [s.inicio, s.fin]), [[7, 11], [11, 15]]);
  assert.deepEqual(validarSesiones(resultado.sesiones, datos), []);
});

test('un grupo sin materias requiere configurar su carga', () => {
  const datos = entrada();
  datos.cargas = [];
  assert.ok(validarEntradas(datos).some(i => i.codigo === 'SIN_ASIGNATURAS'));
});

test('en Mixto exige el reparto elegido y no convierte automáticamente el excedente', () => {
  const datos = entrada('MIXTO', 9);
  assert.equal(validarEntradas(datos).find(i => i.codigo === 'CAPACIDAD_TURNO')?.grupoId, 'g1');
  datos.cargas[0].horasPresenciales = 7;
  datos.cargas[0].horasAsincronas = 2;
  const resultado = generarHorario(datos);
  assert.equal(resultado.sesiones.reduce((n, s) => n + s.fin - s.inicio, 0), 7);
  assert.ok(resultado.sesiones.every(s => s.dia === 6 && s.inicio >= 7 && s.fin <= 15));
  assert.deepEqual(validarSesiones(resultado.sesiones, datos), []);
});

test('conserva el docente seleccionado y señala restricciones y alternativas', () => {
  const datos = entrada();
  datos.docentes[0].gruposRestringidos = ['g1'];
  datos.docentes.push({ ...docente(), id: 'd2', nombre: 'Bruno', asignaturasPreferidas: [] });
  assert.equal(validarEntradas(datos).find(i => i.codigo === 'DOCENTE_NO_ELEGIBLE')?.docenteId, 'd1');
  assert.deepEqual(docentesElegibles(datos.cargas[0], datos.grupos[0], datos.docentes).map(d => d.id), ['d2']);
});

test('bloquea un máximo semanal excedido por materias o ciclos superpuestos', () => {
  const datos = entrada('MATUTINO', 3);
  datos.docentes[0].maxHorasSemanales = 5;
  datos.cargas.push({ ...carga(3), id: 'ca2', asignaturaId: 'a2', asignatura: 'Geografía' });
  assert.match(validarEntradas(datos).find(i => i.codigo === 'CUPO_DOCENTE_EXCEDIDO')?.mensaje || '', /Ana.*6.*5/);
  assert.equal(generarHorario(datos).sesiones.length, 0);
  datos.cargas.pop();
  assert.equal(validarEntradas(datos).some(i => i.codigo === 'CUPO_DOCENTE_EXCEDIDO'), false);
  datos.ocupacionesExternas = [{ cargaId: 'externa', grupoId: 'otro', asignaturaId: 'otra',
    docenteId: 'd1', dia: 2, inicio: 7, fin: 10 }];
  assert.match(validarEntradas(datos).find(i => i.codigo === 'CUPO_DOCENTE_EXCEDIDO')?.mensaje || '', /Ana.*6.*5/);
  assert.deepEqual(docentesElegibles(datos.cargas[0], datos.grupos[0], datos.docentes, datos.ocupacionesExternas), []);
});

test('el selector considera las demás materias sin contar dos veces la materia actual', () => {
  const datos = entrada('MATUTINO', 3);
  datos.docentes[0].maxHorasSemanales = 5;
  datos.cargas.push({ ...carga(2), id: 'ca2', asignaturaId: 'a2', asignatura: 'Geografía' });
  assert.equal(docentesElegibles(datos.cargas[1], datos.grupos[0], datos.docentes,
    [], datos.cargas).length, 1);
  datos.cargas[1].horasTotales = 3;
  datos.cargas[1].horasPresenciales = 3;
  assert.equal(docentesElegibles(datos.cargas[1], datos.grupos[0], datos.docentes,
    [], datos.cargas).length, 0);
});

test('una materia solo asíncrona no agrega horas al cupo presencial', () => {
  const datos = entrada('MIXTO', 2);
  datos.cargas[0].horasPresenciales = 0;
  datos.cargas[0].horasAsincronas = 2;
  datos.docentes[0].maxHorasSemanales = 1;
  datos.ocupacionesExternas = [{ cargaId: 'externa', grupoId: 'otro', asignaturaId: 'otra',
    docenteId: 'd1', dia: 1, inicio: 7, fin: 9 }];
  assert.equal(docentesElegibles(datos.cargas[0], datos.grupos[0], datos.docentes, datos.ocupacionesExternas).length, 1);
  assert.equal(validarEntradas(datos).some(i => i.codigo === 'CUPO_DOCENTE_EXCEDIDO'), false);
});

test('detecta choques de docente, grupo y aula tras un cambio manual', () => {
  const datos = entrada();
  datos.grupos[0].aula = '101';
  const resultado = generarHorario(datos);
  const duplicada = { ...resultado.sesiones[0], grupoId: 'g2', cargaId: 'otra' };
  assert.ok(validarSesiones([...resultado.sesiones, duplicada], datos).some(i => i.codigo === 'CHOQUE'));
});

test('rechaza más de tres materias distintas del grupo para el mismo docente', () => {
  const datos = entrada();
  datos.cargas = [1, 2, 3, 4].map(numero => ({ ...carga(1), id: `ca${numero}`, asignaturaId: `a${numero}` }));
  assert.ok(validarEntradas(datos).some(i => i.codigo === 'MAX_TRES_MATERIAS'));
});

test('PDF y Word incluyen la materia y separan el trabajo asíncrono', async () => {
  const datos = entrada('MIXTO', 5);
  datos.cargas[0].horasPresenciales = 3;
  datos.cargas[0].horasAsincronas = 2;
  const resultado = generarHorario(datos);
  const pdf = crearPdfHorario(datos, resultado.sesiones, '2027-1', { tipo: 'grupos' });
  assert.ok(pdf.output('arraybuffer').byteLength > 2000);
  const docx = await crearDocxHorario(datos, resultado.sesiones, '2027-1', { tipo: 'grupos' });
  const zip = await JSZip.loadAsync(await docx.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  assert.ok(xml?.includes('Historia'));
  assert.ok(xml?.includes('Trabajo asíncrono'));
  assert.ok(xml?.includes('2 h/semana'));
});

test('una vacante reserva horas del grupo y aparece en el borrador exportado', async () => {
  const datos = entrada();
  datos.docentes = [];
  datos.cargas[0].docenteId = idVacante(datos.cargas[0].id);
  const resultado = generarHorario(datos);
  assert.equal(resultado.sesiones.reduce((total, sesion) => total + sesion.fin - sesion.inicio, 0), 3);
  assert.ok(resultado.sesiones.every(sesion => sesion.docenteId === idVacante('ca1')));
  assert.ok(resultado.incidencias.some(incidencia => incidencia.codigo === 'VACANTE'));
  assert.deepEqual(validarSesiones(resultado.sesiones, datos), []);
  const docx = await crearDocxHorario(datos, resultado.sesiones, '2027-1', { tipo: 'grupos' });
  const zip = await JSZip.loadAsync(await docx.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  assert.ok(xml?.includes('VACANTE'));
  assert.ok(xml?.includes('BORRADOR'));
});
