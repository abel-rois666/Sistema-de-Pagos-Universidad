import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pasosParaDesbloquear } from '../src/horarios/orientacionHorario.ts';
import GuiaDesbloqueoHorario from '../src/components/horarios/GuiaDesbloqueoHorario.tsx';
import type { EntradaHorario } from '../src/horarios/types.ts';

const base = {
  modo: 'automatico' as const, permitirVacantes: false, permitirNoPreferidas: false,
  cargasFijas: new Set(['c1']), busquedaAmpliadaUsada: false,
  configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1, minHorasGrupo: 2, minHorasDocente: 2 },
};

test('la guía distingue límite de búsqueda y ofrece ampliar, liberar y permitir vacantes', () => {
  const pasos = pasosParaDesbloquear([
    { codigo: 'DOCENTE_FIJO_SIN_SOLUCION', mensaje: 'Docente fijado', cargaId: 'c1' },
    { codigo: 'BUSQUEDA_AGOTADA', mensaje: 'Límite agotado' },
  ], base);
  assert.deepEqual(pasos.map(paso => paso.accion),
    ['ampliar_busqueda', 'liberar_docente', 'permitir_vacantes']);
  assert.match(pasos[0].detalle, /no modifica asignaciones ni garantiza/);
  assert.ok(!pasosParaDesbloquear([{ codigo: 'BUSQUEDA_AGOTADA', mensaje: 'Límite agotado' }],
    { ...base, busquedaAmpliadaUsada: true }).some(paso => paso.accion === 'ampliar_busqueda'));
});

test('una jornada de una hora permite ajustar solo el mínimo del actor afectado', () => {
  const pasos = pasosParaDesbloquear([
    { codigo: 'JORNADA_CORTA_GRUPO', mensaje: 'Solo una hora', grupoId: 'g1' },
  ], base);
  const limites = pasos.find(paso => paso.accion === 'revisar_limites');
  assert.ok(limites);
  assert.match(limites.detalle, /Mín. diario grupo.*a 1/);
  assert.ok(pasos.some(paso => paso.accion === 'revisar_cargas'));
  const docente = pasosParaDesbloquear([
    { codigo: 'JORNADA_CORTA_DOCENTE', mensaje: 'Solo una hora', docenteId: 'd1' },
  ], base).find(paso => paso.accion === 'revisar_limites');
  assert.match(docente?.detalle || '', /Mín. diario docente.*a 1/);
  assert.equal(pasosParaDesbloquear([{ codigo: 'BUSQUEDA_AGOTADA', mensaje: 'Límite' }],
    { ...base, permitirVacantes: true, busquedaAmpliadaUsada: true })[0].accion, 'revisar_cargas');
});

test('cada incidencia estricta se muestra junto a su acción concreta', () => {
  const entrada: EntradaHorario = {
    grupos: [{ id: 'g1', codigo: '5A', planId: 'p1', cicloId: 'ci1', turno: 'MATUTINO' }],
    docentes: [], cargas: [], configuracion: base.configuracion,
  };
  const html = renderToStaticMarkup(createElement(GuiaDesbloqueoHorario, {
    entrada, incidencias: [
      { codigo: 'BUSQUEDA_AGOTADA', mensaje: 'Se agotó la búsqueda.' },
      { codigo: 'JORNADA_CORTA_GRUPO', mensaje: 'El grupo 5A tiene una hora el martes.', grupoId: 'g1' },
    ], modo: 'manual', permitirVacantes: false, permitirNoPreferidas: false,
    cargasFijas: new Set<string>(), busquedaAmpliadaUsada: false, bloqueado: false,
    onAccion: () => {},
  }));
  const tarjetas = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) || [];
  assert.equal(tarjetas.length, 2);
  assert.match(tarjetas[0], /Se agotó la búsqueda[\s\S]*Reintentar búsqueda ampliada/);
  assert.doesNotMatch(tarjetas[0], /Ajustar mínimo del grupo/);
  assert.match(tarjetas[1], /grupo 5A tiene una hora[\s\S]*Ajustar mínimo del grupo/);
  assert.doesNotMatch(tarjetas[1], /Reintentar búsqueda ampliada/);
});

test('en Manual no ofrece opciones exclusivas del automático', () => {
  const pasos = pasosParaDesbloquear([{ codigo: 'SIN_DOCENTE', mensaje: 'Falta docente' }],
    { ...base, modo: 'manual' });
  assert.deepEqual(pasos.map(paso => paso.accion), ['revisar_cargas']);
});
