import { supabase } from '../lib/supabase';
import type { AlumnoPrograma, FichaCertificacion } from '../types';
import type { ResumenCertificacion } from '../certificacion/seguimiento';

const faltaRPC = (e: { code?: string }) => e.code === 'PGRST202' || e.code === '42883';
export interface ConsultaCertificacion { fichas: FichaCertificacion[]; programas: AlumnoPrograma[]; disponible: boolean }
export const certificacionService = {
  async consultar(alumnoId: string, signal?: AbortSignal): Promise<ConsultaCertificacion> {
    let peticion = supabase.rpc('certificacion_consultar_v1', { p_alumno_id: alumnoId });
    if (signal) peticion = peticion.abortSignal(signal);
    const { data, error } = await peticion;
    if (!error) { if (!data) throw new Error('El servidor no confirmó la consulta de certificación.'); return { ...data, disponible: true }; }
    if (!faltaRPC(error)) throw error;
    // Compatibilidad de lectura: nunca escribir mediante un contrato antiguo ni atribuir la ficha a un programa.
    let fichas = supabase.from('ficha_certificacion').select('*').eq('alumno_id', alumnoId).order('id');
    let programas = supabase.from('alumno_programas').select('*, planes_estudio(*, carreras:carrera_id(*))').eq('alumno_id', alumnoId).order('id');
    if (signal) { fichas = fichas.abortSignal(signal); programas = programas.abortSignal(signal); }
    const [f,p] = await Promise.all([fichas,programas]);
    if (f.error) throw f.error; if (p.error) throw p.error;
    return { fichas: (f.data || []).filter(f => !f.archivado_en), programas: p.data || [], disponible: false };
  },
  async resumen(ids: string[], desde: number, cantidad: number, signal: AbortSignal): Promise<ResumenCertificacion[]> {
    const { data, error } = await supabase.rpc('certificacion_resumen_v1', { p_alumnos: ids, p_desde: desde, p_cantidad: cantidad }).abortSignal(signal);
    if (!error) { if (!data) throw new Error('El servidor no confirmó el seguimiento de certificación.'); return data; }
    if (!faltaRPC(error)) throw error;
    const legado = await supabase.from('ficha_certificacion').select('id,alumno_id,pago_certificado,tramite_completado,fecha_inicio_tramite')
      .in('alumno_id',ids).order('alumno_id').order('id').range(desde,desde+cantidad-1).abortSignal(signal);
    if (legado.error) throw legado.error;
    return legado.data || [];
  },
  async guardar(ficha: FichaCertificacion, motivo = ''): Promise<FichaCertificacion> {
    const { id, alumno_id, alumno_programa_id, revision, created_at, updated_at, archivado_en, ...datos } = ficha;
    const { data,error } = await supabase.rpc('certificacion_guardar_v1', { p_id: id, p_alumno_id: alumno_id, p_programa_id: alumno_programa_id, p_revision: revision ?? 0, p_datos: datos, p_motivo: motivo });
    if (error) throw new Error(faltaRPC(error) ? 'Instala la migración de certificación por programa para guardar. La captura se conserva.' : error.message);
    if (!data) throw new Error('El servidor no confirmó el guardado. Revisa el registro antes de reintentar.');
    return data;
  },
  async archivar(ficha: FichaCertificacion, motivo: string) {
    const { error } = await supabase.rpc('certificacion_archivar_v1', { p_id: ficha.id, p_revision: ficha.revision ?? 0, p_motivo: motivo });
    if (error) throw error;
  }
};
