import assert from 'node:assert/strict';
import test from 'node:test';
import { construirEscenarioAsesoriaHorario, crearContextoAsesoriaHorario,
  type EstadoAsesoriaHorario } from '../src/horarios/asesoriaIA.ts';
import type { EntradaHorario } from '../src/horarios/types.ts';

const entrada: EntradaHorario = {
  grupos: [{ id: 'grupo-uuid-privado', codigo: '5A-MAT', cicloId: 'ciclo-privado',
    planId: 'plan-privado', turno: 'MATUTINO' }],
  docentes: [{ id: 'docente-uuid-privado', nombre: 'DOCENTE NOMBRE PRIVADO', activo: true,
    disponibilidad: [], planes: ['plan-privado'], asignaturasPreferidas: [], gruposRestringidos: [] }],
  cargas: [{ id: 'carga-uuid-privada', grupoId: 'grupo-uuid-privado',
    asignaturaId: 'materia-privada', asignatura: 'MATERIA NOMBRE PRIVADO',
    horasTotales: 3, horasPresenciales: 3, horasAsincronas: 0, docenteId: 'docente-uuid-privado' }],
  configuracion: { maxHuecoGrupo: 2, maxHuecoDocente: 1, minHorasGrupo: 2, minHorasDocente: 2 },
};
const estado: EstadoAsesoriaHorario = {
  modo: 'automatico', politica: 'estricto', permitirVacantes: false,
  permitirNoPreferidas: false, cargasFijas: new Set(['carga-uuid-privada']),
  busquedaAmpliadaUsada: false, busquedaExhaustiva: false, generado: false, metricas: null,
};
const incidencias = [
  { codigo: 'BUSQUEDA_AGOTADA', mensaje: 'Docente DOCENTE NOMBRE PRIVADO', cargaId: 'carga-uuid-privada' },
  { codigo: 'JORNADA_CORTA_GRUPO', mensaje: 'Grupo 5A-MAT con una hora', grupoId: 'grupo-uuid-privado' },
];

test('el resumen para Groq no incluye nombres, UUID ni mensajes de incidencias', () => {
  const contexto = crearContextoAsesoriaHorario(entrada, incidencias, estado);
  const enviado = JSON.stringify(contexto.solicitud);
  assert.doesNotMatch(enviado, /PRIVADO|privad|5A-MAT|docente-uuid|grupo-uuid/);
  assert.deepEqual(contexto.solicitud.resumen.incidencias, [
    { codigo: 'BUSQUEDA_AGOTADA', cargaRef: 'c1' },
    { codigo: 'JORNADA_CORTA_GRUPO', cargaRef: null },
  ]);
  assert.ok(contexto.solicitud.acciones.includes('liberar:c1'));
  assert.ok(contexto.solicitud.acciones.includes('min_grupo_1'));
});

test('solo se aplican acciones permitidas sobre una copia local del escenario', () => {
  const contexto = crearContextoAsesoriaHorario(entrada, incidencias, estado);
  assert.equal(construirEscenarioAsesoriaHorario(entrada, estado, contexto, 'liberar:c9'), null);
  const liberar = construirEscenarioAsesoriaHorario(entrada, estado, contexto, 'liberar:c1');
  assert.ok(liberar);
  assert.deepEqual(liberar.cargasFijas, []);
  assert.equal(estado.cargasFijas.has('carga-uuid-privada'), true);
  const minimo = construirEscenarioAsesoriaHorario(entrada, estado, contexto, 'min_grupo_1');
  assert.equal(minimo?.entrada.configuracion.minHorasGrupo, 1);
  assert.equal(minimo?.entrada.configuracion.minHorasDocente, 2);
  assert.equal(entrada.configuracion.minHorasGrupo, 2);
  assert.equal(minimo?.entrada.cargas[0].docenteId, 'docente-uuid-privado');
});

test('el modo manual no ofrece vacantes automáticas ni liberar docentes fijos', () => {
  const contexto = crearContextoAsesoriaHorario(entrada, incidencias, { ...estado, modo: 'manual' });
  assert.equal(contexto.solicitud.acciones.some(accion => accion.startsWith('liberar:')), false);
  assert.equal(contexto.solicitud.acciones.includes('permitir_vacantes'), false);
  assert.equal(contexto.solicitud.acciones.includes('permitir_no_preferidas'), false);
});
