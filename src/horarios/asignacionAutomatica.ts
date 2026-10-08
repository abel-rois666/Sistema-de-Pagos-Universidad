import { docentesElegibles, evaluarHoras, validarEntradas, validarSesiones } from './motor';
import { buscarHoras } from './busquedaHoras';
import { conservarPropuesta, crearPropuestaHorario, propuestasParaMostrar, type PropuestaHorario } from './evaluacionHorario';
import { incidenciaSuave, type CargaHorario, type DocenteHorario, type EntradaHorario, type IncidenciaHorario, type ResultadoHorario, type SesionHorario } from './types';
import { docenteVacante, esVacante } from './vacantes';
import { cumplePoliticaHorario, incumplimientosEstrictos, type PoliticaHorario } from './politicaHorario';

export interface OpcionesAsignacionAutomatica {
  permitirNoPreferidas: boolean;
  permitirVacantes?: boolean;
  politica?: PoliticaHorario;
  cargasFijas: ReadonlySet<string>;
  limiteTiempoMs?: number;
  busquedaAmpliada?: boolean;
  informarAvance?: (evaluaciones: number, soluciones: number) => void;
}

export interface DetalleAsignacionAutomatica {
  cargaId: string;
  docenteId: string;
  preferida: boolean;
  fija: boolean;
  vacante?: boolean;
}

export interface ResultadoAsignacionAutomatica extends ResultadoHorario {
  entrada: EntradaHorario;
  detalle: DetalleAsignacionAutomatica[];
  completo: boolean;
  evaluaciones: number;
  propuestas: PropuestaHorario[];
  busquedaExhaustiva: boolean;
  solucionesEvaluadas: number;
}

interface Pendiente { carga: CargaHorario; candidatos: DocenteHorario[]; motivoSinCandidatos: string }
interface Estado {
  asignadas: CargaHorario[];
  omitidas: IncidenciaHorario[];
  horas: SesionHorario[];
  puntaje: number;
}

const MAX_EVALUACIONES = 5000;
const MAX_NODOS_HORAS = 120000;
const MAX_NODOS_POR_COMBINACION = 500;
const MAX_OPCIONES_HORAS = 2;

function puntuar(entrada: EntradaHorario, cargas: CargaHorario[], resultado: ResultadoHorario): number {
  const docentes = new Map(entrada.docentes.map(docente => [docente.id, docente]));
  const horas = new Map<string, number>();
  let noPreferidas = 0;
  let reasignadas = 0;
  let vacantes = 0;
  for (const carga of cargas) {
    if (esVacante(carga.docenteId)) { vacantes++; continue; }
    const docente = docentes.get(carga.docenteId || '');
    if (docente && !docente.asignaturasPreferidas.includes(carga.asignaturaId)) noPreferidas++;
    if (entrada.cargas.find(original => original.id === carga.id)?.docenteId
      && entrada.cargas.find(original => original.id === carga.id)?.docenteId !== carga.docenteId) reasignadas++;
    horas.set(carga.docenteId!, (horas.get(carga.docenteId!) || 0) + (carga.horasTotales || 0));
  }
  const huecosGrupo = Object.values(resultado.huecosGrupo).reduce((total, huecos) => total + huecos, 0);
  const huecosDocente = Object.values(resultado.huecosDocente).reduce((total, huecos) => total + huecos, 0);
  const maxCarga = Math.max(0, ...horas.values());
  const jornadasGrupo = resultado.incidencias.filter(i => i.codigo === 'JORNADA_CORTA_GRUPO').length;
  const jornadasDocente = resultado.incidencias.filter(i => i.codigo === 'JORNADA_CORTA_DOCENTE').length;
  return huecosGrupo * 30 + huecosDocente * 4 + jornadasGrupo * 20 + jornadasDocente * 5
    + noPreferidas * 18 + reasignadas * 3 + maxCarga + vacantes * 10000;
}

function superaTresMaterias(asignadas: CargaHorario[], carga: CargaHorario, docenteId: string): boolean {
  const materias = new Set(asignadas.filter(item => item.grupoId === carga.grupoId && item.docenteId === docenteId)
    .map(item => item.asignaturaId));
  materias.add(carga.asignaturaId);
  return materias.size > 3;
}

function entradaParcial(entrada: EntradaHorario, cargas: CargaHorario[]): EntradaHorario {
  const grupoIds = new Set(cargas.map(carga => carga.grupoId));
  return { ...entrada, grupos: entrada.grupos.filter(grupo => grupoIds.has(grupo.id)), cargas };
}

/** Busca combinaciones de docente y horario en un borrador; no escribe en la base. */
export async function asignarDocentesYGenerar(
  entrada: EntradaHorario, opciones: OpcionesAsignacionAutomatica,
): Promise<ResultadoAsignacionAutomatica> {
  const estructurales = validarEntradas({ ...entrada, cargas: entrada.cargas.map(carga => ({ ...carga, docenteId: null })) })
    .filter(incidencia => incidencia.codigo !== 'SIN_DOCENTE');
  if (estructurales.length) return {
    entrada, sesiones: [], incidencias: estructurales, huecosGrupo: {}, huecosDocente: {},
    detalle: [], completo: false, evaluaciones: 0, propuestas: [],
    busquedaExhaustiva: true, solucionesEvaluadas: 0,
  };

  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const pendientes: Pendiente[] = entrada.cargas.map(carga => {
    const grupo = grupos.get(carga.grupoId)!;
    const elegibles = docentesElegibles(carga, grupo, entrada.docentes, entrada.ocupacionesExternas);
    const vacante = docenteVacante(carga, entrada);
    if (opciones.cargasFijas.has(carga.id) && carga.docenteId) {
      const fijado = esVacante(carga.docenteId) ? docenteVacante(carga, entrada, carga.docenteId)
        : elegibles.find(docente => docente.id === carga.docenteId);
      return { carga, candidatos: fijado ? [fijado] : [],
        motivoSinCandidatos: `El docente fijado para ${carga.asignatura} en ${grupo.codigo} no cumple el plan, la disponibilidad, el cupo semanal o las restricciones. Libera la asignación para buscar otra opción.` };
    }
    const candidatosReales = opciones.permitirNoPreferidas ? elegibles
      : elegibles.filter(docente => docente.asignaturasPreferidas.includes(carga.asignaturaId));
    const candidatos = [...candidatosReales, ...(opciones.permitirVacantes && vacante ? [vacante] : [])];
    return { carga, candidatos,
      motivoSinCandidatos: candidatos.length ? `No se encontró una combinación para ${carga.asignatura} en ${grupo.codigo} dentro de la búsqueda acotada.`
        : !opciones.permitirNoPreferidas && elegibles.length
          ? `Ningún docente disponible marcó ${carga.asignatura} como preferida en ${grupo.codigo}. Activa las materias no preferidas o elige un docente manualmente.`
          : `No hay docentes habilitados con disponibilidad y cupo semanal para ${carga.asignatura} en ${grupo.codigo}. Revisa el máximo semanal o elige otra asignación.` };
  }).sort((a, b) => Number(opciones.cargasFijas.has(b.carga.id)) - Number(opciones.cargasFijas.has(a.carga.id))
    || a.candidatos.length - b.candidatos.length
    || (b.carga.horasPresenciales || 0) - (a.carga.horasPresenciales || 0)
    || a.carga.id.localeCompare(b.carga.id));

  let mejor: Estado = { asignadas: [], omitidas: [], horas: [], puntaje: Infinity };
  let candidatas: PropuestaHorario[] = [];
  let solucionesEvaluadas = 0;
  let evaluaciones = 0;
  let nodosHoras = 0;
  let busquedaAgotada = false;
  const politica = opciones.politica ?? 'flexible';
  const maxEvaluaciones = opciones.busquedaAmpliada ? 20000 : politica === 'estricto' ? 8000 : MAX_EVALUACIONES;
  const maxNodosHoras = opciones.busquedaAmpliada ? 600000 : politica === 'estricto' ? 200000 : MAX_NODOS_HORAS;
  const maxNodosPorCombinacion = opciones.busquedaAmpliada ? 4000
    : politica === 'estricto' ? 1500 : MAX_NODOS_POR_COMBINACION;
  const maxOpcionesHoras = opciones.busquedaAmpliada ? 12 : politica === 'estricto' ? 8 : MAX_OPCIONES_HORAS;
  const vence = Date.now() + (opciones.limiteTiempoMs
    ?? (opciones.busquedaAmpliada ? 30000 : politica === 'estricto' ? 12000 : 6000));
  let mejorIncumplimiento: IncidenciaHorario[] = [];
  let finMejora = Infinity;
  const tiempoAgotado = () => Date.now() >= Math.min(vence, finMejora);
  const registrar = (asignadas: CargaHorario[], horario: ResultadoHorario) => {
    const propuestaEntrada = entradaParcial(entrada, asignadas);
    const detalle = asignadas.map(carga => ({
      cargaId: carga.id, docenteId: carga.docenteId!, fija: opciones.cargasFijas.has(carga.id),
      preferida: entrada.docentes.find(docente => docente.id === carga.docenteId)
        ?.asignaturasPreferidas.includes(carga.asignaturaId) || false,
      ...(esVacante(carga.docenteId) ? { vacante: true } : {}),
    }));
    const propuesta = crearPropuestaHorario(entrada, propuestaEntrada, horario, detalle);
    if (candidatas.some(existente => existente.firma === propuesta.firma)) return;
    solucionesEvaluadas++;
    if (solucionesEvaluadas === 1) finMejora = Date.now() + 1200;
    candidatas = conservarPropuesta(candidatas, propuesta);
    if (solucionesEvaluadas === 1 || solucionesEvaluadas % 50 === 0)
      opciones.informarAvance?.(evaluaciones, solucionesEvaluadas);
  };
  const explorar = async (indice: number, asignadas: CargaHorario[], omitidas: IncidenciaHorario[],
    horas: SesionHorario[]): Promise<void> => {
    if (indice === pendientes.length) {
      const completa = entradaParcial(entrada, asignadas);
      const horario = evaluarHoras(completa, [...horas]);
      if (!omitidas.length) {
        if (cumplePoliticaHorario(horario.incidencias, politica)) registrar(asignadas, horario);
        else {
          const incumplimientos = incumplimientosEstrictos(horario.incidencias);
          if (!mejorIncumplimiento.length || incumplimientos.length < mejorIncumplimiento.length)
            mejorIncumplimiento = incumplimientos;
        }
        return;
      }
      const puntaje = puntuar(entrada, asignadas, horario);
      const estado = { asignadas, omitidas, horas, puntaje };
      if (asignadas.length > mejor.asignadas.length
        || (asignadas.length === mejor.asignadas.length && puntaje < mejor.puntaje)) mejor = estado;
      return;
    }
    const pendiente = pendientes[indice];
    let primerConflicto = '';
    for (const docente of pendiente.candidatos) {
      const vacantesParciales = asignadas.filter(carga => esVacante(carga.docenteId)).length;
      if (esVacante(docente.id) && candidatas.length
        && vacantesParciales + 1 > candidatas[0].metricas.vacantes) continue;
      if (evaluaciones >= maxEvaluaciones || nodosHoras >= maxNodosHoras || tiempoAgotado()) {
        busquedaAgotada = true;
        break;
      }
      if (superaTresMaterias(asignadas, pendiente.carga, docente.id)) {
        primerConflicto ||= 'Se alcanzó el máximo de tres materias del grupo para el docente.';
        continue;
      }
      const ocupaciones = [...(entrada.ocupacionesExternas || []), ...horas];
      if (!esVacante(docente.id) && !docentesElegibles(pendiente.carga,
        grupos.get(pendiente.carga.grupoId)!, [docente], ocupaciones).length) {
        primerConflicto ||= 'El docente ya no tiene disponibilidad o cupo semanal con las materias colocadas.';
        continue;
      }
      const nuevas = [...asignadas, { ...pendiente.carga, docenteId: docente.id }];
      // Solo se colocan las horas de la nueva materia. Las anteriores quedan ocupadas
      // sin reconstruir desde cero el horario completo en cada nivel del árbol.
      const parcial: EntradaHorario = { ...entrada,
        grupos: [grupos.get(pendiente.carga.grupoId)!],
        cargas: [nuevas.at(-1)!], ocupacionesExternas: ocupaciones };
      const opcionesHoras: SesionHorario[][] = [];
      const limite = Math.min(maxNodosPorCombinacion, maxNodosHoras - nodosHoras);
      const busqueda = buscarHoras(parcial, limite, {
        debeDetener: tiempoAgotado,
        alEncontrar: encontradas => {
          opcionesHoras.push(encontradas);
          return opcionesHoras.length >= maxOpcionesHoras;
        },
      });
      evaluaciones++;
      nodosHoras += busqueda.evaluaciones;
      if (evaluaciones % 20 === 0) opciones.informarAvance?.(evaluaciones, solucionesEvaluadas);
      // Limitar distribuciones por materia también recorta la búsqueda global.
      if (!busqueda.exhaustiva) busquedaAgotada = true;
      if (!opcionesHoras.length) {
        primerConflicto ||= busqueda.agotada ? 'Se agotó la búsqueda de horas para esta asignación.'
          : 'No quedan horas compatibles para este docente, grupo y aula.';
        continue;
      }
      for (const opcion of opcionesHoras) {
        await explorar(indice + 1, nuevas, omitidas, [...horas, ...opcion]);
        if (evaluaciones >= maxEvaluaciones || nodosHoras >= maxNodosHoras || tiempoAgotado()) break;
      }
      if (evaluaciones % 40 === 0) await new Promise<void>(resolver => setTimeout(resolver, 0));
    }
    if (candidatas.length) return;
    const grupo = grupos.get(pendiente.carga.grupoId)!;
    const incidencia: IncidenciaHorario = {
      codigo: opciones.cargasFijas.has(pendiente.carga.id) ? 'DOCENTE_FIJO_SIN_SOLUCION' : 'SIN_DOCENTE_AUTO',
      cargaId: pendiente.carga.id, grupoId: grupo.id,
      mensaje: pendiente.candidatos.length
        ? `No se pudo ubicar ${pendiente.carga.asignatura} en ${grupo.codigo}. ${busquedaAgotada
          ? 'Se agotó el límite de búsqueda; no se ha demostrado que sea imposible.'
          : primerConflicto || 'Prueba otra selección o ajusta la disponibilidad.'}`
        : pendiente.motivoSinCandidatos,
    };
    // Omitir una materia solo conserva el mejor avance parcial; nunca cuenta como solución completa.
    await explorar(indice + 1, asignadas, [...omitidas, incidencia], horas);
  };
  await explorar(0, [], [], []);
  const propuestas = propuestasParaMostrar(candidatas.filter(propuesta =>
    !validarSesiones(propuesta.sesiones, propuesta.entrada).some(incidencia => !incidenciaSuave(incidencia))));
  if (propuestas.length) {
    const recomendada = propuestas[0];
    return { ...recomendada, entrada: recomendada.entrada, detalle: recomendada.detalle,
      completo: true, evaluaciones, propuestas, busquedaExhaustiva: !busquedaAgotada, solucionesEvaluadas };
  }
  const elegido: Estado = mejor;
  const asignadas = new Map(elegido.asignadas.map(carga => [carga.id, carga]));
  const entradaFinal: EntradaHorario = { ...entrada, cargas: entrada.cargas.map(carga => asignadas.get(carga.id)
    || { ...carga, docenteId: opciones.cargasFijas.has(carga.id) ? carga.docenteId : null }) };
  const detalle = elegido.asignadas.map(carga => ({
    cargaId: carga.id, docenteId: carga.docenteId!, fija: opciones.cargasFijas.has(carga.id),
    preferida: entrada.docentes.find(docente => docente.id === carga.docenteId)?.asignaturasPreferidas.includes(carga.asignaturaId) || false,
    ...(esVacante(carga.docenteId) ? { vacante: true } : {}),
  }));
  if (elegido.omitidas.length) return {
    entrada: entradaFinal, sesiones: [], incidencias: [
      ...elegido.omitidas.slice(0, 5),
      ...mejorIncumplimiento.slice(0, 3),
      { codigo: busquedaAgotada ? 'BUSQUEDA_AGOTADA' : 'SIN_SOLUCION',
        mensaje: busquedaAgotada
          ? `Se agotó la búsqueda con ${elegido.asignadas.length} de ${pendientes.length} materias ubicadas. Los avisos anteriores muestran los primeros bloqueos; no se ha demostrado que sea imposible.`
          : `Se ubicaron ${elegido.asignadas.length} de ${pendientes.length} materias. Los avisos anteriores muestran los primeros bloqueos que impiden completar el horario con las restricciones actuales.` },
    ], huecosGrupo: {}, huecosDocente: {},
    detalle, completo: false, evaluaciones, propuestas: [],
    busquedaExhaustiva: !busquedaAgotada, solucionesEvaluadas,
  };
  return { entrada: entradaFinal, sesiones: [], incidencias: [...mejorIncumplimiento.slice(0, 4), {
    codigo: busquedaAgotada ? 'BUSQUEDA_AGOTADA' : 'SIN_SOLUCION',
    mensaje: busquedaAgotada ? `Se agotó la búsqueda sin una propuesta ${politica}; puede existir una solución. ${politica === 'estricto' && !opciones.permitirVacantes ? 'Puedes permitir vacantes para ampliar las alternativas.' : ''}`
      : politica === 'estricto' && mejorIncumplimiento.length
        ? 'Los horarios completos evaluados incumplen los límites diarios estrictos. Ajusta los límites o permite vacantes.'
        : 'No existe una propuesta completa con las restricciones actuales.',
  }], huecosGrupo: {}, huecosDocente: {}, detalle, completo: false, evaluaciones,
  propuestas: [], busquedaExhaustiva: !busquedaAgotada, solucionesEvaluadas };
}
