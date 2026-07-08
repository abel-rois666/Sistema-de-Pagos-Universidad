/**
 * Convierte un número o cadena numérica a su formato ordinal ("1" -> "1ER", "2" -> "2DO").
 * Mantiene textos especiales intactos (como "POR DEFINIR" o "EGRESADO").
 */
export const formatGrado = (grado: string | number | null | undefined): string => {
  if (!grado) return '';
  const strGrado = String(grado).trim().toUpperCase();
  
  switch (strGrado) {
    case '1': return '1ER';
    case '2': return '2DO';
    case '3': return '3ER';
    case '4': return '4TO';
    case '5': return '5TO';
    case '6': return '6TO';
    case '7': return '7MO';
    case '8': return '8VO';
    case '9': return '9NO';
    case '10': return '10MO';
    case '11': return '11VO';
    case '12': return '12VO';
    default:
      // Si ya viene con el sufijo u otras palabras, lo devolvemos tal cual
      return strGrado;
  }
};

/**
 * Convierte un formato ordinal ("1ER", "2DO") o numérico a su equivalente numérico puro en texto ("1", "2").
 * Útil para limpiar entradas de CSV.
 */
export const normalizeGrado = (grado: string | number | null | undefined): string => {
  if (!grado) return 'POR DEFINIR';
  const strGrado = String(grado).trim().toUpperCase();
  
  const numMatch = strGrado.match(/^(\d+)/);
  if (numMatch && numMatch[1]) {
    // Si tiene un número al principio, lo extraemos.
    return numMatch[1];
  }
  
  return strGrado;
};
