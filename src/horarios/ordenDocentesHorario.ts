/** Comparte el orden alfabético entre vista, exportación y edición local. */
export function compararNombresDocentes(a: string, b: string): number {
  return a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'base', numeric: true });
}
