import type { CalendarioAcademico, EventoAcademico } from '../calendario/service';
import type { EntradaHorario, SesionHorario } from '../horarios/types';
export const DOCUMENTOS_BASE = ['PLANEACION', 'CRITERIOS', 'POLITICAS'] as const;
export const EXAMENES = ['P1', 'P2', 'P3', 'EXTRA'] as const;
export type ExamenDocencia = typeof EXAMENES[number];
export const ETIQUETAS_DOCUMENTO: Record<string, string> = { PLANEACION: 'Planeación', CRITERIOS: 'Criterios de evaluación', POLITICAS: 'Políticas de clase', P1: 'Primer parcial', P2: 'Segundo parcial', P3: 'Tercer parcial', EXTRA: 'Extraordinario' };
export interface EntregaAsignatura { asignatura_id: string; nombre_asignatura?: string; clave_asignatura?: string; plan_referencia?: string; examenes: ExamenDocencia[]; entregados: string[] }
export interface CorteDocente { inicio: string; fin: string }
export interface TarifaDocencia { monto: number | null; revision: number; cortes?: CorteDocente[] }
export interface CargaDocentePublicada {
  id: string; grupo_id: string | null; asignatura_id: string | null; docente_id: string; grupo_codigo: string; grupo_turno: string;
  asignatura_nombre: string; docente_nombre: string; horas_totales: number; horas_presenciales: number; horas_en_linea?: number; horas_asincronas: number; aula?: string; sede?: string;
  asignatura: { clave_legado: string | null; plan_id: string; planes_estudio: { nombre: string; clave_legado: string; modalidad: string; tipo_periodo: string; rvoe?: string; carreras: { nombre: string } | null } | null } | null;
}
export interface ContextoDocencia {
  ciclo: { id: string; nombre: string; tipo_periodo: string; fecha_inicio: string | null; fecha_termino: string | null };
  publicacion: { id: string; version: number } | null;
  cargas: CargaDocentePublicada[];
  sesiones: { carga_id: string; dia_semana: number; hora_inicio: number; hora_fin: number; medio?: string; aula?: string; sede?: string }[];
  calendarios: CalendarioAcademico[]; eventos: EventoAcademico[];
  expediente: { revision: number; carpeta_drive: string | null; entregas: EntregaAsignatura[] };
  financiero: { puede_editar: boolean; general: TarifaDocencia; excepcion: TarifaDocencia } | null;
  puede_editar_expediente: boolean;
}
export interface MateriaDocente { id: string; asignaturaId: string | null; nombre: string; clave: string; plan: string; grupos: string[] }
export interface PublicacionDocente { entrada: EntradaHorario; sesiones: SesionHorario[]; materias: MateriaDocente[] }
