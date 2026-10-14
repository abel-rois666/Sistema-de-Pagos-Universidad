/** Fechas civiles sin conversión a la zona horaria del navegador. */
export interface EventoCalendarioCalculable {
  fechaInicio: string;
  fechaFin: string;
  tipo: string;
  suspendeClases: boolean;
}

export type TurnoCalendario = 'MATUTINO' | 'VESPERTINO' | 'MIXTO';
export type ModalidadCalendario = 'ESCOLARIZADA' | 'MIXTA' | 'NO_ESCOLARIZADA' | 'COMBINADA';

export interface ResumenDiasEfectivos {
  presenciales: number;
  sincronasEnLinea: number;
  total: number;
  semanasConClase: number;
  semanasEquivalentes: number;
}

const DIA_MILISEGUNDOS = 86_400_000;

function diaUtc(fecha: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Las fechas deben usar el formato AAAA-MM-DD.');
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const valor = Date.UTC(anio, mes - 1, dia);
  if (new Date(valor).toISOString().slice(0, 10) !== fecha) throw new Error(`La fecha ${fecha} no es válida.`);
  return valor;
}

/** Días festivos, vacaciones y exámenes especiales nunca cuentan como clase. */
export function excluyeDiaLectivo(evento: EventoCalendarioCalculable): boolean {
  return evento.suspendeClases || ['FESTIVO', 'VACACIONES', 'RECUPERACION', 'EXTRAORDINARIOS']
    .includes(evento.tipo.toUpperCase());
}

/** El turno Mixto de modalidad Mixta tiene dos ventanas lectivas con medios distintos. */
export function calcularDiasEfectivos(fechaInicio: string, fechaFin: string,
  turno: TurnoCalendario, modalidad: ModalidadCalendario,
  eventos: readonly EventoCalendarioCalculable[]): ResumenDiasEfectivos {
  const inicio = diaUtc(fechaInicio);
  const fin = diaUtc(fechaFin);
  if (fin < inicio) throw new Error('La fecha de término no puede preceder al inicio.');
  const exclusiones = eventos.filter(excluyeDiaLectivo).map(evento => {
    const desde = diaUtc(evento.fechaInicio);
    const hasta = diaUtc(evento.fechaFin);
    if (hasta < desde) throw new Error('Un evento tiene un rango de fechas invertido.');
    return { desde, hasta };
  });
  let presenciales = 0;
  let sincronasEnLinea = 0;
  const semanas = new Set<string>();
  for (let fecha = inicio; fecha <= fin; fecha += DIA_MILISEGUNDOS) {
    if (exclusiones.some(evento => evento.desde <= fecha && fecha <= evento.hasta)) continue;
    const dia = new Date(fecha).getUTCDay();
    const presencial = turno === 'MIXTO' ? dia === 6 : dia >= 1 && dia <= 5;
    const enLinea = modalidad === 'MIXTA' && turno === 'MIXTO' && dia >= 1 && dia <= 5;
    if (!presencial && !enLinea) continue;
    if (presencial) presenciales++;
    if (enLinea) sincronasEnLinea++;
    const lunes = fecha - ((dia + 6) % 7) * DIA_MILISEGUNDOS;
    semanas.add(new Date(lunes).toISOString().slice(0, 10));
  }
  const total = presenciales + sincronasEnLinea;
  const diasPorSemana = turno === 'MIXTO' ? (modalidad === 'MIXTA' ? 6 : 1) : 5;
  return { presenciales, sincronasEnLinea, total, semanasConClase: semanas.size,
    semanasEquivalentes: Math.round(total / diasPorSemana * 100) / 100 };
}
