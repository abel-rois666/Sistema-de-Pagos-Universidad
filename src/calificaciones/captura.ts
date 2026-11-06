import type { InscripcionAcademica } from '../types';

export type CampoCaptura = 'parcial_1' | 'parcial_2' | 'parcial_3' | 'calificacion_final' | 'observaciones' | 'tipo_evaluacion'
  | 'bloqueo_p1' | 'bloqueo_p2' | 'bloqueo_p3' | 'bloqueo_final' | 'solicitud_p1' | 'solicitud_p2' | 'solicitud_p3' | 'solicitud_final';
export type ValorCaptura = string | number | boolean | null;
const parciales = ['parcial_1', 'parcial_2', 'parcial_3'] as const;

export function normalizarValorCaptura(campo: CampoCaptura, raw: ValorCaptura): ValorCaptura {
  if ([...parciales, 'calificacion_final'].includes(campo)) {
    if (raw === null || raw === '' || (typeof raw === 'string' && !raw.trim())) return null;
    const numero = Number(raw);
    if (typeof raw === 'boolean' || !Number.isFinite(numero) || (numero !== -555 && (numero < 0 || numero > 10))) throw new Error('La calificación debe estar entre 0 y 10, o NP.');
    return numero;
  }
  return raw;
}

/** Regla existente de parciales, NP, redondeo y final manual, compartida por ambas capturas. */
export function aplicarCambioCaptura(actual: Partial<InscripcionAcademica>, campo: CampoCaptura, valor: ValorCaptura, nivel: string, minima: number, restaurar = false): Partial<InscripcionAcademica> {
  const updated: Partial<InscripcionAcademica> = { ...actual, [campo]: valor };
  if (campo === 'parcial_1') updated.bloqueo_p1 = valor !== null;
  if (campo === 'parcial_2') updated.bloqueo_p2 = valor !== null;
  if (campo === 'parcial_3') updated.bloqueo_p3 = valor !== null;
  if (campo === 'calificacion_final') {
    updated.bloqueo_final = valor !== null;
    if (restaurar) updated.modificada_manualmente = false;
    else if (valor !== null) updated.modificada_manualmente = true;
  }
  if ((parciales.includes(campo as typeof parciales[number]) || restaurar) && !updated.modificada_manualmente) {
    const notas = parciales.map(p => updated[p]);
    if (notas.every(n => typeof n === 'number' && Number.isFinite(n))) {
      const todasNP = notas.every(n => n === -555);
      const promedio = notas.reduce((suma, n) => suma + (n === -555 ? 0 : n), 0) / 3;
      updated.promedio_calculado = todasNP ? -555 : Number(promedio.toFixed(2));
      updated.calificacion_final = todasNP ? -555 : Math.round(promedio);
      updated.bloqueo_final = true;
    } else { updated.promedio_calculado = null; updated.calificacion_final = null; updated.bloqueo_final = false; }
  }
  if (nivel === 'Especialidad' && campo === 'calificacion_final') {
    updated.parcial_1 = updated.calificacion_final;
    updated.promedio_calculado = updated.calificacion_final;
  }
  updated.estatus = updated.calificacion_final == null ? null : updated.calificacion_final >= minima ? 'ACREDITADA' : 'REPROBADA';
  return updated;
}
