import { supabase } from '../lib/supabase';
import { errorOperacionAcademica } from './operacionesAcademicasService';
import type { InscripcionAcademica } from '../types';

/** Guarda el lote completo; jamás intenta DELETE y UPSERT separados como respaldo. */
export async function guardarCalificacionesLote(filas: Partial<InscripcionAcademica>[], limpiar: string[], originales: Record<string, Partial<InscripcionAcademica>>) {
  const { data, error } = await supabase.rpc('guardar_calificaciones_lote_v1', {
    p_filas: filas,
    p_limpiar: limpiar,
    p_originales: Object.values(originales).filter(fila => Boolean(fila.id)),
  });
  if (error) throw errorOperacionAcademica(error);
  if (data !== filas.length + limpiar.length) throw new Error('La confirmación del lote está incompleta. Actualiza antes de reintentar.');
}
