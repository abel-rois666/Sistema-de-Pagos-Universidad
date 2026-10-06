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

/** Distingue ciclos que comparten nombre pero tienen distinta periodicidad. */
export const formatCicloEscolar = (ciclo: { nombre?: string | null; tipo_periodo?: string | null }): string =>
  `${ciclo.nombre?.trim() || 'Ciclo sin nombre'} · ${ciclo.tipo_periodo?.trim() || 'Tipo sin definir'}`;

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

/**
 * Normaliza cualquier formato de fecha (ISO con/sin hora, DD/MM/YYYY, YYYY/MM/DD) a formato input 'YYYY-MM-DD'.
 */
export const normalizeDateToInput = (val?: string | null): string => {
  if (!val) return '';
  const clean = String(val).trim();
  if (clean.includes('T')) return clean.split('T')[0];
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        // DD/MM/YYYY -> YYYY-MM-DD
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) {
        // YYYY/MM/DD -> YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  return clean;
};
