import type { DatosPdfCalendario } from '../calendario/exportarPdf';
import type { EntradaHorario, SesionHorario } from '../horarios/types';
import type { PaymentPlan } from '../types';

export interface DocumentoPreparado {
  tipo: 'BOLETA' | 'CALENDARIO' | 'HORARIO' | 'PAGOS';
  cicloId: string;
  nombre: string;
  blob: Blob;
}

const nombreSeguro = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'documento';

export async function prepararBoletaPdf(
  datos: Omit<Parameters<typeof import('../utils/boletasExportUtils').crearBoletaPDF>[0], 'opciones' | 'onProgress'>,
): Promise<DocumentoPreparado> {
  if (datos.alumnos.length !== 1) throw new Error('La boleta del comunicado debe corresponder a un solo alumno.');
  if (!datos.firmante?.firma_url || !datos.config?.selloUrl)
    throw new Error('Configura el firmante, su firma y el sello institucional antes de preparar la boleta.');
  const { crearBoletaPDF } = await import('../utils/boletasExportUtils');
  const { blob, nombre } = await crearBoletaPDF({ ...datos,
    opciones: { copias: 1, incluirFirma: true, incluirSello: true }, onProgress: () => undefined });
  return { tipo: 'BOLETA', cicloId: datos.ciclo.id, nombre, blob };
}

/** Devuelve archivos individuales para Drive; no inicia descargas. */
export async function prepararCalendarioPdf(datos: DatosPdfCalendario): Promise<DocumentoPreparado> {
  const { crearPdfCalendario } = await import('../calendario/exportarPdf');
  const pdf = crearPdfCalendario(datos, 'completo');
  return { tipo: 'CALENDARIO', cicloId: datos.calendario.ciclo_id,
    nombre: `Calendario_${nombreSeguro(datos.cicloNombre)}.pdf`, blob: pdf.output('blob') };
}

export async function prepararHorarioGrupoPdf(
  entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string, grupoId: string,
): Promise<DocumentoPreparado> {
  if (!entrada.grupos.some(grupo => grupo.id === grupoId)) throw new Error('El grupo no pertenece al horario elegido.');
  const { crearPdfHorario } = await import('../horarios/exportar');
  const grupo = entrada.grupos.find(item => item.id === grupoId)!;
  const pdf = crearPdfHorario(entrada, sesiones, cicloNombre, { tipo: 'grupos', ids: [grupoId] });
  return { tipo: 'HORARIO', cicloId: grupo.cicloId,
    nombre: `Horario_${nombreSeguro(grupo.codigo)}.pdf`, blob: pdf.output('blob') };
}

export async function prepararHorarioGruposPdf(
  entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string, grupoIds: string[],
): Promise<DocumentoPreparado> {
  if (!grupoIds.length || grupoIds.some(id => !entrada.grupos.some(grupo => grupo.id === id)))
    throw new Error('Los grupos del alumno no pertenecen al horario publicado.');
  const ciclos = [...new Set(entrada.grupos.filter(grupo => grupoIds.includes(grupo.id)).map(grupo => grupo.cicloId))];
  if (ciclos.length !== 1) throw new Error('Los grupos del horario pertenecen a ciclos distintos.');
  const { crearPdfHorario } = await import('../horarios/exportar');
  const pdf = crearPdfHorario(entrada, sesiones, cicloNombre, { tipo: 'grupos', ids: grupoIds });
  return { tipo: 'HORARIO', cicloId: ciclos[0], nombre: 'Horario_de_clases.pdf', blob: pdf.output('blob') };
}

export async function prepararCalendarioPagosPdf(
  plan: PaymentPlan, cicloNombre: string,
): Promise<DocumentoPreparado> {
  const { crearPdfCalendarioPagos } = await import('./calendarioPagos');
  if (!plan.ciclo_id) throw new Error('El plan de pagos no tiene ciclo escolar.');
  const pdf = crearPdfCalendarioPagos(plan, cicloNombre);
  return { tipo: 'PAGOS', cicloId: plan.ciclo_id,
    nombre: `Pagos_${nombreSeguro(plan.no_plan_pagos)}.pdf`, blob: pdf.output('blob') };
}
