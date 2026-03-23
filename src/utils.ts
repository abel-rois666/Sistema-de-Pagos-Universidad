import { PaymentPlan } from './types';

export const isPaid = (estatus: string | undefined | null) => {
  if (!estatus || estatus.trim() === '') return false;
  const lower = estatus.toLowerCase();
  if (lower.includes('baja') || lower.includes('pendiente')) return false;
  return true;
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
        owed += Number(cantidad);
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
  if (upper.includes('ENERO') || upper.includes('/01/') || upper.includes('-01-')) return 'ENERO';
  if (upper.includes('FEBRERO') || upper.includes('/02/') || upper.includes('-02-')) return 'FEBRERO';
  if (upper.includes('MARZO') || upper.includes('/03/') || upper.includes('-03-')) return 'MARZO';
  if (upper.includes('ABRIL') || upper.includes('/04/') || upper.includes('-04-')) return 'ABRIL';
  if (upper.includes('MAYO') || upper.includes('/05/') || upper.includes('-05-')) return 'MAYO';
  if (upper.includes('JUNIO') || upper.includes('/06/') || upper.includes('-06-')) return 'JUNIO';
  if (upper.includes('JULIO') || upper.includes('/07/') || upper.includes('-07-')) return 'JULIO';
  if (upper.includes('AGOSTO') || upper.includes('/08/') || upper.includes('-08-')) return 'AGOSTO';
  if (upper.includes('SEPTIEMBRE') || upper.includes('/09/') || upper.includes('-09-')) return 'SEPTIEMBRE';
  if (upper.includes('OCTUBRE') || upper.includes('/10/') || upper.includes('-10-')) return 'OCTUBRE';
  if (upper.includes('NOVIEMBRE') || upper.includes('/11/') || upper.includes('-11-')) return 'NOVIEMBRE';
  if (upper.includes('DICIEMBRE') || upper.includes('/12/') || upper.includes('-12-')) return 'DICIEMBRE';
  return 'OTROS';
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
  return '';
};

export const CSV_HEADERS = [
  'NOMBRE_ALUMNO', 'NO_PLAN_PAGOS', 'LICENCIATURA', 'GRADO', 'TURNO', 'ESTATUS_ALUMNO',
  'CICLO_ESCOLAR', 'FECHA_PLAN', 'TIPO_PLAN', 'BECA_TIPO', 'BECA_PORCENTAJE',
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
