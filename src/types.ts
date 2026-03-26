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
  rol: 'ADMINISTRADOR' | 'COORDINADOR';
  preferencia_tema?: string;
  ultimo_ciclo_id?: string;
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

  licenciatura: string;
  grado_turno: string;  // campo combinado (para display y compat. con vista)
  grado?: string;       // grado separado (columna planes_pago.grado)
  turno?: string;       // turno separado (columna planes_pago.turno)
  tipo_plan?: 'Cuatrimestral' | 'Semestral';
}

export interface AppConfig {
  title: string;
  logoUrl: string;
}

export type CatalogoTipo = 'concepto' | 'licenciatura' | 'beca_tipo' | 'beca_porcentaje' | 'grado' | 'turno' | 'estatus_alumno';

export interface CatalogoItem {
  id: string;
  tipo: CatalogoTipo;
  valor: string;
  orden: number;
  activo: boolean;
}

export interface Catalogos {
  conceptos: string[];
  licenciaturas: string[];
  beca_tipos: string[];
  beca_porcentajes: string[];
  grados: string[];
  turnos: string[];
  estatus_alumnos: string[];
}

export interface PlantillaPlan {
  id: string;
  nombre: string;
  ciclo_id: string | null;
  tipo_plan: 'Cuatrimestral' | 'Semestral';
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
}

