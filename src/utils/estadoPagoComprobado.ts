/** Interpretación conservadora para reportes; jamás modifica importes o saldo. */
export function estadoPagoComprobado(valor: string | null | undefined): 'pagado' | 'pendiente' | 'revisar' {
  const texto = (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  if (!texto || /\b(NO\s+PAGADO|PENDIENTE|CANCELADO|BAJA|ABONO|RESTA)\b/.test(texto)) return 'pendiente';
  if (/^(PAGADO|LIQUIDADO)(?:\b|$)/.test(texto)) return 'pagado';
  // El formato histórico R-folio representa el comprobante; no texto libre.
  if (/^R-\d+(?:\s*[;,]\s*R-\d+)*(?:\s*\(PAGADO(?:\s+\$[\d,.]+|\s+CON BECA)\))?$/.test(texto)) return 'pagado';
  return 'revisar';
}
