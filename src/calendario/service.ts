import { supabase } from '../lib/supabase';
import type { ModalidadCalendario, TurnoCalendario } from './calculos';

export interface CalendarioAcademico {
  id: string;
  ciclo_id: string;
  nombre: string;
  tipo_periodo: string;
  modalidad: ModalidadCalendario;
  fecha_inicio: string;
  fecha_fin: string;
  turnos: TurnoCalendario[];
  plan_ids: string[];
}

export interface EventoAcademico {
  id: string;
  calendario_id: string;
  nombre: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  color: string;
  suspende_clases: boolean;
}

export type EventoAcademicoFormulario = Omit<EventoAcademico, 'id' | 'calendario_id'> & { id?: string };

export async function listarCalendarios(cicloId: string): Promise<CalendarioAcademico[]> {
  const { data, error } = await supabase.from('calendarios_academicos').select('*, calendarios_planes(plan_id)')
    .eq('ciclo_id', cicloId).order('nombre');
  if (error) throw new Error(error.message);
  return (data || []).map((fila: any) => ({ ...fila,
    plan_ids: (fila.calendarios_planes || []).map((asociacion: { plan_id: string }) => asociacion.plan_id),
  }));
}

export async function listarEventos(calendarioId: string): Promise<EventoAcademico[]> {
  const { data, error } = await supabase.from('calendario_eventos').select('*')
    .eq('calendario_id', calendarioId).order('fecha_inicio');
  if (error) throw new Error(error.message);
  return data || [];
}

/** La función RPC guarda calendario y planes en una sola transacción. */
export async function guardarCalendario(calendario: Omit<CalendarioAcademico, 'id'> & { id?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('guardar_calendario_academico', {
    p_id: calendario.id || null,
    p_ciclo_id: calendario.ciclo_id,
    p_nombre: calendario.nombre.trim(),
    p_tipo_periodo: calendario.tipo_periodo,
    p_modalidad: calendario.modalidad,
    p_fecha_inicio: calendario.fecha_inicio,
    p_fecha_fin: calendario.fecha_fin,
    p_turnos: calendario.turnos,
    p_plan_ids: calendario.plan_ids,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function guardarEvento(evento: Omit<EventoAcademico, 'id'> & { id?: string }): Promise<void> {
  const { error } = await supabase.from('calendario_eventos').upsert({
    id: evento.id || crypto.randomUUID(), calendario_id: evento.calendario_id,
    nombre: evento.nombre.trim(), tipo: evento.tipo, fecha_inicio: evento.fecha_inicio,
    fecha_fin: evento.fecha_fin, color: evento.color, suspende_clases: evento.suspende_clases,
  });
  if (error) throw new Error(error.message);
}

export async function eliminarEvento(id: string): Promise<void> {
  const { error } = await supabase.from('calendario_eventos').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
