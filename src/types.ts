export interface CicloEscolar {
  id: string;
  nombre: string;
  meses_abarca: string;
  anio: number;
  activo: boolean;
}

export interface Alumno {
  id: string;
  nombre_completo: string;
  licenciatura: string;
  grado_actual: string;
  turno: string;
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
  grado_turno: string;
  tipo_plan?: 'Cuatrimestral' | 'Semestral';
}
