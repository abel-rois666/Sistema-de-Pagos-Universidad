import type { MetricasHorario } from './evaluacionHorario';
import type { PoliticaHorario } from './politicaHorario';
import type { EntradaHorario, IncidenciaHorario } from './types';

export type ModoAsesoriaHorario = 'manual' | 'automatico';

export interface EstadoAsesoriaHorario {
  modo: ModoAsesoriaHorario;
  politica: PoliticaHorario;
  permitirVacantes: boolean;
  permitirNoPreferidas: boolean;
  cargasFijas: ReadonlySet<string>;
  busquedaAmpliadaUsada: boolean;
  busquedaExhaustiva: boolean;
  generado: boolean;
  metricas: MetricasHorario | null;
}

export interface SolicitudAsesoriaHorario {
  version: 1;
  resumen: {
    modo: ModoAsesoriaHorario;
    politica: PoliticaHorario;
    generado: boolean;
    busquedaExhaustiva: boolean;
    grupos: number;
    materias: number;
    configuracion: { maxHuecoGrupo: number; maxHuecoDocente: number; minHorasGrupo: number; minHorasDocente: number };
    metricas: Pick<MetricasHorario, 'vacantes' | 'jornadasCortasGrupo' | 'huecosGrupo' |
      'jornadasCortasDocente' | 'huecosDocente' | 'materiasNoPreferidas'> | null;
    incidencias: { codigo: string; cargaRef: string | null }[];
  };
  acciones: string[];
}

export interface SugerenciaAsesoriaHorario {
  accionId: string;
  motivo: string;
  efectoEsperado: string;
}

export interface EscenarioAsesoriaHorario {
  entrada: EntradaHorario;
  permitirVacantes: boolean;
  permitirNoPreferidas: boolean;
  cargasFijas: string[];
  busquedaAmpliada: boolean;
}

export interface ContextoAsesoriaHorario {
  solicitud: SolicitudAsesoriaHorario;
  cargasPorRef: ReadonlyMap<string, string>;
}

/** Los identificadores y nombres reales quedan en el navegador; Groq recibe solo referencias efímeras. */
export function crearContextoAsesoriaHorario(entrada: EntradaHorario, incidencias: IncidenciaHorario[],
  estado: EstadoAsesoriaHorario): ContextoAsesoriaHorario {
  const ids = [...new Set([
    ...incidencias.map(incidencia => incidencia.cargaId).filter((id): id is string => !!id),
    ...entrada.cargas.filter(carga => carga.docenteId?.startsWith('vacante:')).map(carga => carga.id),
    ...entrada.cargas.filter(carga => estado.cargasFijas.has(carga.id)).map(carga => carga.id),
  ])].slice(0, 8);
  const cargasPorRef = new Map(ids.map((id, indice) => [`c${indice + 1}`, id]));
  const refsPorCarga = new Map([...cargasPorRef].map(([ref, id]) => [id, ref]));
  const codigos = new Set(incidencias.map(incidencia => incidencia.codigo));
  const acciones: string[] = [];
  if (!estado.busquedaExhaustiva && !estado.busquedaAmpliadaUsada) acciones.push('ampliar_busqueda');
  if (estado.modo === 'automatico') {
    if (!estado.permitirVacantes && !estado.generado) acciones.push('permitir_vacantes');
    if (!estado.permitirNoPreferidas && (!estado.generado || (estado.metricas?.vacantes || 0) > 0))
      acciones.push('permitir_no_preferidas');
    for (const [ref, id] of cargasPorRef) {
      if (estado.cargasFijas.has(id) && acciones.filter(accion => accion.startsWith('liberar:')).length < 3)
        acciones.push(`liberar:${ref}`);
    }
  }
  if (codigos.has('JORNADA_CORTA_GRUPO') && (entrada.configuracion.minHorasGrupo ?? 2) > 1)
    acciones.push('min_grupo_1');
  if (codigos.has('JORNADA_CORTA_DOCENTE') && (entrada.configuracion.minHorasDocente ?? 2) > 1)
    acciones.push('min_docente_1');
  if (codigos.has('HUECO_GRUPO') && entrada.configuracion.maxHuecoGrupo < 8)
    acciones.push('hueco_grupo_mas_1');
  if (codigos.has('HUECO_DOCENTE') && entrada.configuracion.maxHuecoDocente < 8)
    acciones.push('hueco_docente_mas_1');
  const metricas = estado.metricas && {
    vacantes: estado.metricas.vacantes,
    jornadasCortasGrupo: estado.metricas.jornadasCortasGrupo,
    huecosGrupo: estado.metricas.huecosGrupo,
    jornadasCortasDocente: estado.metricas.jornadasCortasDocente,
    huecosDocente: estado.metricas.huecosDocente,
    materiasNoPreferidas: estado.metricas.materiasNoPreferidas,
  };
  return {
    cargasPorRef,
    solicitud: {
      version: 1,
      resumen: {
        modo: estado.modo, politica: estado.politica, generado: estado.generado,
        busquedaExhaustiva: estado.busquedaExhaustiva,
        grupos: entrada.grupos.length, materias: entrada.cargas.length,
        configuracion: {
          maxHuecoGrupo: entrada.configuracion.maxHuecoGrupo,
          maxHuecoDocente: entrada.configuracion.maxHuecoDocente,
          minHorasGrupo: entrada.configuracion.minHorasGrupo ?? 2,
          minHorasDocente: entrada.configuracion.minHorasDocente ?? 2,
        },
        metricas,
        incidencias: incidencias.slice(0, 12).map(incidencia => ({
          codigo: incidencia.codigo,
          cargaRef: refsPorCarga.get(incidencia.cargaId || '') || null,
        })),
      },
      acciones,
    },
  };
}

export function tituloAccionAsesoria(accionId: string, cargasPorRef: ReadonlyMap<string, string>,
  entrada: EntradaHorario): string {
  if (accionId.startsWith('liberar:')) {
    const cargaId = cargasPorRef.get(accionId.slice(8));
    const carga = entrada.cargas.find(item => item.id === cargaId);
    const grupo = entrada.grupos.find(item => item.id === carga?.grupoId);
    return carga ? `Liberar docente fijo · ${carga.asignatura}${grupo ? ` (${grupo.codigo})` : ''}` : 'Liberar docente fijo';
  }
  return ({
    ampliar_busqueda: 'Explorar más combinaciones',
    permitir_vacantes: 'Permitir vacantes en el borrador',
    permitir_no_preferidas: 'Considerar materias no preferidas',
    min_grupo_1: 'Aceptar días de una hora para grupos',
    min_docente_1: 'Aceptar días de una hora para docentes',
    hueco_grupo_mas_1: 'Ampliar una hora el hueco máximo de grupos',
    hueco_docente_mas_1: 'Ampliar una hora el hueco máximo de docentes',
  } as Record<string, string>)[accionId] || 'Ajuste de horario';
}

export function construirEscenarioAsesoriaHorario(entrada: EntradaHorario, estado: EstadoAsesoriaHorario,
  contexto: ContextoAsesoriaHorario, accionId: string): EscenarioAsesoriaHorario | null {
  if (!contexto.solicitud.acciones.includes(accionId)) return null;
  const configuracion = { ...entrada.configuracion };
  const cargasFijas = new Set(estado.cargasFijas);
  let permitirVacantes = estado.permitirVacantes;
  let permitirNoPreferidas = estado.permitirNoPreferidas;
  let busquedaAmpliada = false;
  switch (accionId) {
    case 'ampliar_busqueda': busquedaAmpliada = true; break;
    case 'permitir_vacantes': permitirVacantes = true; break;
    case 'permitir_no_preferidas': permitirNoPreferidas = true; break;
    case 'min_grupo_1': configuracion.minHorasGrupo = 1; break;
    case 'min_docente_1': configuracion.minHorasDocente = 1; break;
    case 'hueco_grupo_mas_1': configuracion.maxHuecoGrupo += 1; break;
    case 'hueco_docente_mas_1': configuracion.maxHuecoDocente += 1; break;
    default: {
      if (!accionId.startsWith('liberar:')) return null;
      const cargaId = contexto.cargasPorRef.get(accionId.slice(8));
      if (!cargaId || !cargasFijas.has(cargaId)) return null;
      cargasFijas.delete(cargaId);
    }
  }
  return { entrada: { ...entrada, configuracion }, permitirVacantes, permitirNoPreferidas,
    cargasFijas: [...cargasFijas], busquedaAmpliada };
}
