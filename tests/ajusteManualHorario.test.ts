import assert from 'node:assert/strict';
import test from 'node:test';
import { dividirBloque, evaluarDestinoBloque, evaluarDestinoTramo, marcasGrupoHorario, revisarAjusteManual } from '../src/horarios/ajusteManual.ts';
import { incumplimientosEstrictos } from '../src/horarios/politicaHorario.ts';
import { validarSesiones } from '../src/horarios/motor.ts';
import type { EntradaHorario, SesionHorario } from '../src/horarios/types.ts';

function datos(): { entrada: EntradaHorario; sesiones: SesionHorario[] } {
  const entrada: EntradaHorario = {
    grupos: [
      { id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO', aula: 'A101', sede: 'Centro' },
      { id: 'g2', codigo: '1B', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO', aula: 'A101', sede: 'Centro' },
    ],
    docentes: [
      { id: 'd1', nombre: 'Ana', activo: true, disponibilidad: [
        { dia: 1, inicio: 7, fin: 13 }, { dia: 2, inicio: 7, fin: 13 },
      ], planes: ['p1'], asignaturasPreferidas: ['a1', 'a3'], gruposRestringidos: [] },
      { id: 'd2', nombre: 'Luis', activo: true, disponibilidad: [
        { dia: 1, inicio: 7, fin: 13 },
      ], planes: ['p1'], asignaturasPreferidas: ['a2'], gruposRestringidos: [] },
    ],
    cargas: [
      { id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Historia', horasTotales: 2,
        horasPresenciales: 2, horasAsincronas: 0, docenteId: 'd1' },
      { id: 'c2', grupoId: 'g1', asignaturaId: 'a2', asignatura: 'Inglés', horasTotales: 1,
        horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd2' },
      { id: 'c3', grupoId: 'g2', asignaturaId: 'a3', asignatura: 'Ética', horasTotales: 1,
        horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' },
    ],
    configuracion: { maxHuecoGrupo: 0, maxHuecoDocente: 0, minHorasGrupo: 2, minHorasDocente: 2 },
  };
  const sesiones: SesionHorario[] = [
    { cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1', docenteId: 'd1', dia: 1,
      inicio: 7, fin: 9, aula: 'A101', sede: 'Centro' },
    { cargaId: 'c2', grupoId: 'g1', asignaturaId: 'a2', docenteId: 'd2', dia: 1,
      inicio: 10, fin: 11, aula: 'A101', sede: 'Centro' },
    { cargaId: 'c3', grupoId: 'g2', asignaturaId: 'a3', docenteId: 'd1', dia: 2,
      inicio: 7, fin: 8, aula: 'A101', sede: 'Centro' },
  ];
  return { entrada, sesiones };
}

test('mover un bloque conserva duración, asignación y horas semanales', () => {
  const { entrada, sesiones } = datos();
  const resultado = evaluarDestinoBloque(entrada, sesiones, 1, 1, 9);
  assert.equal(resultado.permitido, true);
  assert.equal(resultado.sesiones?.[1].inicio, 9);
  assert.equal(resultado.sesiones?.[1].fin, 10);
  assert.equal(resultado.sesiones?.[1].docenteId, 'd2');
  assert.equal(sesiones[1].inicio, 10);
  assert.deepEqual(validarSesiones(resultado.sesiones!, entrada).filter(i => i.codigo !== 'JORNADA_CORTA_GRUPO'), []);
});

test('rechaza turno, indisponibilidad y empalmes de grupo, docente y aula', () => {
  const { entrada, sesiones } = datos();
  assert.match(evaluarDestinoBloque(entrada, sesiones, 0, 6, 7).motivo, /turno/);
  assert.match(evaluarDestinoBloque(entrada, sesiones, 1, 2, 10).motivo, /disponibilidad/);
  assert.match(evaluarDestinoBloque(entrada, sesiones, 1, 1, 7).motivo, /grupo/);
  assert.match(evaluarDestinoBloque(entrada, sesiones, 0, 2, 7).motivo, /Ana/);
  entrada.docentes[1].disponibilidad.push({ dia: 2, inicio: 7, fin: 13 });
  assert.match(evaluarDestinoBloque(entrada, sesiones, 1, 2, 7).motivo, /aula/);
});

test('divide una sesión y permite mover solo una hora sin perder la otra', () => {
  const { entrada, sesiones } = datos();
  const divididas = dividirBloque(sesiones, 0);
  assert.deepEqual(divididas.slice(0, 2).map(sesion => [sesion.inicio, sesion.fin]), [[7, 8], [8, 9]]);
  const resultado = evaluarDestinoBloque(entrada, divididas, 1, 2, 9);
  assert.equal(resultado.permitido, true);
  assert.deepEqual(resultado.sesiones?.slice(0, 2).map(sesion => [sesion.dia, sesion.inicio]), [[1, 7], [2, 9]]);
  assert.ok(!validarSesiones(resultado.sesiones!, entrada).some(i => i.codigo === 'HORAS_INCOMPLETAS'));
});

test('el editor bloquea un tramo que dejaría la misma materia separada en un día', () => {
  const { entrada } = datos();
  entrada.grupos = [entrada.grupos[0]];
  entrada.docentes = [entrada.docentes[0]];
  entrada.cargas = [{ ...entrada.cargas[0], horasTotales: 3, horasPresenciales: 3 }];
  const sesiones: SesionHorario[] = [{ cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1',
    docenteId: 'd1', dia: 1, inicio: 7, fin: 10, aula: 'A101', sede: 'Centro' }];
  const resultado = evaluarDestinoTramo(entrada, sesiones, 0, 9, 1, 1, 11, false, 'flexible');
  assert.equal(resultado.permitido, false);
  assert.match(resultado.motivo, /continuas/);
  assert.deepEqual(sesiones.map(sesion => [sesion.inicio, sesion.fin]), [[7, 10]]);
});

test('rechaza mover una clase sobre una ocupación publicada de otro ciclo', () => {
  const { entrada, sesiones } = datos();
  entrada.ocupacionesExternas = [{ cargaId: 'externa', grupoId: 'otro', asignaturaId: 'otra',
    docenteId: 'd1', dia: 2, inicio: 9, fin: 10, aula: 'B201', sede: 'Centro' }];
  assert.match(evaluarDestinoBloque(entrada, sesiones, 0, 2, 9).motivo, /Ana/);
  entrada.ocupacionesExternas[0] = { ...entrada.ocupacionesExternas[0], docenteId: 'otro-docente', aula: 'A101' };
  assert.match(evaluarDestinoBloque(entrada, sesiones, 0, 2, 9).motivo, /aula/);
});

test('marca huecos, jornadas cortas y vacantes en sus celdas y actualiza observaciones', () => {
  const { entrada, sesiones } = datos();
  const marcas = marcasGrupoHorario(entrada, sesiones, 'g1');
  assert.ok(marcas.get('1:9')?.has('hueco'));
  assert.ok(marcas.get('1:10')?.has('docente'));
  const movidas = evaluarDestinoBloque(entrada, sesiones, 1, 1, 9).sesiones!;
  assert.ok(!marcasGrupoHorario(entrada, movidas, 'g1').get('1:9')?.has('hueco'));
  assert.ok(!revisarAjusteManual(entrada, movidas).some(i => i.codigo === 'HUECO_GRUPO' && i.grupoId === 'g1'));
  entrada.cargas[1].docenteId = 'vacante:c2';
  movidas[1] = { ...movidas[1], docenteId: 'vacante:c2' };
  assert.ok(marcasGrupoHorario(entrada, movidas, 'g1').get('1:9')?.has('vacante'));
});

test('mueve dos horas contiguas de una vez cuando cada movimiento individual violaría Estricto', () => {
  const { entrada } = datos();
  entrada.grupos = [entrada.grupos[0]];
  entrada.docentes = [entrada.docentes[0]];
  entrada.cargas = [{ ...entrada.cargas[0], horasTotales: 4, horasPresenciales: 4 }];
  const sesiones: SesionHorario[] = [{ cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1',
    docenteId: 'd1', dia: 1, inicio: 7, fin: 11, aula: 'A101', sede: 'Centro' }];
  const unaHora = evaluarDestinoTramo(entrada, sesiones, 0, 9, 1, 2, 7, true, 'estricto');
  assert.equal(unaHora.permitido, false);
  const dosHoras = evaluarDestinoTramo(entrada, sesiones, 0, 9, 2, 2, 7, true, 'estricto');
  assert.equal(dosHoras.permitido, true);
  assert.deepEqual(dosHoras.sesiones?.map(sesion => [sesion.dia, sesion.inicio, sesion.fin]),
    [[1, 7, 9], [2, 7, 9]]);
  assert.deepEqual(incumplimientosEstrictos(revisarAjusteManual(entrada, dosHoras.sesiones!)), []);
  assert.deepEqual(validarSesiones(dosHoras.sesiones!, entrada), []);
  assert.deepEqual(sesiones.map(sesion => [sesion.dia, sesion.inicio, sesion.fin]), [[1, 7, 11]]);
});

test('un tramo conjunto exige disponibilidad durante todas sus horas y no modifica el origen si falla', () => {
  const { entrada } = datos();
  entrada.grupos = [entrada.grupos[0]];
  entrada.docentes = [entrada.docentes[0]];
  entrada.docentes[0].disponibilidad = [{ dia: 1, inicio: 7, fin: 11 }, { dia: 2, inicio: 7, fin: 8 }];
  entrada.cargas = [{ ...entrada.cargas[0], horasTotales: 4, horasPresenciales: 4 }];
  const sesiones: SesionHorario[] = [{ cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1',
    docenteId: 'd1', dia: 1, inicio: 7, fin: 11, aula: 'A101', sede: 'Centro' }];
  assert.match(evaluarDestinoTramo(entrada, sesiones, 0, 9, 2, 2, 7, true, 'estricto').motivo,
    /disponibilidad/);
  assert.equal(sesiones[0].fin, 11);
});
