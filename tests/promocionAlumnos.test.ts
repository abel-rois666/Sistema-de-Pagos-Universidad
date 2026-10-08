import assert from 'node:assert/strict';
import test from 'node:test';
import type { Alumno } from '../src/types';
import {
  calcularAccionPromocion, compararGrados,
  gradoCanonico,
  motivosBasePromocion,
} from '../src/utils/promocionAlumnos';

const alumno = (cambios: Partial<Alumno> = {}): Alumno => ({
  id: 'alumno-1', apellido_paterno: 'Prueba', nombres: 'Ana',
  nombre_completo: 'PRUEBA ANA', licenciatura: 'Derecho',
  grado_actual: '9NO', turno: 'Matutino', estatus: 'ACTIVO', ...cambios,
});

test('el filtro agrupa grados numéricos y ordinales sin alterar otros textos', () => {
  assert.equal(gradoCanonico('10'), '10');
  assert.equal(gradoCanonico('10MO'), '10');
  assert.equal(gradoCanonico('01ER'), '1');
  assert.equal(gradoCanonico('EGRESADO'), 'EGRESADO');
  assert.deepEqual(['10MO', '2', '1ER'].map(gradoCanonico).sort(compararGrados), ['1', '2', '10']);
});

test('la elegibilidad usa IDs exactos, sin confundir homónimos ni ciclos homónimos', () => {
  assert.deepEqual(motivosBasePromocion(alumno(), 'ciclo-1', new Set(['otro-alumno'])), []);
  assert.deepEqual(motivosBasePromocion(alumno(), 'ciclo-2', new Set()), []);
  assert.deepEqual(motivosBasePromocion(alumno(), 'ciclo-1', new Set(['alumno-1'])), ['PLAN_DEL_CICLO']);
  assert.deepEqual(motivosBasePromocion(alumno(), 'ciclo-1', new Set(['alumno-1']), true), []);
});

test('permitir un plan existente no omite otras causas de exclusión', () => {
  assert.deepEqual(motivosBasePromocion(
    alumno({ estatus: 'BAJA', ciclo_ultima_asignacion_grado: 'ciclo-1' }),
    'ciclo-1', new Set(['alumno-1']), true,
  ), ['ESTATUS_NO_ACTIVO', 'GRADO_YA_ASIGNADO']);
});

test('conserva todos los motivos de exclusión de un alumno una sola vez', () => {
  const motivos = motivosBasePromocion(
    alumno({ estatus: 'BAJA', ciclo_ultima_asignacion_grado: 'ciclo-1' }),
    'ciclo-1', new Set(['alumno-1']),
  );
  assert.deepEqual(motivos, ['ESTATUS_NO_ACTIVO', 'PLAN_DEL_CICLO', 'GRADO_YA_ASIGNADO']);
});

test('el último grado egresa desde el programa vigente sin escribir EGRESADO en grado', () => {
  const programa = { id: 'vigente', alumno_id: 'alumno-1', plan_id: 'plan-1', estatus: 'CURSANDO', total_periodos: 10 };
  assert.deepEqual(calcularAccionPromocion(alumno({ grado_actual: '10MO' }), programa), {
    tipo: 'EGRESO', gradoDestino: '10', programaId: 'vigente',
  });
  assert.deepEqual(calcularAccionPromocion(alumno(), programa), {
    tipo: 'AVANCE', gradoDestino: '10', programaId: 'vigente',
  });
  assert.deepEqual(calcularAccionPromocion(alumno({ grado_actual: '8VO' }), { ...programa, total_periodos: 8 }), {
    tipo: 'EGRESO', gradoDestino: '8', programaId: 'vigente',
  });
});

test('acepta programas vigentes ACTIVO o CURSANDO y excluye estatus no activos', () => {
  const programa = { id: 'vigente', alumno_id: 'alumno-1', plan_id: 'plan-1', estatus: 'ACTIVO', total_periodos: 10 };
  assert.deepEqual(calcularAccionPromocion(alumno(), programa), {
    tipo: 'AVANCE', gradoDestino: '10', programaId: 'vigente',
  });
  assert.deepEqual(calcularAccionPromocion(alumno({ grado_actual: '10MO' }), { ...programa, estatus: ' activo ' }), {
    tipo: 'EGRESO', gradoDestino: '10', programaId: 'vigente',
  });
  assert.deepEqual(calcularAccionPromocion(alumno(), { ...programa, estatus: 'CURSANDO' }), {
    tipo: 'AVANCE', gradoDestino: '10', programaId: 'vigente',
  });
  assert.deepEqual(calcularAccionPromocion(alumno(), { ...programa, estatus: 'BAJA' }), {
    tipo: 'REVISION', motivo: 'PROGRAMA_NO_ACTIVO',
  });
});

test('programa faltante o grado fuera de los periodos exige revisión', () => {
  assert.deepEqual(calcularAccionPromocion(alumno()), { tipo: 'REVISION', motivo: 'SIN_PROGRAMA_VIGENTE' });
  assert.deepEqual(calcularAccionPromocion(alumno(), {
    id: 'vigente', alumno_id: 'alumno-1', plan_id: 'plan-1', estatus: 'CURSANDO', total_periodos: 8,
  }), { tipo: 'REVISION', motivo: 'GRADO_FUERA_DEL_PLAN' });
});
