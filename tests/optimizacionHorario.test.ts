import assert from 'node:assert/strict';
import test from 'node:test';
import { asignarDocentesYGenerar } from '../src/horarios/asignacionAutomatica.ts';
import { crearPropuestaHorario, compararPropuestas, propuestasParaMostrar } from '../src/horarios/evaluacionHorario.ts';
import { optimizarHorarioManual } from '../src/horarios/optimizacionHorario.ts';
import { validarSesiones } from '../src/horarios/motor.ts';
import type { DocenteHorario, EntradaHorario, ResultadoHorario } from '../src/horarios/types.ts';

const docente = (id: string, restringidos: string[] = []): DocenteHorario => ({
  id, nombre: id, activo: true, planes: ['p1'], asignaturasPreferidas: ['a1', 'a2', 'a3'],
  gruposRestringidos: restringidos, disponibilidad: [{ dia: 1, inicio: 7, fin: 9 },
    { dia: 2, inicio: 7, fin: 9 }],
});
const entrada = (): EntradaHorario => ({
  grupos: [{ id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO' }],
  docentes: [docente('d1')],
  cargas: [{ id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Historia',
    horasTotales: 2, horasPresenciales: 2, horasAsincronas: 0, docenteId: 'd1' }],
  configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1, minHorasGrupo: 2, minHorasDocente: 2 },
});

test('el modo manual compara horarios completos y entrega una alternativa distinta', () => {
  const datos = entrada();
  const resultado = optimizarHorarioManual(datos);
  assert.equal(resultado.busquedaExhaustiva, true);
  assert.equal(resultado.propuestas.length, 2);
  assert.ok(resultado.solucionesEvaluadas > 1);
  assert.ok(compararPropuestas(resultado.propuestas[0], resultado.propuestas[1]) <= 0);
  assert.notEqual(resultado.propuestas[0].firma, resultado.propuestas[1].firma);
  for (const propuesta of resultado.propuestas) {
    assert.deepEqual(validarSesiones(propuesta.sesiones, propuesta.entrada), []);
  }
  assert.deepEqual(datos.cargas.map(carga => carga.docenteId), ['d1']);
});

test('prioriza jornadas del grupo antes de las del docente', () => {
  const datos = entrada();
  const base: ResultadoHorario = { sesiones: [], huecosGrupo: { g1: 0 }, huecosDocente: { d1: 0 }, incidencias: [] };
  const grupoMejor = crearPropuestaHorario(datos, datos, { ...base,
    incidencias: [{ codigo: 'JORNADA_CORTA_DOCENTE', mensaje: 'Jornada docente corta' }] });
  const docenteMejor = crearPropuestaHorario(datos, datos, { ...base,
    incidencias: [{ codigo: 'JORNADA_CORTA_GRUPO', mensaje: 'Jornada grupo corta' }] });
  assert.ok(compararPropuestas(grupoMejor, docenteMejor) < 0);
  assert.equal(propuestasParaMostrar([docenteMejor, grupoMejor])[0], grupoMejor);
});

test('una asignación real posterior supera una primera solución con vacante', async () => {
  const datos = entrada();
  datos.grupos = [1, 2, 3].map(numero => ({ ...datos.grupos[0], id: `g${numero}`, codigo: `G${numero}` }));
  datos.cargas = [1, 2, 3].map(numero => ({ ...datos.cargas[0], id: `c${numero}`,
    grupoId: `g${numero}`, asignaturaId: `a${numero}`, horasTotales: 1,
    horasPresenciales: 1, docenteId: null }));
  datos.docentes = [docente('d1'), docente('d2', ['g2', 'g3']), docente('d3', ['g1'])];
  datos.docentes.forEach(item => { item.disponibilidad = [{ dia: 1, inicio: 7, fin: 8 }]; });
  const resultado = await asignarDocentesYGenerar(datos, {
    permitirNoPreferidas: false, permitirVacantes: true, cargasFijas: new Set(),
  });
  assert.equal(resultado.completo, true);
  assert.ok(resultado.solucionesEvaluadas > 1);
  assert.equal(resultado.propuestas[0].metricas.vacantes, 0);
  assert.equal(resultado.entrada.cargas.find(carga => carga.id === 'c1')?.docenteId, 'd2');
  assert.deepEqual(validarSesiones(resultado.sesiones, resultado.entrada), []);
});

test('un límite vencido se informa sin afirmar que no existe solución', () => {
  const datos = entrada();
  const resultado = optimizarHorarioManual(datos, { limiteTiempoMs: -1 });
  assert.equal(resultado.busquedaExhaustiva, false);
  assert.equal(resultado.propuestas.length, 0);
  assert.ok(resultado.incidencias.some(incidencia => incidencia.codigo === 'BUSQUEDA_AGOTADA'));
});
