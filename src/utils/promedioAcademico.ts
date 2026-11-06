import { esAsignaturaIngles } from './asignaturaIngles';

export interface AsignaturaPromedio {
  nombre?: string | null;
  clasificacion_clave?: string | null;
  clasificacion_nombre?: string | null;
}

/** La clasificación oficial tiene prioridad; el nombre es respaldo para registros legados. */
export function esComplementaria(asignatura?: AsignaturaPromedio | null): boolean {
  if (asignatura?.clasificacion_clave) return String(asignatura.clasificacion_clave).trim() === '266';
  return asignatura?.clasificacion_nombre?.trim().toLocaleLowerCase('es') === 'complementaria' || esAsignaturaIngles(asignatura?.nombre || '');
}

export function participaEnPromedio(asignatura?: AsignaturaPromedio | null): boolean {
  if (esComplementaria(asignatura) || esAsignaturaIngles(asignatura?.nombre || '')) return false;
  return !asignatura?.clasificacion_clave || ['263', '264'].includes(String(asignatura.clasificacion_clave).trim());
}

export function promedioCicloTruncado(materias: readonly { calificacion_final?: unknown; asignaturas?: AsignaturaPromedio | AsignaturaPromedio[] | null }[]): string {
  const notas = materias.flatMap(materia => {
    const asignatura = Array.isArray(materia.asignaturas) ? materia.asignaturas[0] : materia.asignaturas;
    const valor = materia.calificacion_final;
    if (!participaEnPromedio(asignatura) || !['number', 'string'].includes(typeof valor) || (typeof valor === 'string' && !valor.trim())) return [];
    const nota = Number(valor);
    return nota === -555 ? [0] : Number.isFinite(nota) && nota >= 0 && nota <= 10 ? [nota] : [];
  });
  return notas.length ? (Math.floor(notas.reduce((a, b) => a + b, 0) / notas.length * 100) / 100).toFixed(2) : '0.00';
}
