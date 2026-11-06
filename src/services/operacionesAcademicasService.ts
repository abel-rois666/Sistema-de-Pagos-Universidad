import { supabase } from '../lib/supabase';

export function errorOperacionAcademica(error: { code?: string; message: string }): Error {
  return new Error(['PGRST202', '42883'].includes(error.code || '')
    ? 'Esta operación requiere instalar la migración de operaciones académicas atómicas. No se modificó ningún registro.'
    : error.message);
}

export async function eliminarGruposAtomico(ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const { data, error } = await supabase.rpc('eliminar_grupos_lote_v1', { p_ids: [...new Set(ids)] });
  if (error) throw errorOperacionAcademica(error);
  if (data !== new Set(ids).size) throw new Error('El servidor no confirmó la eliminación de todos los grupos. Actualiza la consulta antes de reintentar.');
}
