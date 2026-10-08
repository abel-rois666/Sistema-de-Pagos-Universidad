import assert from 'node:assert/strict';
import test from 'node:test';
import { probarCambioDocente, repararAsignacionLocal } from '../src/horarios/edicionLocal.ts';
import { validarSesiones } from '../src/horarios/motor.ts';
import { agruparVacantes, idVacante, idVacanteLicenciatura } from '../src/horarios/vacantes.ts';
import type { EntradaHorario, SesionHorario } from '../src/horarios/types.ts';

function escenario(): { entrada: EntradaHorario; sesiones: SesionHorario[] } {
  const entrada: EntradaHorario = {
    grupos: [
      { id: 'g1', codigo: '1A', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO', carreraNombre: 'Derecho' },
      { id: 'g2', codigo: '1B', cicloId: 'c1', planId: 'p1', turno: 'MATUTINO', carreraNombre: 'Derecho' },
    ],
    docentes: [
      { id: 'd1', nombre: 'Ana', activo: true, planes: ['p1'], asignaturasPreferidas: ['a1'],
        gruposRestringidos: [], disponibilidad: [{ dia: 1, inicio: 7, fin: 13 }] },
      { id: 'd2', nombre: 'Luis', activo: true, planes: ['p1'], asignaturasPreferidas: ['a2'],
        gruposRestringidos: [], disponibilidad: [{ dia: 1, inicio: 7, fin: 13 }] },
    ],
    cargas: [
      { id: 'c1', grupoId: 'g1', asignaturaId: 'a1', asignatura: 'Civil', horasTotales: 1,
        horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd1' },
      { id: 'c2', grupoId: 'g2', asignaturaId: 'a2', asignatura: 'Penal', horasTotales: 1,
        horasPresenciales: 1, horasAsincronas: 0, docenteId: 'd2' },
    ],
    configuracion: { maxHuecoGrupo: 1, maxHuecoDocente: 1, minHorasGrupo: 1, minHorasDocente: 1 },
  };
  const sesiones: SesionHorario[] = [
    { cargaId: 'c1', grupoId: 'g1', asignaturaId: 'a1', docenteId: 'd1', dia: 1, inicio: 7, fin: 8 },
    { cargaId: 'c2', grupoId: 'g2', asignaturaId: 'a2', docenteId: 'd2', dia: 1, inicio: 7, fin: 8 },
  ];
  return { entrada, sesiones };
}

test('permite cambiar el docente de una materia sin regenerar ni mover otras sesiones', () => {
  const { entrada, sesiones } = escenario();
  const resultado = probarCambioDocente(entrada, sesiones, 'c2', idVacanteLicenciatura(entrada.grupos[1], 1), 'flexible');
  assert.notEqual(typeof resultado, 'string');
  if (typeof resultado === 'string') return;
  assert.equal(resultado.sesiones[0], sesiones[0]);
  assert.equal(resultado.sesiones[1].inicio, 7);
  assert.equal(resultado.entrada.cargas[1].docenteId, resultado.sesiones[1].docenteId);
  assert.equal(entrada.cargas[1].docenteId, 'd2');
});

test('rechaza empalme directo y reacomoda únicamente la materia afectada', () => {
  const { entrada, sesiones } = escenario();
  assert.equal(typeof probarCambioDocente(entrada, sesiones, 'c2', 'd1', 'flexible'), 'string');
  const reparada = repararAsignacionLocal(entrada, sesiones, 'c2', 'd1', 'flexible');
  assert.notEqual(typeof reparada, 'string');
  if (typeof reparada === 'string') return;
  assert.equal(reparada.sesiones[0], sesiones[0]);
  assert.equal(reparada.sesiones.find(s => s.cargaId === 'c2')?.inicio, 8);
  assert.equal(reparada.horasMovidas, 1);
  assert.deepEqual(validarSesiones(reparada.sesiones, reparada.entrada), []);
});

test('vacantes estables se comparten si no hay empalme y se separan al agotarse', () => {
  const { entrada, sesiones } = escenario();
  entrada.cargas.push({ ...entrada.cargas[1], id: 'c3', asignaturaId: 'a3', asignatura: 'Mercantil' });
  sesiones.push({ ...sesiones[1], cargaId: 'c3', asignaturaId: 'a3', inicio: 8, fin: 9 });
  entrada.cargas.forEach(c => { c.docenteId = idVacante(c.id); });
  sesiones.forEach(s => { s.docenteId = idVacante(s.cargaId); });
  const agrupada = agruparVacantes(entrada, sesiones);
  const ids = agrupada.entrada.cargas.map(c => c.docenteId);
  assert.equal(new Set(ids).size, 2);
  assert.equal(ids[0], ids[2]);
  assert.notEqual(ids[0], ids[1]);
  assert.equal(typeof probarCambioDocente(agrupada.entrada, agrupada.sesiones, 'c2', ids[0]!, 'flexible'), 'string');
  assert.deepEqual(validarSesiones(agrupada.sesiones, agrupada.entrada), []);
});

test('la cuarta materia de un grupo requiere otra vacante aunque no se empalme', () => {
  const { entrada } = escenario();
  entrada.grupos = [entrada.grupos[0]];
  entrada.cargas = Array.from({ length: 4 }, (_, indice) => ({ ...entrada.cargas[0],
    id: `c${indice + 1}`, asignaturaId: `a${indice + 1}`, docenteId: idVacante(`c${indice + 1}`) }));
  const sesiones = entrada.cargas.map((carga, indice) => ({ cargaId: carga.id, grupoId: 'g1',
    asignaturaId: carga.asignaturaId, docenteId: carga.docenteId!, dia: 1 as const,
    inicio: 7 + indice, fin: 8 + indice }));
  const agrupada = agruparVacantes(entrada, sesiones);
  assert.equal(new Set(agrupada.entrada.cargas.map(c => c.docenteId)).size, 2);
  assert.equal(agrupada.entrada.cargas[3].docenteId, idVacanteLicenciatura(entrada.grupos[0], 2));
  assert.deepEqual(validarSesiones(agrupada.sesiones, agrupada.entrada), []);
});
