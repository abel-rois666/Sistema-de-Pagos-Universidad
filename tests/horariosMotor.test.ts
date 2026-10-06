import assert from 'node:assert/strict';
import test from 'node:test';
import { docentesElegibles, generarHorario, validarEntradas, validarSesiones } from '../src/horarios/motor.ts';
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
});

test('respeta el máximo de duración elegido para una materia', () => {
  const datos = entrada('MATUTINO', 3);
  datos.cargas[0].maxBloque = 1;
  const resultado = generarHorario(datos);
  assert.ok(resultado.sesiones.length >= 3);
  assert.ok(resultado.sesiones.every(s => s.fin - s.inicio === 1));
  assert.deepEqual(validarSesiones(resultado.sesiones, datos), []);
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
