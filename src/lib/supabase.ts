/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { PaymentPlan, Alumno, CicloEscolar, Recibo, ReciboDetalle } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Mapper: PaymentPlan → planes_pago (excluye campos calculados por la vista) ──
export const toDBPlan = (plan: PaymentPlan) => ({
  id: plan.id,
  alumno_id: plan.alumno_id ?? null,
  ciclo_id: plan.ciclo_id ?? null,
  no_plan_pagos: plan.no_plan_pagos,
  fecha_plan: plan.fecha_plan,
  beca_porcentaje: plan.beca_porcentaje,
  beca_tipo: plan.beca_tipo,
  tipo_plan: plan.tipo_plan ?? 'Cuatrimestral',
  licenciatura: plan.licenciatura ?? null,
  grado_turno_inscrito: plan.grado_turno ?? null,
  grado: plan.grado ?? (plan.grado_turno?.split('/')[0]?.trim() ?? null),
  turno: plan.turno ?? (plan.grado_turno?.split('/')[1]?.trim() ?? null),
  concepto_1: plan.concepto_1 ?? null, fecha_1: plan.fecha_1 ?? null, cantidad_1: plan.cantidad_1 ?? null, estatus_1: plan.estatus_1 ?? null,
  concepto_2: plan.concepto_2 ?? null, fecha_2: plan.fecha_2 ?? null, cantidad_2: plan.cantidad_2 ?? null, estatus_2: plan.estatus_2 ?? null,
  concepto_3: plan.concepto_3 ?? null, fecha_3: plan.fecha_3 ?? null, cantidad_3: plan.cantidad_3 ?? null, estatus_3: plan.estatus_3 ?? null,
  concepto_4: plan.concepto_4 ?? null, fecha_4: plan.fecha_4 ?? null, cantidad_4: plan.cantidad_4 ?? null, estatus_4: plan.estatus_4 ?? null,
  concepto_5: plan.concepto_5 ?? null, fecha_5: plan.fecha_5 ?? null, cantidad_5: plan.cantidad_5 ?? null, estatus_5: plan.estatus_5 ?? null,
  concepto_6: plan.concepto_6 ?? null, fecha_6: plan.fecha_6 ?? null, cantidad_6: plan.cantidad_6 ?? null, estatus_6: plan.estatus_6 ?? null,
  concepto_7: plan.concepto_7 ?? null, fecha_7: plan.fecha_7 ?? null, cantidad_7: plan.cantidad_7 ?? null, estatus_7: plan.estatus_7 ?? null,
  concepto_8: plan.concepto_8 ?? null, fecha_8: plan.fecha_8 ?? null, cantidad_8: plan.cantidad_8 ?? null, estatus_8: plan.estatus_8 ?? null,
  concepto_9: plan.concepto_9 ?? null, fecha_9: plan.fecha_9 ?? null, cantidad_9: plan.cantidad_9 ?? null, estatus_9: plan.estatus_9 ?? null,
});

// ── CRUD Helpers ─────────────────────────────────────────────────────────────

// Verifica si un string es un UUID válido de Postgres
const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Upsert de un plan de pagos individual */
export const savePlan = async (plan: PaymentPlan): Promise<string | null> => {
  if (plan.id && !isUUID(plan.id)) return null;
  const { error } = await supabase.from('planes_pago').upsert(toDBPlan(plan));
  if (error) { console.error('[savePlan]', error.message); return error.message; }
  return null;
};

/** Upsert de un alumno */
export const saveAlumno = async (alumno: Alumno): Promise<string | null> => {
  if (alumno.id && !isUUID(alumno.id)) return null;
  const { error } = await supabase.from('alumnos').upsert({
    id: alumno.id,
    nombre_completo: alumno.nombre_completo,
    licenciatura: alumno.licenciatura,
    grado_actual: alumno.grado_actual,
    turno: alumno.turno,
    estatus: alumno.estatus,
    beca_porcentaje: alumno.beca_porcentaje,
    ciclo_ultima_asignacion_grado: alumno.ciclo_ultima_asignacion_grado,
  });
  if (error) { console.error('[saveAlumno]', error.message); return error.message; }
  return null;
};

/** Upsert completo del array de ciclos (usado al activar/desactivar) */
export const saveCiclos = async (ciclos: CicloEscolar[]): Promise<string | null> => {
  const validCiclos = ciclos.filter(c => isUUID(c.id));
  if (validCiclos.length === 0) return null;
  const { error } = await supabase.from('ciclos_escolares').upsert(
    validCiclos.map(c => ({ id: c.id, nombre: c.nombre, meses_abarca: c.meses_abarca, anio: c.anio, activo: c.activo }))
  );
  if (error) { console.error('[saveCiclos]', error.message); return error.message; }
  return null;
};

/** Insert masivo de alumnos (importación CSV) */
export const bulkSaveAlumnos = async (alumnos: Alumno[]): Promise<string | null> => {
  const validAlumnos = alumnos.filter(a => isUUID(a.id));
  if (!validAlumnos.length) return null;
  const { error } = await supabase.from('alumnos').upsert(
    validAlumnos.map(a => ({
      id: a.id,
      nombre_completo: a.nombre_completo,
      licenciatura: a.licenciatura,
      grado_actual: a.grado_actual,
      turno: a.turno,
      estatus: a.estatus || 'ACTIVO',
      beca_porcentaje: a.beca_porcentaje || '0%',
      beca_tipo: a.beca_tipo || 'NINGUNA',
      ciclo_ultima_asignacion_grado: a.ciclo_ultima_asignacion_grado || null
    }))
  );
  if (error) { console.error('[bulkSaveAlumnos]', error.message); return error.message; }
  return null;
};

/** Insert masivo de planes (importación CSV) */
export const bulkSavePlanes = async (planes: PaymentPlan[]): Promise<string | null> => {
  const validPlanes = planes.filter(p => isUUID(p.id));
  if (!validPlanes.length) return null;
  const { error } = await supabase.from('planes_pago').upsert(validPlanes.map(toDBPlan));
  if (error) { console.error('[bulkSavePlanes]', error.message); return error.message; }
  return null;
};

/** Upsert de una plantilla de plan */
export const savePlantilla = async (plantilla: any): Promise<string | null> => {
  if (plantilla.id && !isUUID(plantilla.id)) return null;
  const { error } = await supabase.from('plantillas_plan').upsert(plantilla);
  if (error) { console.error('[savePlantilla]', error.message); return error.message; }
  return null;
};

/** Eliminar una plantilla de plan */
export const deletePlantilla = async (id: string): Promise<string | null> => {
  if (!isUUID(id)) return null;
  const { error } = await supabase.from('plantillas_plan').delete().eq('id', id);
  if (error) { console.error('[deletePlantilla]', error.message); return error.message; }
  return null;
};

/** Eliminar un alumno */
export const deleteAlumno = async (id: string): Promise<string | null> => {
  if (!isUUID(id)) return null;
  const { error } = await supabase.from('alumnos').delete().eq('id', id);
  if (error) { console.error('[deleteAlumno]', error.message); return error.message; }
  return null;
};

/** Upsert individual de ciclo escolar */
export const saveCiclo = async (ciclo: CicloEscolar): Promise<string | null> => {
  if (ciclo.id && !isUUID(ciclo.id)) return null;
  const { error } = await supabase.from('ciclos_escolares').upsert(
    { id: ciclo.id, nombre: ciclo.nombre, meses_abarca: ciclo.meses_abarca, anio: ciclo.anio, activo: ciclo.activo }
  );
  if (error) { console.error('[saveCiclo]', error.message); return error.message; }
  return null;
};

/** Eliminar un ciclo escolar */
export const deleteCiclo = async (id: string): Promise<string | null> => {
  if (!isUUID(id)) return null;
  const { error } = await supabase.from('ciclos_escolares').delete().eq('id', id);
  if (error) { console.error('[deleteCiclo]', error.message); return error.message; }
  return null;
};

/** Upsert de un item de catalogo */
export const saveCatalogoItem = async (item: any): Promise<string | null> => {
  if (item.id && !isUUID(item.id)) return null;
  const { error } = await supabase.from('catalogos').upsert(item);
  if (error) { console.error('[saveCatalogoItem]', error.message); return error.message; }
  return null;
};

/** Eliminar un item de catalogo */
export const deleteCatalogoItem = async (id: string): Promise<string | null> => {
  if (!isUUID(id)) return null;
  const { error } = await supabase.from('catalogos').delete().eq('id', id);
  if (error) { console.error('[deleteCatalogoItem]', error.message); return error.message; }
  return null;
};

/** Registrar un nuevo pago (recibo + detalles) y actualizar estatus del plan si aplica */
export const saveReciboCompleto = async (
  recibo: Omit<Recibo, 'id' | 'folio' | 'created_at' | 'estatus'>,
  detalles: Omit<ReciboDetalle, 'id' | 'recibo_id'>[],
  planUpdates?: { planId: string, updates: Partial<PaymentPlan> }
): Promise<{ error: string | null; folio?: number }> => {
  try {
    // 1. Insertar el recibo (Omitirmos el ID para que Postgres genere el UUID y el folio serial)
    const { data: reciboData, error: reciboError } = await supabase
      .from('recibos')
      .insert({
        fecha_recibo: recibo.fecha_recibo,
        fecha_pago: recibo.fecha_pago,
        alumno_id: recibo.alumno_id,
        ciclo_id: recibo.ciclo_id,
        total: recibo.total,
        forma_pago: recibo.forma_pago,
        banco: recibo.banco,
        estatus: 'ACTIVO'
      })
      .select('id, folio')
      .single();

    if (reciboError) throw new Error(`Error insertando recibo: ${reciboError.message}`);

    const newReciboId = reciboData.id;
    const newFolio = reciboData.folio;

    // 2. Insertar detalles
    const detallesToInsert = detalles.map(d => ({
      ...d,
      recibo_id: newReciboId
    }));

    const { error: detallesError } = await supabase
      .from('recibos_detalles')
      .insert(detallesToInsert);

    if (detallesError) throw new Error(`Error insertando detalles: ${detallesError.message}`);

    // 3. Actualizar Plan de Pagos (si hubo afectación a conceptos)
    if (planUpdates) {
      const finalUpdates: any = {};
      for (const [k, v] of Object.entries(planUpdates.updates)) {
        if (typeof v === 'string') {
          finalUpdates[k] = v.replace('{{FOLIO}}', String(newFolio));
        } else {
          finalUpdates[k] = v;
        }
      }

      const { error: planError } = await supabase
        .from('planes_pago')
        .update(finalUpdates)
        .eq('id', planUpdates.planId);
      
      if (planError) throw new Error(`Error actualizando el plan de pagos: ${planError.message}`);
    }

    return { error: null, folio: newFolio };
  } catch (err: any) {
    console.error('[saveReciboCompleto]', err.message);
    return { error: err.message || 'Error desconocido' };
  }
};

/** Cancelar un recibo y revertir el estatus del plan si aplica */
export const cancelarRecibo = async (reciboId: string): Promise<string | null> => {
   if (!isUUID(reciboId)) return null;
   try {
     // 1. Obtener el recibo y sus detalles
     const { data: recibo, error: rErr } = await supabase
       .from('recibos')
       .select('*, recibos_detalles(*)')
       .eq('id', reciboId)
       .single();
     if (rErr || !recibo) throw new Error(rErr?.message || 'Recibo no encontrado');

     // 2. Marcar como CANCELADO
     const { error: cancelErr } = await supabase
       .from('recibos')
       .update({ estatus: 'CANCELADO' })
       .eq('id', reciboId);
     if (cancelErr) throw new Error(cancelErr.message);

     // 3. Revertir conceptos del plan que fueron afectados
     const detallesConPlan = (recibo.recibos_detalles || []).filter(
       (d: any) => d.indice_concepto_plan != null
     );

     if (detallesConPlan.length > 0 && recibo.alumno_id && recibo.ciclo_id) {
       // Buscar el plan del alumno para ese ciclo
       const { data: planes } = await supabase
         .from('planes_pago')
         .select('id')
         .eq('alumno_id', recibo.alumno_id)
         .eq('ciclo_id', recibo.ciclo_id);

       if (planes && planes.length > 0) {
         const planId = planes[0].id;
         const updates: Record<string, string> = {};
         for (const det of detallesConPlan) {
           updates[`estatus_${det.indice_concepto_plan}`] = 'PENDIENTE';
         }
         const { error: planErr } = await supabase
           .from('planes_pago')
           .update(updates)
           .eq('id', planId);
         if (planErr) console.error('[cancelarRecibo] Error revirtiendo plan:', planErr.message);
       }
     }

     return null;
   } catch (err: any) {
     console.error('[cancelarRecibo]', err.message);
     return err.message || 'Error desconocido';
   }
};


