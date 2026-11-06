/** Una selección de página nunca incorpora filas ocultas ni borra otras páginas. */
export function cambiarSeleccionVisible<T>(seleccion: readonly T[], visibles: readonly T[], marcar: boolean): T[] {
  const ids = new Set(visibles);
  return marcar ? [...new Set([...seleccion, ...visibles])] : seleccion.filter(id => !ids.has(id));
}

export function estadoSeleccionVisible<T>(seleccion: readonly T[], visibles: readonly T[]) {
  const ids = new Set(seleccion);
  const cantidad = visibles.filter(id => ids.has(id)).length;
  return { completa: visibles.length > 0 && cantidad === visibles.length, parcial: cantidad > 0 && cantidad < visibles.length };
}
