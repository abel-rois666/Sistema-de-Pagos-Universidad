import type { IncidenciaHorario } from './types';

/** Permite reparar un borrador antiguo sin introducir más conflictos que los que ya tenía. */
export function conflictosNuevos(anteriores: IncidenciaHorario[], siguientes: IncidenciaHorario[]): IncidenciaHorario[] {
  const clave = (incidencia: IncidenciaHorario) => JSON.stringify([
    incidencia.codigo, incidencia.grupoId || '', incidencia.cargaId || '', incidencia.docenteId || '',
  ]);
  const cantidades = new Map<string, number>();
  anteriores.forEach(incidencia => {
    const id = clave(incidencia);
    cantidades.set(id, (cantidades.get(id) || 0) + 1);
  });
  return siguientes.filter(incidencia => {
    const id = clave(incidencia);
    const restantes = cantidades.get(id) || 0;
    if (restantes) { cantidades.set(id, restantes - 1); return false; }
    return true;
  });
}
