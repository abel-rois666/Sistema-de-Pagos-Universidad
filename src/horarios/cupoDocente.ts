import type { CargaHorario, DocenteHorario, SesionHorario } from './types';

/** Solo las horas presenciales ocupan bloques semanales del docente. */
export function horasExternasDocente(docenteId: string, sesiones: SesionHorario[] = []): number {
  return sesiones.filter(sesion => sesion.docenteId === docenteId)
    .reduce((total, sesion) => total + sesion.fin - sesion.inicio, 0);
}

export function horasAsignadasDocente(docenteId: string, cargas: CargaHorario[],
  externas: SesionHorario[] = [], excluirCargaId?: string): number {
  return horasExternasDocente(docenteId, externas) + cargas
    .filter(carga => carga.id !== excluirCargaId && carga.docenteId === docenteId)
    .reduce((total, carga) => total + (carga.horasPresenciales || 0), 0);
}

export function horasTrasAsignar(docente: DocenteHorario, carga: CargaHorario,
  cargas: CargaHorario[], externas: SesionHorario[] = []): number {
  return horasAsignadasDocente(docente.id, cargas, externas, carga.id)
    + (carga.horasPresenciales || 0);
}

export function superaCupoDocente(docente: DocenteHorario, horas: number): boolean {
  return docente.maxHorasSemanales != null && horas > docente.maxHorasSemanales;
}
