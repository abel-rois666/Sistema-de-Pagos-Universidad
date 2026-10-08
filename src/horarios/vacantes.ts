import { VENTANAS_TURNO, type CargaHorario, type DocenteHorario, type EntradaHorario, type GrupoHorario, type SesionHorario } from './types';

const PREFIJO_VACANTE = 'vacante:';

/** Identificador local del borrador; nunca se envía como UUID a la base. */
export const idVacante = (cargaId: string) => `${PREFIJO_VACANTE}${cargaId}`;
export const esVacante = (docenteId: string | null | undefined) => Boolean(docenteId?.startsWith(PREFIJO_VACANTE));

const normalizar = (valor: string) => valor.trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export const claveLicenciaturaVacante = (grupo: GrupoHorario) => grupo.carreraNombre?.trim()
  ? `carrera:${normalizar(grupo.carreraNombre)}` : `plan:${grupo.planId}`;
export const idVacanteLicenciatura = (grupo: GrupoHorario, numero: number) =>
  `${PREFIJO_VACANTE}lic:${encodeURIComponent(claveLicenciaturaVacante(grupo))}:${numero}`;
export const numeroVacante = (id: string) => Number(id.startsWith('vacante:lic:')
  ? id.match(/:(\d+)$/)?.[1] || 0 : 0);

export function vacantesDeLicenciatura(entrada: EntradaHorario, grupo: GrupoHorario): string[] {
  const grupos = new Map(entrada.grupos.map(item => [item.id, item]));
  return [...new Set(entrada.cargas.filter(carga => esVacante(carga.docenteId)
    && grupos.get(carga.grupoId)
    && claveLicenciaturaVacante(grupos.get(carga.grupoId)!) === claveLicenciaturaVacante(grupo))
    .map(carga => carga.docenteId!))].sort((a, b) => numeroVacante(a) - numeroVacante(b) || a.localeCompare(b));
}

export function siguienteVacante(entrada: EntradaHorario, grupo: GrupoHorario): string {
  const usadas = new Set(vacantesDeLicenciatura(entrada, grupo));
  let numero = 1;
  while (usadas.has(idVacanteLicenciatura(grupo, numero))) numero++;
  return idVacanteLicenciatura(grupo, numero);
}

export function etiquetaVacante(id: string, grupo?: GrupoHorario): string {
  const numero = numeroVacante(id);
  return numero ? `Vacante ${numero} · ${grupo?.carreraNombre || 'licenciatura sin dato'}`
    : `Vacante de ${grupo?.carreraNombre || 'licenciatura sin dato'}`;
}

export function docenteVacante(carga: CargaHorario, entrada: EntradaHorario, id = idVacante(carga.id)): DocenteHorario | null {
  const grupo = entrada.grupos.find(item => item.id === carga.grupoId);
  if (!grupo) return null;
  return {
    id, nombre: etiquetaVacante(id, grupo), activo: true,
    disponibilidad: Object.values(VENTANAS_TURNO).flat(), planes: [grupo.planId],
    asignaturasPreferidas: [carga.asignaturaId], gruposRestringidos: [],
  };
}

export function docentesConVacantes(entrada: EntradaHorario): DocenteHorario[] {
  const vacantes = new Map<string, DocenteHorario>();
  for (const carga of entrada.cargas.filter(item => esVacante(item.docenteId))) {
    const docente = docenteVacante(carga, entrada, carga.docenteId!);
    if (!docente) continue;
    const anterior = vacantes.get(docente.id);
    if (!anterior) vacantes.set(docente.id, docente);
    else {
      anterior.planes = [...new Set([...anterior.planes, ...docente.planes])];
      anterior.asignaturasPreferidas = [...new Set([...anterior.asignaturasPreferidas, carga.asignaturaId])];
    }
  }
  return [...entrada.docentes, ...vacantes.values()];
}

/** Agrupa las vacantes automáticas sin mover sesiones ni mezclar licenciaturas. */
export function agruparVacantes(entrada: EntradaHorario, sesiones: SesionHorario[]) {
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const cargas = [...entrada.cargas].sort((a, b) => a.id.localeCompare(b.id));
  const ubicadas = new Map<string, SesionHorario[]>();
  const materiasPorVacante = new Map<string, CargaHorario[]>();
  const asignaciones = new Map<string, string>();
  // Las vacantes elegidas por el usuario conservan su identidad y ocupan primero su horario.
  for (const carga of cargas) {
    if (!carga.docenteId?.startsWith('vacante:lic:')) continue;
    const id = carga.docenteId;
    ubicadas.set(id, [...(ubicadas.get(id) || []), ...sesiones.filter(s => s.cargaId === carga.id)]);
    materiasPorVacante.set(id, [...(materiasPorVacante.get(id) || []), carga]);
  }
  for (const carga of cargas) {
    if (!esVacante(carga.docenteId)) continue;
    if (carga.docenteId?.startsWith('vacante:lic:')) continue;
    const grupo = grupos.get(carga.grupoId);
    if (!grupo) continue;
    const propias = sesiones.filter(s => s.cargaId === carga.id);
    let numero = 1;
    for (;; numero++) {
      const id = idVacanteLicenciatura(grupo, numero);
      const otras = ubicadas.get(id) || [];
      const empalme = propias.some(s => otras.some(o => s.dia === o.dia && s.inicio < o.fin && o.inicio < s.fin));
      const materiasGrupo = new Set((materiasPorVacante.get(id) || [])
        .filter(item => item.grupoId === grupo.id).map(item => item.asignaturaId));
      if (empalme || (materiasGrupo.size >= 3 && !materiasGrupo.has(carga.asignaturaId))) continue;
      asignaciones.set(carga.id, id); ubicadas.set(id, [...otras, ...propias]);
      materiasPorVacante.set(id, [...(materiasPorVacante.get(id) || []), carga]); break;
    }
  }
  return {
    entrada: { ...entrada, cargas: entrada.cargas.map(c => ({ ...c,
      docenteId: asignaciones.get(c.id) || c.docenteId })) },
    sesiones: sesiones.map(s => ({ ...s, docenteId: asignaciones.get(s.cargaId) || s.docenteId })),
  };
}
