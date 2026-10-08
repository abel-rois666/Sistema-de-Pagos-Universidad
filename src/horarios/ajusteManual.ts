import { evaluarHoras, validarContinuidadMaterias, validarSesiones } from './motor';
import { horasLibresEntreClases } from './reglasJornada';
import { docenteVacante, esVacante } from './vacantes';
import { incumplimientosEstrictos, type PoliticaHorario } from './politicaHorario';
import { DIAS_HORARIO, NOMBRES_DIAS, VENTANAS_TURNO,
  type DiaHorario, type EntradaHorario, type IncidenciaHorario, type SesionHorario, type TurnoHorario } from './types';

export interface DestinoBloque {
  permitido: boolean;
  motivo: string;
  advertencia?: string;
  sesiones?: SesionHorario[];
}

export type MarcaHorario = 'hueco' | 'jornada' | 'docente' | 'vacante';

const seCruzan = (a: SesionHorario, b: SesionHorario) => a.dia === b.dia
  && a.inicio < b.fin && b.inicio < a.fin;

const mismaAula = (a: SesionHorario, b: SesionHorario) => Boolean(a.aula?.trim() && b.aula?.trim()
  && a.aula.trim().toLocaleLowerCase('es') === b.aula.trim().toLocaleLowerCase('es')
  && (a.sede || '').trim().toLocaleLowerCase('es') === (b.sede || '').trim().toLocaleLowerCase('es'));

const horasDia = (sesiones: SesionHorario[], id: string, dia: DiaHorario, campo: 'grupoId' | 'docenteId') => {
  const horas = new Set<number>();
  for (const sesion of sesiones) if (sesion[campo] === id && sesion.dia === dia) {
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) horas.add(hora);
  }
  return [...horas].sort((a, b) => a - b);
};

const hueco = (horas: number[], dia: DiaHorario, turno?: TurnoHorario) =>
  horasLibresEntreClases(horas, dia, turno).length;

function penalizacionDia(horas: number[], dia: DiaHorario, maxHueco: number, minHoras: number,
  turno?: TurnoHorario): number {
  return Math.max(0, hueco(horas, dia, turno) - maxHueco)
    + (horas.length > 0 ? Math.max(0, minHoras - horas.length) : 0);
}

function penalizacionAfectada(entrada: EntradaHorario, sesiones: SesionHorario[], sesion: SesionHorario,
  dias: ReadonlySet<DiaHorario>): number {
  let total = 0;
  const conExternas = [...(entrada.ocupacionesExternas || []), ...sesiones];
  for (const dia of dias) {
    total += penalizacionDia(horasDia(sesiones, sesion.grupoId, dia, 'grupoId'), dia,
      entrada.configuracion.maxHuecoGrupo, entrada.configuracion.minHorasGrupo ?? 2,
      entrada.grupos.find(grupo => grupo.id === sesion.grupoId)?.turno);
    if (!esVacante(sesion.docenteId)
      && horasDia(sesiones, sesion.docenteId, dia, 'docenteId').length) total += penalizacionDia(
      horasDia(conExternas, sesion.docenteId, dia, 'docenteId'), dia,
      entrada.configuracion.maxHuecoDocente, entrada.configuracion.minHorasDocente ?? 2);
  }
  return total;
}

/** Evalúa un movimiento sin alterar el borrador y respeta la política seleccionada. */
export function evaluarDestinoBloque(entrada: EntradaHorario, sesiones: SesionHorario[], indice: number,
  dia: DiaHorario, inicio: number, validarTodo = true,
  politica: PoliticaHorario = 'flexible'): DestinoBloque {
  const original = sesiones[indice];
  if (!original) return { permitido: false, motivo: 'Selecciona un bloque válido.' };
  return evaluarDestinoTramo(entrada, sesiones, indice, original.inicio, original.fin - original.inicio,
    dia, inicio, validarTodo, politica);
}

/** Mueve un tramo contiguo de una sesión como una sola operación, sin estados parciales. */
export function evaluarDestinoTramo(entrada: EntradaHorario, sesiones: SesionHorario[], indice: number,
  tramoInicio: number, duracion: number, dia: DiaHorario, inicio: number,
  validarTodo = true, politica: PoliticaHorario = 'flexible'): DestinoBloque {
  const original = sesiones[indice];
  if (!original) return { permitido: false, motivo: 'Selecciona un bloque válido.' };
  if (!Number.isInteger(tramoInicio) || !Number.isInteger(duracion) || duracion < 1
    || tramoInicio < original.inicio || tramoInicio + duracion > original.fin)
    return { permitido: false, motivo: 'Elige horas contiguas dentro del bloque original.' };
  const grupo = entrada.grupos.find(item => item.id === original.grupoId);
  const carga = entrada.cargas.find(item => item.id === original.cargaId);
  const docente = entrada.docentes.find(item => item.id === original.docenteId)
    || (carga && esVacante(original.docenteId) ? docenteVacante(carga, entrada) : null);
  if (!grupo || !carga || !docente) return { permitido: false, motivo: 'Falta el grupo, la materia o el docente de este bloque.' };
  const fin = inicio + duracion;
  if (!Number.isInteger(inicio) || !DIAS_HORARIO.includes(dia))
    return { permitido: false, motivo: 'El destino debe comenzar en una hora completa de lunes a sábado.' };
  if (dia === original.dia && inicio === tramoInicio)
    return { permitido: true, motivo: 'El bloque ya está en este espacio.', sesiones };
  if (!VENTANAS_TURNO[grupo.turno].some(ventana => ventana.dia === dia
    && ventana.inicio <= inicio && ventana.fin >= fin))
    return { permitido: false, motivo: `El bloque de ${duracion} hora(s) queda fuera del turno ${grupo.turno.toLowerCase()}.` };
  if (!docente.disponibilidad.some(ventana => ventana.dia === dia
    && ventana.inicio <= inicio && ventana.fin >= fin))
    return { permitido: false, motivo: esVacante(original.docenteId) ? 'El destino queda fuera del turno de la vacante.'
      : `${docente.nombre} no tiene disponibilidad durante todo el bloque.` };

  const tramo = { ...original, inicio: tramoInicio, fin: tramoInicio + duracion };
  const remanentes = [
    ...(original.inicio < tramoInicio ? [{ ...original, fin: tramoInicio }] : []),
    ...(tramo.fin < original.fin ? [{ ...original, inicio: tramo.fin }] : []),
  ];
  const propuesto = { ...tramo, dia, inicio, fin };
  const ocupadas = [...sesiones.filter((_, posicion) => posicion !== indice),
    ...remanentes, ...(entrada.ocupacionesExternas || [])];
  for (const otra of ocupadas) {
    if (!seCruzan(propuesto, otra)) continue;
    if (otra.grupoId === propuesto.grupoId) return { permitido: false,
      motivo: `El grupo ${grupo.codigo} ya tiene clase en ese espacio.` };
    if (otra.docenteId === propuesto.docenteId) return { permitido: false,
      motivo: esVacante(propuesto.docenteId) ? 'La vacante ya ocupa ese espacio.'
        : `${docente.nombre} ya tiene clase en ese espacio.` };
    if (mismaAula(propuesto, otra)) return { permitido: false,
      motivo: `El aula ${propuesto.aula} ya está ocupada en ese espacio.` };
  }

  const candidatas = sesiones.flatMap((sesion, posicion) => posicion === indice
    ? [...remanentes, propuesto] : [sesion]);
  const discontinuidad = validarContinuidadMaterias(candidatas, entrada)[0];
  if (discontinuidad) return { permitido: false, motivo: discontinuidad.mensaje };
  if (validarTodo) {
    const bloqueos = validarSesiones(candidatas, entrada).filter(incidencia =>
      !['HUECO_GRUPO', 'HUECO_DOCENTE', 'JORNADA_CORTA_GRUPO', 'JORNADA_CORTA_DOCENTE', 'VACANTE']
        .includes(incidencia.codigo));
    if (bloqueos.length) return { permitido: false, motivo: bloqueos[0].mensaje };
  }
  const dias = new Set<DiaHorario>([original.dia, dia]);
  const penalizacionNueva = penalizacionAfectada(entrada, candidatas, tramo, dias);
  if (politica === 'estricto' && penalizacionNueva > 0) return {
    permitido: false, motivo: 'El movimiento crearía un hueco o una jornada inferior al mínimo diario del modo estricto.',
  };
  if (validarTodo && politica === 'estricto') {
    const incumplimientos = incumplimientosEstrictos(revisarAjusteManual(entrada, candidatas));
    if (incumplimientos.length) return { permitido: false, motivo: incumplimientos[0].mensaje };
  }
  const empeora = penalizacionNueva > penalizacionAfectada(entrada, sesiones, tramo, dias);
  return { permitido: true, motivo: empeora ? 'Permitido, pero aumenta un hueco o una jornada corta.'
    : 'Destino disponible.', ...(empeora ? { advertencia: 'Aumenta un hueco o una jornada corta.' } : {}),
    sesiones: candidatas };
}

/** Separa un bloque en unidades de 60 minutos sin cambiar sus horas totales. */
export function dividirBloque(sesiones: SesionHorario[], indice: number): SesionHorario[] {
  const original = sesiones[indice];
  if (!original || original.fin - original.inicio <= 1) return sesiones;
  return [...sesiones.slice(0, indice),
    ...Array.from({ length: original.fin - original.inicio }, (_, paso) => ({
      ...original, inicio: original.inicio + paso, fin: original.inicio + paso + 1,
    })), ...sesiones.slice(indice + 1)];
}

/** Las observaciones se vinculan a celdas visibles sin depender de analizar mensajes. */
export function marcasGrupoHorario(entrada: EntradaHorario, sesiones: SesionHorario[], grupoId: string):
  Map<string, Set<MarcaHorario>> {
  const marcas = new Map<string, Set<MarcaHorario>>();
  const marcar = (dia: DiaHorario, hora: number, marca: MarcaHorario) => {
    const clave = `${dia}:${hora}`;
    const actuales = marcas.get(clave) || new Set<MarcaHorario>();
    actuales.add(marca); marcas.set(clave, actuales);
  };
  const propias = sesiones.filter(sesion => sesion.grupoId === grupoId);
  for (const sesion of propias) if (esVacante(sesion.docenteId)) {
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) marcar(sesion.dia, hora, 'vacante');
  }
  for (const dia of DIAS_HORARIO) {
    const horas = horasDia(propias, grupoId, dia, 'grupoId');
    if (hueco(horas, dia, entrada.grupos.find(grupo => grupo.id === grupoId)?.turno)
      > entrada.configuracion.maxHuecoGrupo) {
      for (const hora of horasLibresEntreClases(horas, dia,
        entrada.grupos.find(grupo => grupo.id === grupoId)?.turno)) marcar(dia, hora, 'hueco');
    }
    if (horas.length > 0 && horas.length < (entrada.configuracion.minHorasGrupo ?? 2)) {
      for (const hora of horas) marcar(dia, hora, 'jornada');
    }
  }
  const conExternas = [...(entrada.ocupacionesExternas || []), ...sesiones];
  for (const docenteId of new Set(propias.map(sesion => sesion.docenteId).filter(id => !esVacante(id)))) {
    for (const dia of DIAS_HORARIO) {
      const horasPropias = horasDia(propias, docenteId, dia, 'docenteId');
      if (!horasPropias.length) continue;
      const horas = horasDia(conExternas, docenteId, dia, 'docenteId');
      if (hueco(horas, dia) > entrada.configuracion.maxHuecoDocente
        || horas.length < (entrada.configuracion.minHorasDocente ?? 2)) {
        for (const hora of horasPropias) marcar(dia, hora, 'docente');
      }
    }
  }
  return marcas;
}

/** Resalta los huecos y jornadas breves en la vista editable de un docente. */
export function marcasDocenteHorario(entrada: EntradaHorario, sesiones: SesionHorario[], docenteId: string):
  Map<string, Set<MarcaHorario>> {
  const marcas = new Map<string, Set<MarcaHorario>>();
  const marcar = (dia: DiaHorario, hora: number, marca: MarcaHorario) => {
    const clave = `${dia}:${hora}`;
    const actuales = marcas.get(clave) || new Set<MarcaHorario>();
    actuales.add(marca); marcas.set(clave, actuales);
  };
  const propias = sesiones.filter(sesion => sesion.docenteId === docenteId);
  for (const sesion of propias) if (esVacante(docenteId)) {
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) marcar(sesion.dia, hora, 'vacante');
  }
  const conExternas = [...(entrada.ocupacionesExternas || []), ...sesiones];
  for (const dia of DIAS_HORARIO) {
    const propiasDia = horasDia(propias, docenteId, dia, 'docenteId');
    if (!propiasDia.length || esVacante(docenteId)) continue;
    const horas = horasDia(conExternas, docenteId, dia, 'docenteId');
    if (hueco(horas, dia) > entrada.configuracion.maxHuecoDocente) {
      for (const hora of horasLibresEntreClases(horas, dia)) marcar(dia, hora, 'hueco');
    }
    if (horas.length < (entrada.configuracion.minHorasDocente ?? 2)) {
      for (const hora of propiasDia) marcar(dia, hora, 'jornada');
    }
  }
  return marcas;
}

/** Recalcula la revisión del borrador sin cambiar la división manual de sus bloques. */
export function revisarAjusteManual(entrada: EntradaHorario, sesiones: SesionHorario[]): IncidenciaHorario[] {
  const horas = sesiones.flatMap(sesion => Array.from({ length: sesion.fin - sesion.inicio }, (_, paso) => ({
    ...sesion, inicio: sesion.inicio + paso, fin: sesion.inicio + paso + 1,
  })));
  return evaluarHoras(entrada, horas).incidencias;
}

export function etiquetaCelda(dia: DiaHorario, hora: number) {
  return `${NOMBRES_DIAS[dia]} ${String(hora).padStart(2, '0')}:00–${String(hora + 1).padStart(2, '0')}:00`;
}
