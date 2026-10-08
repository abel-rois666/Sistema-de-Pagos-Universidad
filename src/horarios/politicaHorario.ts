import type { IncidenciaHorario } from './types';

export type PoliticaHorario = 'flexible' | 'estricto';

const codigosEstrictos = new Set([
  'HUECO_GRUPO', 'HUECO_DOCENTE', 'JORNADA_CORTA_GRUPO', 'JORNADA_CORTA_DOCENTE',
]);

export function incumplimientosEstrictos(incidencias: IncidenciaHorario[]): IncidenciaHorario[] {
  return incidencias.filter(incidencia => codigosEstrictos.has(incidencia.codigo));
}

export function cumplePoliticaHorario(incidencias: IncidenciaHorario[], politica: PoliticaHorario): boolean {
  return politica === 'flexible' || incumplimientosEstrictos(incidencias).length === 0;
}
