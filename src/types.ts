export interface CicloEscolar {
  id: string;
  nombre: string;
  meses_abarca: string;
  anio: number;
  anio_fin?: number | null;
  tipo_periodo?: string | null;
  fecha_inicio?: string;
  fecha_termino?: string;
  activo: boolean;
}

export interface Usuario {
  id: string;
  username: string;
  rol: 'ADMINISTRADOR' | 'COORDINADOR' | 'CAJERO' | 'DOCENTE';
  preferencia_tema?: string;
  ultimo_ciclo_id?: string;
  auth_id?: string | null;
  activo?: boolean | null;
  docente_id?: string | null;
}

export interface Alumno {
  id: string;
  // Campos normalizados (Opción B: conviven con nombre_completo)
  apellido_paterno: string;
  apellido_materno?: string | null;
  nombres: string;
  // Campo completo calculado en el frontend al guardar (UPPERCASE concatenado)
  nombre_completo: string;
  // Bandera de revisión post-migración
  nombre_requiere_revision?: boolean | null;
  // Sincronización
  sincronizado_el?: string | null;
  kardex_sincronizado?: boolean;
  kardex_sincronizado_at?: string | null;
  // Resto de campos
  licenciatura: string;
  grado_actual: string;
  turno: string;
  estatus?: string;
  beca_porcentaje?: string;
  beca_tipo?: string;
  observaciones_pago_titulacion?: string | null;
  ciclo_ultima_asignacion_grado?: string | null;
  saldo_a_favor?: number;

  // ── Datos Generales (nuevos campos Supabase) ────────────────────────
  // Identificador del sistema legado
  matricula?: string | null;

  // Dirección
  domicilio?: string | null;
  cp?: string | null;
  municipio?: string | null;
  estado?: string | null;

  // Identificación y origen
  curp?: string | null;
  fecha_nacimiento?: string | null;  // ISO: 'YYYY-MM-DD'
  estado_nacimiento?: string | null;
  nacionalidad?: string | null;
  escuela_procedencia?: string | null;
  estado_escolaridad?: string | null;

  // Contacto y género
  telefono?: string | null;
  celular?: string | null;
  email?: string | null;
  sexo?: 'H' | 'M' | null;
  id_sexo?: number | null;

  // Datos nuevos
  discapacidad?: string | null;
  lengua_indigena?: string | null;
}

export interface PaymentPlanDetalle {
  id: string;
  plan_id: string;
  indice_concepto: number;
  concepto: string;
  fecha_vencimiento: string | null; // ISO YYYY-MM-DD
  cantidad: number;
  estatus: string;
}

export interface PaymentPlan {
  id: string;
  alumno_id?: string;
  ciclo_id?: string;
  nombre_alumno: string;
  no_plan_pagos: string;
  fecha_plan: string;
  beca_porcentaje: string;
  beca_tipo: string;
  ciclo_escolar: string;

  concepto_1?: string;
  fecha_1?: string;
  cantidad_1?: number;
  estatus_1?: string;

  concepto_2?: string;
  fecha_2?: string;
  cantidad_2?: number;
  estatus_2?: string;

  concepto_3?: string;
  fecha_3?: string;
  cantidad_3?: number;
  estatus_3?: string;

  concepto_4?: string;
  fecha_4?: string;
  cantidad_4?: number;
  estatus_4?: string;

  concepto_5?: string;
  fecha_5?: string;
  cantidad_5?: number;
  estatus_5?: string;

  concepto_6?: string;
  fecha_6?: string;
  cantidad_6?: number;
  estatus_6?: string;

  concepto_7?: string;
  fecha_7?: string;
  cantidad_7?: number;
  estatus_7?: string;

  concepto_8?: string;
  fecha_8?: string;
  cantidad_8?: number;
  estatus_8?: string;

  concepto_9?: string;
  fecha_9?: string;
  cantidad_9?: number;
  estatus_9?: string;

  concepto_10?: string;
  fecha_10?: string;
  cantidad_10?: number;
  estatus_10?: string;

  concepto_11?: string;
  fecha_11?: string;
  cantidad_11?: number;
  estatus_11?: string;

  concepto_12?: string;
  fecha_12?: string;
  cantidad_12?: number;
  estatus_12?: string;

  concepto_13?: string;
  fecha_13?: string;
  cantidad_13?: number;
  estatus_13?: string;

  concepto_14?: string;
  fecha_14?: string;
  cantidad_14?: number;
  estatus_14?: string;

  concepto_15?: string;
  fecha_15?: string;
  cantidad_15?: number;
  estatus_15?: string;

  licenciatura: string;
  grado_turno: string;  // campo combinado (para display y compat. con vista)
  grado?: string;       // grado separado (columna planes_pago.grado)
  turno?: string;       // turno separado (columna planes_pago.turno)
  tipo_plan?: 'Cuatrimestral' | 'Semestral' | 'Titulación' | 'Especialidad Completa' | 'Especialidad Cuatrimestral';
  
  // Desglose Dinámico de Costos (Especialidades u otros)
  desglose_conceptos?: any; // JSONB Array de {cantidad, concepto, costo_unitario, costo_total}
  desglose_total_bruto?: number;
  desglose_descuento_porcentaje?: number;
  desglose_descuento_monto?: number;
  desglose_total_neto?: number;
  observaciones?: string[];
  detalles?: PaymentPlanDetalle[];
}

export interface ConstanciaParams {
  fontSize: number;         // px, cuerpo del texto (default 14)
  lineHeight: number;       // interlineado párrafos (default 2.2)
  marginH: number;          // padding horizontal cuerpo px (default 80)
  marginV: number;          // padding vertical cuerpo px (default 60)
  logoSize: number;         // tamaño del logo en px (default 72)
  watermarkOpacity: number; // opacidad marca de agua 0-1 (default 0.07)
  watermarkSize: number;    // tamaño marca de agua px (default 400)
  paperSize: 'carta' | 'oficio'; // carta=1056px, oficio=1346px
  headerFontSize: number;   // fuente nombre institución (default 22)
  showWatermark: boolean;   // mostrar/ocultar marca de agua
  headerInstName: string;   // Nombre de la institución
  headerAddress: string;    // Dirección
  headerRfc: string;        // RFC / CCT
  headerPhones: string;     // Teléfonos
  customLogoUrl: string;    // Logo específico para constancias
  logoObjectFit: 'contain' | 'cover' | 'fill'; // Tipo de recorte del logo
  logoBorderRadius: number; // Redondeo del logo (para recortes circulares)
}

export const DEFAULT_CONSTANCIA_PARAMS: ConstanciaParams = {
  fontSize: 14,
  lineHeight: 2.2,
  marginH: 80,
  marginV: 60,
  logoSize: 72,
  watermarkOpacity: 0.07,
  watermarkSize: 400,
  paperSize: 'carta',
  headerFontSize: 22,
  showWatermark: true,
  headerInstName: 'Centro Universitario Oriente de México',
  headerAddress: 'AV. JAVIER ROJO GÓMEZ No. 375, COL. AGRÍCOLA ORIENTAL, C.P. 08500, IZTACALCO, CIUDAD DE MÉXICO',
  headerRfc: 'R.F.C.: UTE010830L65  C.C.T.: 09PSU0509Q  CLAVE INSTITUCIÓN D.G.P.: 090552',
  headerPhones: 'TELÉFONOS: 5571558440 y 5571558423',
  customLogoUrl: '',
  logoObjectFit: 'contain',
  logoBorderRadius: 0,
};

export interface AppConfig {
  title: string;
  logoUrl: string;
  directorNombre: string;
  directorCargo: string;
  claveInstitucion?: string;
  claveDgair?: string;
  nombreEntidadUniversidad?: string;
  claveEntidadUniversidad?: string;
  claveEntidadFederativa?: string;
  constanciaParams: ConstanciaParams;
}

export type CatalogoTipo = 'concepto' | 'licenciatura' | 'beca_tipo' | 'beca_porcentaje' | 'grado' | 'turno' | 'estatus_alumno' | 'empresa_ss' | 'modalidad_titulacion';

export interface CatalogoItem {
  id: string;
  tipo: CatalogoTipo;
  valor: string;
  orden: number;
  activo: boolean;
  /** Solo para tipo='licenciatura': metadatos adicionales */
  metadata?: {
    tipo_academico?: 'LICENCIATURA' | 'ESPECIALIDAD';
    tipo_periodo?: 'CUATRIMESTRAL' | 'SEMESTRAL';
    rvoe?: string;
    rvoe_fecha?: string; // ISO: "2002-02-18"
  } | null;
}

export interface Catalogos {
  conceptos: string[];
  licenciaturas: string[];
  beca_tipos: string[];
  beca_porcentajes: string[];
  grados: string[];
  turnos: string[];
  estatus_alumnos: string[];
  empresas_ss: string[];
  modalidades_titulacion: string[];
  /** Mapa nombre-licenciatura -> metadata (tipo académico y periodo) */
  licenciaturasMetadata: Record<string, { tipo_academico?: string; tipo_periodo?: string }>;
}

export interface PlantillaPlan {
  id: string;
  nombre: string;
  ciclo_id: string | null;
  tipo_plan: 'Cuatrimestral' | 'Semestral' | 'Titulación' | 'Especialidad Completa' | 'Especialidad Cuatrimestral';
  descripcion?: string;
  activo: boolean;

  concepto_1?: string; fecha_1?: string; cantidad_1?: number;
  concepto_2?: string; fecha_2?: string; cantidad_2?: number;
  concepto_3?: string; fecha_3?: string; cantidad_3?: number;
  concepto_4?: string; fecha_4?: string; cantidad_4?: number;
  concepto_5?: string; fecha_5?: string; cantidad_5?: number;
  concepto_6?: string; fecha_6?: string; cantidad_6?: number;
  concepto_7?: string; fecha_7?: string; cantidad_7?: number;
  concepto_8?: string; fecha_8?: string; cantidad_8?: number;
  concepto_9?: string; fecha_9?: string; cantidad_9?: number;
  concepto_10?: string; fecha_10?: string; cantidad_10?: number;
  concepto_11?: string; fecha_11?: string; cantidad_11?: number;
  concepto_12?: string; fecha_12?: string; cantidad_12?: number;
  concepto_13?: string; fecha_13?: string; cantidad_13?: number;
  concepto_14?: string; fecha_14?: string; cantidad_14?: number;
  concepto_15?: string; fecha_15?: string; cantidad_15?: number;
  concepto_16?: string; fecha_16?: string; cantidad_16?: number;
  concepto_17?: string; fecha_17?: string; cantidad_17?: number;
  concepto_18?: string; fecha_18?: string; cantidad_18?: number;
}

export interface Recibo {
  id: string;
  folio?: number;
  fecha_recibo: string;
  fecha_pago: string;
  alumno_id: string;
  ciclo_id: string;
  total: number;
  forma_pago: string;
  banco: string;
  estatus: 'ACTIVO' | 'CANCELADO';
  created_at?: string;
  uso_saldo_a_favor?: number;
  requiere_factura?: boolean;
  estatus_factura?: string;
  folio_fiscal?: string | null;

  // Campos unidos (opcionales para vistas/historial)
  nombre_alumno?: string;
  licenciatura?: string;
  grado_turno?: string;
  ciclo_escolar?: string;
}

export interface ReciboDetalle {
  id: string;
  recibo_id: string;
  cantidad: number;
  concepto: string;
  costo_unitario: number;
  subtotal: number;
  indice_concepto_plan?: number | null;
  observaciones?: string | null; // Nota de abono/restante para pagos parciales
}

// ──────────────────────────────────────────────────────────────────────
// FICHA DE TITULACIÓN
// ──────────────────────────────────────────────────────────────────────
export type EstatusTresOpciones = 'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO';
export type EstatusDocumental   = 'SIN_INICIAR' | 'APROBADO' | 'RECHAZADO';

export interface FichaTitulacion {
  id: string;
  alumno_id: string;
  modalidad: string | null;

  pago_titulacion:      'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO';
  certificado_estudios: 'SIN_INICIAR' | 'EN_TRAMITE' | 'TRAMITADO';
  ingles:               'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO';
  servicio_social_req:  'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO';
  fotografias:          'PENDIENTES' | 'ENTREGADAS';
  promedio_alto_rendimiento?: 'SIN_INICIAR' | 'NO_APLICA' | 'APLICA' | null;

  doc_antecedente:             EstatusDocumental;
  doc_antecedente_nota:        string | null;
  doc_acta_nacimiento:         EstatusDocumental;
  doc_acta_nacimiento_nota:    string | null;
  doc_curp:                    EstatusDocumental;
  doc_curp_nota:               string | null;

  doc_titulo_profesional:      EstatusDocumental;
  doc_titulo_profesional_nota: string | null;
  doc_cedula_profesional:      EstatusDocumental;
  doc_cedula_profesional_nota: string | null;

  // Inicio de trámite
  fecha_inicio_tramite?:         string | null;
  fecha_estimada_culminacion?:   string | null;
  tramite_completado?:           boolean;
  fecha_completado?:             string | null;
  enlace_drive?:                 string | null;

  created_at?: string;
  updated_at?: string;
}

// ──────────────────────────────────────────────────────────────────────
// SERVICIO SOCIAL
// ──────────────────────────────────────────────────────────────────────
// FICHA DE CERTIFICACIÓN
// ──────────────────────────────────────────────────────────────────────
export interface FichaCertificacion {
  id: string;
  alumno_id: string;

  pago_certificado:            'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO';

  doc_acta_nacimiento:         EstatusDocumental;
  doc_acta_nacimiento_nota:    string | null;
  doc_curp:                    EstatusDocumental;
  doc_curp_nota:               string | null;
  doc_antecedente:             EstatusDocumental;
  doc_antecedente_nota:        string | null;

  // Solo Especialidad
  doc_titulo_profesional:      EstatusDocumental;
  doc_titulo_profesional_nota: string | null;
  doc_cedula_profesional:      EstatusDocumental;
  doc_cedula_profesional_nota: string | null;

  tipo_certificado:            'TOTAL' | 'PARCIAL' | null;

  fecha_inicio_tramite?:       string | null;
  fecha_termino_tramite?:      string | null;
  tramite_completado?:         boolean;
  fecha_completado?:           string | null;
  enlace_drive?:               string | null;

  created_at?: string;
  updated_at?: string;
}

// ──────────────────────────────────────────────────────────────────────
export type VarianteSS = 'ART_55' | 'ART_52' | 'ART_91';

export interface ServicioSocial {
  id: string;
  alumno_id: string;
  nombre_empresa: string;
  tipo_empresa: 'PRIVADA' | 'PUBLICA';
  fecha_registro: string;
  fecha_inicio: string;
  fecha_termino: string;
  horas_cubrir: number;
  estatus: 'EN_CURSO' | 'LIBERADO';
  nombre_programa?: string | null;

  // Variante legal
  variante_legal?: VarianteSS;

  // ART. 52 — Exención por condición personal
  art52_motivo?: 'EDAD' | 'ENFERMEDAD' | null;
  art52_doc_acta?: 'PENDIENTE' | 'ENTREGADO';
  art52_doc_expediente?: 'PENDIENTE' | 'ENTREGADO';

  // ART. 91 — Experiencia laboral
  art91_req_constancia?: boolean;
  art91_req_comprobantes?: boolean;
  art91_req_informe?: boolean;

  created_at?: string;
  updated_at?: string;
}

// ──────────────────────────────────────────────────────────────────────
// PLAN DE ESTUDIOS Y ASIGNATURAS (ACADÉMICO)
// ──────────────────────────────────────────────────────────────────────

export interface Carrera {
  id: string;
  nombre: string;
  clave?: string;
  rvoe?: string;
  fecha_rvoe?: string;
  nivel_educativo?: string;
  calificacion_minima_aprobatoria?: number;
  calificacion_minima?: number;
  calificacion_maxima?: number;
  activo: boolean;
  created_at?: string;
}

export interface PlanEstudio {
  id: string;
  licenciatura_id: string; // UUID referenciando a catalogos.id
  carrera_id?: string;
  rvoe?: string;
  fecha_rvoe?: string;
  carrera?: Carrera; // Para joins
  clave_legado: string;
  nombre: string;
  estatus: string;
  creditos_obligatorios?: number;
  tipo_periodo?: string;
  id_tipo_periodo?: number;
  id_plan_certificacion?: number;
  id_autorizacion_reconocimiento?: number; // Nuevo
  autorizacion_reconocimiento?: string; // Nuevo
  modelo?: string;
  created_at: string;
}

export interface Asignatura {
  id: string;
  plan_id: string; // UUID referenciando a planes_estudio.id
  clave_legado: string;
  nombre: string;
  creditos: number;
  etapa_clave: string;
  etapa_nombre: string;
  clasificacion_nombre?: string;
  clasificacion_clave?: string;
  numero_periodo?: number;
  activo?: boolean;
  created_at: string;
}

export interface InscripcionAcademica {
  id?: string;
  alumno_id: string;
  ciclo_id?: string | null;
  ciclo_legado?: string | null;
  asignatura_id: string;
  parcial_1?: number | null;
  parcial_2?: number | null;
  parcial_3?: number | null;
  promedio_calculado?: number | null;
  calificacion_final?: number | null;
  modificada_manualmente?: boolean;
  observaciones?: string | null;

  bloqueo_p1?: boolean;
  bloqueo_p2?: boolean;
  bloqueo_p3?: boolean;
  bloqueo_final?: boolean;
  solicitud_p1?: boolean;
  solicitud_p2?: boolean;
  solicitud_p3?: boolean;
  solicitud_final?: boolean;

  tipo_evaluacion: string;
  estatus: string;
  created_at?: string;
  asignaturas?: {
    nombre: string;
    clave_legado: string;
    creditos: number;
    clasificacion_clave?: string | null;
    clasificacion_nombre?: string | null;
    planes_estudio?: {
      nombre: string;
      clave_legado: string;
      creditos_obligatorios?: number;
      modelo?: string;
      tipo_periodo?: string;
    };
  };
}

export interface Docente {
  id: string;
  clave_legado: string;
  nombre_completo: string;
  rfc: string;
  curp: string;
  email: string;
  estatus: string;
  usuarios?: { id: string }[];
}

export interface Grupo {
  id: string;
  ciclo_id: string;
  plan_id: string;
  codigo_grupo: string;
  grado: string;
  turno: string;
  estatus: string;
  ciclo?: { nombre: string; tipo_periodo?: string };
  plan?: { nombre: string };
}

export interface DocenteGrupoAsignatura {
  id: string;
  docente_id: string;
  grupo_id: string;
  asignatura_id: string;
  docentes?: Docente;
  grupos?: Grupo;
  asignaturas?: Asignatura;
}

export interface AlumnoGrupo {
  id: string;
  alumno_id: string;
  grupo_id: string;
  asignatura_id: string;
  alumnos?: Alumno;
  grupos?: Grupo;
  asignaturas?: Asignatura;
}

// ── Modulo de Recursos Humanos (NOM-035) ──────────────────────────

export interface Empleado {
  id: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string;
  fecha_nacimiento?: string;
  sexo?: string;
  estado_civil?: string;
  nivel_estudios?: string;
  nivel_estudios_estado?: string;
  direccion?: string;
  telefono?: string;
  fecha_ingreso?: string;
  documentos_entregados?: Record<string, boolean>;
  enlace_drive?: string | null;
  rfc?: string;
  curp?: string;
  clave_puesto?: number;
  puesto?: string;
  departamento?: string;
  tipo_contratacion?: string;
  tipo_jornada?: string;
  estatus: string;
  firmante_certificados?: boolean;
  firmante_titulos?: boolean;
  titulo_academico?: string;
  created_at?: string;
}

export interface Nom035Evaluacion {
  id: string;
  empleado_id: string;
  tipo_guia?: string;
  respuestas: Record<string, any>;
  calificacion_final: number;
  calificacion_desglose?: any;
  nivel_riesgo: string;
  created_at?: string;
}

export interface Nom035PlanAccion {
  id: string;
  titulo: string;
  descripcion?: string;
  nivel_intervencion: string;
  estatus: string;
  created_at?: string;
}

