import assert from 'node:assert/strict';
import test from 'node:test';
import { asignarDocentesYGenerar } from '../src/horarios/asignacionAutomatica.ts';
import { crearContenidoBorrador, recuperarContenidoBorrador } from '../src/horarios/borradores.ts';
import { datosPendientesParaComplecion, prepararComplecionGrupos,
  validarComplecionGrupos } from '../src/horarios/completarBorrador.ts';
import { repararAsignacionLocal } from '../src/horarios/edicionLocal.ts';
import { validarSesiones } from '../src/horarios/motor.ts';
import { prepararBorradorHorario, seleccionCompletaHorario } from '../src/horarios/seleccion.ts';
import { incidenciaSuave, type EntradaHorario, type SesionHorario } from '../src/horarios/types.ts';

function escenario() {
  const entrada: EntradaHorario = {
    grupos: [
      { id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO' },
      { id: 'g2', codigo: '1B', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO' },
    ],
    docentes: [{ id: 'd1', nombre: 'Ana', activo: true, planes: ['p1'],
      asignaturasPreferidas: ['a1', 'a2'], gruposRestringidos: [],
      disponibilidad: [{ dia: 1, inicio: 7, fin: 13 }] }],
    cargas: [
      { id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Civil', horasTotales: 1,
        horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' },
      { id: 'c2', grupoId: 'g2', asignaturaId: 'a2', asignatura: 'Penal', horasTotales: 1,
        horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' },
    ],
    configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1, minHorasGrupo: 1, minHorasDocente: 1 },
  };
  const sesiones: SesionHorario[] = [{ cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1',
    docenteId: 'd1', dia: 1, inicio: 9, fin: 10 }];
  return { entrada, sesiones };
}

test('completa un grupo omitido sin mover un bloque ajustado y deja la selección publicable', async () => {
  const { entrada, sesiones } = escenario();
  const incluidas = new Set(['c1']);
  const preparada = prepararComplecionGrupos(entrada, ['g1'], incluidas, sesiones, ['g2']);
  assert.deepEqual(preparada.cargasPendientes, ['c2']);
  assert.equal(preparada.entradaBusqueda?.ocupacionesExternas?.at(-1), sesiones[0]);
  const resultado = await asignarDocentesYGenerar(preparada.entradaBusqueda!, {
    permitirNoPreferidas: false, cargasFijas: new Set(['c2']), politica: 'flexible',
  });
  assert.ok(resultado.propuestas.length > 0);
  const validada = validarComplecionGrupos(entrada, ['g1'], incluidas, sesiones,
    preparada, resultado.propuestas[0], 'flexible');
  assert.notEqual(typeof validada, 'string');
  if (typeof validada === 'string') return;
  assert.equal(validada.sesiones[0], sesiones[0]);
  assert.equal(validada.sesiones.length, 2);
  assert.notEqual(validada.sesiones[1].inicio, 9);
  assert.equal(seleccionCompletaHorario(validada.entrada,
    new Set(preparada.gruposSeleccionados), preparada.cargasIncluidas), true);
  assert.deepEqual(validarSesiones(validada.sesiones, prepararBorradorHorario(validada.entrada,
    new Set(preparada.gruposSeleccionados), preparada.cargasIncluidas)).filter(i => !incidenciaSuave(i)), []);
  assert.deepEqual([...incluidas], ['c1']);
  assert.deepEqual(sesiones, [{ cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1',
    docenteId: 'd1', dia: 1, inicio: 9, fin: 10 }]);
  const contenido = crearContenidoBorrador(entrada, validada.entrada, {
    gruposSeleccionados: preparada.gruposSeleccionados,
    cargasIncluidas: [...preparada.cargasIncluidas], ubicacionesEditadas: {},
    sesiones: validada.sesiones, modo: 'automatico', politica: 'flexible',
    permitirVacantes: false, permitirNoPreferidas: false, cargasFijas: [],
    omitirComplementarias: false,
  });
  const reabierto = recuperarContenidoBorrador(entrada, contenido);
  assert.equal(reabierto.sesionesCompatibles, true);
  assert.deepEqual(reabierto.sesiones, validada.sesiones);
  assert.deepEqual(contenido.gruposSeleccionados, ['g1', 'g2']);
});

test('rechaza la propuesta si invade una hora del borrador y conserva el estado anterior', () => {
  const { entrada, sesiones } = escenario();
  const incluidas = new Set(['c1']);
  const preparada = prepararComplecionGrupos(entrada, ['g1'], incluidas, sesiones, ['g2']);
  const propuesta = { entrada: { ...preparada.entradaBusqueda!, cargas: [entrada.cargas[1]] },
    sesiones: [{ ...sesiones[0], cargaId: 'c2', grupoId: 'g2', asignaturaId: 'a2' }] };
  const validada = validarComplecionGrupos(entrada, ['g1'], incluidas, sesiones,
    preparada, propuesta, 'flexible');
  assert.equal(typeof validada, 'string');
  assert.equal(sesiones.length, 1);
  assert.deepEqual([...incluidas], ['c1']);
});

test('permite incluir un grupo pendiente y ubicar después una materia sin mover la anterior', () => {
  const { entrada, sesiones } = escenario();
  const preparada = prepararComplecionGrupos(entrada, ['g1'], new Set(['c1']), sesiones, ['g2']);
  const parcial = prepararBorradorHorario(entrada,
    new Set(preparada.gruposSeleccionados), preparada.cargasIncluidas);
  assert.ok(validarSesiones(sesiones, parcial).some(i => i.codigo === 'HORAS_INCOMPLETAS' && i.cargaId === 'c2'));
  const contenido = crearContenidoBorrador(entrada, entrada, {
    gruposSeleccionados: preparada.gruposSeleccionados,
    cargasIncluidas: [...preparada.cargasIncluidas], ubicacionesEditadas: {},
    sesiones, modo: 'automatico', politica: 'flexible', permitirVacantes: false,
    permitirNoPreferidas: false, cargasFijas: [], omitirComplementarias: false,
  });
  assert.deepEqual(recuperarContenidoBorrador(entrada, contenido).sesiones, sesiones);
  const reparada = repararAsignacionLocal(parcial, sesiones, 'c2', 'd1', 'flexible');
  assert.notEqual(typeof reparada, 'string');
  if (typeof reparada === 'string') return;
  assert.equal(reparada.sesiones[0], sesiones[0]);
  assert.equal(reparada.sesiones.length, 2);
  assert.deepEqual(validarSesiones(reparada.sesiones, reparada.entrada).filter(i => !incidenciaSuave(i)), []);
});

test('señala las horas semanales faltantes antes de buscar, permitiendo incluir el grupo para corregirlas', () => {
  const { entrada, sesiones } = escenario();
  entrada.cargas[1].horasTotales = null;
  entrada.cargas[1].horasPresenciales = null;
  entrada.cargas[1].horasAsincronas = null;
  const preparada = prepararComplecionGrupos(entrada, ['g1'], new Set(['c1']), sesiones, ['g2']);
  assert.ok(datosPendientesParaComplecion(preparada).some(i =>
    i.codigo === 'HORAS_SIN_DEFINIR' && i.cargaId === 'c2'));
  assert.deepEqual(preparada.gruposSeleccionados, ['g1', 'g2']);
  assert.equal(sesiones.length, 1);
});
