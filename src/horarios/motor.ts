import {
  type CargaHorario, type DiaHorario, type DocenteHorario, type EntradaHorario,
  type GrupoHorario, type IncidenciaHorario, type ResultadoHorario, type SesionHorario,
  DIAS_HORARIO, NOMBRES_DIAS, VENTANAS_TURNO,
} from './types';
import { horasAsignadasDocente, horasTrasAsignar, superaCupoDocente } from './cupoDocente';
import { docentesConVacantes, esVacante } from './vacantes';
import { buscarHoras } from './busquedaHoras';
import { horasLibresEntreClases } from './reglasJornada';

const clave = (dia: DiaHorario, hora: number) => `${dia}-${hora}`;
const mismasAulas = (a: SesionHorario, b: SesionHorario) =>
  Boolean(a.aula?.trim() && b.aula?.trim()
    && a.aula.trim().toLocaleLowerCase('es') === b.aula.trim().toLocaleLowerCase('es')
    && (a.sede || '').trim().toLocaleLowerCase('es') === (b.sede || '').trim().toLocaleLowerCase('es'));

export function docentesElegibles(
  carga: CargaHorario, grupo: GrupoHorario, docentes: DocenteHorario[], ocupaciones: SesionHorario[] = [],
  cargasAsignadas: CargaHorario[] = [],
): DocenteHorario[] {
  return docentes.filter(docente => docente.activo
    && docente.planes.includes(grupo.planId)
    && !docente.gruposRestringidos.includes(grupo.id)
    && (carga.horasPresenciales === 0
      || !superaCupoDocente(docente, horasTrasAsignar(docente, carga, cargasAsignadas, ocupaciones)))
    && (carga.horasPresenciales === 0 || VENTANAS_TURNO[grupo.turno].reduce((total, turno) => {
      for (let hora = turno.inicio; hora < turno.fin; hora++) {
        if (docente.disponibilidad.some(ventana => ventana.dia === turno.dia && ventana.inicio <= hora && ventana.fin > hora)
          && !ocupaciones.some(s => s.docenteId === docente.id && s.dia === turno.dia && s.inicio <= hora && s.fin > hora)) total++;
      }
      return total;
    }, 0) >= (carga.horasPresenciales || 1)))
    .sort((a, b) => Number(b.asignaturasPreferidas.includes(carga.asignaturaId))
      - Number(a.asignaturasPreferidas.includes(carga.asignaturaId))
      || a.nombre.localeCompare(b.nombre, 'es'));
}

export function validarEntradas(entrada: EntradaHorario): IncidenciaHorario[] {
  const errores: IncidenciaHorario[] = [];
  if (!entrada.cargas.length) errores.push({ codigo: 'SIN_ASIGNATURAS',
    mensaje: 'Incluye al menos una materia para generar el horario.' });
  if (![entrada.configuracion.maxHuecoGrupo, entrada.configuracion.maxHuecoDocente]
    .every(valor => Number.isInteger(valor) && valor >= 0 && valor <= 8)) {
    errores.push({ codigo: 'HUECO_INVALIDO', mensaje: 'La preferencia de huecos debe ser un entero entre 0 y 8 horas por día.' });
  }
  if (![entrada.configuracion.minHorasGrupo ?? 2, entrada.configuracion.minHorasDocente ?? 2]
    .every(valor => Number.isInteger(valor) && valor >= 1 && valor <= 8)) {
    errores.push({ codigo: 'JORNADA_INVALIDA', mensaje: 'La duración mínima preferida debe ser un entero entre 1 y 8 horas por día.' });
  }
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const docentes = new Map(docentesConVacantes(entrada).map(docente => [docente.id, docente]));
  for (const docente of entrada.docentes) {
    if (!entrada.cargas.some(carga => carga.docenteId === docente.id)) continue;
    if (docente.maxHorasSemanales != null
      && (!Number.isInteger(docente.maxHorasSemanales) || docente.maxHorasSemanales < 1 || docente.maxHorasSemanales > 84)) {
      errores.push({ codigo: 'CUPO_DOCENTE_INVALIDO', docenteId: docente.id,
        mensaje: `El máximo semanal de ${docente.nombre} debe ser un entero entre 1 y 84 horas, o quedar sin límite.` });
    }
  }
  const materiasPorGrupo = new Set<string>();
  const gruposConCarga = new Set<string>();
  const materiasPorDocenteGrupo = new Map<string, Set<string>>();
  const horasPorGrupo = new Map<string, number>();

  for (const carga of entrada.cargas) {
    const grupo = grupos.get(carga.grupoId);
    const error = (codigo: string, mensaje: string) => errores.push({ codigo, mensaje, grupoId: carga.grupoId, cargaId: carga.id, docenteId: carga.docenteId || undefined });
    if (carga.maxBloque !== undefined && ![1, 2, 3, 4].includes(carga.maxBloque)) error('BLOQUE_INVALIDO', `El máximo por sesión de ${carga.asignatura} debe ser de una a cuatro horas.`);
    if (!grupo) { error('GRUPO_INEXISTENTE', `No se encontró el grupo de ${carga.asignatura}.`); continue; }
    gruposConCarga.add(grupo.id);
    const materiaClave = `${grupo.id}:${carga.asignaturaId}`;
    if (materiasPorGrupo.has(materiaClave)) error('MATERIA_DUPLICADA', `${carga.asignatura} aparece más de una vez en ${grupo.codigo}.`);
    materiasPorGrupo.add(materiaClave);
    if (!Number.isInteger(carga.horasTotales) || (carga.horasTotales || 0) <= 0) {
      error('HORAS_SIN_DEFINIR', `Define horas semanales positivas para ${carga.asignatura}.`);
      continue;
    }
    if (!Number.isInteger(carga.horasPresenciales) || !Number.isInteger(carga.horasAsincronas)
      || (carga.horasPresenciales || 0) < 0 || (carga.horasAsincronas || 0) < 0
      || carga.horasPresenciales! + carga.horasAsincronas! !== carga.horasTotales) {
      error('REPARTO_INVALIDO', `Las horas presenciales y asíncronas de ${carga.asignatura} deben sumar ${carga.horasTotales}.`);
      continue;
    }
    if (grupo.turno !== 'MIXTO' && carga.horasAsincronas !== 0) error('ASINCRONO_NO_MIXTO', `${grupo.codigo} no admite horas asíncronas en este turno.`);
    horasPorGrupo.set(grupo.id, (horasPorGrupo.get(grupo.id) || 0) + carga.horasPresenciales!);
    if (!carga.docenteId) { error('SIN_DOCENTE', `Elige un docente para ${carga.asignatura} en ${grupo.codigo}.`); continue; }
    const docente = docentes.get(carga.docenteId);
    if (!docente || !docentesElegibles(carga, grupo, [docente], entrada.ocupacionesExternas).length) {
      error('DOCENTE_NO_ELEGIBLE', `El docente asignado a ${carga.asignatura} no cumple plan, disponibilidad, cupo semanal o restricción de ${grupo.codigo}.`);
      continue;
    }
    const docenteGrupo = `${grupo.id}:${docente.id}`;
    const materias = materiasPorDocenteGrupo.get(docenteGrupo) || new Set<string>();
    materias.add(carga.asignaturaId);
    materiasPorDocenteGrupo.set(docenteGrupo, materias);
  }
  for (const [grupoId, horas] of horasPorGrupo) {
    const grupo = grupos.get(grupoId)!;
    const capacidad = VENTANAS_TURNO[grupo.turno].reduce((total, v) => total + v.fin - v.inicio, 0);
    if (horas > capacidad) errores.push({ codigo: 'CAPACIDAD_TURNO', grupoId, mensaje: `${grupo.codigo} requiere ${horas} horas presenciales; su turno solo permite ${capacidad}.` });
  }
  for (const docente of entrada.docentes) {
    if (!entrada.cargas.some(carga => carga.docenteId === docente.id && (carga.horasPresenciales || 0) > 0)) continue;
    const total = horasAsignadasDocente(docente.id, entrada.cargas, entrada.ocupacionesExternas);
    if (superaCupoDocente(docente, total)) errores.push({ codigo: 'CUPO_DOCENTE_EXCEDIDO', docenteId: docente.id,
      mensaje: `${docente.nombre} sumaría ${total} horas presenciales semanales, incluidas las de ciclos superpuestos; su máximo es ${docente.maxHorasSemanales}. Reduce materias u horas presenciales, o asigna otro docente.` });
  }
  for (const grupo of entrada.grupos) {
    if (!gruposConCarga.has(grupo.id) && !grupo.soloComplementarias) errores.push({ codigo: 'SIN_ASIGNATURAS', grupoId: grupo.id, mensaje: `Asigna al menos una materia a ${grupo.codigo} antes de generar su horario.` });
  }
  for (const [claveDocenteGrupo, materias] of materiasPorDocenteGrupo) {
    if (materias.size > 3) errores.push({ codigo: 'MAX_TRES_MATERIAS', grupoId: claveDocenteGrupo.split(':')[0], docenteId: claveDocenteGrupo.split(':')[1], mensaje: 'Un docente no puede impartir más de tres asignaturas distintas al mismo grupo.' });
  }
  return errores;
}

function huecos(sesiones: SesionHorario[], atributo: 'grupoId' | 'docenteId',
  grupos: Map<string, GrupoHorario>): Record<string, number> {
  const mapa = new Map<string, Map<DiaHorario, Set<number>>>();
  for (const sesion of sesiones) {
    const dias = mapa.get(sesion[atributo]) || new Map<DiaHorario, Set<number>>();
    const horas = dias.get(sesion.dia) || new Set<number>();
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) horas.add(hora);
    dias.set(sesion.dia, horas);
    mapa.set(sesion[atributo], dias);
  }
  const resultado: Record<string, number> = {};
  for (const [id, dias] of mapa) {
    resultado[id] = [...dias.entries()].reduce((total, [dia, horas]) =>
      total + horasLibresEntreClases([...horas], dia, atributo === 'grupoId'
        ? grupos.get(id)?.turno : undefined).length, 0);
  }
  return resultado;
}

function huecoDiario(sesiones: SesionHorario[], id: string, dia: DiaHorario,
  atributo: 'grupoId' | 'docenteId', turno?: GrupoHorario['turno']): number {
  const horas = new Set<number>();
  for (const sesion of sesiones) if (sesion[atributo] === id && sesion.dia === dia) {
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) horas.add(hora);
  }
  return horasLibresEntreClases([...horas], dia, turno).length;
}

/** Una materia puede dividirse en sesiones contiguas, pero no reaparecer tras un hueco el mismo día. */
export function validarContinuidadMaterias(sesiones: SesionHorario[], entrada: EntradaHorario): IncidenciaHorario[] {
  const cargas = new Map(entrada.cargas.map(carga => [carga.id, carga]));
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const porMateriaDia = new Map<string, SesionHorario[]>();
  for (const sesion of sesiones) {
    const clave = `${sesion.cargaId}:${sesion.dia}`;
    const propias = porMateriaDia.get(clave) || [];
    propias.push(sesion);
    porMateriaDia.set(clave, propias);
  }
  const incidencias: IncidenciaHorario[] = [];
  for (const propias of porMateriaDia.values()) {
    if (propias.length < 2) continue;
    const ordenadas = [...propias].sort((a, b) => a.inicio - b.inicio);
    let fin = ordenadas[0].fin;
    for (const sesion of ordenadas.slice(1)) {
      if (sesion.inicio > fin) {
        const carga = cargas.get(sesion.cargaId);
        incidencias.push({ codigo: 'MATERIA_DISCONTINUA', grupoId: sesion.grupoId,
          cargaId: sesion.cargaId, docenteId: sesion.docenteId,
          mensaje: `${carga?.asignatura || 'La materia'} en ${grupos.get(sesion.grupoId)?.codigo || 'el grupo'} tiene horas separadas el ${NOMBRES_DIAS[sesion.dia]}. Sus clases del mismo día deben ser continuas.` });
        break;
      }
      fin = Math.max(fin, sesion.fin);
    }
  }
  return incidencias;
}

function horasDiarias(sesiones: SesionHorario[], id: string, dia: DiaHorario, atributo: 'grupoId' | 'docenteId'): number {
  const horas = new Set<number>();
  for (const sesion of sesiones) if (sesion[atributo] === id && sesion.dia === dia) {
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) horas.add(hora);
  }
  return horas.size;
}

export function generarHorario(entrada: EntradaHorario, limiteBusqueda = 50000,
  debeDetener?: () => boolean): ResultadoHorario & { evaluaciones: number; busquedaAgotada: boolean } {
  const incidencias = validarEntradas(entrada);
  if (incidencias.length) return { sesiones: [], incidencias, huecosGrupo: {}, huecosDocente: {}, evaluaciones: 0, busquedaAgotada: false };
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const busqueda = buscarHoras(entrada, limiteBusqueda, { debeDetener });
  if (!busqueda.horas) {
    const carga = entrada.cargas.find(item => item.id === busqueda.cargaBloqueadaId);
    const grupo = carga && grupos.get(carga.grupoId);
    incidencias.push(busqueda.agotada
      ? { codigo: 'BUSQUEDA_AGOTADA', mensaje: 'Se agotó el límite de búsqueda de horas sin encontrar una distribución. Ajusta el borrador o reduce los grupos; no se ha demostrado que sea imposible.' }
      : { codigo: 'SIN_ESPACIO', grupoId: grupo?.id, docenteId: carga?.docenteId || undefined, cargaId: carga?.id,
        mensaje: `Se comprobaron las distribuciones posibles sin poder ubicar ${carga?.asignatura || 'todas las materias'}${grupo ? ` en ${grupo.codigo}` : ''} con las restricciones actuales.` });
    return { sesiones: [], incidencias, huecosGrupo: {}, huecosDocente: {},
      evaluaciones: busqueda.evaluaciones, busquedaAgotada: busqueda.agotada };
  }
  return { ...evaluarHoras(entrada, busqueda.horas), evaluaciones: busqueda.evaluaciones, busquedaAgotada: false };
}

/** Resume una distribución completa sin volver a buscar espacios. */
export function evaluarHoras(entrada: EntradaHorario, horas: SesionHorario[]): ResultadoHorario {
  const incidencias: IncidenciaHorario[] = [];
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const docentes = new Map(docentesConVacantes(entrada).map(docente => [docente.id, docente]));
  const externas = entrada.ocupacionesExternas || [];

  const sesiones: SesionHorario[] = [];
  const maxPorCarga = new Map(entrada.cargas.map(c => [c.id, c.maxBloque || 4]));
  for (const hora of horas.sort((a, b) => a.dia - b.dia || a.inicio - b.inicio || a.cargaId.localeCompare(b.cargaId))) {
    const anterior = sesiones.find(s => s.cargaId === hora.cargaId && s.dia === hora.dia && s.fin === hora.inicio && s.fin - s.inicio < (maxPorCarga.get(hora.cargaId) || 4));
    if (anterior) anterior.fin = hora.fin;
    else sesiones.push({ ...hora });
  }
  const huecosGrupo = huecos(sesiones, 'grupoId', grupos);
  const huecosDocente = huecos([...externas, ...sesiones], 'docenteId', grupos);
  incidencias.push(...validarContinuidadMaterias(sesiones, entrada));
  for (const [grupoId] of Object.entries(huecosGrupo)) {
    for (const dia of DIAS_HORARIO) {
      const cantidad = huecoDiario(sesiones, grupoId, dia, 'grupoId', grupos.get(grupoId)?.turno);
      const nombre = grupos.get(grupoId)?.codigo || grupoId;
      if (cantidad > entrada.configuracion.maxHuecoGrupo) incidencias.push({ codigo: 'HUECO_GRUPO', grupoId, mensaje: `El grupo ${nombre} tiene ${cantidad} hora(s) libres el ${NOMBRES_DIAS[dia]}; preferencia máxima: ${entrada.configuracion.maxHuecoGrupo}.` });
      const clases = horasDiarias(sesiones, grupoId, dia, 'grupoId');
      const minimo = entrada.configuracion.minHorasGrupo ?? 2;
      if (clases > 0 && clases < minimo) incidencias.push({ codigo: 'JORNADA_CORTA_GRUPO', grupoId,
        mensaje: `El grupo ${nombre} tiene solo ${clases} hora(s) de clase el ${NOMBRES_DIAS[dia]}; preferencia mínima: ${minimo}.` });
    }
  }
  for (const docenteId of new Set(sesiones.map(sesion => sesion.docenteId))) {
    if (esVacante(docenteId)) continue;
    for (const dia of DIAS_HORARIO) {
      if (!horasDiarias(sesiones, docenteId, dia, 'docenteId')) continue;
      const cantidad = huecoDiario([...externas, ...sesiones], docenteId, dia, 'docenteId');
      const nombre = docentes.get(docenteId)?.nombre || docenteId;
      if (cantidad > entrada.configuracion.maxHuecoDocente) incidencias.push({ codigo: 'HUECO_DOCENTE', docenteId, mensaje: `El docente ${nombre} tiene ${cantidad} hora(s) libres el ${NOMBRES_DIAS[dia]}; preferencia máxima: ${entrada.configuracion.maxHuecoDocente}.` });
      const clases = horasDiarias([...externas, ...sesiones], docenteId, dia, 'docenteId');
      const minimo = entrada.configuracion.minHorasDocente ?? 2;
      if (clases > 0 && clases < minimo) incidencias.push({ codigo: 'JORNADA_CORTA_DOCENTE', docenteId,
        mensaje: `El docente ${nombre} tiene solo ${clases} hora(s) de clase el ${NOMBRES_DIAS[dia]}; preferencia mínima: ${minimo}.` });
    }
  }
  for (const carga of entrada.cargas.filter(carga => esVacante(carga.docenteId))) {
    const grupo = grupos.get(carga.grupoId);
    incidencias.push({ codigo: 'VACANTE', grupoId: carga.grupoId, cargaId: carga.id,
      mensaje: `${carga.asignatura} en ${grupo?.codigo || 'el grupo'} tiene horario reservado para una vacante. Asigna un docente activo antes de publicar.` });
  }
  return { sesiones, incidencias, huecosGrupo, huecosDocente };
}

export function validarSesiones(sesiones: SesionHorario[], entrada: EntradaHorario): IncidenciaHorario[] {
  const errores = validarEntradas(entrada);
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const docentes = new Map(docentesConVacantes(entrada).map(docente => [docente.id, docente]));
  const cargas = new Map(entrada.cargas.map(carga => [carga.id, carga]));
  for (const sesion of sesiones) {
    const grupo = grupos.get(sesion.grupoId);
    const docente = docentes.get(sesion.docenteId);
    const carga = cargas.get(sesion.cargaId);
    const turno = grupo && VENTANAS_TURNO[grupo.turno].find(v => v.dia === sesion.dia && v.inicio <= sesion.inicio && v.fin >= sesion.fin);
    if (!grupo || !docente || !carga || carga.grupoId !== grupo.id || carga.asignaturaId !== sesion.asignaturaId || carga.docenteId !== docente.id
      || !turno || sesion.fin - sesion.inicio < 1 || sesion.fin - sesion.inicio > (carga.maxBloque || 4) || !Number.isInteger(sesion.inicio) || !Number.isInteger(sesion.fin)
      || !docente.disponibilidad.some(v => v.dia === sesion.dia && v.inicio <= sesion.inicio && v.fin >= sesion.fin)) {
      errores.push({ codigo: 'SESION_INVALIDA', grupoId: sesion.grupoId, cargaId: sesion.cargaId, mensaje: 'Hay una sesión fuera de turno, disponibilidad o asignación.' });
    }
  }
  const todas = [...(entrada.ocupacionesExternas || []), ...sesiones];
  for (let i = 0; i < todas.length; i++) for (let j = i + 1; j < todas.length; j++) {
    if (i < (entrada.ocupacionesExternas?.length || 0) && j < (entrada.ocupacionesExternas?.length || 0)) continue;
    const a = todas[i]; const b = todas[j];
    if (a.dia !== b.dia || a.fin <= b.inicio || b.fin <= a.inicio) continue;
    if (a.grupoId === b.grupoId || a.docenteId === b.docenteId || mismasAulas(a, b)) {
      errores.push({ codigo: 'CHOQUE', grupoId: b.grupoId, docenteId: b.docenteId, mensaje: 'Dos sesiones se empalman para un grupo, docente o aula.' });
    }
  }
  for (const carga of entrada.cargas) {
    const total = sesiones.filter(s => s.cargaId === carga.id).reduce((n, s) => n + s.fin - s.inicio, 0);
    if (total !== carga.horasPresenciales) errores.push({ codigo: 'HORAS_INCOMPLETAS', grupoId: carga.grupoId, cargaId: carga.id, mensaje: `${carga.asignatura} tiene ${total} de ${carga.horasPresenciales} horas presenciales.` });
  }
  errores.push(...validarContinuidadMaterias(sesiones, entrada));
  return errores;
}
