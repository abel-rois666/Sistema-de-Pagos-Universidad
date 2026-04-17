import { PaymentPlan } from './types';

export const isPaid = (estatus: string | undefined | null) => {
  if (!estatus || estatus.trim() === '') return false;
  const lower = estatus.toLowerCase();
  if (lower.includes('baja') || lower.includes('pendiente')) return false;
  // Si tiene "Resta $X" significa que hay un abono parcial aún pendiente → no se considera pagado
  if (lower.includes('resta $') || lower.includes('resta$')) return false;
  return true;
};

/**
 * Extrae el saldo pendiente real desde el campo estatus de un concepto del plan.
 * Soporta formatos como: "R-101; R-102 (Abono $500.00, Resta $499.00)"
 * - Si contiene "Resta $X" → devuelve X (el saldo pendiente real)
 * - Si contiene "Pagado"   → devuelve 0 (liquidado)
 * - Si no tiene ninguno    → devuelve cantidadOriginal (primer pago o sin abono)
 */
export const getRestanteFromEstatus = (
  estatus: string | undefined | null,
  cantidadOriginal: number
): number => {
  if (!estatus) return cantidadOriginal;
  const lower = estatus.toLowerCase();
  if (lower.includes('pagado')) return 0;
  const m = estatus.match(/Resta\s*\$([0-9,]+(?:\.\d{2})?)/);
  if (m) return parseFloat(m[1].replace(',', ''));
  return cantidadOriginal; // sin abono previo → debe el total
};

export const calculateStudentTotals = (plan: PaymentPlan, studentEstatus?: string) => {
  let paid = 0;
  let owed = 0;
  const isBaja = studentEstatus === 'BAJA';

  const check = (cantidad: number | undefined, estatus: string | undefined) => {
    if (!cantidad) return;
    if (isPaid(estatus)) {
      paid += Number(cantidad);
    } else {
      if (!isBaja) {
        // Para abonos parciales: contar lo ya pagado en "paid" y solo el restante en "owed"
        const restante = getRestanteFromEstatus(estatus, Number(cantidad));
        const abonado = Number(cantidad) - restante;
        if (abonado > 0) paid += abonado;
        owed += restante;
      }
    }
  };

  for (let i = 1; i <= 9; i++) {
    const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
    const estatus = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
    check(cantidad, estatus);
  }

  return { paid, owed };
};

export const extractMonth = (dateStr: string) => {
  if (!dateStr) return 'DESCONOCIDO';
  const upper = dateStr.toUpperCase();
  
  let yearStr = '';
  // match YYYY-MM-DD
  const yyyyMatch = dateStr.match(/^(\d{4})-\d{2}-\d{2}/);
  // match DD/MM/YYYY
  const ddmmMatch = dateStr.match(/^\d{2}\/\d{2}\/(\d{4})/);
  if (yyyyMatch) yearStr = ` ${yyyyMatch[1]}`;
  else if (ddmmMatch) yearStr = ` ${ddmmMatch[1]}`;
  // if format is "ENERO 2024" or something else, it might already have the year, but we'll stick to extracting from standard dates.

  let baseMonth = 'OTROS';
  if (upper.includes('ENERO') || upper.includes('/01/') || upper.includes('-01-')) baseMonth = 'ENERO';
  else if (upper.includes('FEBRERO') || upper.includes('/02/') || upper.includes('-02-')) baseMonth = 'FEBRERO';
  else if (upper.includes('MARZO') || upper.includes('/03/') || upper.includes('-03-')) baseMonth = 'MARZO';
  else if (upper.includes('ABRIL') || upper.includes('/04/') || upper.includes('-04-')) baseMonth = 'ABRIL';
  else if (upper.includes('MAYO') || upper.includes('/05/') || upper.includes('-05-')) baseMonth = 'MAYO';
  else if (upper.includes('JUNIO') || upper.includes('/06/') || upper.includes('-06-')) baseMonth = 'JUNIO';
  else if (upper.includes('JULIO') || upper.includes('/07/') || upper.includes('-07-')) baseMonth = 'JULIO';
  else if (upper.includes('AGOSTO') || upper.includes('/08/') || upper.includes('-08-')) baseMonth = 'AGOSTO';
  else if (upper.includes('SEPTIEMBRE') || upper.includes('/09/') || upper.includes('-09-')) baseMonth = 'SEPTIEMBRE';
  else if (upper.includes('OCTUBRE') || upper.includes('/10/') || upper.includes('-10-')) baseMonth = 'OCTUBRE';
  else if (upper.includes('NOVIEMBRE') || upper.includes('/11/') || upper.includes('-11-')) baseMonth = 'NOVIEMBRE';
  else if (upper.includes('DICIEMBRE') || upper.includes('/12/') || upper.includes('-12-')) baseMonth = 'DICIEMBRE';
  
  if (baseMonth === 'OTROS' || baseMonth === 'DESCONOCIDO') return baseMonth;
  return `${baseMonth}${yearStr}`;
};

/** Formatea una fecha a DD/MM/YYYY para mostrar en pantalla */
export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [y, m, d] = dateString.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateString;
};

/** Convierte una fecha a formato YYYY-MM-DD para inputs tipo date */
export const toInputDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const [d, m, y] = dateString.split('/');
    return `${y}-${m}-${d}`;
  }
};

/** Genera un prefijo corto basado en el nombre del ciclo, ej "2026-1" -> "261" */
export const getCyclePrefix = (cicloNombre: string): string => {
  if (!cicloNombre) return 'PP';
  const nums = cicloNombre.replace(/[^0-9]/g, '');
  if (nums.length >= 5) {
    return nums.substring(2, 4) + nums.substring(4, 5);
  } else if (nums.length === 4) {
    return nums.substring(2, 4);
  } else {
    return cicloNombre.replace(/[^0-9A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'PP';
  }
};

/** Encuentra el contador máximo global de todos los planes evitando los folios autogenerados con UUID previos */
export const getMaxFolioCounter = (allPlans: import('./types').PaymentPlan[]): number => {
  let max = 0;
  for (const p of allPlans) {
    if (!p.no_plan_pagos) continue;
    const parts = p.no_plan_pagos.split('-');
    if (parts.length > 1) {
      if (parts[0] === 'PP') {
         if (/^\d+$/.test(parts[1])) {
             const num = parseInt(parts[1], 10);
             if (num > max) max = num;
         }
         continue; 
      }
      // Formato: 262-454 o 262-454-ESP -> El folio siempre es parts[1]
      const maybeFolio = parts[1];
      if (/^\d+$/.test(maybeFolio)) {
        const num = parseInt(maybeFolio, 10);
        if (!isNaN(num) && num > max) { max = num; }
      }
    }
  }
  return max;
};

export const CSV_HEADERS = [
  'NOMBRE_ALUMNO', 'NO_PLAN_PAGOS', 'LICENCIATURA', 'GRADO', 'TURNO', 'ESTATUS_ALUMNO',
  'CICLO_ESCOLAR', 'FECHA_PLAN', 'TIPO_PLAN', 'BECA_TIPO', 'BECA_PORCENTAJE',
  'SALDO_A_FAVOR', 'OBSERVACIONES_PAGO_TITULACION',
  ...Array.from({ length: 9 }, (_, i) => [
    `CONCEPTO_${i + 1}`, `FECHA_${i + 1}`, `CANTIDAD_${i + 1}`, `ESTATUS_${i + 1}`
  ]).flat()
];

export function generateCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string | number | undefined | null) => {
    if (v == null) return '';
    const str = String(v);
    return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
}

export function downloadCSV(content: string, filename: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const CSV_HEADERS_RECIBOS = [
  'NOMBRE DEL ALUMNO', 'Nº RECIBO', 'FECHA EMISIÓN DE RECIBO', 'TOTAL FINAL', 'FECHA DE PAGO', 'ESTATUS',
  'REQUIERE FACTURA', 'ESTATUS FACTURA', 'FOLIO FISCAL',
  'CANTIDAD 1', 'CONCEPTO 1', 'COSTO UNITARIO1', 'COSTO TOTAL1', 'FORMA DE PAGO1', 'BANCO1',
  'CANTIDAD 2', 'CONCEPTO 2', 'COSTO UNITARIO 2', 'COSTO TOTAL 2', 'FORMA DE PAGO 2', 'BANCO2',
  'CANTIDAD 3', 'CONCEPTO 3', 'COSTO UNITARIO 3', 'COSTO TOTAL 3', 'FORMA DE PAGO 3', 'BANCO3',
  'CANTIDAD 4', 'CONCEPTO 4', 'COSTO UNITARIO 4', 'COSTO TOTAL 4', 'FORMA DE PAGO 4', 'BANCO4',
  'CANTIDAD 5', 'CONCEPTO 5', 'COSTO UNITARIO 5', 'COSTO TOTAL 5', 'FORMA DE PAGO 5', 'BANCO5'
];


/** Capitaliza nombres y oraciones respetando conectores en español */
export const toTitleCase = (str: string | undefined | null): string => {
  if (!str) return '';
  const lowercaseWords = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'por', 'a', 'con']);
  return str.toLowerCase().split(' ').map((word, index) => {
    if (word.length === 0) return '';
    if (index > 0 && lowercaseWords.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

