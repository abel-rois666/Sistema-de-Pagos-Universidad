import type { CicloEscolar, PaymentPlan } from '../types';

export const TODOS_PERIODOS = '__todos__';
export const SIN_PERIODO = '__sin_periodo__';
export function periodoPlan(plan: PaymentPlan, ciclos: readonly CicloEscolar[]): string {
  return ciclos.find(c => c.id === plan.ciclo_id)?.nombre || plan.ciclo_escolar || SIN_PERIODO;
}
export function periodosFinancieros(ciclos: readonly CicloEscolar[], planes: readonly PaymentPlan[] = []): string[] {
  return [...new Set([...ciclos.map(c => c.nombre), ...planes.map(p => periodoPlan(p, ciclos))].filter(Boolean))]
    .sort((a, b) => a === SIN_PERIODO ? 1 : b === SIN_PERIODO ? -1 : b.localeCompare(a, 'es', { numeric: true }));
}
export function filtrarPeriodoPlanes(planes: readonly PaymentPlan[], ciclos: readonly CicloEscolar[], periodo: string) {
  return planes.filter(p => periodo === TODOS_PERIODOS || periodoPlan(p, ciclos) === periodo);
}
export interface ConceptoFinanciero { indice: number; concepto: string; cantidad: number; estatus: string; fecha?: string | null }
/** Los detalles normalizados son la fuente completa; nunca rellenar índices residuales. */
export function conceptosFinancieros(plan: PaymentPlan): ConceptoFinanciero[] {
  if (plan.detalles?.length) return plan.detalles.filter(d => d.concepto?.trim()).map(d => ({
    indice: d.indice_concepto, concepto: d.concepto, cantidad: Number(d.cantidad || 0), estatus: d.estatus || 'PENDIENTE', fecha: d.fecha_vencimiento,
  })).sort((a,b) => a.indice-b.indice);
  return Array.from({ length: 18 }, (_, i) => i+1).flatMap(indice => {
    const p = plan as unknown as Record<string, unknown>;
    return String(p[`concepto_${indice}`] || '').trim() ? [{ indice, concepto: String(p[`concepto_${indice}`]),
      cantidad: Number(p[`cantidad_${indice}`] || 0), estatus: String(p[`estatus_${indice}`] || 'PENDIENTE'), fecha: String(p[`fecha_${indice}`] || '') }] : [];
  });
}
export function saldoConcepto(cantidad: number, estatus: string): { pendiente: number; estado: 'pendiente' | 'parcial' | 'pagado' | 'revisar' } {
  if (!Number.isFinite(cantidad) || cantidad < 0) return { pendiente: 0, estado: 'revisar' };
  const total = Math.max(0, Math.round(cantidad*100));
  const texto = (estatus || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const resta = texto.match(/RESTA\s*\$\s*([0-9,]+(?:\.\d{1,2})?)/);
  if (resta) {
    const centavos = Math.round(Number(resta[1].replaceAll(',', ''))*100);
    return centavos <= total ? { pendiente: centavos/100, estado: centavos ? 'parcial' : 'pagado' } : { pendiente: total/100, estado: 'revisar' };
  }
  if (!texto || /^(PENDIENTE|NO\s+PAGADO)$/.test(texto)) return { pendiente: total/100, estado: 'pendiente' };
  if (/\bPAGADO\b/.test(texto) && !/\b(NO\s+PAGADO|PENDIENTE|ABONO|CANCELADO|BAJA)\b/.test(texto)) return { pendiente: 0, estado: 'pagado' };
  return { pendiente: total/100, estado: 'revisar' };
}
export function describirPlan(plan: PaymentPlan, ciclos: readonly CicloEscolar[]): string {
  const ciclo = ciclos.find(c => c.id === plan.ciclo_id);
  return `${periodoPlan(plan, ciclos) === SIN_PERIODO ? 'Sin periodo' : periodoPlan(plan, ciclos)} · Ciclo ${ciclo?.tipo_periodo || 'sin tipo'} · Plan ${plan.tipo_plan || 'sin tipo'} · ${plan.no_plan_pagos || 'sin folio'}`;
}
