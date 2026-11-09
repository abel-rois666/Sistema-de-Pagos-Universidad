import type { CicloEscolar } from '../types';

export const MOTIVOS_CONCILIACION = [
  { valor: 'CORRECCION_ASOCIACION', etiqueta: 'Corrección de asociación' },
  { valor: 'PAGO_ANTICIPADO', etiqueta: 'Pago anticipado' },
  { valor: 'REGULARIZACION_HISTORICA', etiqueta: 'Regularización de un pago histórico' },
  { valor: 'OTRO', etiqueta: 'Otro motivo documentado' },
] as const;
export interface RespaldoConciliacion { motivo: string; evidencia: string }

/** El nombre determina el recorrido de revisión; el servidor vuelve a resolver ambos IDs. */
export function contextoEntrePeriodos(origenId: string | null | undefined, destinosIds: readonly (string | undefined)[], ciclos: readonly CicloEscolar[]): 'incompleto' | 'mismo_periodo' | 'entre_periodos' {
  const origen = ciclos.find(c => c.id === origenId)?.nombre?.trim();
  if (!origen || !destinosIds.length) return 'incompleto';
  const destinos = destinosIds.map(id => ciclos.find(c => c.id === id)?.nombre?.trim());
  if (destinos.some(n => !n)) return 'incompleto';
  return destinos.some(n => n !== origen) ? 'entre_periodos' : 'mismo_periodo';
}
export function validarRespaldoConciliacion(respaldo: RespaldoConciliacion): string | null {
  if (!MOTIVOS_CONCILIACION.some(m => m.valor === respaldo.motivo)) return 'Selecciona el motivo de la conciliación entre periodos.';
  const longitud = respaldo.evidencia.trim().length;
  if (longitud < 5 || longitud > 2000) return 'Describe el respaldo de la conciliación (entre 5 y 2,000 caracteres).';
  return null;
}
