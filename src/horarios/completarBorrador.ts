import { incumplimientosEstrictosPendientes, type AutorizacionJornadaDocente } from './autorizacionesJornada';
import { revisarAjusteManual } from './ajusteManual';
import { validarEntradas, validarSesiones } from './motor';
import type { PoliticaHorario } from './politicaHorario';
import { conflictosNuevos } from './revisionProgresiva';
import { esMateriaComplementaria, prepararBorradorHorario } from './seleccion';
import { incidenciaSuave, type EntradaHorario, type IncidenciaHorario, type SesionHorario } from './types';

export interface PreparacionComplecion {
  gruposSeleccionados: string[];
  cargasIncluidas: Set<string>;
  entradaBusqueda: EntradaHorario | null;
  cargasPendientes: string[];
}

/** Detecta datos que el usuario debe corregir antes de buscar nuevas sesiones. */
export function datosPendientesParaComplecion(preparacion: PreparacionComplecion): IncidenciaHorario[] {
  if (!preparacion.entradaBusqueda) return [];
  return validarEntradas({ ...preparacion.entradaBusqueda,
    cargas: preparacion.entradaBusqueda.cargas.map(carga => ({ ...carga, docenteId: null })) })
    .filter(incidencia => incidencia.codigo !== 'SIN_DOCENTE');
}

/** Añade grupos al escenario de búsqueda sin mover una sola sesión del borrador actual. */
export function prepararComplecionGrupos(entrada: EntradaHorario, seleccionados: readonly string[],
  incluidas: ReadonlySet<string>, sesiones: readonly SesionHorario[], gruposNuevos: readonly string[]): PreparacionComplecion {
  const existentes = new Set(entrada.grupos.map(grupo => grupo.id));
  const seleccion = new Set(seleccionados);
  const nuevas = [...new Set(gruposNuevos)];
  if (!nuevas.length || nuevas.some(id => !existentes.has(id) || seleccion.has(id)))
    throw new Error('Elige uno o más grupos omitidos de este ciclo.');
  if (sesiones.some(sesion => nuevas.includes(sesion.grupoId)))
    throw new Error('El grupo ya contiene sesiones en el borrador. Revísalas antes de completarlo.');
  const cargasIncluidas = new Set(incluidas);
  const pendientes = entrada.cargas.filter(carga => nuevas.includes(carga.grupoId)
    && (cargasIncluidas.has(carga.id) || !esMateriaComplementaria(carga)));
  pendientes.forEach(carga => cargasIncluidas.add(carga.id));
  nuevas.forEach(id => seleccion.add(id));
  return {
    gruposSeleccionados: [...seleccion], cargasIncluidas,
    cargasPendientes: pendientes.map(carga => carga.id),
    entradaBusqueda: pendientes.length ? {
      ...entrada,
      grupos: entrada.grupos.filter(grupo => nuevas.includes(grupo.id)),
      cargas: pendientes,
      ocupacionesExternas: [...(entrada.ocupacionesExternas || []), ...sesiones],
    } : null,
  };
}

export interface ComplecionValidada {
  entrada: EntradaHorario;
  sesiones: SesionHorario[];
  incidencias: IncidenciaHorario[];
}

/** Incorpora la propuesta solo si no agrega conflictos; las sesiones anteriores conservan sus valores y orden. */
export function validarComplecionGrupos(entrada: EntradaHorario, seleccionados: readonly string[],
  incluidas: ReadonlySet<string>, sesiones: readonly SesionHorario[], preparacion: PreparacionComplecion,
  propuesta: { entrada: EntradaHorario; sesiones: SesionHorario[] }, politica: PoliticaHorario,
  autorizaciones: AutorizacionJornadaDocente[] = []): ComplecionValidada | string {
  const cargasEsperadas = new Set(preparacion.cargasPendientes);
  const asignadas = new Map(propuesta.entrada.cargas.map(carga => [carga.id, carga]));
  if (asignadas.size !== cargasEsperadas.size || [...asignadas.keys()].some(id => !cargasEsperadas.has(id))
    || propuesta.sesiones.some(sesion => !cargasEsperadas.has(sesion.cargaId)))
    return 'La propuesta no contiene exactamente las materias del grupo pendiente.';
  const entradaNueva: EntradaHorario = { ...entrada,
    cargas: entrada.cargas.map(carga => asignadas.get(carga.id) || carga),
  };
  const sesionesNuevas = [...sesiones, ...propuesta.sesiones];
  const antes = prepararBorradorHorario(entrada, new Set(seleccionados), incluidas);
  const despues = prepararBorradorHorario(entradaNueva,
    new Set(preparacion.gruposSeleccionados), preparacion.cargasIncluidas);
  const conflictos = conflictosNuevos(
    validarSesiones([...sesiones], antes).filter(i => !incidenciaSuave(i)),
    validarSesiones(sesionesNuevas, despues).filter(i => !incidenciaSuave(i)));
  if (conflictos.length) return conflictos[0].mensaje;
  const incidencias = revisarAjusteManual(despues, sesionesNuevas);
  if (politica === 'estricto') {
    const anteriores = incumplimientosEstrictosPendientes(antes, [...sesiones],
      revisarAjusteManual(antes, [...sesiones]), autorizaciones);
    const nuevos = conflictosNuevos(anteriores,
      incumplimientosEstrictosPendientes(despues, sesionesNuevas, incidencias, autorizaciones));
    if (nuevos.length) return nuevos[0].mensaje;
  }
  return { entrada: entradaNueva, sesiones: sesionesNuevas, incidencias };
}
