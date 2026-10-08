import { VENTANAS_TURNO, type DiaHorario, type TurnoHorario } from './types';

const ventanasLectivas = Object.values(VENTANAS_TURNO).flat();

/** Cuenta huecos por turno: clases en Matutino y Vespertino no crean un hueco entre turnos. */
export function horasLibresEntreClases(horas: readonly number[], dia: DiaHorario,
  turno?: TurnoHorario): number[] {
  if (horas.length < 2) return [];
  const ventanas = turno ? VENTANAS_TURNO[turno] : ventanasLectivas;
  const libres: number[] = [];
  for (const ventana of ventanas) {
    if (ventana.dia !== dia) continue;
    const dentro = horas.filter(hora => ventana.inicio <= hora && hora < ventana.fin);
    if (dentro.length < 2) continue;
    const ocupadas = new Set(dentro);
    const primera = Math.min(...dentro);
    const ultima = Math.max(...dentro);
    for (let hora = primera + 1; hora < ultima; hora++) {
      if (!ocupadas.has(hora)) libres.push(hora);
    }
  }
  return libres;
}
