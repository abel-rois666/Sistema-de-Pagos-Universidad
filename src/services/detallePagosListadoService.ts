import { supabase } from '../lib/supabase';
import { cargarCertificacionesReporte } from './reporteEgresadosService';
import { consultarPagosListado, type FuentePagosListado, type PaginaPagos } from '../reportes/consultaPagosListado';

function lectura(tabla: string, columnas: string, campo: string) {
  return async ({ ids, desde, cantidad, signal }: PaginaPagos) => {
    const { data, error } = await supabase.from(tabla).select(columnas).in(campo, ids).order('id').range(desde, desde + cantidad - 1).abortSignal(signal);
    if (error || !Array.isArray(data)) throw new Error(`No se pudo consultar ${tabla}. Revisa permisos o disponibilidad y reintenta; no se presenta un detalle incompleto.`);
    return data as any[];
  };
}
const fuente: FuentePagosListado = {
  planes: lectura('vista_planes_pago', '*,detalles:planes_pago_detalles(*)', 'alumno_id'),
  recibos: lectura('recibos', 'id,folio,alumno_id,ciclo_id,fecha_pago,fecha_recibo,total,forma_pago,banco,estatus,uso_saldo_a_favor,folio_fiscal,estatus_factura', 'alumno_id'),
  detalles: lectura('recibos_detalles', 'id,recibo_id,cantidad,concepto,costo_unitario,subtotal,indice_concepto_plan,observaciones', 'recibo_id'),
  vinculos: lectura('planes_pago_vinculos_recibo', 'id,plan_id,recibo_detalle_id,indice_concepto,importe,anulado_en', 'plan_id'),
  certificaciones: async (ids, signal) => (await cargarCertificacionesReporte(ids, signal)).certificaciones,
};
export const cargarDetallePagosListado = (ids: readonly string[], signal: AbortSignal) => consultarPagosListado(ids, fuente, signal);
