import { fetchAllSupabase, supabase } from '../lib/supabase';
import type { Docente, Empleado } from '../types';

export type DocenteDirectorio = Omit<Docente, 'usuarios'> & {
  usuarios?: { id: string; activo?: boolean | null; auth_id?: string | null }[];
};

/** No consulta contraseñas ni concede permisos nuevos. La RLS sigue decidiendo el acceso. */
export async function consultarDocentesDirectorio(verCuentas: boolean): Promise<DocenteDirectorio[]> {
  const { data, error } = await fetchAllSupabase(() => supabase.from('docentes')
    .select(verCuentas ? '*, usuarios(id,activo,auth_id)' : '*').order('nombre_completo').order('id'));
  if (error) throw error;
  return data || [];
}

export async function consultarEmpleadosDirectorio(): Promise<Empleado[]> {
  const { data, error } = await fetchAllSupabase(() => supabase.from('empleados').select('*').order('apellido_paterno').order('id'));
  if (error) throw error;
  return data || [];
}

/** Solo identifica vínculos explícitos por persona_id; fallo o esquema anterior = desconocido. */
export async function consultarPersonasVinculadas(tabla: 'empleados' | 'docentes'): Promise<Set<string> | null> {
  try {
    const { data, error } = await fetchAllSupabase(() => supabase.from(tabla).select('id,persona_id').not('persona_id', 'is', null).order('id'));
    if (error) return null;
    return new Set((data || []).map(f => f.persona_id).filter(Boolean));
  } catch { return null; }
}
