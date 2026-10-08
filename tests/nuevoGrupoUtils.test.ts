import assert from 'node:assert/strict';
import test from 'node:test';
import { asignaturasDelGrado, coincideAlumnoGrupo, coincideAlumnoMultigrado, ordenarAsignaturasGrupo, periodosDelPlan } from '../src/utils/nuevoGrupoUtils';
import type { AlumnoNuevoGrupo, AsignaturaNuevoGrupo } from '../src/utils/nuevoGrupoUtils';

const materias: AsignaturaNuevoGrupo[] = [
  { id: 'a', nombre: 'Historia', clave_legado: 'H1', numero_periodo: 1, activo: true },
  { id: 'b', nombre: 'Derecho', clave_legado: 'D2', numero_periodo: 2, activo: true },
  { id: 'c', nombre: 'Ética', clave_legado: 'E1', numero_periodo: 1, activo: null },
  { id: 'd', nombre: 'Archivada', clave_legado: 'A3', numero_periodo: 3, activo: false },
  { id: 'e', nombre: 'Sin bloque', clave_legado: 'SB', numero_periodo: null, activo: true },
];

test('los grados provienen de materias vigentes y preseleccionan solo su periodo', () => {
  assert.deepEqual(periodosDelPlan(materias), [1, 2]);
  assert.deepEqual(asignaturasDelGrado(materias, 1), ['a', 'c']);
  assert.deepEqual(ordenarAsignaturasGrupo(materias, 2).map(item => item.id).slice(0, 1), ['b']);
});

test('la sugerencia de alumnos exige estatus activo, carrera, grado y turno compatibles', () => {
  const alumno: AlumnoNuevoGrupo = {
    id: 'al', nombre_completo: 'ANA LÓPEZ', matricula: 'M1', licenciatura: 'Licenciatura en Pedagogía',
    grado_actual: '1ER', turno: 'Matutino', estatus: 'ACTIVO',
  };
  assert.equal(coincideAlumnoGrupo(alumno, 'Pedagogía', 1, 'Matutino'), true);
  assert.equal(coincideAlumnoGrupo({ ...alumno, estatus: 'BAJA' }, 'Pedagogía', 1, 'Matutino'), false);
  assert.equal(coincideAlumnoGrupo(alumno, 'Pedagogía', 2, 'Matutino'), false);
  assert.equal(coincideAlumnoGrupo(alumno, 'Pedagogía', 1, 'Vespertino'), false);
  assert.equal(coincideAlumnoGrupo(alumno, 'Derecho', 1, 'Matutino'), false);
});

test('el rango multigrado es inclusivo y exige el mismo plan vigente y turno', () => {
  const alumno: AlumnoNuevoGrupo = {
    id: 'al', nombre_completo: 'ANA LÓPEZ', matricula: 'M1', licenciatura: 'Pedagogía',
    grado_actual: '4TO', turno: 'Matutino', estatus: 'ACTIVO', planVigenteIds: ['plan-a'],
  };
  assert.equal(coincideAlumnoMultigrado(alumno, 'plan-a', 1, 4, 'Matutino'), true);
  assert.equal(coincideAlumnoMultigrado(alumno, 'plan-a', 1, 3, 'Matutino'), false);
  assert.equal(coincideAlumnoMultigrado(alumno, 'plan-b', 1, 4, 'Matutino'), false);
  assert.equal(coincideAlumnoMultigrado({ ...alumno, estatus: 'BAJA' }, 'plan-a', 1, 4, 'Matutino'), false);
  assert.equal(coincideAlumnoMultigrado(alumno, 'plan-a', 1, 4, 'Mixto'), false);
});
