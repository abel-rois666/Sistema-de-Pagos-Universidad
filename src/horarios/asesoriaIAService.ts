import { supabase } from '../lib/supabase';
import type { SolicitudAsesoriaHorario, SugerenciaAsesoriaHorario } from './asesoriaIA';

export async function solicitarAsesoriaHorario(solicitud: SolicitudAsesoriaHorario,
  signal?: AbortSignal): Promise<SugerenciaAsesoriaHorario[]> {
  const { data, error } = await supabase.functions.invoke('asesorar-horario', {
    body: solicitud, signal, timeout: 25000,
  });
  if (error) {
    const estado = (error as { context?: { status?: number } }).context?.status;
    if (estado === 404) throw new Error('Falta desplegar la función «asesorar-horario» en Supabase.');
    if (estado === 401 || estado === 403) throw new Error('Tu sesión no permite consultar la asesoría de horarios.');
    if (estado === 429) throw new Error('Se alcanzó el límite temporal de Groq. Intenta más tarde.');
    if (signal?.aborted) throw new Error('ASESORIA_CANCELADA');
    throw new Error('La asesoría de IA no está disponible ahora. El generador sigue funcionando sin ella.');
  }
  const permitidas = new Set(solicitud.acciones);
  if (!data || !Array.isArray(data.propuestas)) throw new Error('La asesoría devolvió un formato no válido.');
  const vistas = new Set<string>();
  return data.propuestas.filter((propuesta: unknown): propuesta is SugerenciaAsesoriaHorario => {
    if (!propuesta || typeof propuesta !== 'object') return false;
    const dato = propuesta as Record<string, unknown>;
    if (typeof dato.accionId !== 'string' || !permitidas.has(dato.accionId)
      || vistas.has(dato.accionId) || typeof dato.motivo !== 'string'
      || typeof dato.efectoEsperado !== 'string') return false;
    vistas.add(dato.accionId);
    return true;
  }).slice(0, 3).map(propuesta => ({
    accionId: propuesta.accionId,
    motivo: propuesta.motivo.slice(0, 280),
    efectoEsperado: propuesta.efectoEsperado.slice(0, 280),
  }));
}
