import type { Alumno, PaymentPlan } from '../types';
import { getRestanteFromEstatus, isPaid } from '../utils';
import { situacionVencimiento } from './vencimientos';

export interface DebtRecord {
  id: string; alumno_id: string; alumno: string; licenciatura: string; grado: string; turno: string;
  concepto: string; tipo_plan: string; monto: number; fecha_limite: string;
}
/** Proyección de lectura del criterio existente, con vencimiento civil compartido con el resumen. */
export function construirDeudasVencidas(planes: readonly PaymentPlan[], alumnos: readonly Alumno[], referencia: string): DebtRecord[] {
  const records: DebtRecord[] = [];
  for (const plan of planes) {
    // Mantiene la resolución de identidad anterior de esta pantalla; no cambia asociaciones reales.
    const alumno = alumnos.find(a => a.id === plan.alumno_id || a.nombre_completo === plan.nombre_alumno);
    if (alumno?.estatus === 'BAJA') continue;
    const partes = plan.grado_turno?.split('/') || [];
    const campos = plan as unknown as Record<string, unknown>;
    for (let i = 1; i <= 18; i++) {
      const concepto = String(campos[`concepto_${i}`] || ''), cantidad = Number(campos[`cantidad_${i}`] || 0), estatus = String(campos[`estatus_${i}`] || ''), fecha = String(campos[`fecha_${i}`] || '');
      if (!concepto || !(cantidad > 0) || isPaid(estatus) || situacionVencimiento(fecha, referencia) !== 'vencido') continue;
      const monto = getRestanteFromEstatus(estatus, cantidad);
      if (!(monto > 0)) continue;
      records.push({ id: `${plan.id}-${i}`, alumno_id: alumno?.id || plan.alumno_id || '', alumno: plan.nombre_alumno || alumno?.nombre_completo || 'Sin nombre registrado', licenciatura: plan.licenciatura || '', grado: plan.grado || partes[0]?.trim() || '', turno: plan.turno || partes[1]?.trim() || '', concepto, tipo_plan: plan.tipo_plan || 'Indefinido', monto, fecha_limite: fecha });
    }
  }
  return records.sort((a, b) => a.alumno.localeCompare(b.alumno, 'es') || a.id.localeCompare(b.id));
}
