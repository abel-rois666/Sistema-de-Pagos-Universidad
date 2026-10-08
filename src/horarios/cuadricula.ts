import { DIAS_HORARIO, horaTexto, NOMBRES_DIAS, VENTANAS_TURNO,
  type CargaHorario, type DiaHorario, type EntradaHorario, type GrupoHorario, type SesionHorario } from './types';
import { claveLicenciaturaVacante, esVacante, etiquetaVacante } from './vacantes';
import { ordenarGruposHorario } from './ordenGruposHorario';

export type VistaHorario = { tipo: 'grupos' | 'docentes'; ids?: string[] };

export interface SeccionCuadriculaHorario {
  id: string;
  titulo: string;
  encabezado: string[];
  dias: DiaHorario[];
  horas: number[];
  filas: string[][];
  noDisponibles: boolean[][];
  totalesDiarios: number[];
  materias: string[][];
  asincronas: string[][];
}

const horasVentana = (inicio: number, fin: number): number[] =>
  Array.from({ length: fin - inicio }, (_, indice) => inicio + indice);

type OpcionVistaHorario = { id: string; nombre: string; clase: 'grupo' | 'docente' | 'vacantes'; cargaIds?: string[] };

/** Mantiene las mismas opciones e IDs para la vista, el selector y las exportaciones. */
export function opcionesVistaHorario(
  entrada: EntradaHorario, tipo: VistaHorario['tipo'], sesiones: SesionHorario[] = [],
): OpcionVistaHorario[] {
  if (tipo === 'grupos') return ordenarGruposHorario(entrada.grupos)
    .map(grupo => ({ id: grupo.id, nombre: grupo.codigo, clase: 'grupo' }));
  const docentes: OpcionVistaHorario[] = entrada.docentes
    .filter(docente => entrada.cargas.some(carga => carga.docenteId === docente.id))
    .map(docente => ({ id: docente.id, nombre: docente.nombre, clase: 'docente' }));
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const vacantes = new Map<string, { nombre: string; cargas: CargaHorario[] }>();
  for (const carga of entrada.cargas) {
    if (!esVacante(carga.docenteId)) continue;
    const grupo = grupos.get(carga.grupoId);
    if (!grupo) continue;
    const id = carga.docenteId!;
    const grupoReferencia = entrada.grupos.find(item => item.carreraNombre
      && claveLicenciaturaVacante(item) === claveLicenciaturaVacante(grupo)) || grupo;
    if (!vacantes.has(id)) vacantes.set(id, {
      nombre: etiquetaVacante(id, grupoReferencia),
      cargas: [],
    });
    vacantes.get(id)!.cargas.push(carga);
  }
  const seccionesVacantes: OpcionVistaHorario[] = [...vacantes].sort((a, b) =>
    a[1].nombre.localeCompare(b[1].nombre, 'es', { numeric: true })).map(([id, { nombre, cargas }]) => ({
      id, nombre, clase: 'vacantes', cargaIds: cargas.map(carga => carga.id),
    }));
  return [...docentes, ...seccionesVacantes];
}

/** Una misma cuadrícula alimenta la vista previa y las exportaciones. */
export function seccionesCuadriculaHorario(
  entrada: EntradaHorario, sesiones: SesionHorario[], cicloNombre: string, vista: VistaHorario,
): SeccionCuadriculaHorario[] {
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const docentes = new Map(entrada.docentes.map(docente => [docente.id, docente]));
  const cargas = new Map(entrada.cargas.map(carga => [carga.id, carga]));
  const ids = vista.ids ? new Set(vista.ids) : null;
  const entidades = opcionesVistaHorario(entrada, vista.tipo, sesiones);

  return entidades.filter(entidad => !ids || ids.has(entidad.id)).map(entidad => {
    const esGrupo = entidad.clase === 'grupo';
    const esSeccionVacantes = entidad.clase === 'vacantes';
    const grupo = esGrupo ? grupos.get(entidad.id) : undefined;
    const idsVacantes = new Set(entidad.cargaIds || []);
    const cargasEntidad = entrada.cargas.filter(carga => {
      if (esGrupo) return carga.grupoId === entidad.id;
      if (!esSeccionVacantes) return carga.docenteId === entidad.id;
      return idsVacantes.has(carga.id);
    });
    const idsCargas = new Set(cargasEntidad.map(carga => carga.id));
    const sesionesEntidad = sesiones.filter(sesion => esGrupo
      ? sesion.grupoId === entidad.id : esSeccionVacantes
        ? idsCargas.has(sesion.cargaId) : sesion.docenteId === entidad.id);
    const ventanas = esGrupo && grupo ? VENTANAS_TURNO[grupo.turno] : [];
    const dias = esGrupo ? [...new Set(ventanas.map(ventana => ventana.dia))].sort((a, b) => a - b)
      : [...DIAS_HORARIO];
    const horas = esGrupo
      ? [...new Set(ventanas.flatMap(ventana => horasVentana(ventana.inicio, ventana.fin)))].sort((a, b) => a - b)
      : horasVentana(7, 21);
    const docente = esGrupo ? undefined : docentes.get(entidad.id);
    const noDisponibles = horas.map(hora => dias.map(dia => {
      if (esGrupo || esSeccionVacantes || docente?.disponibilidadConocida === false) return false;
      if (sesionesEntidad.some(sesion => sesion.dia === dia && sesion.inicio <= hora && sesion.fin > hora)) return false;
      return !docente?.disponibilidad.some(ventana => ventana.dia === dia && ventana.inicio <= hora && ventana.fin > hora);
    }));
    const totalesDiarios = dias.map(dia => esSeccionVacantes
      ? sesionesEntidad.filter(sesion => sesion.dia === dia).reduce((total, sesion) => total + sesion.fin - sesion.inicio, 0)
      : horas.filter(hora => sesionesEntidad.some(sesion =>
        sesion.dia === dia && sesion.inicio <= hora && sesion.fin > hora)).length);
    const filas = horas.map(hora => [
      `${horaTexto(hora)} a ${horaTexto(hora + 1)}`,
      ...dias.map(dia => {
        const sesionesCelda = sesionesEntidad.filter(item => item.dia === dia && item.inicio <= hora && item.fin > hora);
        if (sesionesCelda.length) {
          return sesionesCelda.map(sesion => {
            const carga = cargas.get(sesion.cargaId);
            const materia = carga?.asignatura || 'Asignatura';
            return esGrupo ? `${materia}${esVacante(carga?.docenteId) ? '\nVACANTE' : ''}`
              : `${materia}\n${carga?.asignaturaClave || 'Sin clave'} · ${grupos.get(sesion.grupoId)?.codigo || 'Grupo'}`;
          }).join('\n\n');
        }
        if (!esGrupo) return '';
        const delDia = sesionesEntidad.filter(item => item.dia === dia);
        return delDia.length && hora > Math.min(...delDia.map(item => item.inicio))
          && hora < Math.max(...delDia.map(item => item.fin)) ? 'HORA LIBRE' : '';
      }),
    ]);
    const materias = cargasEntidad.sort((a, b) => a.asignatura.localeCompare(b.asignatura, 'es'))
      .map(carga => [carga.asignaturaClave || '—', String(carga.horasPresenciales ?? '—'), carga.asignatura,
        esGrupo ? (esVacante(carga.docenteId) ? 'VACANTE' : docentes.get(carga.docenteId || '')?.nombre || 'Sin docente')
          : grupos.get(carga.grupoId)?.codigo || 'Grupo']);
    const asincronas = cargasEntidad.filter(carga => (carga.horasAsincronas || 0) > 0)
      .map(carga => [carga.asignatura, `${carga.horasAsincronas} h/semana`,
        ...(esGrupo ? [] : [grupos.get(carga.grupoId)?.codigo || 'Grupo'])]);
    const encabezado = esGrupo ? [
      grupo?.carreraNombre || 'Horario de grupo',
      ...(grupo?.rvoe ? [`R.V.O.E. ${grupo.rvoe}`] : []),
      ...(grupo?.planNombre || grupo?.planClave ? [`Plan de estudios: ${grupo.planNombre || grupo.planClave}`] : []),
      `Grupo: ${entidad.nombre} · ${grupo?.turno || ''}${grupo?.grado ? ` · grado ${grupo.grado}` : ''}`,
      `Ciclo escolar ${cicloNombre}`,
      ...(cargasEntidad.some(carga => esVacante(carga.docenteId)) ? ['BORRADOR · VACANTE PENDIENTE DE DOCENTE'] : []),
    ] : esSeccionVacantes ? [
      entidad.nombre,
      `Ciclo escolar ${cicloNombre}`,
      'BORRADOR · VACANTES PENDIENTES DE DOCENTE',
    ] : [
      `Docente: ${entidad.nombre}`,
      `Licenciatura(s): ${[...new Set(cargasEntidad.map(carga => grupos.get(carga.grupoId)?.carreraNombre).filter(Boolean))].join(' · ') || 'Sin dato'}`,
      `Turno(s): ${[...new Set(cargasEntidad.map(carga => grupos.get(carga.grupoId)?.turno).filter(Boolean))].join(' · ') || 'Sin dato'}`,
      `Ciclo escolar ${cicloNombre}`,
    ];
    return { id: entidad.id, titulo: esGrupo ? `Grupo ${entidad.nombre}` : esSeccionVacantes ? entidad.nombre : `Docente ${entidad.nombre}`,
      encabezado, dias, horas, filas, noDisponibles, totalesDiarios, materias, asincronas };
  });
}

export const encabezadosDias = (dias: DiaHorario[]) => ['HORARIO', ...dias.map(dia => NOMBRES_DIAS[dia].toUpperCase())];
