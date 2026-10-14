import assert from 'node:assert/strict';
import test from 'node:test';
import { autorizacionesAplicables, huellaJornadaDocente,
  incumplimientosEstrictosPendientes } from '../src/horarios/autorizacionesJornada.ts';
import { revisarAjusteManual } from '../src/horarios/ajusteManual.ts';
import type { EntradaHorario, SesionHorario } from '../src/horarios/types.ts';

const entrada: EntradaHorario = {
  grupos: [{ id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO' }],
  docentes: [{ id: 'd1', nombre: 'Docente Uno', activo: true, planes: ['p1'],
    asignaturasPreferidas: ['a1'], gruposRestringidos: [], disponibilidad: [{ dia: 1, inicio: 7, fin: 9 }] }],
  cargas: [{ id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Historia',
    horasTotales: 1, horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' }],
  configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1, minHorasGrupo: 1, minHorasDocente: 2 },
};
const sesion: SesionHorario = { cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1',
  docenteId: 'd1', dia: 1, inicio: 7, fin: 8 };

test('una excepción motivada resuelve solo la jornada de una hora exacta', () => {
  const sesiones = [sesion];
  const incidencias = revisarAjusteManual(entrada, sesiones);
  assert.equal(incidencias.find(i => i.codigo === 'JORNADA_CORTA_DOCENTE')?.dia, 1);
  const autorizacion = { docenteId: 'd1', dia: 1 as const,
    huella: huellaJornadaDocente(entrada, sesiones, 'd1', 1), motivo: 'Ajuste académico autorizado' };
  assert.deepEqual(incumplimientosEstrictosPendientes(entrada, sesiones, incidencias, [autorizacion]), []);
  assert.equal(autorizacionesAplicables(entrada, sesiones, incidencias, [autorizacion]).length, 1);
  const otraHora = [{ ...sesion, inicio: 8, fin: 9 }];
  assert.equal(autorizacionesAplicables(entrada, otraHora, revisarAjusteManual(entrada, otraHora), [autorizacion]).length, 0);
});

test('motivo insuficiente, otro día y restricciones de grupo no quedan autorizados', () => {
  const datos = { ...entrada, configuracion: { ...entrada.configuracion, minHorasGrupo: 2 } };
  const incidencias = revisarAjusteManual(datos, [sesion]);
  const autorizacion = { docenteId: 'd1', dia: 1 as const,
    huella: huellaJornadaDocente(datos, [sesion], 'd1', 1), motivo: 'Motivo completo' };
  assert.deepEqual(incumplimientosEstrictosPendientes(datos, [sesion], incidencias, [autorizacion])
    .map(i => i.codigo), ['JORNADA_CORTA_GRUPO']);
  assert.equal(incumplimientosEstrictosPendientes(datos, [sesion], incidencias,
    [{ ...autorizacion, motivo: 'corto' }]).length, 2);
  assert.equal(incumplimientosEstrictosPendientes(datos, [sesion], incidencias,
    [{ ...autorizacion, dia: 2 }]).length, 2);
});

test('una segunda clase o cambio de ocupación externa invalida la excepción', () => {
  const autorizacion = { docenteId: 'd1', dia: 1 as const,
    huella: huellaJornadaDocente(entrada, [sesion], 'd1', 1), motivo: 'Ajuste académico autorizado' };
  const dosHoras = [sesion, { ...sesion, inicio: 8, fin: 9 }];
  assert.deepEqual(autorizacionesAplicables(entrada, dosHoras, revisarAjusteManual(entrada, dosHoras), [autorizacion]), []);
  const externa = { ...entrada, ocupacionesExternas: [{ ...sesion, cargaId: 'otra' }] };
  assert.deepEqual(autorizacionesAplicables(externa, [sesion], revisarAjusteManual(externa, [sesion]), [autorizacion]), []);
});
