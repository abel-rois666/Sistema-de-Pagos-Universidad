import { supabase } from '../lib/supabase';

export interface PeriodicidadAcademicaAlumno {
  planId: string;
  planNombre: string;
  tipoPeriodo: string;
}

/** Consulta el programa vigente; no deduce la periodicidad por nombre de carrera. */
export async function cargarPeriodicidadAcademicaAlumno(alumnoId: string): Promise<PeriodicidadAcademicaAlumno> {
  const { data: programas, error } = await supabase.from('alumno_programas')
    .select('plan_id').eq('alumno_id', alumnoId).eq('es_vigente', true);
  if (error) throw new Error(`No se pudo consultar el programa vigente: ${error.message}`);
  const ids = [...new Set((programas || []).map(programa => programa.plan_id).filter(Boolean))];
  if (ids.length !== 1)
    throw new Error('El alumno debe tener un único plan de estudios vigente antes de crear un plan de pagos ordinario.');
  const { data: plan, error: errorPlan } = await supabase.from('planes_estudio')
    .select('id, nombre, tipo_periodo').eq('id', ids[0]).single();
  if (errorPlan || !plan?.tipo_periodo)
    throw new Error('No se pudo comprobar la periodicidad del plan de estudios vigente.');
  return { planId: plan.id, planNombre: plan.nombre, tipoPeriodo: plan.tipo_periodo };
}

export interface RevisionReasociacionPlanPago {
  aplicable: boolean;
  aplicado?: boolean;
  motivo?: string;
  plan_id: string;
  ciclo_origen_id?: string;
  ciclo_destino_id?: string;
  tipo_plan_nuevo?: string;
  recibos_en_origen: number;
  folios: number[];
  detalles_pendientes_conciliar?: number;
  estados_cobrados_conservados?: number;
  criterio_asociacion?: 'PROGRAMA_VIGENTE' | 'PROGRAMA_Y_GRUPO';
  grupos_destino?: number;
  programas_vigentes?: number;
}

export async function revisarReasociacionPlanPago(
  planId: string, cicloDestinoId: string, aplicar = false,
): Promise<RevisionReasociacionPlanPago> {
  const { data, error } = await supabase.rpc('revisar_reasociacion_plan_pago', {
    p_plan_id: planId, p_ciclo_destino_id: cicloDestinoId, p_aplicar: aplicar,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('El servidor no devolvió una revisión válida.');
  return data as RevisionReasociacionPlanPago;
}

/** Conserva todos los recibos en el origen; el servidor exige que no haya vínculos ni estados cobrados. */
export async function revisarReasociacionSoloPlanPago(
  planId: string, cicloDestinoId: string, aplicar = false,
): Promise<RevisionReasociacionPlanPago> {
  const { data, error } = await supabase.rpc('revisar_reasociacion_solo_plan_pago', {
    p_plan_id: planId, p_ciclo_destino_id: cicloDestinoId, p_aplicar: aplicar,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('El servidor no devolvió una revisión válida.');
  return data as RevisionReasociacionPlanPago;
}

/** Mueve el plan sin alterar recibos ni pagos; informa los vínculos legados por conciliar. */
export async function revisarReasociacionConRecibos(
  planId: string, cicloDestinoId: string, aplicar = false,
): Promise<RevisionReasociacionPlanPago> {
  const { data, error } = await supabase.rpc('revisar_reasociacion_con_recibos', {
    p_plan_id: planId, p_ciclo_destino_id: cicloDestinoId, p_aplicar: aplicar,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('El servidor no devolvió una revisión válida.');
  return data as RevisionReasociacionPlanPago;
}

export async function conciliarReciboDetallePlan(
  detalleId: string, planId: string, indice: number, importe: number, aplicar = false,
): Promise<{ aplicable: boolean; aplicado?: boolean; motivo?: string;
  remanente_historico_sin_movimiento?: number; monedero_modificado?: boolean }> {
  const { data, error } = await supabase.rpc('conciliar_recibo_detalle_plan', {
    p_detalle_id: detalleId, p_plan_id: planId, p_indice: indice,
    p_importe: importe, p_aplicar: aplicar,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') throw new Error('El servidor no devolvió una conciliación válida.');
  return data as { aplicable: boolean; aplicado?: boolean; motivo?: string;
    remanente_historico_sin_movimiento?: number; monedero_modificado?: boolean };
}

export async function vincularReciboDetallePlanes(
  detalleId: string, seleccion: { planId: string; idx: number }[],
): Promise<{ excedente: number }> {
  const { data, error } = await supabase.rpc('vincular_recibo_detalle_planes_v3', {
    p_detalle_id: detalleId,
    p_seleccion: seleccion.map(item => ({ plan_id: item.planId, indice: item.idx })),
  });
  if (error) throw new Error(error.message);
  if (!data?.aplicado) throw new Error('El servidor no confirmó la vinculación.');
  return { excedente: Number(data.excedente || 0) };
}

export async function tieneVinculoExplicitoPlan(planId: string, indices: number[]): Promise<boolean> {
  if (indices.length === 0) return false;
  const { data, error } = await supabase.from('planes_pago_vinculos_recibo')
    .select('id').eq('plan_id', planId).in('indice_concepto', indices)
    .is('anulado_en', null).limit(1);
  if (error) throw new Error(`No se pudieron comprobar los vínculos del plan: ${error.message}`);
  return Boolean(data?.length);
}

/** Especialidad conserva su categoría financiera y todos los recibos en su ciclo original. */
export async function revisarReasociacionEspecialidadPago(planId:string,cicloDestinoId:string,aplicar=false):Promise<RevisionReasociacionPlanPago>{
 const {data,error}=await supabase.rpc('revisar_reasociacion_especialidad_pago',{p_plan_id:planId,p_ciclo_destino_id:cicloDestinoId,p_aplicar:aplicar});
 if(error)throw new Error(['PGRST202','42883'].includes(error.code)?'Falta instalar la revisión de Especialidad Cuatrimestral (20261110110000). No se modificó el plan.':error.message);
 if(!data||typeof data.aplicable!=='boolean')throw new Error('El servidor no confirmó una revisión válida.');return data as RevisionReasociacionPlanPago;
}
