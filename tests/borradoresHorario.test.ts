import assert from 'node:assert/strict';
import test from 'node:test';
import { crearContenidoBorrador, firmaContenidoBorrador, recuperarContenidoBorrador } from '../src/horarios/borradores';
import type { EntradaHorario, SesionHorario } from '../src/horarios/types';
import { idVacanteLicenciatura } from '../src/horarios/vacantes.ts';

const base = (): EntradaHorario => ({
  grupos: [{ id: 'grupo-1', codigo: '1A', cicloId: 'ciclo-1', planId: 'plan-1', turno: 'MATUTINO' }],
  docentes: [{ id: 'docente-1', nombre: 'Docente', activo: true,
    disponibilidad: [{ dia: 1, inicio: 7, fin: 13 }], planes: ['plan-1'],
    asignaturasPreferidas: ['materia-1'], gruposRestringidos: [] }],
  cargas: [{ id: 'carga-1', grupoId: 'grupo-1', asignaturaId: 'materia-1', asignatura: 'Materia',
    horasTotales: 2, horasPresenciales: 2, horasAsincronas: 0, docenteId: 'docente-1' }],
  configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1, minHorasGrupo: 2, minHorasDocente: 2 },
});
const sesion: SesionHorario = { cargaId: 'carga-1', grupoId: 'grupo-1', asignaturaId: 'materia-1',
  docenteId: 'vacante:carga-1', dia: 1, inicio: 7, fin: 9 };

test('recupera una vacante y sus sesiones si las fuentes no cambiaron', () => {
  const origen = base();
  const editada = base(); editada.cargas[0].docenteId = 'vacante:carga-1';
  const contenido = crearContenidoBorrador(origen, editada, {
    gruposSeleccionados: ['grupo-1'], cargasIncluidas: ['carga-1'], ubicacionesEditadas: {},
    sesiones: [sesion], modo: 'automatico', politica: 'estricto', permitirVacantes: true,
    permitirNoPreferidas: false, cargasFijas: ['carga-1'], omitirComplementarias: false,
  });
  const recuperado = recuperarContenidoBorrador(base(), contenido);
  assert.equal(recuperado.cambiado, false);
  assert.equal(recuperado.entrada.cargas[0].docenteId, 'vacante:carga-1');
  assert.deepEqual(recuperado.sesiones, [sesion]);
});

test('conserva la identidad compartida de una vacante al guardar y recuperar', () => {
  const origen = base();
  origen.cargas.push({ ...origen.cargas[0], id: 'carga-2', asignaturaId: 'materia-2', asignatura: 'Otra materia' });
  const editada = structuredClone(origen);
  const vacante = idVacanteLicenciatura(origen.grupos[0], 1);
  editada.cargas.forEach(carga => { carga.docenteId = vacante; });
  const sesiones: SesionHorario[] = [
    { ...sesion, docenteId: vacante },
    { ...sesion, cargaId: 'carga-2', asignaturaId: 'materia-2', docenteId: vacante, inicio: 9, fin: 11 },
  ];
  const contenido = crearContenidoBorrador(origen, editada, {
    gruposSeleccionados: ['grupo-1'], cargasIncluidas: ['carga-1', 'carga-2'], ubicacionesEditadas: {},
    sesiones, modo: 'manual', politica: 'flexible', permitirVacantes: true,
    permitirNoPreferidas: false, cargasFijas: [], omitirComplementarias: false,
  });
  const recuperado = recuperarContenidoBorrador(origen, contenido);
  assert.equal(recuperado.cambiado, false);
  assert.deepEqual(recuperado.entrada.cargas.map(c => c.docenteId), [vacante, vacante]);
  assert.deepEqual(recuperado.sesiones, sesiones);
});

test('conserva elecciones pero descarta sesiones cuando cambian datos académicos', () => {
  const contenido = crearContenidoBorrador(base(), base(), {
    gruposSeleccionados: ['grupo-1'], cargasIncluidas: ['carga-1'], ubicacionesEditadas: {},
    sesiones: [{ ...sesion, docenteId: 'docente-1' }], modo: 'manual', politica: 'flexible',
    permitirVacantes: false, permitirNoPreferidas: false, cargasFijas: [], omitirComplementarias: false,
  });
  const actual = base(); actual.docentes[0].disponibilidad = [];
  const recuperado = recuperarContenidoBorrador(actual, contenido);
  assert.equal(recuperado.cambiado, true);
  assert.deepEqual(recuperado.sesiones, []);
  assert.deepEqual(contenido.sesiones, [{ ...sesion, docenteId: 'docente-1' }]);
});

test('rechaza un borrador cuya materia ya no existe', () => {
  const contenido = crearContenidoBorrador(base(), base(), {
    gruposSeleccionados: ['grupo-1'], cargasIncluidas: ['carga-1'], ubicacionesEditadas: {},
    sesiones: [], modo: 'manual', politica: 'flexible', permitirVacantes: false,
    permitirNoPreferidas: false, cargasFijas: [], omitirComplementarias: false,
  });
  const actual = base(); actual.cargas = [];
  assert.throws(() => recuperarContenidoBorrador(actual, contenido), /ya no existen/);
});

test('compara el contenido aunque JSONB reordene las claves', () => {
  const contenido = crearContenidoBorrador(base(), base(), {
    gruposSeleccionados: ['grupo-1'], cargasIncluidas: ['carga-1'], ubicacionesEditadas: {},
    sesiones: [], modo: 'manual', politica: 'flexible', permitirVacantes: false,
    permitirNoPreferidas: false, cargasFijas: [], omitirComplementarias: false,
  });
  const reordenado = Object.fromEntries(Object.entries(contenido).reverse()) as typeof contenido;
  assert.equal(firmaContenidoBorrador(contenido), firmaContenidoBorrador(reordenado));
});
