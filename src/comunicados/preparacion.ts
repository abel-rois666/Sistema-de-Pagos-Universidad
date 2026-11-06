import type { CalendarioAcademico } from '../calendario/service';
import type { CicloEscolar, PaymentPlan } from '../types';
import { inspectPlan } from '../utils/planCoverageUtils';
import { esPlanPagoTitulacion, tipoPeriodoPlanPago } from '../utils/cicloPlanPago';

export interface ProgramaComunicado {
  planId: string;
  tipoPeriodo: string;
  modalidad: string;
  turno: string;
}

export interface GrupoComunicado {
  id: string;
  cicloId: string;
  planId: string;
  codigo: string;
}

export interface HorarioPublicadoComunicado {
  cicloId: string;
  grupoIds: string[];
}

export interface ReferenciaPlanPagoComunicado {
  id: string;
  alumno_id: string;
  ciclo_id: string | null;
  tipo_plan: string | null;
}

export type SeleccionDocumento<T> =
  | { estado: 'LISTO'; valor: T }
  | { estado: 'NO_APLICA'; motivo: string }
  | { estado: 'FALTANTE' | 'AMBIGUO'; motivo: string };

/** El grado del grupo no sustituye el avance personal en los planes flexibles. */
export function esPrimerGradoPersonal(gradoActual: string | number | null | undefined): boolean {
  const grado = String(gradoActual ?? '').trim().toUpperCase();
  return /^0*1[^\d]*$/.test(grado) || grado === 'PRIMERO';
}

export function esNuevoIngresoSinBoleta(gradoActual: string | number | null | undefined,
  tieneHistorialDelPlan: boolean): boolean {
  return esPrimerGradoPersonal(gradoActual) && !tieneHistorialDelPlan;
}

/** Solo una inscripción de un ciclo anterior comparable demuestra historial previo. */
export function tieneHistorialAnterior(cicloIds: (string | null)[], ciclosAnteriores: ReadonlySet<string>): boolean {
  return cicloIds.some(id => Boolean(id && ciclosAnteriores.has(id)));
}

const normalizar = (valor: string | null | undefined) =>
  (valor || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/** La coincidencia por nombre de carrera o ciclo puede entregar documentos ajenos. */
export function seleccionarCalendario(
  calendarios: readonly CalendarioAcademico[], cicloId: string, programa: ProgramaComunicado,
): SeleccionDocumento<CalendarioAcademico> {
  const encontrados = calendarios.filter(calendario =>
    calendario.ciclo_id === cicloId && calendario.plan_ids.includes(programa.planId)
    && normalizar(calendario.tipo_periodo) === normalizar(programa.tipoPeriodo)
    && normalizar(calendario.modalidad) === normalizar(programa.modalidad)
    && calendario.turnos.some(turno => normalizar(turno) === normalizar(programa.turno)));
  if (encontrados.length === 1) return { estado: 'LISTO', valor: encontrados[0] };
  if (encontrados.length > 1) return {
    estado: 'AMBIGUO', motivo: 'Hay varios calendarios para el mismo plan, modalidad y turno.',
  };
  return { estado: 'FALTANTE', motivo: 'No hay un calendario para este plan, modalidad y turno.' };
}

/** Devuelve todos los grupos del alumno que aparecen en la versión publicada del ciclo. */
export function seleccionarGruposConHorario(
  gruposAlumno: readonly GrupoComunicado[], publicado: HorarioPublicadoComunicado | null,
  cicloId: string, planId: string,
): SeleccionDocumento<GrupoComunicado[]> {
  if (!publicado || publicado.cicloId !== cicloId)
    return { estado: 'FALTANTE', motivo: 'No hay horario publicado para este ciclo.' };
  const idsPublicados = new Set(publicado.grupoIds);
  const esperados = gruposAlumno.filter(grupo => grupo.cicloId === cicloId && grupo.planId === planId);
  const grupos = esperados.filter(grupo => idsPublicados.has(grupo.id));
  if (!grupos.length || grupos.length !== esperados.length) return {
    estado: 'FALTANTE', motivo: 'Uno o más grupos del alumno no tienen sesiones en el horario publicado.',
  };
  return { estado: 'LISTO', valor: grupos };
}

/** "Completo" reutiliza la regla de cobertura; no equivale a estar liquidado. */
export function seleccionarPlanDePagos(
  planes: readonly PaymentPlan[], alumnoId: string, cicloId: string,
  ciclos: readonly CicloEscolar[] = [], referencias: readonly ReferenciaPlanPagoComunicado[] = [],
): SeleccionDocumento<PaymentPlan> {
  const delCiclo = planes.filter(plan => plan.alumno_id === alumnoId && plan.ciclo_id === cicloId
    && !esPlanPagoTitulacion(plan.tipo_plan));
  const completos = delCiclo.filter(plan => inspectPlan(plan).completo);
  if (completos.length === 1) return { estado: 'LISTO', valor: completos[0] };
  if (completos.length > 1) return {
    estado: 'AMBIGUO', motivo: 'El alumno tiene varios planes de pago completos en este ciclo.',
  };
  if (delCiclo.length) return { estado: 'FALTANTE', motivo: 'El plan de pagos del ciclo está incompleto.' };
  const cicloActual = ciclos.find(ciclo => ciclo.id === cicloId);
  const homonimos = cicloActual ? referencias.filter(plan => plan.alumno_id === alumnoId && plan.ciclo_id !== cicloId
    && !esPlanPagoTitulacion(plan.tipo_plan)
    && ciclos.some(ciclo => ciclo.id === plan.ciclo_id && ciclo.nombre === cicloActual.nombre)) : [];
  const homonimosMismaPeriodicidad = homonimos.filter(plan => !plan.tipo_plan?.trim()
    || normalizar(tipoPeriodoPlanPago(plan.tipo_plan)) === normalizar(cicloActual?.tipo_periodo));
  if (homonimosMismaPeriodicidad.length) {
    const tipos = [...new Set(homonimosMismaPeriodicidad.map(plan => ciclos.find(ciclo => ciclo.id === plan.ciclo_id)?.tipo_periodo
      || 'tipo sin definir'))].join(', ');
    return { estado: 'FALTANTE', motivo: `Hay un plan de pagos ${cicloActual!.tipo_periodo} con el nombre ${cicloActual!.nombre}, pero está asociado a otro ID de ciclo (${tipos}). Revisa su asociación antes de incluirlo.` };
  }
  if (homonimos.length) {
    const tipos = [...new Set(homonimos.map(plan => plan.tipo_plan?.trim() || 'sin tipo definido'))].join(', ');
    return { estado: 'FALTANTE', motivo: `Hay un plan de pagos registrado como ${tipos} en otro ciclo ${cicloActual!.nombre}. Comprueba la periodicidad del plan académico y su grupo antes de corregir el tipo y el ID del ciclo.` };
  }
  return { estado: 'FALTANTE', motivo: 'El alumno no tiene plan de pagos en este ciclo.' };
}

/** Un borrador legado conserva sus PDF, pero no se comparte hasta registrar su procedencia. */
export function documentosCoincidenConCiclos(
  emision: { ciclo_boleta_id: string | null; boleta_no_aplica?: boolean; comunicados_documentos?:
    { tipo: string; ciclo_id: string | null }[] }, cicloId: string, cicloBoletaId: string | null,
): boolean {
  const sinBoleta = emision.boleta_no_aplica === true;
  if (sinBoleta ? emision.ciclo_boleta_id !== null : !cicloBoletaId || emision.ciclo_boleta_id !== cicloBoletaId)
    return false;
  const documentos = emision.comunicados_documentos || [];
  if (sinBoleta && documentos.some(documento => documento.tipo === 'BOLETA')) return false;
  return (sinBoleta ? ['CALENDARIO', 'HORARIO'] : ['BOLETA', 'CALENDARIO', 'HORARIO'])
    .every(tipo => documentos.some(documento =>
    documento.tipo === tipo && documento.ciclo_id === (tipo === 'BOLETA' ? cicloBoletaId : cicloId)))
    && documentos.every(documento => documento.ciclo_id ===
      (documento.tipo === 'BOLETA' ? cicloBoletaId : cicloId));
}

export const PLANTILLA_MENSAJE_PREDETERMINADA =
  'Hola, {nombre} (matrícula {matricula}). Te compartimos tus documentos del ciclo {ciclo}. '
  + 'La boleta corresponde al ciclo {ciclo_boleta}.\n{enlace}\n'
  + 'Si detectas algún dato incorrecto, comunícate con Control Escolar.';
export const PLANTILLA_NUEVO_INGRESO_PREDETERMINADA =
  'Hola, {nombre} (matrícula {matricula}). Te compartimos tus documentos del ciclo {ciclo}.\n'
  + '{enlace}\nSi detectas algún dato incorrecto, comunícate con Control Escolar.';
export const PLANTILLA_INGLES_PREDETERMINADA =
  'También cursas {materias_ingles} en este ciclo. Consulta sus actividades con Control Escolar.';

export interface PlantillasComunicado {
  contenido: string;
  contenido_nuevo_ingreso: string;
  contenido_ingles: string;
}

export interface DatosMensajeComunicado {
  nombre: string;
  matricula: string;
  ciclo: string;
  ciclo_boleta: string;
  enlace: string;
}

const camposMensaje = ['nombre', 'matricula', 'ciclo', 'ciclo_boleta', 'enlace'] as const;

export function validarPlantillaMensaje(plantilla: string, permiteBoleta = true): string | null {
  const contenido = plantilla.trim();
  if (contenido.length < 20 || contenido.length > 3000)
    return 'La plantilla debe tener entre 20 y 3000 caracteres.';
  const campos = [...contenido.matchAll(/\{([^{}]+)\}/g)].map(coincidencia => coincidencia[1]);
  const desconocido = campos.find(campo => !camposMensaje.includes(campo as typeof camposMensaje[number]));
  if (desconocido) return `El campo {${desconocido}} no está disponible.`;
  if (!permiteBoleta && campos.includes('ciclo_boleta'))
    return 'El mensaje de nuevo ingreso no puede incluir {ciclo_boleta}.';
  if (!campos.includes('nombre') && !campos.includes('matricula'))
    return 'Incluye {nombre} o {matricula} para identificar al alumno.';
  if (campos.filter(campo => campo === 'enlace').length !== 1)
    return 'Incluye {enlace} exactamente una vez.';
  return null;
}

export function validarPlantillaIngles(plantilla: string): string | null {
  const texto = plantilla.trim();
  if (texto.length > 1000) return 'El aviso de Inglés admite hasta 1000 caracteres.';
  const campos = [...texto.matchAll(/\{([^{}]+)\}/g)].map(item => item[1]);
  return campos.some(campo => !['nombre', 'matricula', 'ciclo', 'materias_ingles'].includes(campo))
    ? 'El aviso de Inglés contiene un campo no disponible.' : null;
}

export function renderizarPlantillaMensaje(plantilla: string, datos: DatosMensajeComunicado): string {
  return plantilla.trim().replace(/\{(nombre|matricula|ciclo|ciclo_boleta|enlace)\}/g,
    (_, campo: keyof DatosMensajeComunicado) => datos[campo].trim() || 'sin registrar');
}

export function renderizarAvisoIngles(plantilla: string, datos: DatosMensajeComunicado,
  materias: string[]): string {
  return plantilla.trim().replace(/\{(nombre|matricula|ciclo|materias_ingles)\}/g, (_, campo: string) =>
    campo === 'materias_ingles' ? (materias.join(', ') || 'Inglés')
      : datos[campo as keyof DatosMensajeComunicado].trim() || 'sin registrar');
}

export function componerMensajeConIngles(base: string, aviso: string, enlace: string): string {
  if (!aviso.trim()) return base;
  const indice = base.indexOf(enlace);
  return indice >= 0 ? `${base.slice(0, indice).trimEnd()}\n${aviso.trim()}\n${base.slice(indice)}`
    : `${base.trimEnd()}\n\n${aviso.trim()}`;
}

export function mensajeTelegramComunicado(
  nombre: string, cicloNombre: string, enlace: string, cicloBoletaNombre = '', matricula = '',
): string {
  return renderizarPlantillaMensaje(PLANTILLA_MENSAJE_PREDETERMINADA, {
    nombre, matricula, ciclo: cicloNombre, ciclo_boleta: cicloBoletaNombre, enlace,
  });
}
