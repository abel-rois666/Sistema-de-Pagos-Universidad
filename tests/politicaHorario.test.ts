import assert from 'node:assert/strict';
import test from 'node:test';
import { asignarDocentesYGenerar } from '../src/horarios/asignacionAutomatica.ts';
import { dividirBloque, evaluarDestinoBloque } from '../src/horarios/ajusteManual.ts';
import { optimizarHorarioManual } from '../src/horarios/optimizacionHorario.ts';
import { incumplimientosEstrictos } from '../src/horarios/politicaHorario.ts';
import { idVacante } from '../src/horarios/vacantes.ts';
import type { EntradaHorario } from '../src/horarios/types.ts';

function entrada(): EntradaHorario {
  return {
    grupos: [{ id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO' }],
    docentes: [{ id: 'd1', nombre: 'Docente Uno', activo: true, planes: ['p1'],
      asignaturasPreferidas: ['a1'], gruposRestringidos: [],
      disponibilidad: [{ dia: 1, inicio: 7, fin: 8 }, { dia: 2, inicio: 7, fin: 8 }] }],
    cargas: [{ id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Historia',
      horasTotales: 2, horasPresenciales: 2, horasAsincronas: 0, docenteId: null }],
    configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1, minHorasGrupo: 2, minHorasDocente: 2 },
  };
}

test('Flexible conserva docente real y advierte jornadas cortas; Estricto elige vacante permitida', async () => {
  const datos = entrada();
  const opciones = { permitirNoPreferidas: false, permitirVacantes: true, cargasFijas: new Set<string>() };
  const flexible = await asignarDocentesYGenerar(datos, { ...opciones, politica: 'flexible' });
  assert.equal(flexible.completo, true);
  assert.equal(flexible.entrada.cargas[0].docenteId, 'd1');
  assert.ok(incumplimientosEstrictos(flexible.incidencias).length > 0);

  const estricto = await asignarDocentesYGenerar(datos, { ...opciones, politica: 'estricto' });
  assert.equal(estricto.completo, true);
  assert.equal(estricto.entrada.cargas[0].docenteId, idVacante('c1'));
  assert.deepEqual(incumplimientosEstrictos(estricto.incidencias), []);
  assert.equal(estricto.propuestas[0].metricas.vacantes, 1);
});

test('Estricto sin vacantes informa incumplimientos sin entregar un horario inválido', async () => {
  const resultado = await asignarDocentesYGenerar(entrada(), {
    permitirNoPreferidas: false, permitirVacantes: false, politica: 'estricto', cargasFijas: new Set(),
  });
  assert.equal(resultado.completo, false);
  assert.deepEqual(resultado.propuestas, []);
  assert.ok(resultado.incidencias.some(incidencia => incidencia.codigo === 'JORNADA_CORTA_GRUPO'));
});

test('Manual mantiene los avisos en Flexible y exige los mínimos en Estricto', () => {
  const datos = entrada();
  datos.cargas[0].docenteId = 'd1';
  const flexible = optimizarHorarioManual(datos, { politica: 'flexible' });
  assert.equal(flexible.propuestas.length, 1);
  const estricto = optimizarHorarioManual(datos, { politica: 'estricto' });
  assert.equal(estricto.propuestas.length, 0);
  assert.ok(estricto.incidencias.some(incidencia => incidencia.codigo === 'JORNADA_CORTA_DOCENTE'));
});

test('el ajuste manual rechaza una jornada corta en Estricto y la advierte en Flexible', () => {
  const datos = entrada();
  datos.docentes[0].disponibilidad = [
    { dia: 1, inicio: 7, fin: 9 }, { dia: 2, inicio: 7, fin: 8 },
  ];
  datos.cargas[0].docenteId = 'd1';
  const propuesta = optimizarHorarioManual(datos, { politica: 'estricto' }).propuestas[0];
  assert.ok(propuesta);
  const divididas = dividirBloque(propuesta.sesiones, 0);
  const flexible = evaluarDestinoBloque(datos, divididas, 0, 2, 7, true, 'flexible');
  assert.equal(flexible.permitido, true);
  assert.ok(flexible.advertencia);
  const estricto = evaluarDestinoBloque(datos, divididas, 0, 2, 7, true, 'estricto');
  assert.equal(estricto.permitido, false);
});
