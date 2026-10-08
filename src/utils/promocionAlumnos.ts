import type { Alumno } from '../types';

export type MotivoNoPromocion =
  | 'SIN_CICLO'
  | 'ESTATUS_NO_ACTIVO'
  | 'GRADO_NO_PROMOVIBLE'
  | 'PLAN_DEL_CICLO'
  | 'GRADO_YA_ASIGNADO'
  | 'SIN_PROGRAMA_VIGENTE'
  | 'PROGRAMA_NO_ACTIVO'
  | 'PERIODOS_SIN_DEFINIR'
  | 'GRADO_FUERA_DEL_PLAN';

export const motivoNoPromocionTexto: Record<MotivoNoPromocion, string> = {
  SIN_CICLO: 'Selecciona un ciclo de trabajo',
  ESTATUS_NO_ACTIVO: 'Estatus institucional distinto de ACTIVO',
  GRADO_NO_PROMOVIBLE: 'Grado de egreso o titulación',
  PLAN_DEL_CICLO: 'Ya tiene un plan de pago en este ciclo; puedes incluirlo sin crear otro',
  GRADO_YA_ASIGNADO: 'El grado ya se asignó en este ciclo',
  SIN_PROGRAMA_VIGENTE: 'No tiene un programa académico vigente',
  PROGRAMA_NO_ACTIVO: 'El programa vigente no está ACTIVO ni CURSANDO',
  PERIODOS_SIN_DEFINIR: 'El plan de estudios no define sus periodos',
  GRADO_FUERA_DEL_PLAN: 'El grado actual no corresponde al plan vigente',
};

/** Unifica números y ordinales sin modificar los valores históricos guardados. */
export function gradoCanonico(valor: string | number | null | undefined): string {
  const texto = String(valor ?? '').trim().toUpperCase();
  const ordinal = texto.match(/^0*(\d+)(?:ER|DO|TO|MO|VO|NO)?$/);
  return ordinal ? String(Number(ordinal[1])) : texto || 'POR DEFINIR';
}

export function compararGrados(a: string, b: string): number {
  const numeroA = Number(gradoCanonico(a));
  const numeroB = Number(gradoCanonico(b));
  if (Number.isInteger(numeroA) && Number.isInteger(numeroB)) return numeroA - numeroB;
  if (Number.isInteger(numeroA)) return -1;
  if (Number.isInteger(numeroB)) return 1;
  return a.localeCompare(b, 'es');
}

export function motivosBasePromocion(
  alumno: Alumno,
  cicloId: string,
  alumnosConPlanEnCiclo: ReadonlySet<string>,
  permitirPlanExistente = false,
): MotivoNoPromocion[] {
  const motivos: MotivoNoPromocion[] = [];
  if (!cicloId) motivos.push('SIN_CICLO');
  if (alumno.estatus?.toUpperCase() !== 'ACTIVO') motivos.push('ESTATUS_NO_ACTIVO');
  if (gradoCanonico(alumno.grado_actual).includes('EGRESADO') || gradoCanonico(alumno.grado_actual).includes('TITULADO')) {
    motivos.push('GRADO_NO_PROMOVIBLE');
  }
  if (alumnosConPlanEnCiclo.has(alumno.id) && !permitirPlanExistente) motivos.push('PLAN_DEL_CICLO');
  if (cicloId && alumno.ciclo_ultima_asignacion_grado === cicloId) motivos.push('GRADO_YA_ASIGNADO');
  return motivos;
}

export interface ProgramaPromocion {
  id: string;
  alumno_id: string;
  plan_id: string;
  estatus: string;
  total_periodos: number | null;
}

export type AccionPromocion =
  | { tipo: 'AVANCE'; gradoDestino: string; programaId: string }
  | { tipo: 'EGRESO'; gradoDestino: string; programaId: string }
  | { tipo: 'REVISION'; motivo: MotivoNoPromocion };

export function calcularAccionPromocion(alumno: Alumno, programa?: ProgramaPromocion): AccionPromocion {
  if (!programa) return { tipo: 'REVISION', motivo: 'SIN_PROGRAMA_VIGENTE' };
  if (!['ACTIVO', 'CURSANDO'].includes(programa.estatus.trim().toUpperCase())) {
    return { tipo: 'REVISION', motivo: 'PROGRAMA_NO_ACTIVO' };
  }
  const limite = Number(programa.total_periodos);
  if (!Number.isInteger(limite) || limite < 1) return { tipo: 'REVISION', motivo: 'PERIODOS_SIN_DEFINIR' };
  const grado = gradoCanonico(alumno.grado_actual);
  const actual = grado === 'POR DEFINIR' || grado === '0' ? 0 : Number(grado);
  if (!Number.isInteger(actual) || actual < 0 || actual > limite) {
    return { tipo: 'REVISION', motivo: 'GRADO_FUERA_DEL_PLAN' };
  }
  if (actual === limite) return { tipo: 'EGRESO', gradoDestino: grado, programaId: programa.id };
  return { tipo: 'AVANCE', gradoDestino: String(actual + 1), programaId: programa.id };
}
