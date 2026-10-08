import type { CargaHorario, EntradaHorario } from './types';

export function esMateriaComplementaria(carga: CargaHorario): boolean {
  const clave = carga.clasificacionClave?.trim();
  return clave ? clave === '266'
    : carga.clasificacionNombre?.trim().toLocaleLowerCase('es') === 'complementaria';
}

/** Selecciona grupos y materias para un borrador sin modificar la carga guardada. */
export function prepararBorradorHorario(
  entrada: EntradaHorario, gruposIncluidos: ReadonlySet<string>, cargasIncluidas: ReadonlySet<string>,
): EntradaHorario {
  return {
    ...entrada,
    grupos: entrada.grupos.filter(grupo => gruposIncluidos.has(grupo.id)),
    cargas: entrada.cargas.filter(carga => gruposIncluidos.has(carga.grupoId) && cargasIncluidas.has(carga.id)),
  };
}

export function seleccionCompletaHorario(
  entrada: EntradaHorario, gruposIncluidos: ReadonlySet<string>, cargasIncluidas: ReadonlySet<string>,
): boolean {
  return entrada.grupos.every(grupo => gruposIncluidos.has(grupo.id))
    && entrada.cargas.every(carga => esMateriaComplementaria(carga) || cargasIncluidas.has(carga.id));
}
