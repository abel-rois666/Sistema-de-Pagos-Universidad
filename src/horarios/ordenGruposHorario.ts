import type { GrupoHorario } from './types';

const comparador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

const compararLicenciatura = (a: GrupoHorario, b: GrupoHorario) => {
  const nombreA = a.carreraNombre?.trim() || '';
  const nombreB = b.carreraNombre?.trim() || '';
  if (!nombreA) return nombreB ? 1 : 0;
  if (!nombreB) return -1;
  return comparador.compare(nombreA, nombreB);
};

/** Orden de presentación; no modifica el orden de entrada del generador. */
export const ordenarGruposHorario = (grupos: readonly GrupoHorario[]): GrupoHorario[] =>
  [...grupos].sort((a, b) => compararLicenciatura(a, b)
    || comparador.compare(a.turno, b.turno)
    || comparador.compare(a.codigo, b.codigo)
    || comparador.compare(a.id, b.id));
