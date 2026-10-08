import type { EntradaHorario } from './types';

/** Aplica el mismo tiempo presencial a las materias Mixtas incluidas. */
export function aplicarHorasPresencialesMasivas(
  entrada: EntradaHorario, horas: number, gruposIncluidos: ReadonlySet<string>, cargasIncluidas: ReadonlySet<string>,
): { entrada: EntradaHorario; cantidad: number } {
  if (!Number.isInteger(horas) || horas < 0 || horas > 8) {
    throw new Error('Elige un número entero de 0 a 8 horas presenciales.');
  }
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo]));
  const objetivo = entrada.cargas.filter(carga => gruposIncluidos.has(carga.grupoId)
    && cargasIncluidas.has(carga.id) && grupos.get(carga.grupoId)?.turno === 'MIXTO');
  if (!objetivo.length) throw new Error('No hay materias Mixtas incluidas para aplicar el reparto.');
  for (const carga of objetivo) {
    if (!Number.isInteger(carga.horasTotales) || (carga.horasTotales || 0) <= 0) {
      throw new Error(`Define primero las horas semanales de ${carga.asignatura}.`);
    }
    if (horas > carga.horasTotales!) {
      throw new Error(`${carga.asignatura} tiene ${carga.horasTotales} horas semanales; no puede recibir ${horas} presenciales.`);
    }
  }
  const cantidadPorGrupo = new Map<string, number>();
  for (const carga of objetivo) cantidadPorGrupo.set(carga.grupoId, (cantidadPorGrupo.get(carga.grupoId) || 0) + 1);
  for (const [grupoId, cantidad] of cantidadPorGrupo) {
    if (horas * cantidad > 8) {
      throw new Error(`${grupos.get(grupoId)?.codigo || 'El grupo'} tendría ${horas * cantidad} horas presenciales; el sábado admite 8. Reduce las horas o usa el modo individual.`);
    }
  }
  const ids = new Set(objetivo.map(carga => carga.id));
  return { cantidad: objetivo.length, entrada: { ...entrada, cargas: entrada.cargas.map(carga => ids.has(carga.id)
    ? { ...carga, horasPresenciales: horas, horasAsincronas: carga.horasTotales! - horas } : carga) } };
}
