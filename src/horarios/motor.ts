import {
  type CargaHorario, type DiaHorario, type DocenteHorario, type EntradaHorario,
  type GrupoHorario, type IncidenciaHorario, type ResultadoHorario, type SesionHorario,
  VENTANAS_TURNO,
} from './types';

const clave = (dia: DiaHorario, hora: number) => `${dia}-${hora}`;
const mismasAulas = (a: SesionHorario, b: SesionHorario) =>
  Boolean(a.aula?.trim() && b.aula?.trim()
    && a.aula.trim().toLocaleLowerCase('es') === b.aula.trim().toLocaleLowerCase('es')
    && (a.sede || '').trim().toLocaleLowerCase('es') === (b.sede || '').trim().toLocaleLowerCase('es'));

export function docentesElegibles(
  carga: CargaHorario, grupo: GrupoHorario, docentes: DocenteHorario[], ocupaciones: SesionHorario[] = [],
): DocenteHorario[] {
  return docentes.filter(docente => docente.activo
    && docente.planes.includes(grupo.planId)
    && !docente.gruposRestringidos.includes(grupo.id)
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
  if (![entrada.configuracion.maxHuecoGrupo, entrada.configuracion.maxHuecoDocente]
    .every(valor => Number.isInteger(valor) && valor >= 0 && valor <= 8)) {
    errores.push({ codigo: 'HUECO_INVALIDO', mensaje: 'La preferencia de huecos debe ser un entero entre 0 y 8 horas por día.' });
  }
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const docentes = new Map(entrada.docentes.map(docente => [docente.id, docente]));
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
      error('DOCENTE_NO_ELEGIBLE', `El docente asignado a ${carga.asignatura} no está habilitado o disponible para ${grupo.codigo}.`);
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
  for (const grupo of entrada.grupos) {
    if (!gruposConCarga.has(grupo.id)) errores.push({ codigo: 'SIN_ASIGNATURAS', grupoId: grupo.id, mensaje: `Asigna al menos una materia a ${grupo.codigo} antes de generar su horario.` });
  }
  for (const [claveDocenteGrupo, materias] of materiasPorDocenteGrupo) {
    if (materias.size > 3) errores.push({ codigo: 'MAX_TRES_MATERIAS', grupoId: claveDocenteGrupo.split(':')[0], docenteId: claveDocenteGrupo.split(':')[1], mensaje: 'Un docente no puede impartir más de tres asignaturas distintas al mismo grupo.' });
  }
  return errores;
}

function huecos(sesiones: SesionHorario[], atributo: 'grupoId' | 'docenteId'): Record<string, number> {
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
    resultado[id] = [...dias.values()].reduce((total, horas) => {
      const lista = [...horas].sort((a, b) => a - b);
      return total + (lista.length ? lista.at(-1)! - lista[0] + 1 - lista.length : 0);
    }, 0);
  }
  return resultado;
}

function huecoDiario(sesiones: SesionHorario[], id: string, dia: DiaHorario, atributo: 'grupoId' | 'docenteId'): number {
  const horas = new Set<number>();
  for (const sesion of sesiones) if (sesion[atributo] === id && sesion.dia === dia) {
    for (let hora = sesion.inicio; hora < sesion.fin; hora++) horas.add(hora);
  }
  const lista = [...horas].sort((a, b) => a - b);
  return lista.length ? lista.at(-1)! - lista[0] + 1 - lista.length : 0;
}

export function generarHorario(entrada: EntradaHorario): ResultadoHorario {
  const incidencias = validarEntradas(entrada);
  if (incidencias.length) return { sesiones: [], incidencias, huecosGrupo: {}, huecosDocente: {} };
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const docentes = new Map(entrada.docentes.map(docente => [docente.id, docente]));
  const externas = entrada.ocupacionesExternas || [];
  const horas: SesionHorario[] = [];
  const cargas = [...entrada.cargas].sort((a, b) => {
    const da = docentes.get(a.docenteId!)!;
    const db = docentes.get(b.docenteId!)!;
    const disponibilidadA = da.disponibilidad.reduce((n, v) => n + v.fin - v.inicio, 0);
    const disponibilidadB = db.disponibilidad.reduce((n, v) => n + v.fin - v.inicio, 0);
    return disponibilidadA - disponibilidadB || b.horasPresenciales! - a.horasPresenciales! || a.id.localeCompare(b.id);
  });

  for (const carga of cargas) {
    const grupo = grupos.get(carga.grupoId)!;
    const docente = docentes.get(carga.docenteId!)!;
    for (let unidad = 0; unidad < carga.horasPresenciales!; unidad++) {
      const candidatos: { sesion: SesionHorario; puntaje: number }[] = [];
      for (const ventana of VENTANAS_TURNO[grupo.turno]) {
        for (let hora = ventana.inicio; hora < ventana.fin; hora++) {
          if (!docente.disponibilidad.some(d => d.dia === ventana.dia && d.inicio <= hora && d.fin > hora)) continue;
          const sesion: SesionHorario = { cargaId: carga.id, grupoId: grupo.id, asignaturaId: carga.asignaturaId, docenteId: docente.id, dia: ventana.dia, inicio: hora, fin: hora + 1, aula: grupo.aula, sede: grupo.sede };
          const conflicto = [...externas, ...horas].some(otra => otra.dia === ventana.dia && otra.inicio <= hora && otra.fin > hora
            && (otra.grupoId === grupo.id || otra.docenteId === docente.id || mismasAulas(otra, sesion)));
          if (conflicto) continue;
          const ocupadas = new Set(horas.filter(s => s.cargaId === carga.id && s.dia === ventana.dia).map(s => s.inicio));
          const temporal = [...horas, sesion];
          const huecoGrupo = huecoDiario(temporal, grupo.id, ventana.dia, 'grupoId');
          const huecoDocente = huecoDiario([...externas, ...temporal], docente.id, ventana.dia, 'docenteId');
          const limiteGrupo = entrada.configuracion.maxHuecoGrupo;
          const limiteDocente = entrada.configuracion.maxHuecoDocente;
          // El grupo tiene prioridad; completar bloques contiguos desempata frente a fragmentarlos.
          const puntaje = Math.max(0, huecoGrupo - limiteGrupo) * 100
            + Math.max(0, huecoDocente - limiteDocente) * 10
            + huecoGrupo * 4 + huecoDocente
            - (ocupadas.has(hora - 1) || ocupadas.has(hora + 1) ? 3 : 0)
            + ventana.dia / 100 + hora / 1000;
          candidatos.push({ sesion, puntaje });
        }
      }
      candidatos.sort((a, b) => a.puntaje - b.puntaje);
      if (!candidatos.length) {
        incidencias.push({ codigo: 'SIN_ESPACIO', grupoId: grupo.id, docenteId: docente.id, cargaId: carga.id, mensaje: `No se pudieron ubicar todas las horas de ${carga.asignatura} en ${grupo.codigo}; revisa disponibilidad y ocupaciones.` });
        break;
      }
      horas.push(candidatos[0].sesion);
    }
  }
  if (incidencias.length) return { sesiones: [], incidencias, huecosGrupo: {}, huecosDocente: {} };

  const sesiones: SesionHorario[] = [];
  const maxPorCarga = new Map(entrada.cargas.map(c => [c.id, c.maxBloque || 4]));
  for (const hora of horas.sort((a, b) => a.dia - b.dia || a.inicio - b.inicio || a.cargaId.localeCompare(b.cargaId))) {
    const anterior = sesiones.find(s => s.cargaId === hora.cargaId && s.dia === hora.dia && s.fin === hora.inicio && s.fin - s.inicio < (maxPorCarga.get(hora.cargaId) || 4));
    if (anterior) anterior.fin = hora.fin;
    else sesiones.push({ ...hora });
  }
  const huecosGrupo = huecos(sesiones, 'grupoId');
  const huecosDocente = huecos([...externas, ...sesiones], 'docenteId');
  for (const [grupoId] of Object.entries(huecosGrupo)) {
    for (const dia of [1, 2, 3, 4, 5, 6] as DiaHorario[]) {
      const cantidad = huecoDiario(sesiones, grupoId, dia, 'grupoId');
      if (cantidad > entrada.configuracion.maxHuecoGrupo) incidencias.push({ codigo: 'HUECO_GRUPO', grupoId, mensaje: `El grupo supera la preferencia de ${entrada.configuracion.maxHuecoGrupo} hora(s) libres el día ${dia}: tiene ${cantidad}.` });
    }
  }
  for (const [docenteId] of Object.entries(huecosDocente)) {
    for (const dia of [1, 2, 3, 4, 5, 6] as DiaHorario[]) {
      const cantidad = huecoDiario([...externas, ...sesiones], docenteId, dia, 'docenteId');
      if (cantidad > entrada.configuracion.maxHuecoDocente) incidencias.push({ codigo: 'HUECO_DOCENTE', docenteId, mensaje: `El docente supera la preferencia de ${entrada.configuracion.maxHuecoDocente} hora(s) libres el día ${dia}: tiene ${cantidad}.` });
    }
  }
  return { sesiones, incidencias, huecosGrupo, huecosDocente };
}

export function validarSesiones(sesiones: SesionHorario[], entrada: EntradaHorario): IncidenciaHorario[] {
  const errores = validarEntradas(entrada);
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const docentes = new Map(entrada.docentes.map(docente => [docente.id, docente]));
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
  return errores;
}
