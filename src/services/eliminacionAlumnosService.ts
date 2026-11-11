import { supabase } from '../lib/supabase';
import { resolverEliminacionAlumnos, type ReciboBloqueanteAlumno } from '../utils/eliminacionAlumnos';

export function eliminarAlumnosConDiagnostico(ids: readonly string[]) {
  return resolverEliminacionAlumnos(ids, {
    eliminar: async seleccion => {
      const { data, error } = await supabase.from('alumnos').delete().in('id', seleccion).select('id');
      return { ids: (data || []).map(fila => fila.id as string), error };
    },
    consultarRecibos: async seleccion => {
      // Vista previa acotada; no descarga importes, datos fiscales ni detalles personales.
      const { data, error } = await supabase.from('recibos').select('id,alumno_id,folio,estatus')
        .in('alumno_id', seleccion).order('folio', { ascending: false }).limit(51);
      if (error) throw error;
      return { recibos: (data || []).slice(0, 50) as ReciboBloqueanteAlumno[], mas: (data?.length || 0) > 50 };
    },
  });
}
