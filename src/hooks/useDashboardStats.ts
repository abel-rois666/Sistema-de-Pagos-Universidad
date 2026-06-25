import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PaymentPlan } from '../types';
import { isPaid, getRestanteFromEstatus } from '../utils';

export function useDashboardStats() {
  const { plans, ciclos, alumnos, activeCicloId } = useAppStore();

  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const filteredPlans = plans.filter(p => p.ciclo_id === activeCicloId || p.ciclo_escolar === activeCiclo?.nombre);

  const totalActivos = alumnos.filter(a => a.estatus === 'ACTIVO').length;
  // Solo cuenta alumnos con AL MENOS UN pago vencido a la fecha de hoy (no pagos futuros)
  const totalDeudores = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const parsePaymentDate = (dStr: string): Date | null => {
      if (!dStr) return null;
      if (dStr.includes('-')) {
        const [y, m, d] = dStr.split('-');
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      if (dStr.includes('/')) {
        const [d, m, y] = dStr.split('/');
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      return null;
    };
    return filteredPlans.filter(p => {
      const alumno = alumnos.find(a => a.id === p.alumno_id || a.nombre_completo === p.nombre_alumno);
      if (alumno?.estatus === 'BAJA') return false;

      if (p.detalles && p.detalles.length > 0) {
        return p.detalles.some(d => {
          if (d.estatus === 'PENDIENTE' && d.fecha_vencimiento) {
            const dt = parsePaymentDate(d.fecha_vencimiento);
            if (dt && dt <= today) return true;
          }
          return false;
        });
      }

      for (let i = 1; i <= 9; i++) {
        const estatus = p[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha = p[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (estatus !== 'PENDIENTE' || !fecha) continue;
        const d = parsePaymentDate(fecha);
        if (d && d <= today) return true;
      }
      return false;
    }).length;
  }, [filteredPlans, alumnos]);

  // Suma del adeudo vencido hasta hoy (fecha_limite <= hoy, excluye pagos futuros)
  const totalAdeudoCiclo = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const parseDate = (dStr: string): Date | null => {
      if (!dStr) return null;
      if (dStr.includes('-')) {
        const [y, m, d] = dStr.split('-');
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      if (dStr.includes('/')) {
        const [d, m, y] = dStr.split('/');
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      return null;
    };
    let total = 0;
    filteredPlans.forEach(plan => {
      const alumno = alumnos.find(a => a.id === plan.alumno_id || a.nombre_completo === plan.nombre_alumno);
      if (alumno?.estatus === 'BAJA') return;

      if (plan.detalles && plan.detalles.length > 0) {
        plan.detalles.forEach(d => {
          if (d.cantidad && d.estatus && d.fecha_vencimiento && !isPaid(d.estatus)) {
            const fechaDate = parseDate(d.fecha_vencimiento);
            if (fechaDate && fechaDate <= today) {
              total += getRestanteFromEstatus(d.estatus, Number(d.cantidad));
            }
          }
        });
        return;
      }

      for (let i = 1; i <= 9; i++) {
        const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
        const estatus  = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha    = plan[`fecha_${i}`   as keyof PaymentPlan] as string | undefined;
        if (cantidad && estatus && fecha && !isPaid(estatus)) {
          const fechaDate = parseDate(fecha);
          // Solo sumar si la fecha ya venció (hasta hoy)
          if (fechaDate && fechaDate <= today) {
            total += getRestanteFromEstatus(estatus, Number(cantidad));
          }
        }
      }
    });
    return total;
  }, [filteredPlans, alumnos]);

  return { activeCiclo, filteredPlans, totalActivos, totalDeudores, totalAdeudoCiclo };
}
