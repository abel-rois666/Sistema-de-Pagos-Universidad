export type DiaHorario = 1 | 2 | 3 | 4 | 5 | 6;
export type TurnoHorario = 'MATUTINO' | 'VESPERTINO' | 'MIXTO';

export interface VentanaHorario {
  dia: DiaHorario;
  inicio: number; // Hora entera, formato de 24 horas.
  fin: number;
}

export interface GrupoHorario {
  id: string;
  codigo: string;
  cicloId: string;
  planId: string;
  turno: TurnoHorario;
  aula?: string | null;
  sede?: string | null;
}

export interface DocenteHorario {
  id: string;
  nombre: string;
  activo: boolean;
  disponibilidad: VentanaHorario[];
  planes: string[];
  asignaturasPreferidas: string[];
  gruposRestringidos: string[];
}

export interface CargaHorario {
  id: string; // ID de docentes_grupos_asignaturas.
  grupoId: string;
  asignaturaId: string;
  asignatura: string;
  horasTotales: number | null;
  horasPresenciales: number | null;
  horasAsincronas: number | null;
  docenteId: string | null;
  maxBloque?: 1 | 2 | 3 | 4;
}

export interface SesionHorario {
  cargaId: string;
  grupoId: string;
  asignaturaId: string;
  docenteId: string;
  dia: DiaHorario;
  inicio: number;
  fin: number;
  aula?: string | null;
  sede?: string | null;
}

export interface IncidenciaHorario {
  codigo: string;
  mensaje: string;
  grupoId?: string;
  cargaId?: string;
  docenteId?: string;
}

export interface ConfiguracionHorario {
  maxHuecoGrupo: number;
  maxHuecoDocente: number;
}

export interface EntradaHorario {
  grupos: GrupoHorario[];
  docentes: DocenteHorario[];
  cargas: CargaHorario[];
  ocupacionesExternas?: SesionHorario[];
  configuracion: ConfiguracionHorario;
}

export interface ResultadoHorario {
  sesiones: SesionHorario[];
  incidencias: IncidenciaHorario[];
  huecosGrupo: Record<string, number>;
  huecosDocente: Record<string, number>;
}

export const DIAS_HORARIO: readonly DiaHorario[] = [1, 2, 3, 4, 5, 6];
export const NOMBRES_DIAS: Record<DiaHorario, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado',
};

export const VENTANAS_TURNO: Record<TurnoHorario, VentanaHorario[]> = {
  MATUTINO: [1, 2, 3, 4, 5].map(dia => ({ dia: dia as DiaHorario, inicio: 7, fin: 13 })),
  VESPERTINO: [1, 2, 3, 4, 5].map(dia => ({ dia: dia as DiaHorario, inicio: 16, fin: 21 })),
  MIXTO: [{ dia: 6, inicio: 7, fin: 15 }],
};

export function normalizarTurno(turno: string | null | undefined): TurnoHorario | null {
  const normalizado = turno?.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return normalizado === 'MATUTINO' || normalizado === 'VESPERTINO' || normalizado === 'MIXTO'
    ? normalizado : null;
}

export function horaTexto(hora: number): string {
  return `${String(hora).padStart(2, '0')}:00`;
}
