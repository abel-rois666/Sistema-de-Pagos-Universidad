import { supabase } from '../lib/supabase';
import { consultarProgramasCSV, type FuenteProgramasCSV } from '../reportes/consultaProgramasCSV';
import type { ProgramaCSV } from '../reportes/detallesListadoCSV';

const fuente: FuenteProgramasCSV = {
  async programas({ ids, desde, cantidad, signal }) {
    const { data, error } = await supabase.from('alumno_programas')
      .select('id,alumno_id,plan_id,estatus,es_vigente,planes_estudio(nombre,clave_legado,tipo_periodo,modalidad,carreras:carrera_id(nombre))')
      .in('alumno_id', ids).order('alumno_id').order('id').range(desde, desde + cantidad - 1).abortSignal(signal);
    if (error) throw new Error('No se pudieron consultar los programas. Reintenta; no se descargará un detalle incompleto.');
    if (!data) throw new Error('El servidor no confirmó los programas.');
    return data as unknown as ProgramaCSV[];
  },
  async certificaciones({ ids, desde, cantidad, signal }) {
    // Reutiliza la lectura autorizada existente; nunca atribuye una ficha legada por nombre.
    const { data, error } = await supabase.rpc('certificacion_resumen_v1', { p_alumnos: ids, p_desde: desde, p_cantidad: cantidad }).abortSignal(signal);
    if (error) throw new Error(['PGRST202', '42883'].includes(error.code) ? 'El detalle por programa requiere la función de certificación por programa ya preparada. El listado por alumno y los planes de pagos siguen disponibles.' : 'No se pudo consultar el seguimiento completo. Reintenta la exportación.');
    if (!Array.isArray(data)) throw new Error('El servidor no confirmó el seguimiento de certificación.');
    return data;
  }
};
export const cargarProgramasExportacion = (ids: readonly string[], signal: AbortSignal) => consultarProgramasCSV(ids, fuente, signal);
