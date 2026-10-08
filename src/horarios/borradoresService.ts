import { supabase } from '../lib/supabase';
import type { ContenidoBorradorHorario } from './borradores';

export interface BorradorHorarioGuardado {
  id: string;
  ciclo_id: string;
  nombre: string;
  contenido: ContenidoBorradorHorario;
  creado_por: string | null;
  creado_en: string;
  actualizado_en: string;
}

export async function listarBorradoresHorario(cicloId: string): Promise<BorradorHorarioGuardado[]> {
  const { data, error } = await supabase.from('horarios_borradores')
    .select('id,ciclo_id,nombre,contenido,creado_por,creado_en,actualizado_en')
    .eq('ciclo_id', cicloId).order('actualizado_en', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as BorradorHorarioGuardado[];
}

export async function guardarBorradorHorario(cicloId: string, nombre: string,
  contenido: ContenidoBorradorHorario, id?: string, versionAnterior?: string): Promise<BorradorHorarioGuardado> {
  const limpio = nombre.trim();
  if (!limpio || limpio.length > 100) throw new Error('El nombre debe tener entre 1 y 100 caracteres.');
  const consulta = id
    ? supabase.from('horarios_borradores').update({ nombre: limpio, contenido,
      actualizado_en: new Date().toISOString() }).eq('id', id).eq('ciclo_id', cicloId)
      .eq('actualizado_en', versionAnterior || '')
    : supabase.from('horarios_borradores').insert({ ciclo_id: cicloId, nombre: limpio, contenido });
  const { data, error } = await consulta.select('id,ciclo_id,nombre,contenido,creado_por,creado_en,actualizado_en').single();
  if (error) throw new Error(error.code === 'PGRST116' && id
    ? 'Otra persona actualizó o eliminó este borrador. Actualiza la lista antes de sobrescribirlo.' : error.message);
  return data as BorradorHorarioGuardado;
}

export async function eliminarBorradorHorario(cicloId: string, id: string): Promise<void> {
  const { error } = await supabase.from('horarios_borradores').delete().eq('id', id).eq('ciclo_id', cicloId);
  if (error) throw new Error(error.message);
}
