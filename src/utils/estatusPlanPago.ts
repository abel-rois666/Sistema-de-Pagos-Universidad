export interface VinculoReciboPlan {
  folio: string;
  importe: number;
}

/** Presenta una conciliación confirmada con el mismo texto editable del plan. */
export function estatusVisiblePlanPago(
  estatusGuardado: string | null | undefined,
  cantidad: number | null | undefined,
  vinculos: readonly VinculoReciboPlan[],
): string {
  const guardado = estatusGuardado?.trim() || '';
  if (guardado && !['PENDIENTE', 'NO PAGADO'].includes(guardado.toLocaleUpperCase('es-MX').replace(/\s+/g, ' '))) return guardado;
  if (!vinculos.length) return guardado || 'PENDIENTE';

  const folios = [...new Set(vinculos.map(vinculo => `R-${vinculo.folio}`))].join('; ');
  const abonado = vinculos.reduce((total, vinculo) => total + vinculo.importe, 0);
  const monto = Number(cantidad);
  const dinero = (valor: number) => valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!Number.isFinite(monto) || monto <= 0) return folios;
  if (abonado + 0.005 >= monto) return `${folios} (Pagado $${dinero(abonado)})`;
  return `${folios} (Abono $${dinero(abonado)}, Resta $${dinero(monto - abonado)})`;
}
