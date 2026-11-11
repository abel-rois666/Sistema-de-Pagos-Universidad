/** Identificadores opcionales: siempre texto para conservar los ceros iniciales. */
export interface DatosPagoPersonal {
  nss: string | null;
  clabe: string | null;
  cuenta: string | null;
  tarjeta: string | null;
}
export type CampoPagoPersonal = keyof DatosPagoPersonal;
export const DATOS_PAGO_VACIOS: DatosPagoPersonal = { nss: null, clabe: null, cuenta: null, tarjeta: null };
export const CAMPOS_PAGO_PERSONAL: readonly { campo: CampoPagoPersonal; etiqueta: string; maximo: number; exacto?: boolean }[] = [
  { campo: 'nss', etiqueta: 'NSS', maximo: 11, exacto: true },
  { campo: 'clabe', etiqueta: 'CLABE', maximo: 18 },
  { campo: 'cuenta', etiqueta: 'Número de cuenta', maximo: 11 },
  { campo: 'tarjeta', etiqueta: 'Número de tarjeta', maximo: 16 }
];

export function erroresDatosPagoPersonal(datos: Partial<Record<CampoPagoPersonal, unknown>>) {
  const errores: Partial<Record<CampoPagoPersonal, string>> = {};
  for (const { campo, etiqueta, maximo, exacto } of CAMPOS_PAGO_PERSONAL) {
    const valor = datos[campo];
    if (valor === null || valor === undefined || valor === '') continue;
    if (typeof valor !== 'string' || !/^[0-9]+$/.test(valor)) errores[campo] = `${etiqueta}: ingresa únicamente dígitos del 0 al 9, sin espacios, signos ni separadores.`;
    else if (exacto && valor.length !== maximo) errores[campo] = `${etiqueta}: debe contener exactamente ${maximo} dígitos.`;
    else if (valor.length > maximo) errores[campo] = `${etiqueta}: admite como máximo ${maximo} dígitos.`;
  }
  return errores;
}

export function datosPagoPersonalValidados(datos: Partial<Record<CampoPagoPersonal, unknown>>): DatosPagoPersonal {
  const errores = Object.values(erroresDatosPagoPersonal(datos));
  if (errores.length) throw new Error(errores.join(' '));
  return Object.fromEntries(CAMPOS_PAGO_PERSONAL.map(({ campo }) => [campo, datos[campo] || null])) as unknown as DatosPagoPersonal;
}

export function ocultarDatoPago(valor: string | null | undefined) {
  if (!valor) return 'Sin registrar';
  if (valor.length <= 4) return '•'.repeat(valor.length);
  return '•'.repeat(Math.max(0, valor.length - 4)) + valor.slice(-4);
}
