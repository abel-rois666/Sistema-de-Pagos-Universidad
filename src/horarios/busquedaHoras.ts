import {
  type CargaHorario, type DiaHorario, type DocenteHorario, type EntradaHorario,
  type GrupoHorario, type SesionHorario, VENTANAS_TURNO,
} from './types';
import { docentesConVacantes } from './vacantes';
import { horasLibresEntreClases } from './reglasJornada';

interface Espacio { dia: DiaHorario; inicio: number }
interface Pendiente { carga: CargaHorario; grupo: GrupoHorario; docente: DocenteHorario; espacios: Espacio[] }

export interface ResultadoBusquedaHoras {
  horas: SesionHorario[] | null;
  evaluaciones: number;
  agotada: boolean;
  exhaustiva: boolean;
  soluciones: number;
  cargaBloqueadaId?: string;
}

export interface OpcionesBusquedaHoras {
  /** Devuelve true para detenerse; sin callback se conserva la primera solución. */
  alEncontrar?: (horas: SesionHorario[], evaluaciones: number) => boolean;
  debeDetener?: () => boolean;
}

const lugar = (dia: DiaHorario, hora: number) => `${dia}:${hora}`;
const ubicacion = (sesion: Pick<SesionHorario, 'aula' | 'sede'>) =>
  sesion.aula?.trim() ? `${(sesion.sede || '').trim().toLocaleLowerCase('es')}:${sesion.aula.trim().toLocaleLowerCase('es')}` : '';

function horasDiarias(sesiones: SesionHorario[], id: string, dia: DiaHorario, campo: 'grupoId' | 'docenteId'): number {
  return sesiones.filter(sesion => sesion[campo] === id && sesion.dia === dia)
    .reduce((total, sesion) => total + sesion.fin - sesion.inicio, 0);
}

function huecoDiario(sesiones: SesionHorario[], id: string, dia: DiaHorario, campo: 'grupoId' | 'docenteId',
  turno?: GrupoHorario['turno']): number {
  const horas = new Set<number>();
  for (const sesion of sesiones) if (sesion[campo] === id && sesion.dia === dia) {
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) horas.add(hora);
  }
  return horasLibresEntreClases([...horas], dia, turno).length;
}

/** Recorre combinaciones de horas con retroceso; un límite agotado no demuestra imposibilidad. */
export function buscarHoras(entrada: EntradaHorario, limite: number, configuracionBusqueda: OpcionesBusquedaHoras = {}): ResultadoBusquedaHoras {
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const docentes = new Map(docentesConVacantes(entrada).map(docente => [docente.id, docente]));
  const externas = entrada.ocupacionesExternas || [];
  const ocupadasGrupo = new Set<string>();
  const ocupadasDocente = new Set<string>();
  const ocupadasAula = new Set<string>();
  for (const sesion of externas) for (let hora = sesion.inicio; hora < sesion.fin; hora++) {
    const sitio = lugar(sesion.dia, hora);
    ocupadasGrupo.add(`${sesion.grupoId}:${sitio}`);
    ocupadasDocente.add(`${sesion.docenteId}:${sitio}`);
    if (ubicacion(sesion)) ocupadasAula.add(`${ubicacion(sesion)}:${sitio}`);
  }

  const pendientes: Pendiente[] = entrada.cargas.filter(carga => (carga.horasPresenciales || 0) > 0).map(carga => {
    const grupo = grupos.get(carga.grupoId)!;
    // Las vacantes también figuran en la entrada validada del motor.
    const docente = docentes.get(carga.docenteId!)!;
    const espacios: Espacio[] = [];
    for (const ventana of VENTANAS_TURNO[grupo.turno]) for (let hora = ventana.inicio; hora < ventana.fin; hora++) {
      if (docente.disponibilidad.some(disponible => disponible.dia === ventana.dia
        && disponible.inicio <= hora && disponible.fin > hora)) espacios.push({ dia: ventana.dia, inicio: hora });
    }
    return { carga, grupo, docente, espacios };
  }).sort((a, b) => (a.espacios.length - a.carga.horasPresenciales!) - (b.espacios.length - b.carga.horasPresenciales!)
    || b.carga.horasPresenciales! - a.carga.horasPresenciales!
    || a.carga.id.localeCompare(b.carga.id));

  const horas: SesionHorario[] = [];
  const totalesGrupo = new Map(entrada.grupos.map(grupo => [grupo.id,
    entrada.cargas.filter(carga => carga.grupoId === grupo.id).reduce((total, carga) => total + (carga.horasPresenciales || 0), 0)]));
  const totalesDocente = new Map(entrada.cargas.reduce((mapa, carga) => {
    mapa.set(carga.docenteId!, (mapa.get(carga.docenteId!) || 0) + (carga.horasPresenciales || 0));
    return mapa;
  }, new Map<string, number>()));
  let evaluaciones = 0;
  let agotada = false;
  let detenidaPorSolucion = false;
  let soluciones = 0;
  let primeraSolucion: SesionHorario[] | null = null;
  let cargaBloqueadaId: string | undefined;

  const libre = (pendiente: Pendiente, espacio: Espacio) => {
    const sitio = lugar(espacio.dia, espacio.inicio);
    const aula = ubicacion(pendiente.grupo);
    return !ocupadasGrupo.has(`${pendiente.grupo.id}:${sitio}`)
      && !ocupadasDocente.has(`${pendiente.docente.id}:${sitio}`)
      && (!aula || !ocupadasAula.has(`${aula}:${sitio}`));
  };
  const marcar = (sesion: SesionHorario, agregar: boolean) => {
    const sitio = lugar(sesion.dia, sesion.inicio);
    const accion = agregar ? 'add' : 'delete';
    ocupadasGrupo[accion](`${sesion.grupoId}:${sitio}`);
    ocupadasDocente[accion](`${sesion.docenteId}:${sitio}`);
    const aula = ubicacion(sesion);
    if (aula) ocupadasAula[accion](`${aula}:${sitio}`);
  };
  const puntuar = (pendiente: Pendiente, sesion: SesionHorario) => {
    const temporal = [...horas, sesion];
    const grupoId = pendiente.grupo.id;
    const docenteId = pendiente.docente.id;
    const dia = sesion.dia;
    const huecoGrupo = huecoDiario(temporal, grupoId, dia, 'grupoId', pendiente.grupo.turno);
    const huecoDocente = huecoDiario([...externas, ...temporal], docenteId, dia, 'docenteId');
    const cargaGrupo = horasDiarias(temporal, grupoId, dia, 'grupoId');
    const cargaDocente = horasDiarias([...externas, ...temporal], docenteId, dia, 'docenteId');
    const restantesGrupo = (totalesGrupo.get(grupoId) || 0) - horas.filter(hora => hora.grupoId === grupoId).length - 1;
    const restantesDocente = (totalesDocente.get(docenteId) || 0) - horas.filter(hora => hora.docenteId === docenteId).length - 1;
    const minimoGrupo = entrada.configuracion.minHorasGrupo ?? 2;
    const minimoDocente = entrada.configuracion.minHorasDocente ?? 2;
    const contigua = horas.some(hora => hora.cargaId === sesion.cargaId && hora.dia === dia
      && Math.abs(hora.inicio - sesion.inicio) === 1);
    return Math.max(0, huecoGrupo - entrada.configuracion.maxHuecoGrupo) * 100
      + Math.max(0, huecoDocente - entrada.configuracion.maxHuecoDocente) * 10
      + huecoGrupo * 4 + huecoDocente
      + Math.max(0, cargaGrupo - Math.max(3, minimoGrupo)) * 4
      + Math.max(0, cargaDocente - Math.max(3, minimoDocente))
      + (cargaGrupo < minimoGrupo && restantesGrupo < minimoGrupo - cargaGrupo ? 80 : 0)
      + (cargaDocente < minimoDocente && restantesDocente < minimoDocente - cargaDocente ? 8 : 0)
      - (contigua ? 3 : 0) + dia / 100 + sesion.inicio / 1000;
  };

  const explorar = (indiceCarga: number, colocadas: number, indiceMinimo: number): boolean => {
    if (configuracionBusqueda.debeDetener?.()) { agotada = true; return false; }
    if (indiceCarga === pendientes.length) {
      soluciones++;
      const completa = [...horas];
      primeraSolucion ||= completa;
      if (!configuracionBusqueda.alEncontrar || configuracionBusqueda.alEncontrar(completa, evaluaciones)) {
        detenidaPorSolucion = true;
        return true;
      }
      return false;
    }
    const pendiente = pendientes[indiceCarga];
    const restantes = pendiente.carga.horasPresenciales! - colocadas;
    if (pendiente.espacios.slice(indiceMinimo).filter(espacio => libre(pendiente, espacio)).length < restantes) {
      cargaBloqueadaId ||= pendiente.carga.id;
      return false;
    }
    const opciones = pendiente.espacios.map((espacio, indice) => ({ espacio, indice }))
      .filter(({ espacio, indice }) => indice >= indiceMinimo && libre(pendiente, espacio)
        && (!horas.some(hora => hora.cargaId === pendiente.carga.id && hora.dia === espacio.dia)
          || horas.some(hora => hora.cargaId === pendiente.carga.id && hora.dia === espacio.dia
            && hora.fin === espacio.inicio)))
      .map(({ espacio, indice }) => {
        const sesion: SesionHorario = { cargaId: pendiente.carga.id, grupoId: pendiente.grupo.id,
          asignaturaId: pendiente.carga.asignaturaId, docenteId: pendiente.docente.id,
          dia: espacio.dia, inicio: espacio.inicio, fin: espacio.inicio + 1,
          aula: pendiente.grupo.aula, sede: pendiente.grupo.sede };
        return { sesion, indice, puntaje: puntuar(pendiente, sesion) };
      }).sort((a, b) => a.puntaje - b.puntaje || a.indice - b.indice);
    for (const opcion of opciones) {
      if (evaluaciones >= limite) { agotada = true; return false; }
      evaluaciones++;
      marcar(opcion.sesion, true);
      horas.push(opcion.sesion);
      const completa = colocadas + 1 === pendiente.carga.horasPresenciales;
      // Si una materia posterior ya no tiene suficientes horas libres, esta rama no puede completarse.
      const posteriorSinCupo = pendientes.slice(indiceCarga + 1).find(otra =>
        otra.espacios.filter(espacio => libre(otra, espacio)).length < otra.carga.horasPresenciales!);
      if (!posteriorSinCupo && explorar(completa ? indiceCarga + 1 : indiceCarga,
        completa ? 0 : colocadas + 1, completa ? 0 : opcion.indice + 1)) return true;
      if (posteriorSinCupo) cargaBloqueadaId ||= posteriorSinCupo.carga.id;
      horas.pop();
      marcar(opcion.sesion, false);
      if (agotada) return false;
    }
    cargaBloqueadaId ||= pendiente.carga.id;
    return false;
  };

  explorar(0, 0, 0);
  return { horas: primeraSolucion, evaluaciones, agotada,
    exhaustiva: !agotada && !detenidaPorSolucion, soluciones, cargaBloqueadaId };
}
