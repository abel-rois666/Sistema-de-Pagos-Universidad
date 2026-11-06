import type { Alumno, CicloEscolar, PaymentPlan } from '../types';

const normalizar = (valor: string | null | undefined) => (valor || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX');

const nombreCiclo = (plan: PaymentPlan, ciclosPorId: ReadonlyMap<string, CicloEscolar>) =>
  ciclosPorId.get(plan.ciclo_id || '')?.nombre || plan.ciclo_escolar || '';

/** Ordena el historial de un alumno del ciclo más reciente al más antiguo. */
export function ordenarHistorialPlanes(plans: readonly PaymentPlan[], ciclos: readonly CicloEscolar[]) {
  const ciclosPorId = new Map(ciclos.map(ciclo => [ciclo.id, ciclo]));
  return [...plans].sort((a, b) =>
    nombreCiclo(b, ciclosPorId).localeCompare(nombreCiclo(a, ciclosPorId), 'es-MX', { numeric: true })
    || (a.tipo_plan || '').localeCompare(b.tipo_plan || '', 'es-MX')
    || (a.no_plan_pagos || '').localeCompare(b.no_plan_pagos || '', 'es-MX'));
}

/** Busca por identidad del alumno o por el folio del plan, sin depender del ciclo de consulta. */
export function buscarPlanesPago(plans: readonly PaymentPlan[], alumnos: readonly Alumno[],
  ciclos: readonly CicloEscolar[], termino: string) {
  const consulta = normalizar(termino.trim());
  if (!consulta) return [];
  const alumnosPorId = new Map(alumnos.map(alumno => [alumno.id, alumno]));
  const ciclosPorId = new Map(ciclos.map(ciclo => [ciclo.id, ciclo]));
  const nombre = (plan: PaymentPlan) => plan.nombre_alumno
    || alumnosPorId.get(plan.alumno_id || '')?.nombre_completo || '';
  return plans.filter(plan => {
    const alumno = alumnosPorId.get(plan.alumno_id || '');
    return [nombre(plan), alumno?.matricula, plan.no_plan_pagos,
      plan.tipo_plan, nombreCiclo(plan, ciclosPorId)]
      .some(valor => normalizar(valor).includes(consulta));
  }).sort((a, b) => nombre(a).localeCompare(nombre(b), 'es-MX')
    || nombreCiclo(b, ciclosPorId).localeCompare(nombreCiclo(a, ciclosPorId), 'es-MX', { numeric: true }));
}
