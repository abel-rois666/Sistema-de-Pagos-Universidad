import type { PaymentPlan } from '../types';
import { estadoPagoComprobado } from '../utils/estadoPagoComprobado';

export function resumirPagoTitulacion(plan?: PaymentPlan): string {
  if (!plan) return 'Sin plan';
  const conceptos = plan.detalles?.length ? plan.detalles.map(d => ({ concepto: d.concepto, estatus: d.estatus }))
    : Array.from({ length: 18 }, (_, n) => ({ concepto: plan[`concepto_${n + 1}` as keyof PaymentPlan], estatus: plan[`estatus_${n + 1}` as keyof PaymentPlan] }));
  const estados = conceptos.filter(d => typeof d.concepto === 'string' && d.concepto.trim() && d.concepto.trim() !== '0')
    .map(d => estadoPagoComprobado(typeof d.estatus === 'string' ? d.estatus : ''));
  if (!estados.length) return 'Sin plan';
  if (estados.includes('revisar')) return 'Revisar estado de pago';
  return estados.every(e => e === 'pagado') ? 'Pago completo' : 'Pago en curso';
}
