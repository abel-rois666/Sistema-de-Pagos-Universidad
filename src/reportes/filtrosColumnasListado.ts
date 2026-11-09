import type { Alumno, PaymentPlan } from '../types';
import { COLUMNAS_LISTADO, type ColumnaListadoId } from './listadoGeneral';
import { estadoPagoCertificado, estadoTramiteCertificado, type ResumenCertificacion } from '../certificacion/seguimiento';
import { resumirPagoTitulacion } from './estadoPagoTitulacion';

export type SeleccionFiltrosColumnas = Partial<Record<ColumnaListadoId, string[]>>;
export interface FiltroColumnaListado {
  id: ColumnaListadoId;
  nombre: string;
  ayuda?: string;
  opciones: string[];
  valores: ReadonlyMap<string, readonly string[]>;
  requiereCertificacion: boolean;
}

const estadosPago = ['Sin plan', 'Pago en curso', 'Pago completo', 'Revisar estado de pago'];
const estadosCertificado = ['Sin registro', 'Sin iniciar', 'En curso', 'Completado', 'Por revisar'];
const estadosTramite = ['Sin registro', 'En preparación', 'En trámite', 'Completado'];

/** Usa valores normalizados de las columnas y estados estructurados; nunca analiza el texto con nombres de programas. */
export function crearFiltrosColumnasListado(
  alumnos: readonly Alumno[], seleccion: readonly ColumnaListadoId[], fecha: string,
  planes: readonly PaymentPlan[], certificaciones: readonly ResumenCertificacion[],
): FiltroColumnaListado[] {
  const planesPorAlumno = new Map<string, PaymentPlan[]>();
  const fichasPorAlumno = new Map<string, ResumenCertificacion[]>();
  if (seleccion.includes('pagoTitulacion')) for (const p of planes) {
    if (p.alumno_id && p.tipo_plan === 'Titulación') planesPorAlumno.set(p.alumno_id, [...(planesPorAlumno.get(p.alumno_id) || []), p]);
  }
  if (seleccion.includes('pagoCertificado') || seleccion.includes('certificacion')) for (const f of certificaciones) {
    fichasPorAlumno.set(f.alumno_id, [...(fichasPorAlumno.get(f.alumno_id) || []), f]);
  }
  return COLUMNAS_LISTADO.filter(c => c.opcional && seleccion.includes(c.id)).map(c => {
    const requiereCertificacion = c.id === 'pagoCertificado' || c.id === 'certificacion';
    const valores = new Map(alumnos.map(a => {
      let propios: string[];
      if (c.id === 'email') propios = [a.email?.trim() ? 'Con correo' : 'Sin dato'];
      else if (c.id === 'pagoTitulacion') {
        const planesAlumno = planesPorAlumno.get(a.id) || [];
        propios = planesAlumno.length ? planesAlumno.map(resumirPagoTitulacion) : ['Sin plan'];
      } else if (requiereCertificacion) {
        const fichas = fichasPorAlumno.get(a.id) || [];
        propios = fichas.length ? fichas.map(c.id === 'pagoCertificado' ? estadoPagoCertificado : estadoTramiteCertificado) : ['Sin registro'];
      } else propios = [c.valor(a, fecha)];
      return [a.id, [...new Set(propios)]] as const;
    }));
    const opciones = c.id === 'pagoTitulacion' ? estadosPago
      : c.id === 'pagoCertificado' ? estadosCertificado
      : c.id === 'certificacion' ? estadosTramite
      : [...new Set([...valores.values()].flat())].sort((a, b) => {
        if (a === 'Sin dato') return 1;
        if (b === 'Sin dato') return -1;
        return a.localeCompare(b, 'es', { numeric: true });
      });
    const ayuda = c.id === 'email' ? 'Distingue alumnos con correo registrado o sin dato; no comprueba que la dirección sea válida.'
      : c.id === 'pagoTitulacion' ? 'Incluye al alumno si al menos uno de sus planes de Titulación tiene un estado elegido. Conserva abonos y consulta todos los ciclos.'
      : requiereCertificacion ? 'Incluye al alumno si alguna ficha tiene un estado elegido, también las anteriores sin asociar. Cada filtro puede coincidir con una ficha distinta; consulta el programa en la tabla. Pago y trámite se filtran por separado.'
      : c.ayuda;
    return { id: c.id, nombre: c.nombre, ayuda, opciones: [...opciones], valores, requiereCertificacion };
  });
}

export function filtrarColumnasListado(alumnos: readonly Alumno[], filtros: readonly FiltroColumnaListado[], seleccion: SeleccionFiltrosColumnas) {
  return alumnos.filter(a => filtros.every(f => !seleccion[f.id]?.length || seleccion[f.id]!.some(v => f.valores.get(a.id)?.includes(v))));
}

export const etiquetaOpcionColumna = (id: ColumnaListadoId, valor: string) =>
  id === 'edad' && /^\d+$/.test(valor) ? `${valor} ${valor === '1' ? 'año' : 'años'}` : valor;

export function resumenFiltrosColumnas(filtros: readonly FiltroColumnaListado[], seleccion: SeleccionFiltrosColumnas) {
  return filtros.filter(f => seleccion[f.id]?.length).map(f => `${f.nombre}: ${seleccion[f.id]!.map(v => etiquetaOpcionColumna(f.id, v)).join(', ')}`);
}
