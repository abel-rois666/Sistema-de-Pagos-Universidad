import { PaymentPlan, CicloEscolar, Alumno } from './types';

export const MOCK_CICLOS: CicloEscolar[] = [
  { id: 'c1', nombre: '26/1', meses_abarca: 'Enero - Abril', anio: 2026, activo: true },
  { id: 'c2', nombre: '26/2', meses_abarca: 'Mayo - Agosto', anio: 2026, activo: false }
];

export const MOCK_ALUMNOS: Alumno[] = [
  { id: 'a1', nombre_completo: 'CHAVEZ CORDERO SAMARA YAMIL', licenciatura: 'ADMINISTRACIÓN', grado_actual: '7MO', turno: 'MIXTO' },
  { id: 'a2', nombre_completo: 'AGUILAR GUT', licenciatura: 'DERECHO', grado_actual: '8VO', turno: 'MIXTO' }
];

export const MOCK_DATA: PaymentPlan[] = [
  {
    id: '1',
    alumno_id: 'a1',
    ciclo_id: 'c1',
    nombre_alumno: 'CHAVEZ CORDERO SAMARA YAMIL',
    no_plan_pagos: '00207',
    fecha_plan: '13/10/2025',
    beca_porcentaje: '35%',
    beca_tipo: 'BECA ALCALDÍA',
    ciclo_escolar: '26/1',
    concepto_1: 'CONSTANCIAS RENOVACIÓN DE BECA',
    fecha_1: '13 DE OCTUBRE',
    cantidad_1: 314,
    estatus_1: 'R-35552',
    concepto_2: '1ER PAGO',
    fecha_2: '13 DE OCTUBRE',
    cantidad_2: 2165,
    estatus_2: 'R-35552',
    concepto_3: '2DO PAGO',
    fecha_3: '11 DE NOVIEMBRE',
    cantidad_3: 2165,
    estatus_3: 'R-35883',
    concepto_4: '3ER PAGO',
    fecha_4: '11 DE DICIEMBRE',
    cantidad_4: 2165,
    estatus_4: 'R-36458',
    concepto_5: '4TO PAGO',
    fecha_5: '11 DE ENERO',
    cantidad_5: 2165,
    estatus_5: 'R-36957',
    licenciatura: 'ADMINISTRACIÓN',
    grado_turno: '7MO MIXTO'
  },
  {
    id: '2',
    alumno_id: 'a2',
    ciclo_id: 'c1',
    nombre_alumno: 'AGUILAR GUT',
    no_plan_pagos: '1',
    fecha_plan: '13/02/2026',
    beca_porcentaje: '0%',
    beca_tipo: 'NINGUNA',
    ciclo_escolar: '26/1',
    concepto_1: 'CONSTANCIAS RENOVACIÓN DE BECA',
    fecha_1: '13/02/2026',
    cantidad_1: 314,
    estatus_1: 'R-35633',
    concepto_2: '1ER PAGO',
    fecha_2: '13/02/2026',
    cantidad_2: 1332,
    estatus_2: 'R-35633',
    concepto_3: '2DO PAGO',
    fecha_3: '11/03/2026',
    cantidad_3: 1332,
    estatus_3: 'R-35981',
    concepto_4: '3ER PAGO',
    fecha_4: '11/04/2026',
    cantidad_4: 1332,
    estatus_4: 'PENDIENTE',
    concepto_5: '4TO PAGO',
    fecha_5: '11/05/2026',
    cantidad_5: 1332,
    estatus_5: 'PENDIENTE',
    licenciatura: 'DERECHO',
    grado_turno: '8VO MIXTO'
  }
];
