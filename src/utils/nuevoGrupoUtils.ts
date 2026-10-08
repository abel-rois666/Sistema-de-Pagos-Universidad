import { normalizeGrado } from './formatUtils';

export interface AsignaturaNuevoGrupo {
  id: string;
  nombre: string;
  clave_legado: string;
  numero_periodo: number | null;
  activo: boolean | null;
}

export interface AlumnoNuevoGrupo {
  id: string;
  nombre_completo: string;
  matricula: string | null;
  licenciatura: string | null;
  grado_actual: string | null;
  turno: string | null;
  estatus: string | null;
  planVigenteIds?: string[];
}

export const periodosDelPlan = (asignaturas: AsignaturaNuevoGrupo[]): number[] =>
  [...new Set(asignaturas.filter(a => a.activo !== false && Number.isInteger(a.numero_periodo) && (a.numero_periodo || 0) > 0)
    .map(a => a.numero_periodo as number))].sort((a, b) => a - b);

export const asignaturasDelGrado = (asignaturas: AsignaturaNuevoGrupo[], grado: number): string[] =>
  asignaturas.filter(a => a.activo !== false && a.numero_periodo === grado).map(a => a.id);

export const coincideAlumnoGrupo = (alumno: AlumnoNuevoGrupo, carrera: string, grado: number, turno: string): boolean =>
  alumno.estatus?.toUpperCase() === 'ACTIVO'
  && normalizeGrado(alumno.grado_actual) === String(grado)
  && alumno.turno?.trim().toUpperCase() === turno.toUpperCase()
  && !!carrera
  && !!alumno.licenciatura
  && alumno.licenciatura.toLocaleLowerCase('es').includes(carrera.toLocaleLowerCase('es'));

export const coincideAlumnoMultigrado = (alumno: AlumnoNuevoGrupo, planId: string, gradoInicio: number, gradoFin: number, turno: string): boolean => {
  const grado = Number(normalizeGrado(alumno.grado_actual));
  return alumno.estatus?.toUpperCase() === 'ACTIVO'
    && alumno.planVigenteIds?.includes(planId) === true
    && Number.isInteger(grado) && grado >= gradoInicio && grado <= gradoFin
    && alumno.turno?.trim().toUpperCase() === turno.toUpperCase();
};

export const ordenarAsignaturasGrupo = (asignaturas: AsignaturaNuevoGrupo[], grado: number): AsignaturaNuevoGrupo[] =>
  [...asignaturas].sort((a, b) => Number(b.numero_periodo === grado) - Number(a.numero_periodo === grado)
    || (a.numero_periodo || 0) - (b.numero_periodo || 0)
    || a.nombre.localeCompare(b.nombre, 'es'));
