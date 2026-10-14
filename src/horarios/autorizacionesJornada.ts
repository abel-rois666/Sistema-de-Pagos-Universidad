import { incumplimientosEstrictos } from './politicaHorario';
import type { DiaHorario, EntradaHorario, IncidenciaHorario, SesionHorario } from './types';

export interface AutorizacionJornadaDocente {
  docenteId: string;
  dia: DiaHorario;
  huella: string;
  motivo: string;
}

/** Una autorización corresponde a las sesiones exactas de un docente en un día. */
export function huellaJornadaDocente(entrada: EntradaHorario, sesiones: SesionHorario[],
  docenteId: string, dia: DiaHorario): string {
  const bloques = [...(entrada.ocupacionesExternas || []), ...sesiones]
    .filter(sesion => sesion.docenteId === docenteId && sesion.dia === dia)
    .map(sesion => [sesion.cargaId, sesion.inicio, sesion.fin])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(bloques);
}

export function esJornadaDocenteAutorizable(incidencia: IncidenciaHorario,
  entrada: EntradaHorario, sesiones: SesionHorario[]): incidencia is IncidenciaHorario & { docenteId: string; dia: DiaHorario } {
  if (incidencia.codigo !== 'JORNADA_CORTA_DOCENTE' || !incidencia.docenteId || !incidencia.dia) return false;
  const propias = sesiones.filter(sesion => sesion.docenteId === incidencia.docenteId && sesion.dia === incidencia.dia);
  if (!propias.length) return false;
  const horas = new Set<number>();
  for (const sesion of [...(entrada.ocupacionesExternas || []), ...sesiones]) {
    if (sesion.docenteId !== incidencia.docenteId || sesion.dia !== incidencia.dia) continue;
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) horas.add(hora);
  }
  return horas.size === 1;
}

export function autorizacionesAplicables(entrada: EntradaHorario, sesiones: SesionHorario[],
  incidencias: IncidenciaHorario[], autorizaciones: AutorizacionJornadaDocente[]): AutorizacionJornadaDocente[] {
  return autorizaciones.filter(autorizacion => autorizacion.motivo.trim().length >= 10
    && incidencias.some(incidencia => esJornadaDocenteAutorizable(incidencia, entrada, sesiones)
      && incidencia.docenteId === autorizacion.docenteId && incidencia.dia === autorizacion.dia)
    && autorizacion.huella === huellaJornadaDocente(entrada, sesiones, autorizacion.docenteId, autorizacion.dia));
}

export function incumplimientosEstrictosPendientes(entrada: EntradaHorario, sesiones: SesionHorario[],
  incidencias: IncidenciaHorario[], autorizaciones: AutorizacionJornadaDocente[]): IncidenciaHorario[] {
  const aplicables = autorizacionesAplicables(entrada, sesiones, incidencias, autorizaciones);
  return incumplimientosEstrictos(incidencias).filter(incidencia =>
    !aplicables.some(autorizacion => incidencia.codigo === 'JORNADA_CORTA_DOCENTE'
      && incidencia.docenteId === autorizacion.docenteId && incidencia.dia === autorizacion.dia));
}
