export const ROLES_INSCRIPCIONES = ['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR'] as const;
export type EstadoInscripcion = 'CONFIRMADA' | 'BAJA' | 'CANCELADA';
export type TipoIngreso = 'PRIMER_INGRESO' | 'REINGRESO' | 'DESCONOCIDO';
export interface ReferenciaHistorialInscripcion {
  huella:string; aplicar_ingreso:boolean; aplicar_grado:boolean;
  ciclo_ingreso_id:string|null; fecha_ingreso_propuesta:string|null; grado_propuesto:string|null;
  aplicar_desde?:boolean; ciclo_desde_id?:string|null; fecha_desde_propuesta?:string|null;
  metodo_desde?:'HISTORIAL_MAS_ANTIGUO';
  aplicar_origen?:boolean; ciclo_origen_propuesto_id?:string|null;
}
export interface ContextoInscripcion {
  inscripcion_id:string;revision:number;ciclo_origen_id:string|null;contexto:Record<string,unknown>;
}
export interface InscripcionCiclo {
  id: string; alumno_programa_id: string; ciclo_id: string; revision: number;
  estado: EstadoInscripcion; desde: string; hasta: string | null; grado_personal: string;
  tipo_ingreso: TipoIngreso; fecha_primer_ingreso: string | null; evidencia: string;
  motivo: string; procedencia: string; actualizado_en: string;
}
export interface CandidatoInscripcion {
  alumno_programa_id: string; alumno_id: string; matricula: string; nombre: string;
  plan_id: string; programa: string; tipo_periodo: string; modalidad: string;
  grado_sugerido: string; total_periodos: number | null; estatus_programa: string;
  historico: boolean; compatible: boolean; grupos: string[]; fuentes: string[];
  inscripcion: InscripcionCiclo | null;
  contexto_actual?:ContextoInscripcion;
  ingreso_programa?:{fecha:string|null;calidad:string;ciclo_id:string|null};
}
export interface CapturaInscripcion {
  estado: EstadoInscripcion; desde: string; hasta: string; grado_personal: string;
  tipo_ingreso: TipoIngreso; fecha_primer_ingreso: string; evidencia: string; motivo: string;
  admitir_historico: boolean;
  ciclo_origen_id?:string;
  referencia?:ReferenciaHistorialInscripcion;
}
export interface PreparacionInscripcion {
  id:string;alumno_programa_id:string;plan_id:string;ciclo_id:string;ciclo_origen_id:string|null;
  estado:'PENDIENTE'|'CONFIRMADA'|'CANCELADA';revision:number;datos:CapturaInscripcion;
  referencia:ReferenciaHistorialInscripcion|null;contexto:Record<string,unknown>;
  inscripcion_esperada_id:string|null;inscripcion_esperada_revision:number;
  inscripcion_confirmada_id:string|null;actualizado_en:string;
}
export type SituacionInscripcion = 'CON_GRUPO'|'SIN_GRUPO'|'PENDIENTE'|'BAJA'|'CANCELADA'|'FUERA_FECHA';
export const ETIQUETAS_INSCRIPCION: Record<SituacionInscripcion,string> = {
  CON_GRUPO:'Inscrito con grupo', SIN_GRUPO:'Inscrito sin grupo', PENDIENTE:'Inscripción pendiente',
  BAJA:'Baja de la inscripción', CANCELADA:'Inscripción cancelada', FUERA_FECHA:'Fuera de la fecha consultada',
};
