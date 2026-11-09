/** Interpretación conservadora para reportes; jamás modifica importes o saldo. */
export function estadoPagoComprobado(valor: string | null | undefined): 'pagado' | 'pendiente' | 'revisar' {
  const texto = (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!texto || /\b(NO\s+PAGADO|PENDIENTE|CANCELADO|BAJA|ABONO|RESTA)\b/.test(texto)) return 'pendiente';
  if (/^(PAGADO|LIQUIDADO)(?:\b|$)/.test(texto)) return 'pagado';
  // Folios históricos R- (recibo) y F- (factura) capturados como estatus del pago.
  // No se deduce el pago de los campos fiscales ni se modifica la factura.
  // Los indicadores de pendiente/abono/cancelación se evalúan antes de reconocer el folio.
  const medio = '(?:EFECTIVO|DEPOSITO(?: BANCARIO)?|TRANSFERENCIA(?: BANCARIA)?|TARJETA(?: DE)? (?:DEBITO|CREDITO))';
  const pagado = 'PAGADO(?: \\$\\s*[\\d,.]+| CON BECA)';
  const comprobante = `[RF]-\\d+(?:\\s*\\((?:${medio}|${pagado})\\))?`;
  if (new RegExp(`^${comprobante}(?:\\s*[;,]\\s*${comprobante})*$`).test(texto)) return 'pagado';
  return 'revisar';
}
