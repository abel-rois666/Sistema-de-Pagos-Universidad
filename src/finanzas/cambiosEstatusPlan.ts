import type { PaymentPlan } from '../types';
import { conceptosFinancieros } from './consulta';

/** Un índice legado solo deja de ser ambiguo si todos sus vínculos activos son de otros planes. */
export function referenciaHistoricaRequiereRevision(planId: string, vinculos: readonly {plan_id: string; anulado_en: string | null}[]): boolean {
  const activos = vinculos.filter(v => v.anulado_en === null);
  return activos.length === 0 || activos.some(v => v.plan_id === planId);
}

/** Vacío y Pendiente representan el mismo estado inicial, nunca un pago liberado. */
export function normalizarEstatusPlan(valor: unknown): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  return !texto || texto.toLocaleUpperCase('es-MX') === 'PENDIENTE' ? 'PENDIENTE' : texto;
}

export function indicesRestablecidosPlan(original: PaymentPlan, captura: Partial<PaymentPlan>): number[] {
  if (captura.id !== original.id) throw new Error('La captura no corresponde al plan seleccionado. Vuelve a abrir el plan.');
  // La consulta compartida prefiere detalles normalizados cuando existen.
  const anteriores = new Map(conceptosFinancieros(original).map(c => [c.indice, c.estatus]));
  const indices: number[] = [];
  for (let i = 1; i <= 18; i++) {
    const key = `estatus_${i}` as keyof PaymentPlan;
    const anterior = normalizarEstatusPlan(anteriores.get(i) ?? original[key]);
    const siguiente = normalizarEstatusPlan(captura[key] === undefined ? anterior : captura[key]);
    if (anterior !== 'PENDIENTE' && siguiente === 'PENDIENTE') indices.push(i);
  }
  return indices;
}
