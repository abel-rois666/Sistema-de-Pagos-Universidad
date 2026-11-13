import type { Alumno, PaymentPlan, Recibo, ReciboDetalle } from '../types';
import type { ResumenCertificacion } from '../certificacion/seguimiento';
import { conceptosFinancieros, saldoConcepto } from '../finanzas/consulta';
import { estadoPagoComprobado } from '../utils/estadoPagoComprobado';
import { resumirPagoTitulacion } from './estadoPagoTitulacion';
import { certificacionesAlumno, estadoPagoCertificado, estadoTramiteCertificado, etiquetaProgramaCertificado, planesTitulacionAlumno } from '../certificacion/seguimiento';
import type { TablaCSV } from './detallesListadoCSV';

export interface VinculoPagoLectura { id: string; plan_id: string; recibo_detalle_id: string; indice_concepto: number; importe: number; anulado_en: string | null }
export interface DatosPagosListado {
  planes: PaymentPlan[]; recibos: Recibo[]; detalles: ReciboDetalle[]; vinculos: VinculoPagoLectura[]; certificaciones: ResumenCertificacion[];
}
/** Índices locales: evita recorrer el historial completo por cada alumno al preparar el ZIP. */
export function separarPagosPorAlumno(datos: DatosPagosListado) {
  const mapa = new Map<string, DatosPagosListado>();
  const grupo = (id: string) => { if (!mapa.has(id)) mapa.set(id, { planes: [], recibos: [], detalles: [], vinculos: [], certificaciones: [] }); return mapa.get(id)!; };
  const planes = new Map(datos.planes.map(p => [p.id, p.alumno_id]));
  const recibos = new Map(datos.recibos.map(r => [r.id, r.alumno_id]));
  for (const p of datos.planes) if (p.alumno_id) grupo(p.alumno_id).planes.push(p);
  for (const r of datos.recibos) grupo(r.alumno_id).recibos.push(r);
  for (const d of datos.detalles) { const id = recibos.get(d.recibo_id); if (id) grupo(id).detalles.push(d); }
  for (const v of datos.vinculos) { const id = planes.get(v.plan_id); if (id) grupo(id).vinculos.push(v); }
  for (const f of datos.certificaciones) grupo(f.alumno_id).certificaciones.push(f);
  return mapa;
}
export type ContenidoPagos = 'ambos' | 'certificados' | 'titulacion';
export interface MovimientoPago {
  clave: string; recibo: Recibo; concepto: string; importe: number | null;
  respaldo: string; // Importe aplicado, subtotal identificado o referencia sin atribución monetaria.
}
const centavos = (n: number) => Math.round(n * 100);
const suma = (valores: number[]) => valores.reduce((a, b) => a + centavos(b), 0) / 100;
export const esConceptoCertificado = (texto: string) => /\bCERTIFICAD[OA]S?\b|\bCERTIFICACION\b/.test(texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase());
export function alcanceAlumnosPagos(alumnos: readonly Alumno[], filtrados: readonly Alumno[], seleccion: readonly string[]) {
  const ids = new Set(seleccion.length ? seleccion : filtrados.map(a => a.id));
  // La selección explícita conserva alumnos entre páginas y cambios de filtro.
  return (seleccion.length ? alumnos : filtrados).filter(a => ids.delete(a.id));
}
export function resumenPlanPagos(plan: PaymentPlan) {
  const conceptos = conceptosFinancieros(plan).filter(c => c.concepto.trim() !== '0');
  const conocido = conceptos.length > 0 && conceptos.every(c => Number.isFinite(c.cantidad) && c.cantidad >= 0);
  const importes = conceptos.map(c => {
    if (estadoPagoComprobado(c.estatus) === 'pagado') return c.cantidad;
    const saldo = saldoConcepto(c.cantidad, c.estatus);
    return saldo.estado === 'revisar' || /\bABONO\b/i.test(c.estatus) && !/RESTA\s*\$/i.test(c.estatus) ? null : c.cantidad - saldo.pendiente;
  });
  return { estado: resumirPagoTitulacion(plan), total: conocido ? suma(conceptos.map(c => c.cantidad)) : null,
    pagadoSegunPlan: conocido && importes.every(n => n !== null) ? suma(importes as number[]) : null };
}
function activos(datos: DatosPagosListado, alumnoId: string) {
  return new Map(datos.recibos.filter(r => r.alumno_id === alumnoId && r.estatus === 'ACTIVO').map(r => [r.id, r]));
}
export function movimientosPlan(plan: PaymentPlan, datos: DatosPagosListado) {
  const recibos = activos(datos, plan.alumno_id || '');
  const detalles = new Map(datos.detalles.map(d => [d.id, d]));
  const movimientos: MovimientoPago[] = [];
  const vistos = new Set<string>(), recibosVinculados = new Set<string>();
  for (const v of datos.vinculos) {
    if (v.plan_id !== plan.id || v.anulado_en || vistos.has(v.id)) continue;
    vistos.add(v.id);
    const d = detalles.get(v.recibo_detalle_id), r = d && recibos.get(d.recibo_id);
    if (!r) continue; // Nunca contar cancelados o pagos de otro alumno.
    if (!Number.isFinite(Number(v.importe)) || Number(v.importe) <= 0) throw new Error('Hay un vínculo con importe inválido. Revisa el plan antes de exportar.');
    movimientos.push({ clave: v.id, recibo: r, concepto: conceptosFinancieros(plan).find(c => c.indice === v.indice_concepto)?.concepto || d!.concepto,
      importe: Number(v.importe), respaldo: 'Vínculo explícito al concepto del plan' });
    recibosVinculados.add(r.id);
  }
  const pendientes = new Set<string>();
  // Un folio histórico permite localizar el recibo, pero no prueba cuánto se aplicó a este plan.
  const referencias = new Set(conceptosFinancieros(plan).flatMap(c => [...c.estatus.matchAll(/\b([RF])-([0-9]+)\b/gi)].map(m => `${m[1].toUpperCase()}-${m[2]}`)));
  for (const ref of referencias) {
    const [tipo, folio] = ref.split('-');
    const candidatos = [...recibos.values()].filter(r => tipo === 'R' ? String(r.folio) === String(Number(folio)) : r.folio_fiscal?.trim() === folio);
    if (candidatos.length !== 1) { pendientes.add(ref); continue; }
    const r = candidatos[0];
    if (recibosVinculados.has(r.id)) continue;
    recibosVinculados.add(r.id);
    movimientos.push({ clave: `referencia-${r.id}`, recibo: r, concepto: 'Referencia en el estatus del plan', importe: null, respaldo: 'Referencia histórica; importe aplicado sin identificar' });
  }
  return { movimientos, referenciasPendientes: [...pendientes], vinculado: suma(movimientos.flatMap(m => m.importe === null ? [] : [m.importe])) };
}
export function movimientosCertificado(alumnoId: string, datos: DatosPagosListado): MovimientoPago[] {
  const recibos = activos(datos, alumnoId), planes = new Map(datos.planes.filter(p => p.alumno_id === alumnoId).map(p => [p.id, p]));
  const vistos = new Set<string>();
  return datos.detalles.flatMap(d => {
    const r = recibos.get(d.recibo_id);
    if (!r || vistos.has(d.id)) return [];
    vistos.add(d.id);
    const vinculos = datos.vinculos.filter(v => v.recibo_detalle_id === d.id && !v.anulado_en && planes.has(v.plan_id));
    const certificados = vinculos.filter(v => esConceptoCertificado(conceptosFinancieros(planes.get(v.plan_id)!).find(c => c.indice === v.indice_concepto)?.concepto || ''));
    if (certificados.length) return [{ clave: d.id, recibo: r, concepto: d.concepto, importe: suma(certificados.map(v => Number(v.importe))), respaldo: 'Vinculado a concepto de certificado; programa académico sin determinar' }];
    // Si hay reparto explícito hacia otros conceptos no atribuir el subtotal al certificado.
    if (vinculos.length || !esConceptoCertificado(d.concepto)) return [];
    return [{ clave: d.id, recibo: r, concepto: d.concepto, importe: d.subtotal != null && Number.isFinite(Number(d.subtotal)) ? Number(d.subtotal) : null, respaldo: 'Concepto del recibo identificado por texto; sin vínculo a ficha o programa' }];
  });
}
export const montoPago = (n: number | null) => n === null ? 'Sin importe identificado' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
export function tablasDetallePagos(alumnos: readonly Alumno[], datos: DatosPagosListado, ciclos: readonly { id: string; nombre: string; tipo_periodo?: string | null }[], contenido: ContenidoPagos): Record<string, TablaCSV> {
  const porAlumno = separarPagosPorAlumno(datos);
  const estados: TablaCSV = { cabeceras: ['Matrícula', 'Alumno', 'Programa académico', 'Pago del certificado', 'Trámite del certificado', 'alumno_id', 'alumno_programa_id', 'ficha_certificacion_id'], filas: [] };
  const planes: TablaCSV = { cabeceras: ['Matrícula', 'Alumno', 'Plan de pagos', 'Ciclo', 'Tipo de ciclo', 'Estado del pago', 'Importe del plan', 'Pagado según estatus del plan', 'Importe identificado en vínculos', 'Referencias sin localizar', 'Asociación académica', 'alumno_id', 'plan_pago_id'], filas: [] };
  const recibos: TablaCSV = { cabeceras: ['Matrícula', 'Alumno', 'Consulta', 'Plan de pagos', 'Ciclo del plan', 'Folio recibo', 'Folio factura', 'Fecha de pago', 'Forma de pago', 'Concepto', 'Importe del concepto o vínculo', 'Total del recibo (no sumar por fila)', 'Uso de monedero del recibo', 'Respaldo', 'alumno_id', 'plan_pago_id', 'recibo_id', 'movimiento_id'], filas: [] };
  for (const a of alumnos) {
    const propios = porAlumno.get(a.id) || { planes: [], recibos: [], detalles: [], vinculos: [], certificaciones: [] };
    const agregar = (movimientos: MovimientoPago[], tipo: string, plan?: PaymentPlan) => movimientos.forEach(m => recibos.filas.push([a.matricula || '', a.nombre_completo, tipo, plan?.no_plan_pagos || '', ciclos.find(c => c.id === plan?.ciclo_id)?.nombre || plan?.ciclo_escolar || '', `R-${m.recibo.folio ?? ''}`, m.recibo.folio_fiscal || '', m.recibo.fecha_pago || '', m.recibo.forma_pago || 'Sin dato', m.concepto, m.importe === null ? '' : m.importe.toFixed(2), Number(m.recibo.total).toFixed(2), Number(m.recibo.uso_saldo_a_favor || 0).toFixed(2), m.respaldo, a.id, plan?.id || '', m.recibo.id, m.clave]));
    if (contenido !== 'titulacion') {
      const fichas = certificacionesAlumno(propios.certificaciones, a.id);
      if (!fichas.length) estados.filas.push([a.matricula || '', a.nombre_completo, 'Sin registro', 'Sin registro', 'Sin registro', a.id, '', '']);
      for (const f of fichas) estados.filas.push([a.matricula || '', a.nombre_completo, etiquetaProgramaCertificado(f), estadoPagoCertificado(f), estadoTramiteCertificado(f), a.id, f.alumno_programa_id || '', f.id || '']);
      agregar(movimientosCertificado(a.id, propios), 'Certificado (sin atribución a programa)');
    }
    const titulacion = planesTitulacionAlumno(propios.planes, a.id);
    if (contenido !== 'certificados' && !titulacion.length) planes.filas.push([a.matricula || '', a.nombre_completo, '', '', '', 'Sin plan', '', '', '', '', 'Sin asociación inequívoca con programa académico', a.id, '']);
    if (contenido !== 'certificados') for (const p of titulacion) {
      const resumen = resumenPlanPagos(p), mov = movimientosPlan(p, propios), ciclo = ciclos.find(c => c.id === p.ciclo_id);
      planes.filas.push([a.matricula || '', a.nombre_completo, p.no_plan_pagos || '', ciclo?.nombre || p.ciclo_escolar || '', ciclo?.tipo_periodo || '', resumen.estado, resumen.total?.toFixed(2) ?? '', resumen.pagadoSegunPlan?.toFixed(2) ?? '', mov.movimientos.some(m => m.importe !== null) ? mov.vinculado.toFixed(2) : '', mov.referenciasPendientes.join('; '), 'Sin asociación inequívoca con programa académico', a.id, p.id]);
      agregar(mov.movimientos, 'Titulación', p);
    }
  }
  return { ...(contenido !== 'titulacion' ? { 'certificados_estados.csv': estados } : {}), ...(contenido !== 'certificados' ? { 'titulacion_planes.csv': planes } : {}), 'recibos_detalle.csv': recibos };
}
