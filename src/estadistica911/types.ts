export const CUESTIONARIOS = ['carrera', 'posgrado', 'escuela', 'institucion', 'infraestructura', 'tecnologia'] as const;
export type Cuestionario911 = typeof CUESTIONARIOS[number];
export type Valor911 = string | number | null;
export type Estado911 = 'BORRADOR' | 'EN_REVISION' | 'CERRADO';
export interface Campo911 {
  codigo: string;
  descripcion: string;
  tipo: string;
  fase: string;
  orden: number;
}
export interface Regla911 {
  cuestionario: Cuestionario911;
  variable: string;
  expresion: string;
  mensaje: string;
  tipo: string;
  linea: number;
  seccion: string;
  pregunta: string;
}
export interface Posicion911 {
  codigo: string;
  pagina: number;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  tamano: number;
  caracter?: number;
}
export interface Fuente911 {
  campos: Campo911[];
  layout: {
    encabezado: string[];
    identidades: Record<string, string>[];
    sha256: string;
    archivo: string;
  } | null;
  mapa: {
    sha256: string;
    posiciones: Posicion911[];
    identificacion?: Posicion911[];
    paginas: number;
    sinPosicion: string[];
  };
}
export interface Respuesta911 {
  calculado: Valor911;
  declarado?: Valor911;
  justificacion?: string;
  evidencia?: string;
  origen: string;
  poblacion?: string;
  revisada?: boolean;
}
export interface Correspondencia911 {
  aplica?: 'APLICA' | 'NO_APLICA';
  motivoNoAplica?: string;
  evidenciaNoAplica?: string;
  planes: string[];
  confirmada: boolean;
  duracionAnios?: number;
  periodosPorAnio?: number;
  modalidad?: string;
  nivel?: string;
  nombre?: string;
}
export interface Instancia911 {
  id: string;
  cuestionario: Cuestionario911;
  identidad: Record<string, string>;
  respuestas: Record<string, Respuesta911>;
  correspondencia: Correspondencia911;
  bloques: Record<string, Record<string, Valor911>[]>;
}
export interface Config911 {
  guiaVersion?: string;
  ofertaConfirmada?: boolean;
  domicilioPlantel?: { municipio: string; localidad: string; vialidad: string; exterior: string; evidencia: string };
  edicion: string;
  plantel: string;
  institucion: string;
  corte: string;
  cortePersonalizado?: boolean;
  motivoCorte?: string;
  actualInicio: string;
  edadReferencia: string;
  anteriorInicio: string;
  anteriorFin: string;
  fiscal: number;
  ciclosMatricula: string[];
  ciclosAnteriores: string[];
  responsable: string;
  cargo: string;
  controlConfirmado: boolean;
  coberturas?: Record<string, string>;
  nombreInstitucion?: string;
  nombrePlantel?: string;
  fechaLlenado?: string;
}
export interface Expediente911 {
  id: string;
  nombre: string;
  estado: Estado911;
  revision: number;
  version: number;
  config: Config911;
  instancias: Instancia911[];
  incidencias: string[];
  revisiones: Record<string, string>;
  excepciones?: Record<string, {
    justificacion: string;
    evidencia: string;
  }>;
  catalogoHash: string;
  corteCalculado?: string;
  creado_en?: string;
}
export interface Persona911 {
  ingreso_procedencia?: { origen: string; ciclo_id?: string; ciclo?: string; fecha?: string; confirmada?: boolean };
  id: string;
  alumno_id: string;
  programa_id: string;
  plan_id: string;
  ciclo_id: string;
  matricula: string;
  nombre: string;
  programa: string;
  modalidad: string;
  tipo_ingreso: 'PRIMER_INGRESO' | 'REINGRESO' | 'DESCONOCIDO';
  grado: string;
  sexo: string;
  nacimiento: string | null;
  desde: string;
  hasta: string | null;
  situacion: string;
  confirmado: boolean;
  evidencia: string;
  discapacidad?: boolean | null;
  indigena?: boolean | null;
  entidad_residencia?: string;
  entidad_nacimiento?: string;
  pais_nacimiento?: string;
  fecha_primer_ingreso?: string;
  evento?: 'EGRESO' | 'TITULACION';
  fecha_evento?: string;
  avance?: number;
  edad?: number | null;
  motivo?: string;
  variables?: string[];
  caracteristicas?: {
    desde: string;
    hasta: string | null;
    datos: Record<string, unknown>;
  }[];
}
export interface Respaldo911 {
  instancia: string;
  variable: string;
  poblacion: string;
  incluidos: Persona911[];
  excluidos: {
    id: string;
    motivo: string;
  }[];
  completa: boolean;
  incidencias: string[];
}
export interface Resultado911 {
  instancias: Instancia911[];
  respaldos: Respaldo911[];
  incidencias: string[];
}
export const valorRespuesta = (r?: Respuesta911): Valor911 => r?.declarado !== undefined ? r.declarado : r?.calculado ?? null;
export const ROLES911 = ['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR', 'COORDINADOR ACADEMICO', 'COORDINADOR RECURSOS HUMANOS', 'COORDINADOR FINANCIERO'];
export const CONFIG_INICIAL911: Config911 = {
  edicion: '2026-2027',
  plantel: '09PSU0509Q',
  institucion: '09MSU0509T',
  corte: '2026-09-30',
  actualInicio: '',
  edadReferencia: '',
  anteriorInicio: '',
  anteriorFin: '',
  fiscal: 2025,
  ciclosMatricula: [],
  ciclosAnteriores: [],
  responsable: '',
  cargo: '',
  controlConfirmado: false
};
