import type { Alumno, CicloEscolar, PaymentPlan, PaymentPlanDetalle } from '../types';

export type PlanCoverageStatus = 'COMPLETO' | 'INCOMPLETO' | 'SIN_PLAN';
export type PlanCoverageIntegralFilter = 'TODOS' | 'INTEGRAL' | 'NO_INTEGRAL';
export const PLAN_COVERAGE_COLUMNS = [
  { key: 'alumnoNombre', label: 'Alumno' },
  { key: 'licenciatura', label: 'Licenciatura' },
  { key: 'tipo', label: 'Tipo / folio' },
  { key: 'integral', label: 'Plan integral' },
  { key: 'observaciones', label: 'Observaciones' },
  { key: 'estado', label: 'Situación' },
  { key: 'conceptos', label: 'Conceptos' },
  { key: 'monto', label: 'Monto programado' },
  { key: 'faltantes', label: 'Faltantes' },
] as const;
export type PlanCoverageColumn = typeof PLAN_COVERAGE_COLUMNS[number]['key'];

export interface PlanCoverageEntry {
  key: string;
  cicloId: string;
  cicloNombre: string;
  alumnoId: string;
  alumnoNombre: string;
  matricula: string;
  licenciatura: string;
  planId?: string;
  folio: string;
  tipo: string;
  integral: boolean;
  observaciones: string[];
  estado: PlanCoverageStatus;
  conceptos: number;
  monto: number;
  faltantes: string[];
}

export interface PlanCoverageCycle {
  cicloId: string;
  cicloNombre: string;
  alumnos: number;
  alumnosConPlanCompleto: number;
  alumnosSinPlanCompleto: number;
  alumnosSinPlan: number;
  planes: number;
  planesCompletos: number;
  planesIncompletos: number;
  tipos: { nombre: string; total: number; completos: number }[];
  entries: PlanCoverageEntry[];
}

export interface PlanCoverageFilters {
  cicloId: string;
  licenciaturas: string[];
  tipos: string[];
  observaciones: string[];
  integral: PlanCoverageIntegralFilter;
  busqueda: string;
  estado: PlanCoverageStatus | 'TODOS';
}

export function filterPlanCoverage(cycles: PlanCoverageCycle[], filters: PlanCoverageFilters): PlanCoverageCycle[] {
  const term = filters.busqueda.trim().toLocaleUpperCase('es-MX');
  return cycles
    .filter(ciclo => filters.cicloId === 'TODOS' || ciclo.cicloId === filters.cicloId)
    .map(ciclo => {
      const eligible = ciclo.entries.filter(entry =>
        (filters.licenciaturas.length === 0 || filters.licenciaturas.includes(entry.licenciatura)) &&
        (filters.tipos.length === 0 || (entry.estado !== 'SIN_PLAN' && filters.tipos.includes(entry.tipo))) &&
        (filters.observaciones.length === 0 || entry.observaciones.some(observacion => filters.observaciones.includes(observacion))) &&
        (filters.integral === 'TODOS' || (entry.estado !== 'SIN_PLAN' && entry.integral === (filters.integral === 'INTEGRAL'))) &&
        (filters.estado === 'TODOS' || entry.estado === filters.estado)
      );
      const matchingStudents = new Set(eligible.filter(entry => !term ||
        [entry.alumnoNombre, entry.matricula, entry.folio, entry.tipo]
          .some(value => value.toLocaleUpperCase('es-MX').includes(term))
      ).map(entry => entry.alumnoId));
      return { ...ciclo, entries: eligible.filter(entry => matchingStudents.has(entry.alumnoId)) };
    });
}

export function summarizeCoverage(cycles: Pick<PlanCoverageCycle, 'entries'>[]) {
  const rows = cycles.flatMap(ciclo => ciclo.entries);
  const count = (entries: PlanCoverageEntry[]) => new Set(entries.map(entry => entry.alumnoId)).size;
  const alumnos = cycles.reduce((total, ciclo) => total + count(ciclo.entries), 0);
  const alumnosConCompleto = cycles.reduce((total, ciclo) => total + count(ciclo.entries.filter(entry => entry.estado === 'COMPLETO')), 0);
  return {
    alumnos,
    alumnosConCompleto,
    alumnosSinCompleto: alumnos - alumnosConCompleto,
    planesCompletos: rows.filter(entry => entry.estado === 'COMPLETO').length,
    planesIncompletos: rows.filter(entry => entry.estado === 'INCOMPLETO').length,
    alumnosSinPlan: rows.filter(entry => entry.estado === 'SIN_PLAN').length,
    planesIntegrales: rows.filter(entry => entry.integral).length,
    alumnosConIntegral: cycles.reduce((total, ciclo) => total + count(ciclo.entries.filter(entry => entry.integral)), 0),
  };
}

export function countPlanObservations(entries: PlanCoverageEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.integral) continue;
    for (const observacion of entry.observaciones) counts.set(observacion, (counts.get(observacion) || 0) + 1);
  }
  return Array.from(counts, ([nombre, planes]) => ({ nombre, planes }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

interface Concepto {
  concepto: string;
  fecha: string;
  cantidad: unknown;
}

const clean = (value: unknown) => String(value ?? '').trim();

const institutionalStatus = (alumno: Alumno) => clean(alumno.estatus).toLocaleUpperCase('es-MX').replace(/[_\s]+/g, ' ');
const canIncludePlan = (alumno: Alumno) => ['ACTIVO', 'EGRESADO', 'TITULADO', 'EGRESADO TITULADO'].includes(institutionalStatus(alumno));
const canIncludeWithoutPlan = (alumno: Alumno) => ['ACTIVO', 'EGRESADO'].includes(institutionalStatus(alumno));

const hasAmount = (value: unknown) => value !== null && value !== undefined && clean(value) !== '';
const amount = (value: unknown) => Number(value);

export function inspectPlan(plan: PaymentPlan) {
  const useDetails = (plan.detalles?.length ?? 0) > 0;
  const details = new Map<number, PaymentPlanDetalle>();
  for (const detail of plan.detalles ?? []) {
    if (detail.indice_concepto >= 1 && detail.indice_concepto <= 18) details.set(detail.indice_concepto, detail);
  }

  let conceptos = 0;
  let monto = 0;
  const faltantes: string[] = [];

  for (let index = 1; index <= 18; index++) {
    const detail = details.get(index);
    // La pantalla del plan usa los detalles normalizados cuando existen.
    // No mezclar en ese caso campos numerados antiguos que ya no se muestran.
    if (useDetails && !detail) continue;
    const wide = plan as unknown as Record<string, unknown>;
    const row: Concepto = useDetails ? {
      concepto: clean(detail?.concepto),
      fecha: clean(detail?.fecha_vencimiento),
      cantidad: detail?.cantidad,
    } : {
      concepto: clean(wide[`concepto_${index}`]),
      fecha: clean(wide[`fecha_${index}`]),
      cantidad: wide[`cantidad_${index}`],
    };
    // Un cero aislado puede ser el valor predeterminado de un espacio sin usar.
    // Un importe distinto de cero, incluso sin concepto ni fecha, sí activa la fila.
    if (!row.concepto && !row.fecha && (!hasAmount(row.cantidad) || amount(row.cantidad) === 0)) continue;
    conceptos++;
    if (!row.concepto) faltantes.push(`#${index}: concepto`);
    if (!row.fecha) faltantes.push(`#${index}: fecha`);
    if (!hasAmount(row.cantidad)) faltantes.push(`#${index}: monto`);
    else if (Number.isFinite(amount(row.cantidad))) monto += amount(row.cantidad);
  }

  if (conceptos === 0) faltantes.push('Sin conceptos programados');
  return { completo: faltantes.length === 0, conceptos, monto, faltantes };
}

export function buildPlanCoverage(ciclos: CicloEscolar[], alumnos: Alumno[], planes: PaymentPlan[]): PlanCoverageCycle[] {
  const byId = new Map(alumnos.map(alumno => [alumno.id, alumno]));
  const byName = new Map<string, Alumno | null>();
  for (const alumno of alumnos) {
    const name = clean(alumno.nombre_completo).toLocaleUpperCase('es-MX');
    if (byName.has(name)) byName.set(name, null);
    else byName.set(name, alumno);
  }

  return ciclos.map(ciclo => {
    const cyclePlans = planes
      .filter(plan => plan.ciclo_id === ciclo.id || (!plan.ciclo_id && plan.ciclo_escolar === ciclo.nombre))
      .flatMap(plan => {
        const alumno = (plan.alumno_id && byId.get(plan.alumno_id)) || byName.get(clean(plan.nombre_alumno).toLocaleUpperCase('es-MX'));
        return alumno && canIncludePlan(alumno) ? [{ plan, alumno }] : [];
      });
    const studentIds = new Set<string>(alumnos.filter(alumno => canIncludeWithoutPlan(alumno) && alumno.ciclo_ultima_asignacion_grado === ciclo.id).map(alumno => alumno.id));
    const entries: PlanCoverageEntry[] = [];
    const typeCount = new Map<string, { total: number; completos: number }>();
    const completeStudentIds = new Set<string>();
    const studentsWithPlan = new Set<string>();

    for (const { plan, alumno } of cyclePlans) {
      const alumnoId = alumno.id;
      studentIds.add(alumnoId);
      studentsWithPlan.add(alumnoId);
      const review = inspectPlan(plan);
      const tipo = clean(plan.tipo_plan) || 'Sin tipo';
      const observaciones = Array.isArray(plan.observaciones)
        ? [...new Set(plan.observaciones.map(clean).filter(Boolean))]
        : [];
      const integral = ['Cuatrimestral', 'Semestral'].includes(tipo) && observaciones.length > 0;
      const current = typeCount.get(tipo) || { total: 0, completos: 0 };
      current.total++;
      if (review.completo) {
        current.completos++;
        completeStudentIds.add(alumnoId);
      }
      typeCount.set(tipo, current);
      entries.push({
        key: plan.id,
        cicloId: ciclo.id,
        cicloNombre: ciclo.nombre,
        alumnoId,
        alumnoNombre: alumno.nombre_completo || plan.nombre_alumno || 'Alumno sin nombre',
        matricula: clean(alumno.matricula),
        licenciatura: clean(plan.licenciatura) || clean(alumno.licenciatura) || 'Sin licenciatura',
        planId: plan.id,
        folio: clean(plan.no_plan_pagos) || 'Sin folio',
        tipo,
        integral,
        observaciones,
        estado: review.completo ? 'COMPLETO' : 'INCOMPLETO',
        conceptos: review.conceptos,
        monto: review.monto,
        faltantes: review.faltantes,
      });
    }

    for (const alumno of alumnos) {
      if (!canIncludeWithoutPlan(alumno) || alumno.ciclo_ultima_asignacion_grado !== ciclo.id || studentsWithPlan.has(alumno.id)) continue;
      entries.push({
        key: `sin-plan:${ciclo.id}:${alumno.id}`,
        cicloId: ciclo.id,
        cicloNombre: ciclo.nombre,
        alumnoId: alumno.id,
        alumnoNombre: alumno.nombre_completo,
        matricula: clean(alumno.matricula),
        licenciatura: clean(alumno.licenciatura) || 'Sin licenciatura',
        folio: '—',
        tipo: '—',
        integral: false,
        observaciones: [],
        estado: 'SIN_PLAN',
        conceptos: 0,
        monto: 0,
        faltantes: ['Sin plan registrado en el ciclo'],
      });
    }

    entries.sort((a, b) => a.alumnoNombre.localeCompare(b.alumnoNombre, 'es') || a.tipo.localeCompare(b.tipo, 'es'));
    const planesCompletos = entries.filter(entry => entry.estado === 'COMPLETO').length;
    return {
      cicloId: ciclo.id,
      cicloNombre: ciclo.nombre,
      alumnos: studentIds.size,
      alumnosConPlanCompleto: completeStudentIds.size,
      alumnosSinPlanCompleto: studentIds.size - completeStudentIds.size,
      alumnosSinPlan: entries.filter(entry => entry.estado === 'SIN_PLAN').length,
      planes: cyclePlans.length,
      planesCompletos,
      planesIncompletos: cyclePlans.length - planesCompletos,
      tipos: Array.from(typeCount, ([nombre, counts]) => ({ nombre, ...counts })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      entries,
    };
  });
}
