import type { EventoAcademico } from './service';

export interface ActividadCalendario {
  id: string;
  nombre: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  color: string;
  suspende_clases: boolean;
  evento?: EventoAcademico;
}

/** Los límites lectivos siempre son visibles como actividades, sin insertar eventos en la base. */
export function actividadesCalendario(inicio: string, fin: string,
  eventos: readonly EventoAcademico[]): ActividadCalendario[] {
  const actividades: ActividadCalendario[] = eventos.map(evento => ({ ...evento, evento }));
  if (inicio && !eventos.some(evento => evento.tipo === 'INICIO' &&
    evento.fecha_inicio === inicio && evento.fecha_fin === inicio)) {
    actividades.push({ id: 'hito-inicio-clases', nombre: 'Inicio de clases', tipo: 'INICIO',
      fecha_inicio: inicio, fecha_fin: inicio, color: '#0d9488', suspende_clases: false });
  }
  if (fin && !eventos.some(evento => evento.tipo === 'TERMINO' &&
    evento.fecha_inicio === fin && evento.fecha_fin === fin)) {
    actividades.push({ id: 'hito-termino-clases', nombre: 'Término de clases', tipo: 'TERMINO',
      fecha_inicio: fin, fecha_fin: fin, color: '#b45309', suspende_clases: false });
  }
  return actividades.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio)
    || a.fecha_fin.localeCompare(b.fecha_fin) || a.nombre.localeCompare(b.nombre, 'es'));
}
