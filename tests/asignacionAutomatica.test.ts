import assert from 'node:assert/strict';
import test from 'node:test';
import { asignarDocentesYGenerar } from '../src/horarios/asignacionAutomatica.ts';
import { validarSesiones } from '../src/horarios/motor.ts';
import { idVacante } from '../src/horarios/vacantes.ts';
import type { DocenteHorario, EntradaHorario } from '../src/horarios/types.ts';

const docente = (id: string, preferidas: string[]): DocenteHorario => ({
  id, nombre: id, activo: true, planes: ['p1'], asignaturasPreferidas: preferidas, gruposRestringidos: [],
  disponibilidad: [{ dia: 1, inicio: 7, fin: 10 }],
});

const entrada = (): EntradaHorario => ({
  grupos: [{ id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO' }],
  docentes: [docente('d1', ['a1']), docente('d2', [])],
  cargas: [{ id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Historia',
    horasTotales: 2, horasPresenciales: 2, horasAsincronas: 0, docenteId: null }],
  configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1 },
});

test('el modo estricto elige una materia preferida y genera sesiones válidas', async () => {
  const datos = entrada();
  const resultado = await asignarDocentesYGenerar(datos, { permitirNoPreferidas: false, cargasFijas: new Set() });
  assert.equal(resultado.completo, true);
  assert.equal(resultado.entrada.cargas[0].docenteId, 'd1');
  assert.equal(resultado.detalle[0].preferida, true);
  assert.deepEqual(validarSesiones(resultado.sesiones, resultado.entrada), []);
  assert.equal(datos.cargas[0].docenteId, null);
});

test('el modo flexible permite docente sin preferencia cuando el preferido está restringido', async () => {
  const datos = entrada();
  datos.docentes[0].gruposRestringidos = ['g1'];
  const estricto = await asignarDocentesYGenerar(datos, { permitirNoPreferidas: false, cargasFijas: new Set() });
  assert.equal(estricto.completo, false);
  assert.equal(estricto.incidencias[0].codigo, 'SIN_DOCENTE_AUTO');
  const flexible = await asignarDocentesYGenerar(datos, { permitirNoPreferidas: true, cargasFijas: new Set() });
  assert.equal(flexible.completo, true);
  assert.equal(flexible.entrada.cargas[0].docenteId, 'd2');
  assert.equal(flexible.detalle[0].preferida, false);
});

test('el modo automático elige otro docente cuando el preferido no tiene cupo semanal', async () => {
  const datos = entrada();
  datos.docentes[0].maxHorasSemanales = 1;
  datos.docentes[1].maxHorasSemanales = 2;
  const resultado = await asignarDocentesYGenerar(datos,
    { permitirNoPreferidas: true, cargasFijas: new Set() });
  assert.equal(resultado.completo, true);
  assert.equal(resultado.entrada.cargas[0].docenteId, 'd2');
});

test('conserva la asignación fijada y avisa si impide generar; liberarla permite alternativa', async () => {
  const datos = entrada();
  datos.cargas[0].docenteId = 'd1';
  datos.docentes[0].gruposRestringidos = ['g1'];
  const fijado = await asignarDocentesYGenerar(datos, { permitirNoPreferidas: true, cargasFijas: new Set(['c1']) });
  assert.equal(fijado.completo, false);
  assert.equal(fijado.entrada.cargas[0].docenteId, 'd1');
  assert.equal(fijado.incidencias[0].codigo, 'DOCENTE_FIJO_SIN_SOLUCION');
  const liberado = await asignarDocentesYGenerar(datos, { permitirNoPreferidas: true, cargasFijas: new Set() });
  assert.equal(liberado.completo, true);
  assert.equal(liberado.entrada.cargas[0].docenteId, 'd2');
});

test('una asignación existente fijada se conserva aunque la materia no sea preferida', async () => {
  const datos = entrada();
  datos.cargas[0].docenteId = 'd2';
  const resultado = await asignarDocentesYGenerar(datos, { permitirNoPreferidas: false, cargasFijas: new Set(['c1']) });
  assert.equal(resultado.completo, true);
  assert.equal(resultado.entrada.cargas[0].docenteId, 'd2');
  assert.deepEqual(resultado.detalle[0], { cargaId: 'c1', docenteId: 'd2', preferida: false, fija: true });
});

test('considera el choque horario entre grupos durante la asignación de docentes', async () => {
  const datos = entrada();
  datos.grupos.push({ ...datos.grupos[0], id: 'g2', codigo: '1B' });
  datos.cargas[0].horasTotales = 1;
  datos.cargas[0].horasPresenciales = 1;
  datos.cargas.push({ ...datos.cargas[0], id: 'c2', grupoId: 'g2' });
  datos.docentes.forEach(item => { item.disponibilidad = [{ dia: 1, inicio: 7, fin: 8 }]; item.asignaturasPreferidas = ['a1']; });
  const resultado = await asignarDocentesYGenerar(datos, { permitirNoPreferidas: false, cargasFijas: new Set() });
  assert.equal(resultado.completo, true);
  assert.notEqual(resultado.entrada.cargas[0].docenteId, resultado.entrada.cargas[1].docenteId);
  assert.deepEqual(validarSesiones(resultado.sesiones, resultado.entrada), []);
});

test('retrocede en la elección de docente cuando la primera combinación bloquea otro grupo', async () => {
  const datos = entrada();
  datos.grupos = [1, 2, 3].map(numero => ({ ...datos.grupos[0], id: `g${numero}`, codigo: `G${numero}` }));
  datos.cargas = [1, 2, 3].map(numero => ({ ...datos.cargas[0], id: `c${numero}`,
    grupoId: `g${numero}`, asignaturaId: `a${numero}`, horasTotales: 1, horasPresenciales: 1 }));
  datos.docentes = [
    { ...docente('d1', ['a1', 'a2', 'a3']), disponibilidad: [{ dia: 1, inicio: 7, fin: 8 }] },
    { ...docente('d2', ['a1', 'a2', 'a3']), gruposRestringidos: ['g2', 'g3'], disponibilidad: [{ dia: 1, inicio: 7, fin: 8 }] },
    { ...docente('d3', ['a1', 'a2', 'a3']), gruposRestringidos: ['g1'], disponibilidad: [{ dia: 1, inicio: 7, fin: 8 }] },
  ];
  const resultado = await asignarDocentesYGenerar(datos,
    { permitirNoPreferidas: false, cargasFijas: new Set() });
  assert.equal(resultado.completo, true);
  assert.equal(resultado.entrada.cargas.find(carga => carga.id === 'c1')?.docenteId, 'd2');
  assert.equal(resultado.detalle.length, 3);
  assert.ok(resultado.evaluaciones > 3);
  assert.deepEqual(validarSesiones(resultado.sesiones, resultado.entrada), []);
});

test('reparte cuatro materias del mismo grupo para no superar tres por docente', async () => {
  const datos = entrada();
  datos.cargas = [1, 2, 3, 4].map(numero => ({ ...datos.cargas[0], id: `c${numero}`,
    asignaturaId: `a${numero}`, horasTotales: 1, horasPresenciales: 1 }));
  datos.docentes.forEach(item => { item.asignaturasPreferidas = ['a1', 'a2', 'a3', 'a4'];
    item.disponibilidad = [{ dia: 1, inicio: 7, fin: 11 }]; });
  const resultado = await asignarDocentesYGenerar(datos, { permitirNoPreferidas: false, cargasFijas: new Set() });
  assert.equal(resultado.completo, true);
  for (const item of datos.docentes) {
    assert.ok(resultado.entrada.cargas.filter(carga => carga.docenteId === item.id).length <= 3);
  }
  assert.deepEqual(validarSesiones(resultado.sesiones, resultado.entrada), []);
});

test('reserva una vacante cuando no hay docentes elegibles y el usuario lo permite', async () => {
  const datos = entrada();
  datos.docentes.forEach(item => { item.activo = false; });
  const sinVacantes = await asignarDocentesYGenerar(datos,
    { permitirNoPreferidas: true, cargasFijas: new Set() });
  assert.equal(sinVacantes.completo, false);
  const conVacantes = await asignarDocentesYGenerar(datos,
    { permitirNoPreferidas: true, permitirVacantes: true, cargasFijas: new Set() });
  assert.equal(conVacantes.completo, true);
  assert.equal(conVacantes.entrada.cargas[0].docenteId, idVacante('c1'));
  assert.equal(conVacantes.detalle[0].vacante, true);
  assert.ok(conVacantes.incidencias.some(incidencia => incidencia.codigo === 'VACANTE'));
  assert.deepEqual(validarSesiones(conVacantes.sesiones, conVacantes.entrada), []);
});

test('prioriza a un docente real cuando también se permiten vacantes', async () => {
  const resultado = await asignarDocentesYGenerar(entrada(),
    { permitirNoPreferidas: false, permitirVacantes: true, cargasFijas: new Set() });
  assert.equal(resultado.completo, true);
  assert.equal(resultado.entrada.cargas[0].docenteId, 'd1');
});

test('una vacante no resuelve la falta de espacio físico entre grupos', async () => {
  const datos = entrada();
  datos.grupos[0].turno = 'MIXTO';
  datos.grupos[0].aula = 'A-1';
  datos.grupos.push({ ...datos.grupos[0], id: 'g2', codigo: '1B' });
  datos.cargas[0].horasTotales = 8;
  datos.cargas[0].horasPresenciales = 8;
  datos.cargas.push({ ...datos.cargas[0], id: 'c2', grupoId: 'g2' });
  datos.docentes = [];
  const resultado = await asignarDocentesYGenerar(datos,
    { permitirNoPreferidas: true, permitirVacantes: true, cargasFijas: new Set() });
  assert.equal(resultado.completo, false);
  assert.ok(resultado.incidencias.some(incidencia => incidencia.codigo === 'SIN_DOCENTE_AUTO'));
});

test('el cupo semanal cuenta una sola vez las horas ya colocadas al añadir otra materia', async () => {
  const datos = entrada();
  datos.docentes = [docente('d1', ['a1', 'a2'])];
  datos.docentes[0].maxHorasSemanales = 4;
  datos.docentes[0].disponibilidad = [{ dia: 1, inicio: 7, fin: 11 }];
  datos.cargas.push({ ...datos.cargas[0], id: 'c2', asignaturaId: 'a2', asignatura: 'Geografía' });
  const resultado = await asignarDocentesYGenerar(datos,
    { permitirNoPreferidas: false, cargasFijas: new Set(), limiteTiempoMs: 200 });
  assert.equal(resultado.completo, true);
  assert.equal(resultado.sesiones.reduce((total, sesion) => total + sesion.fin - sesion.inicio, 0), 4);
  assert.deepEqual(validarSesiones(resultado.sesiones, resultado.entrada).filter(i => i.codigo !== 'JORNADA_CORTA_DOCENTE'), []);
});

test('encuentra una propuesta completa para muchos grupos antes de refinar alternativas', async () => {
  const datos = entrada();
  datos.grupos = Array.from({ length: 20 }, (_, i) => ({
    ...datos.grupos[0], id: `g${i}`, codigo: `G${i}`, planId: `p${i}`,
  }));
  datos.docentes = datos.grupos.flatMap((grupo, i) => [0, 1].map(numero => ({
    ...docente(`d${i}-${numero}`, Array.from({ length: 4 }, (_, materia) => `a${i}-${materia}`)),
    planes: [grupo.planId], disponibilidad: [{ dia: 1 as const, inicio: 7, fin: 11 }],
  })));
  datos.cargas = datos.grupos.flatMap((grupo, i) => Array.from({ length: 4 }, (_, materia) => ({
    ...datos.cargas[0], id: `c${i}-${materia}`, grupoId: grupo.id,
    asignaturaId: `a${i}-${materia}`, asignatura: `Materia ${i}-${materia}`,
    horasTotales: 1, horasPresenciales: 1,
  })));
  const resultado = await asignarDocentesYGenerar(datos,
    { permitirNoPreferidas: false, cargasFijas: new Set(), limiteTiempoMs: 4000 });
  assert.equal(resultado.completo, true);
  assert.equal(resultado.entrada.cargas.length, 80);
  assert.deepEqual(validarSesiones(resultado.sesiones, resultado.entrada).filter(i => i.codigo !== 'JORNADA_CORTA_DOCENTE'
    && i.codigo !== 'JORNADA_CORTA_GRUPO'), []);
});

test('resume los bloqueos cuando muchas materias carecen de docente', async () => {
  const datos = entrada();
  datos.docentes = [];
  datos.cargas = Array.from({ length: 8 }, (_, indice) => ({
    ...datos.cargas[0], id: `c${indice}`, asignaturaId: `a${indice}`, asignatura: `Materia ${indice}`,
    horasTotales: 1, horasPresenciales: 1,
  }));
  const resultado = await asignarDocentesYGenerar(datos,
    { permitirNoPreferidas: true, cargasFijas: new Set() });
  assert.equal(resultado.completo, false);
  assert.equal(resultado.incidencias.length, 6);
  assert.match(resultado.incidencias.at(-1)?.mensaje || '', /(?:Se ubicaron|con) 0 de 8 materias/);
});
