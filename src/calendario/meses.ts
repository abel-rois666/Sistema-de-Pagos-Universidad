interface RangoEvento { fecha_inicio: string; fecha_fin: string }

/** Incluye los meses lectivos y los eventos posteriores o anteriores a las clases. */
export function mesesInvolucrados(inicio: string, fin: string, eventos: readonly RangoEvento[]): string[] {
  const fechas = [inicio, fin, ...eventos.flatMap(evento => [evento.fecha_inicio, evento.fecha_fin])]
    .filter(fecha => /^\d{4}-\d{2}-\d{2}$/.test(fecha));
  if (!fechas.length) return [];
  const primero = fechas.reduce((menor, fecha) => fecha < menor ? fecha : menor).slice(0, 7);
  const ultimo = fechas.reduce((mayor, fecha) => fecha > mayor ? fecha : mayor).slice(0, 7);
  const [anioInicial, mesInicial] = primero.split('-').map(Number);
  const [anioFinal, mesFinal] = ultimo.split('-').map(Number);
  const cantidad = (anioFinal - anioInicial) * 12 + mesFinal - mesInicial;
  if (cantidad < 0 || cantidad > 120) return [];
  return Array.from({ length: cantidad + 1 }, (_, indice) =>
    new Date(Date.UTC(anioInicial, mesInicial - 1 + indice, 1)).toISOString().slice(0, 7));
}
