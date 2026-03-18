/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { PaymentPlan, Alumno, CicloEscolar } from '../types';

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

/** Upsert de un plan de pagos individual */
export const savePlan = async (plan: PaymentPlan): Promise<string | null> => {
  const { error } = await supabase.from('planes_pago').upsert(toDBPlan(plan));
  if (error) { console.error('[savePlan]', error.message); return error.message; }
  return null;
};

/** Upsert de un alumno */
export const saveAlumno = async (alumno: Alumno): Promise<string | null> => {
  const { error } = await supabase.from('alumnos').upsert({
    id: alumno.id,
    nombre_completo: alumno.nombre_completo,
    licenciatura: alumno.licenciatura,
    grado_actual: alumno.grado_actual,
    turno: alumno.turno,
    estatus: alumno.estatus,
    beca_porcentaje: alumno.beca_porcentaje,
  });
  if (error) { console.error('[saveAlumno]', error.message); return error.message; }
  return null;
};

/** Upsert completo del array de ciclos (usado al activar/desactivar) */
export const saveCiclos = async (ciclos: CicloEscolar[]): Promise<string | null> => {
  const { error } = await supabase.from('ciclos_escolares').upsert(
    ciclos.map(c => ({ id: c.id, nombre: c.nombre, meses_abarca: c.meses_abarca, anio: c.anio, activo: c.activo }))
  );
  if (error) { console.error('[saveCiclos]', error.message); return error.message; }
  return null;
};

/** Insert masivo de alumnos (importación CSV) */
export const bulkSaveAlumnos = async (alumnos: Alumno[]): Promise<string | null> => {
  if (!alumnos.length) return null;
  const { error } = await supabase.from('alumnos').insert(
    alumnos.map(a => ({ id: a.id, nombre_completo: a.nombre_completo, licenciatura: a.licenciatura, grado_actual: a.grado_actual, turno: a.turno }))
  );
  if (error) { console.error('[bulkSaveAlumnos]', error.message); return error.message; }
  return null;
};

/** Insert masivo de planes (importación CSV) */
export const bulkSavePlanes = async (planes: PaymentPlan[]): Promise<string | null> => {
  if (!planes.length) return null;
  const { error } = await supabase.from('planes_pago').insert(planes.map(toDBPlan));
  if (error) { console.error('[bulkSavePlanes]', error.message); return error.message; }
  return null;
};

/** Upsert de una plantilla de plan */
export const savePlantilla = async (plantilla: any): Promise<string | null> => {
  const { error } = await supabase.from('plantillas_plan').upsert(plantilla);
  if (error) { console.error('[savePlantilla]', error.message); return error.message; }
  return null;
};

/** Eliminar una plantilla de plan */
export const deletePlantilla = async (id: string): Promise<string | null> => {
  const { error } = await supabase.from('plantillas_plan').delete().eq('id', id);
  if (error) { console.error('[deletePlantilla]', error.message); return error.message; }
  return null;
};

/** Eliminar un alumno */
export const deleteAlumno = async (id: string): Promise<string | null> => {
  const { error } = await supabase.from('alumnos').delete().eq('id', id);
  if (error) { console.error('[deleteAlumno]', error.message); return error.message; }
  return null;
};

/** Upsert individual de ciclo escolar */
export const saveCiclo = async (ciclo: CicloEscolar): Promise<string | null> => {
  const { error } = await supabase.from('ciclos_escolares').upsert(
    { id: ciclo.id, nombre: ciclo.nombre, meses_abarca: ciclo.meses_abarca, anio: ciclo.anio, activo: ciclo.activo }
  );
  if (error) { console.error('[saveCiclo]', error.message); return error.message; }
  return null;
};

/** Eliminar un ciclo escolar */
export const deleteCiclo = async (id: string): Promise<string | null> => {
  const { error } = await supabase.from('ciclos_escolares').delete().eq('id', id);
  if (error) { console.error('[deleteCiclo]', error.message); return error.message; }
  return null;
};

/** Upsert de un item de catalogo */
export const saveCatalogoItem = async (item: any): Promise<string | null> => {
  const { error } = await supabase.from('catalogos').upsert(item);
  if (error) { console.error('[saveCatalogoItem]', error.message); return error.message; }
  return null;
};

/** Eliminar un item de catalogo */
export const deleteCatalogoItem = async (id: string): Promise<string | null> => {
  const { error } = await supabase.from('catalogos').delete().eq('id', id);
  if (error) { console.error('[deleteCatalogoItem]', error.message); return error.message; }
  return null;
};

