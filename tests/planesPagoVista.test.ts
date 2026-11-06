import assert from 'node:assert/strict';
import test from 'node:test';
import type { Alumno, CicloEscolar, PaymentPlan } from '../src/types';
import { buscarPlanesPago, ordenarHistorialPlanes } from '../src/utils/planesPagoVista';

const ciclos = [
  { id: 'c26', nombre: '2026-3', tipo_periodo: 'Cuatrimestral', activo: false },
  { id: 'c27', nombre: '2027-1', tipo_periodo: 'Cuatrimestral', activo: true },
] as CicloEscolar[];
const alumno = { id: 'a1', matricula: 'LA-2026-1001', nombre_completo: 'ÁLVAREZ LÓPEZ ANA' } as Alumno;
const planes = [
  { id: 'p26', alumno_id: 'a1', nombre_alumno: alumno.nombre_completo,
    no_plan_pagos: '263-101', ciclo_id: 'c26', ciclo_escolar: '2026-3', tipo_plan: 'Cuatrimestral' },
  { id: 'p27', alumno_id: 'a1', nombre_alumno: alumno.nombre_completo,
    no_plan_pagos: '271-101', ciclo_id: 'c27', ciclo_escolar: '2027-1', tipo_plan: 'Cuatrimestral' },
] as PaymentPlan[];

test('el historial muestra primero el ciclo más reciente sin depender del orden recibido', () => {
  assert.deepEqual(ordenarHistorialPlanes(planes, ciclos).map(plan => plan.id), ['p27', 'p26']);
});

test('la búsqueda permite nombre sin acentos, matrícula, folio y ciclo', () => {
  for (const termino of ['alvarez', 'LA-2026-1001', '271-101', '2027-1']) {
    assert.ok(buscarPlanesPago(planes, [alumno], ciclos, termino).some(plan => plan.id === 'p27'));
  }
  assert.deepEqual(buscarPlanesPago(planes, [alumno], ciclos, 'sin coincidencia'), []);
});
