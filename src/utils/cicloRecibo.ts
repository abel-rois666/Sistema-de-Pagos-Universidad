import type { CicloEscolar, PaymentPlan } from '../types';
import { validarCicloPlanPago } from './cicloPlanPago';

interface ReferenciaConceptoPlan { plan_id?: string; indice_concepto_plan: number | null }
export interface ContextoCicloRecibo {
  ciclo?: CicloEscolar;
  plan?: PaymentPlan;
  error?: string;
}

export function validarConfirmacionCicloRecibo(contexto: ContextoCicloRecibo, confirmado: boolean): string | null {
  return !contexto.plan && !confirmado
    ? 'Confirma el ciclo escolar en el que se emitirá este recibo independiente.' : null;
}

/** El cobro hereda un plan identificado; un recibo independiente usa la elección local. */
export function resolverContextoCicloRecibo(ciclos: readonly CicloEscolar[], planes: readonly PaymentPlan[],
  alumnoId: string, cicloElegidoId: string, filas: readonly ReferenciaConceptoPlan[],
  planInicialId?: string): ContextoCicloRecibo {
  const vinculadas = filas.filter(fila => fila.indice_concepto_plan !== null || fila.plan_id);
  if (vinculadas.some(fila => !fila.plan_id || !Number.isInteger(fila.indice_concepto_plan)
    || Number(fila.indice_concepto_plan) < 1 || Number(fila.indice_concepto_plan) > 18))
    return { error: 'Vuelve a seleccionar el concepto del plan antes de guardar el recibo.' };
  const ids = [...new Set([...vinculadas.map(fila => fila.plan_id!), ...(planInicialId ? [planInicialId] : [])])];
  if (ids.length > 1) return { error: 'Los conceptos de distintos planes se cobran en recibos separados.' };
  const plan = ids.length ? planes.find(item => item.id === ids[0]) : undefined;
  if (ids.length && (!plan || plan.alumno_id !== alumnoId))
    return { error: 'No se pudo comprobar el plan del alumno. Actualiza los datos antes de cobrar.' };
  const ciclo = ciclos.find(item => item.id === (plan ? plan.ciclo_id : cicloElegidoId));
  if (!ciclo) return { plan, error: 'Selecciona un ciclo escolar válido para el recibo.' };
  if (plan && !planInicialId && plan.ciclo_id !== cicloElegidoId)
    return { plan, ciclo, error: 'El ciclo del plan cambió. Vuelve a seleccionar el ciclo y sus conceptos antes de cobrar.' };
  const errorPlan = plan && validarCicloPlanPago(ciclo, plan.tipo_plan);
  return { ciclo, plan, ...(errorPlan ? { error: `${errorPlan} Revisa la asociación del plan antes de cobrar.` } : {}) };
}
