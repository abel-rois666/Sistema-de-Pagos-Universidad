import { type TurnoHorario, type VentanaHorario, VENTANAS_TURNO } from './types';

export type MedioSesion = 'PRESENCIAL' | 'EN_LINEA';

/** Un borrador anterior carece de medio: sus sesiones siguen siendo presenciales. */
export function medioSesion(medio: MedioSesion | null | undefined): MedioSesion {
  return medio === 'EN_LINEA' ? 'EN_LINEA' : 'PRESENCIAL';
}

export function esModalidadMixta(modalidad: string | null | undefined): boolean {
  return modalidad?.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === 'MIXTA';
}

/** La ventana en línea adicional existe únicamente en el turno Mixto de la modalidad Mixta. */
export function ventanasPorMedio(turno: TurnoHorario, modalidad: string | null | undefined,
  medio: MedioSesion): readonly VentanaHorario[] {
  if (medio === 'EN_LINEA') return turno === 'MIXTO' && esModalidadMixta(modalidad)
    ? VENTANAS_TURNO.VESPERTINO : [];
  return VENTANAS_TURNO[turno];
}

export function capacidadPorMedio(turno: TurnoHorario, modalidad: string | null | undefined,
  medio: MedioSesion): number {
  return ventanasPorMedio(turno, modalidad, medio)
    .reduce((total, ventana) => total + ventana.fin - ventana.inicio, 0);
}
