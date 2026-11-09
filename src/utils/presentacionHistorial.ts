interface RegistroPresentacion {
  calificacion_final?: number | string | null; parcial_1?: number | null; parcial_2?: number | null; parcial_3?: number | null;
  tipo_evaluacion?: string | null; ciclo?: {nombre?: string | null} | null; ciclo_legado?: string | null;
}
interface MateriaPresentacion {
  acreditada: boolean; mejor_calificacion: number | null;
  ordinario?: RegistroPresentacion | null; registros?: RegistroPresentacion[];
}
/** Misma distinción histórica entre captura incompleta, cero acreditado y NP. */
export function situacionHistorial(item: MateriaPresentacion, minimo: number) {
  if (item.acreditada) return 'Acreditada';
  const parciales = [item.ordinario?.parcial_1, item.ordinario?.parcial_2, item.ordinario?.parcial_3];
  const vacio = (v: number | null | undefined) => v === null || v === undefined || v === 0;
  const incompletos = parciales.some(vacio), final = item.mejor_calificacion;
  const explicito = final === -555 || (final !== null && final > 0 && final < minimo);
  const cero = final === 0 && !incompletos;
  const letales = parciales.every(p => !vacio(p) && (p === 5 || p === -555));
  return explicito || cero || letales ? 'Reprobada' : 'Por acreditar / Cursando';
}
export function formatearCreditos(valor: unknown) {
  if (valor === null || valor === undefined || valor === '') return '—';
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString('es-MX', {maximumFractionDigits: 2}) : '—';
}
/** Identifica los registros que explican el resultado, sin calcular ni elegir otra nota. */
export function fuentesResultado(item: MateriaPresentacion) {
  if (item.mejor_calificacion === null) return [];
  return (item.registros || []).filter(r => r.calificacion_final !== null && r.calificacion_final !== undefined && Number(r.calificacion_final) === item.mejor_calificacion)
    .map(r => ({ tipo: r.tipo_evaluacion || 'ORDINARIO', ciclo: r.ciclo?.nombre || r.ciclo_legado || 'Sin ciclo' }));
}
