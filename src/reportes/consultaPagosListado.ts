import type { PaymentPlan, Recibo, ReciboDetalle } from '../types';
import type { DatosPagosListado, VinculoPagoLectura } from './detallePagosListado';
import type { ResumenCertificacion } from '../certificacion/seguimiento';

export interface PaginaPagos { ids: string[]; desde: number; cantidad: number; signal: AbortSignal }
export interface FuentePagosListado {
  planes: (p: PaginaPagos) => Promise<PaymentPlan[]>;
  recibos: (p: PaginaPagos) => Promise<Recibo[]>;
  detalles: (p: PaginaPagos) => Promise<ReciboDetalle[]>;
  vinculos: (p: PaginaPagos) => Promise<VinculoPagoLectura[]>;
  certificaciones: (ids: string[], signal: AbortSignal) => Promise<ResumenCertificacion[]>;
}
/** Consulta de lectura por IDs, sin límite a la página visible ni filtro al ciclo contable del recibo. */
export async function consultarPagosListado(ids: readonly string[], fuente: FuentePagosListado, signal: AbortSignal): Promise<DatosPagosListado> {
  const comprobar = () => { if (signal.aborted) throw new DOMException('Consulta cancelada', 'AbortError'); };
  const leer = async <T extends { id?: string | null }>(valores: string[], consulta: (p: PaginaPagos) => Promise<T[]>) => {
    const resultado: T[] = [], vistos = new Set<string>();
    for (let inicio = 0; inicio < valores.length; inicio += 80) {
      for (let desde = 0; ;) {
        comprobar();
        const pagina = await consulta({ ids: valores.slice(inicio, inicio + 80), desde, cantidad: 500, signal });
        comprobar();
        if (!pagina.length) break;
        for (const fila of pagina) {
          if (!fila.id || vistos.has(fila.id)) throw new Error('Los registros cambiaron durante la consulta. Actualiza antes de exportar.');
          vistos.add(fila.id); resultado.push(fila);
        }
        desde += pagina.length;
      }
    }
    return resultado;
  };
  const unicos = [...new Set(ids)];
  comprobar();
  const planes = await leer(unicos, fuente.planes);
  const recibos = await leer(unicos, fuente.recibos);
  if (planes.some(p => !p.alumno_id || !unicos.includes(p.alumno_id)) || recibos.some(r => !unicos.includes(r.alumno_id))) throw new Error('La consulta devolvió datos fuera de los alumnos elegidos.');
  const detalles = await leer(recibos.map(r => r.id), fuente.detalles);
  const vinculos = await leer(planes.map(p => p.id), fuente.vinculos);
  const certificaciones = await fuente.certificaciones(unicos, signal);
  comprobar();
  const porRecibo = new Map(recibos.map(r => [r.id, r])), porDetalle = new Map(detalles.map(d => [d.id, d])), porPlan = new Map(planes.map(p => [p.id, p]));
  if (detalles.some(d => !porRecibo.has(d.recibo_id)) || certificaciones.some(f => !unicos.includes(f.alumno_id))) throw new Error('El respaldo está fuera del alcance elegido.');
  for (const v of vinculos) {
    if (v.anulado_en) continue;
    const d = porDetalle.get(v.recibo_detalle_id), r = d && porRecibo.get(d.recibo_id), p = porPlan.get(v.plan_id);
    if (!r || !p || r.alumno_id !== p.alumno_id || !Number.isFinite(Number(v.importe)) || Number(v.importe) <= 0) throw new Error('No se pudo comprobar el respaldo de todos los vínculos. Revisa permisos y asociaciones; no se muestran resultados parciales.');
  }
  return { planes, recibos, detalles, vinculos, certificaciones };
}
