import type { PaymentPlan } from '../types';
import { calculateStudentTotals } from '../utils';

/** Fecha civil de operación, independiente de la zona horaria del equipo. */
export function fechaFinancieraHoy(instante = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante);
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
/** No permite que Date convierta 31/02 a una fecha de marzo. */
export function fechaVencimientoCivil(valor?: string | null): string | null {
  const texto = (valor || '').trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/), local = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const fecha = iso ? texto : local ? `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}` : '';
  if (!fecha) return null;
  const d = new Date(`${fecha}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === fecha ? fecha : null;
}
export type SituacionVencimiento = 'vencido' | 'enPlazo' | 'revisarFecha';
export function situacionVencimiento(fecha: string | null | undefined, referencia: string): SituacionVencimiento {
  const corte = fechaVencimientoCivil(referencia);
  if (!corte) throw new Error('La fecha de consulta financiera no es válida.');
  const limite = fechaVencimientoCivil(fecha);
  return !limite ? 'revisarFecha' : limite < corte ? 'vencido' : 'enPlazo';
}
export interface SaldoPorVencimiento { pagado: number; adeuda: number; vencido: number; enPlazo: number; revisarFecha: number }
/** Conserva el cálculo anterior de pagos, abonos y BAJA; solo clasifica su saldo por fecha. */
export function saldosPorVencimiento(plan: PaymentPlan, estatusAlumno?: string, mes = 'Todos', referencia = fechaFinancieraHoy()): SaldoPorVencimiento {
  const totales = calculateStudentTotals(plan, estatusAlumno, mes === 'Todos' ? undefined : mes);
  const resultado: SaldoPorVencimiento = { pagado: totales.paid, adeuda: totales.owed, vencido: 0, enPlazo: 0, revisarFecha: 0 };
  for (let indice = 1; indice <= 18; indice++) {
    const p = plan as unknown as Record<string, unknown>;
    const fila = { cantidad_1: p[`cantidad_${indice}`], estatus_1: p[`estatus_${indice}`], fecha_1: p[`fecha_${indice}`] } as PaymentPlan;
    const saldo = calculateStudentTotals(fila, estatusAlumno, mes === 'Todos' ? undefined : mes).owed;
    if (saldo !== 0) resultado[situacionVencimiento(String(p[`fecha_${indice}`] || ''), referencia)] += saldo;
  }
  return resultado;
}
