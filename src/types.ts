export interface CicloEscolar {
  id: string;
  nombre: string;
  meses_abarca: string;
  anio: number;
  anio_fin?: number | null;  // Año de fin (para ciclos que abarcan 2 años)
  activo: boolean;
}

export interface Usuario {
  id: string;
  username: string;
  rol: 'ADMINISTRADOR' | 'COORDINADOR' | 'CAJERO';
  preferencia_tema?: string;
  ultimo_ciclo_id?: string;
  auth_id?: string | null;
  activo?: boolean | null;
}

export interface Alumno {
  id: string;
  nombre_completo: string;
  licenciatura: string;
  grado_actual: string;
  turno: string;
  estatus?: string;
  beca_porcentaje?: string;
  beca_tipo?: string;
  observaciones_pago_titulacion?: string | null;
  ciclo_ultima_asignacion_grado?: string | null;
  saldo_a_favor?: number;
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
}

export interface AppConfig {
  title: string;
  logoUrl: string;
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
