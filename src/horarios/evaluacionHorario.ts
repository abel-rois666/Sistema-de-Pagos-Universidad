import type { EntradaHorario, ResultadoHorario, SesionHorario } from './types';

export interface MetricasHorario {
  vacantes: number;
  jornadasCortasGrupo: number;
  huecosGrupo: number;
  jornadasCortasDocente: number;
  huecosDocente: number;
  materiasNoPreferidas: number;
  maxHorasDocente: number;
  reasignaciones: number;
}

export interface DetallePropuestaHorario {
  cargaId: string;
  docenteId: string;
  preferida: boolean;
  fija: boolean;
  vacante?: boolean;
}

export interface PropuestaHorario extends ResultadoHorario {
  entrada: EntradaHorario;
  detalle: DetallePropuestaHorario[];
  metricas: MetricasHorario;
  firma: string;
}

const orden: (keyof MetricasHorario)[] = [
  'vacantes', 'jornadasCortasGrupo', 'huecosGrupo', 'jornadasCortasDocente',
  'huecosDocente', 'materiasNoPreferidas', 'maxHorasDocente', 'reasignaciones',
];

export function compararPropuestas(a: PropuestaHorario, b: PropuestaHorario): number {
  for (const campo of orden) {
    const diferencia = a.metricas[campo] - b.metricas[campo];
    if (diferencia) return diferencia;
  }
  return a.firma.localeCompare(b.firma);
}

const horasSesion = (sesion: SesionHorario) => sesion.fin - sesion.inicio;

export function crearPropuestaHorario(origen: EntradaHorario, entrada: EntradaHorario,
  horario: ResultadoHorario, detalle: DetallePropuestaHorario[] = []): PropuestaHorario {
  const docentes = new Map(entrada.docentes.map(docente => [docente.id, docente]));
  const originales = new Map(origen.cargas.map(carga => [carga.id, carga.docenteId]));
  const horas = new Map<string, number>();
  for (const sesion of entrada.ocupacionesExternas || []) {
    horas.set(sesion.docenteId, (horas.get(sesion.docenteId) || 0) + horasSesion(sesion));
  }
  let vacantes = 0;
  let materiasNoPreferidas = 0;
  let reasignaciones = 0;
  for (const carga of entrada.cargas) {
    if (carga.docenteId?.startsWith('vacante:')) { vacantes++; continue; }
    const docente = docentes.get(carga.docenteId || '');
    if (docente && !docente.asignaturasPreferidas.includes(carga.asignaturaId)) materiasNoPreferidas++;
    const anterior = originales.get(carga.id);
    if (anterior && anterior !== carga.docenteId) reasignaciones++;
    if (carga.docenteId) horas.set(carga.docenteId,
      (horas.get(carga.docenteId) || 0) + (carga.horasPresenciales || 0));
  }
  const firma = [
    ...entrada.cargas.map(carga => `${carga.id}:${carga.docenteId || ''}`).sort(),
    ...horario.sesiones.flatMap(sesion => Array.from({ length: horasSesion(sesion) }, (_, indice) =>
      `${sesion.cargaId}:${sesion.dia}:${sesion.inicio + indice}`)).sort(),
  ].join('|');
  return {
    ...horario, entrada, detalle, firma,
    metricas: {
      vacantes,
      jornadasCortasGrupo: horario.incidencias.filter(i => i.codigo === 'JORNADA_CORTA_GRUPO').length,
      huecosGrupo: Object.values(horario.huecosGrupo).reduce((total, valor) => total + valor, 0),
      jornadasCortasDocente: horario.incidencias.filter(i => i.codigo === 'JORNADA_CORTA_DOCENTE').length,
      huecosDocente: Object.values(horario.huecosDocente).reduce((total, valor) => total + valor, 0),
      materiasNoPreferidas,
      maxHorasDocente: Math.max(0, ...horas.values()),
      reasignaciones,
    },
  };
}

/** Conserva una muestra pequeña de las mejores soluciones sin duplicados. */
export function conservarPropuesta(actuales: PropuestaHorario[], nueva: PropuestaHorario): PropuestaHorario[] {
  if (actuales.some(propuesta => propuesta.firma === nueva.firma)) return actuales;
  const porPatron = new Map<string, number>();
  return [...actuales, nueva].sort(compararPropuestas).filter(propuesta => {
    const patron = [
      ...propuesta.entrada.cargas.map(carga => `${carga.id}:${carga.docenteId || ''}`).sort(),
      ...propuesta.sesiones.map(sesion => `${sesion.cargaId}:${sesion.dia}`).sort(),
    ].join('|');
    const cantidad = porPatron.get(patron) || 0;
    porPatron.set(patron, cantidad + 1);
    return cantidad < 3;
  }).slice(0, 64);
}

function horasPorCarga(propuesta: PropuestaHorario): Set<string> {
  return new Set(propuesta.sesiones.flatMap(sesion =>
    Array.from({ length: horasSesion(sesion) }, (_, indice) =>
      `${sesion.cargaId}:${sesion.dia}:${sesion.inicio + indice}`)));
}

export function propuestasParaMostrar(candidatas: PropuestaHorario[]): PropuestaHorario[] {
  if (!candidatas.length) return [];
  const [mejor, ...resto] = [...candidatas].sort(compararPropuestas);
  const horasMejor = horasPorCarga(mejor);
  const docenteMejor = new Map(mejor.entrada.cargas.map(carga => [carga.id, carga.docenteId]));
  const alternativa = resto.find(propuesta => {
    if (propuesta.metricas.vacantes !== mejor.metricas.vacantes
      || propuesta.metricas.jornadasCortasGrupo > mejor.metricas.jornadasCortasGrupo + 1
      || propuesta.metricas.huecosGrupo > mejor.metricas.huecosGrupo + 2) return false;
    const cambiaDocente = propuesta.entrada.cargas.some(carga => docenteMejor.get(carga.id) !== carga.docenteId);
    const horasOtras = horasPorCarga(propuesta);
    const diferencias = [...horasMejor].filter(hora => !horasOtras.has(hora)).length
      + [...horasOtras].filter(hora => !horasMejor.has(hora)).length;
    return cambiaDocente || diferencias >= 4;
  });
  return alternativa ? [mejor, alternativa] : [mejor];
}
