import { supabase } from '../lib/supabase';
import { consultarDatosEgresados, type FuenteReporteEgresados } from '../reportes/consultaEgresados';
import { certificacionService } from './certificacionService';

const fuente: FuenteReporteEgresados = {
  async inscripciones({ ids, desde, cantidad, signal }) {
    const { data, error } = await supabase.from('inscripciones_academicas')
      .select('alumno_id,ciclo_id,ciclo_legado').in('alumno_id', ids)
      .order('alumno_id').order('id').range(desde, desde + cantidad - 1).abortSignal(signal);
    if (error) throw error;
    if (!data) throw new Error('El servidor no confirmó la consulta del historial.');
    return data;
  },
  async certificaciones({ ids, desde, cantidad, signal }) {
    return certificacionService.resumen(ids,desde,cantidad,signal);
  }
};

export const cargarReporteEgresados = (ids: string[], ciclos: { id: string; nombre: string }[], signal: AbortSignal, progreso: (porcentaje: number) => void) => consultarDatosEgresados(fuente, ids, ciclos, { signal, progreso });
export const cargarCertificacionesReporte = (ids: string[], signal: AbortSignal) => consultarDatosEgresados({ inscripciones: async () => [], certificaciones: fuente.certificaciones }, ids, [], { signal });
