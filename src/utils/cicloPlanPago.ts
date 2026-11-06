import type { CicloEscolar } from '../types';

const normalizar = (valor: string | null | undefined) => (valor || '').trim().toLocaleLowerCase('es-MX');

/** Titulación es un trámite separado del calendario de pagos académico. */
export function esPlanPagoTitulacion(tipoPlan: string | null | undefined): boolean {
  return normalizar(tipoPlan).normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'titulacion';
}

export function tipoPeriodoPlanPago(tipoPlan: string | null | undefined): string | null {
  const tipo = normalizar(tipoPlan);
  if (tipo.includes('cuatrimestral')) return 'cuatrimestral';
  if (tipo.includes('semestral')) return 'semestral';
  return null;
}

/** Mantiene la elección visible al cambiar de tipo sin escribir estado durante el render. */
export function cicloVisiblePlanPago(ciclos: readonly CicloEscolar[], tipoPlan: string | null | undefined,
  preferidoId: string | null | undefined, globalId: string | null | undefined): CicloEscolar | undefined {
  const tipo = tipoPeriodoPlanPago(tipoPlan);
  const disponibles = tipo ? ciclos.filter(ciclo => normalizar(ciclo.tipo_periodo) === tipo) : ciclos;
  return disponibles.find(ciclo => ciclo.id === preferidoId)
    || disponibles.find(ciclo => ciclo.id === globalId)
    || disponibles.find(ciclo => ciclo.activo)
    || disponibles[0];
}

/** El ID guardado debe ser el ciclo que se eligió y concordar con el tipo del plan ordinario. */
export function validarCicloPlanPago(ciclo: CicloEscolar | undefined,
  tipoPlan: string | null | undefined): string | null {
  if (!ciclo) return 'Selecciona un ciclo escolar válido antes de guardar el plan de pagos.';
  const tipoEsperado = tipoPeriodoPlanPago(tipoPlan);
  if (tipoEsperado && normalizar(ciclo.tipo_periodo) !== tipoEsperado)
    return `El ciclo ${ciclo.nombre} es ${ciclo.tipo_periodo || 'de tipo desconocido'} y no corresponde al plan ${tipoPlan}.`;
  return null;
}

/** Un nombre repetido nunca identifica por sí solo al ciclo de un plan. */
export function resolverCicloPlanPagoImportado(
  ciclos: readonly CicloEscolar[], nombre: string, tipoPlan: string,
): CicloEscolar | undefined {
  const tipo = tipoPeriodoPlanPago(tipoPlan);
  if (!tipo) return undefined;
  const candidatos = ciclos.filter(ciclo => normalizar(ciclo.nombre) === normalizar(nombre)
    && normalizar(ciclo.tipo_periodo) === tipo);
  return candidatos.length === 1 ? candidatos[0] : undefined;
}

/** Solo ayuda a presentar posibles recibos; la función SQL verifica el vínculo antes de guardarlo. */
export function coincideConceptoReciboPlan(conceptoRecibo: string | null | undefined,
  conceptoPlan: string | null | undefined): boolean {
  if (!conceptoRecibo || !conceptoPlan) return false;
  const normalizarConcepto = (valor: string) => valor
    .replace(/\s*\(Plan [^)]*\)\s*$/i, '')
    .replace(/\s+CON COSTO PROMOCIONAL\s*$/i, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('es-MX')
    .replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return normalizarConcepto(conceptoRecibo) === normalizarConcepto(conceptoPlan);
}

/** Compara el ciclo y el tipo financiero con el plan de estudios del alumno. */
export function validarPeriodicidadAcademicaPlanPago(
  ciclo: CicloEscolar | undefined, tipoPlan: string | null | undefined,
  periodoAcademico: string | null | undefined,
): string | null {
  const errorCiclo = validarCicloPlanPago(ciclo, tipoPlan);
  if (errorCiclo) return errorCiclo;
  const tipoFinanciero = tipoPeriodoPlanPago(tipoPlan);
  const academico = normalizar(periodoAcademico);
  if (tipoFinanciero && !academico)
    return 'No se pudo comprobar la periodicidad del plan de estudios del alumno.';
  if (tipoFinanciero && academico !== tipoFinanciero)
    return `El plan de estudios del alumno es ${periodoAcademico}; revisa el tipo del plan de pagos.`;
  if (tipoFinanciero && normalizar(ciclo?.tipo_periodo) !== academico)
    return 'El ciclo elegido no corresponde a la periodicidad del plan de estudios del alumno.';
  return null;
}
