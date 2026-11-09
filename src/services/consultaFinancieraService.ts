import { supabase, fetchAllSupabase } from '../lib/supabase';
import type { PaymentPlan, Recibo, ReciboDetalle } from '../types';
import { useAppStore } from '../store/useAppStore';
import { validarRespaldoConciliacion, type RespaldoConciliacion } from '../finanzas/conciliacionEntrePeriodos';

export type ReciboConDetalles = Recibo & { recibos_detalles: ReciboDetalle[] };
export interface DestinoVinculado { plan_id: string; indice_concepto: number; importe: number; plan: { no_plan_pagos: string; ciclo_id: string; tipo_plan: string } }
export async function consultarDestinosDetalle(detalleId: string, signal?: AbortSignal): Promise<DestinoVinculado[]> {
  let q = supabase.from('planes_pago_vinculos_recibo').select('plan_id, indice_concepto, importe, plan:planes_pago(no_plan_pagos, ciclo_id, tipo_plan)')
    .eq('recibo_detalle_id', detalleId).is('anulado_en', null).order('creado_en');
  if (signal) q = q.abortSignal(signal);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as DestinoVinculado[];
}
export async function consultarPlanFinanciero(id: string): Promise<PaymentPlan | null> {
  const { data, error } = await supabase.from('vista_planes_pago').select('*, detalles:planes_pago_detalles(*)').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PaymentPlan | null;
}
const consultasPlanes = new Map<string, Promise<void>>();
const revisionesPlanes = new Map<string, number>();
export function refrescarPlanFinanciero(id: string, forzar = false): Promise<void> {
  const previa = consultasPlanes.get(id);
  if (previa && !forzar) return previa;
  const revision = (revisionesPlanes.get(id) || 0)+1;
  revisionesPlanes.set(id, revision);
  const consulta = consultarPlanFinanciero(id).then(plan => {
    if (revisionesPlanes.get(id) !== revision) return;
    useAppStore.getState().setPlans(prev => plan ? prev.some(p => p.id === id) ? prev.map(p => p.id === id ? plan : p) : [...prev, plan] : prev.filter(p => p.id !== id));
  }).finally(() => { if (consultasPlanes.get(id) === consulta) consultasPlanes.delete(id); });
  consultasPlanes.set(id, consulta);
  return consulta;
}
export async function consultarPlanesAlumno(alumnoId: string, signal?: AbortSignal): Promise<PaymentPlan[]> {
  const { data, error } = await fetchAllSupabase(() => {
    const q = supabase.from('vista_planes_pago').select('*, detalles:planes_pago_detalles(*)').eq('alumno_id', alumnoId).order('id');
    return signal ? q.abortSignal(signal) : q;
  });
  if (error) throw new Error(error.message);
  return data as PaymentPlan[];
}
export async function consultarRecibosAlumno(alumnoId: string, pagina: number, cicloIds: string[] | null, signal?: AbortSignal, folio = '') {
  let q = supabase.from('recibos').select('*, recibos_detalles(*)', { count: 'exact' }).eq('alumno_id', alumnoId)
    .order('folio', { ascending: false }).order('id').range(pagina*20, pagina*20+19);
  if (cicloIds) q = q.in('ciclo_id', cicloIds.length ? cicloIds : ['00000000-0000-0000-0000-000000000000']);
  if (folio) q = q.eq('folio', Number(folio));
  if (signal) q = q.abortSignal(signal);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { recibos: (data || []) as ReciboConDetalles[], total: count || 0 };
}
export async function guardarObservacionFinanciera(planId: string, indice: number, original: string, texto: string): Promise<void> {
  const { data, error } = await supabase.rpc('guardar_observacion_plan_v1', { p_plan_id: planId, p_indice: indice, p_original: original, p_texto: texto });
  if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883' ? 'Falta instalar la migración de corrección financiera. Tu texto se conserva.' : error.message);
  if (!data?.aplicado) throw new Error('El servidor no confirmó el guardado. Tu texto se conserva.');
  revisionesPlanes.set(planId, (revisionesPlanes.get(planId) || 0)+1);
  const estatus = data.estatus || texto.trim() || 'PENDIENTE';
  useAppStore.getState().setPlans(prev => prev.map(p => p.id === planId ? { ...p, [`estatus_${indice}`]: estatus,
    detalles: p.detalles?.map(d => d.indice_concepto === indice ? { ...d, estatus } : d) } : p));
}
export async function revisarVinculacionFinanciera(detalleId: string, destinos: { planId: string; idx: number; importe?: number }[], modo: 'aplicar' | 'historico', confirmar = false, revision?: string, respaldo?: RespaldoConciliacion) {
  if (respaldo) {
    const error = validarRespaldoConciliacion(respaldo);
    if (error) throw new Error(error);
    if (destinos.length !== 1) throw new Error('Concilia un concepto por vez cuando los periodos sean distintos.');
  }
  const { data, error } = respaldo
    ? await supabase.rpc('conciliar_recibo_entre_periodos_v1', { p_detalle_id: detalleId, p_plan_id: destinos[0].planId, p_indice: destinos[0].idx,
      p_importe: destinos[0].importe ?? null, p_modo: modo, p_motivo: respaldo.motivo, p_evidencia: respaldo.evidencia.trim(), p_confirmar: confirmar, p_revision: revision || null })
    : await supabase.rpc('vinculacion_financiera_v1', { p_detalle_id: detalleId,
      p_destinos: destinos.map(d => ({ plan_id: d.planId, indice: d.idx, importe: d.importe })), p_modo: modo, p_confirmar: confirmar, p_revision: revision || null });
  if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883' ? `Falta instalar la migración de ${respaldo ? 'conciliación entre periodos' : 'corrección financiera'}. No se aplicó el recibo.` : error.message);
  return data as { aplicable: boolean; aplicado?: boolean; motivo?: string; revision: string; aplicado_total: number; remanente: number;
    disponible_origen?: number; aplicado_previamente?: number; excedente_previo?: number; pendiente_destino?: number; motivo_conciliacion?: string; evidencia?: string;
    destinos: { plan_id: string; indice: number; importe: number }[] };
}
export async function refrescarSaldoAlumno(alumnoId: string) {
  const { data, error } = await supabase.from('alumnos').select('id, saldo_a_favor').eq('id', alumnoId).single();
  if (error) throw new Error(error.message);
  useAppStore.getState().setAlumnos(prev => prev.map(a => a.id === alumnoId ? { ...a, saldo_a_favor: data.saldo_a_favor } : a));
}
