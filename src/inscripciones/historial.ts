import type { CandidatoInscripcion, CapturaInscripcion } from './types';
import { capturaInicial } from './dominio';

export interface CicloHistorialInscripcion {
  id: string; nombre: string; tipo_periodo: string; fecha_inicio: string | null;
  materias: { id: string; nombre: string; periodo: number | null; registros: number }[];
  inscripcion: { id: string; revision: number; grado_personal: string; estado: string } | null;
}
export interface HistorialInscripcion {
  alumno_programa_id: string; modelo: string; huella: string;
  alumno_id?:string;plan_id?:string;
  ciclos: CicloHistorialInscripcion[];
}
export interface PropuestaHistorialInscripcion {
  ingreso: CicloHistorialInscripcion | null; origen: CicloHistorialInscripcion | null;
  grado: string | null; tipo: CapturaInscripcion['tipo_ingreso']; avisos: string[];
}
export function numeroGradoInscripcion(valor: string): number | null {
  const m = valor.trim().toUpperCase().match(/^(\d+)(?:ER|RO|DO|TO|VO|MO|NO|º|°)?$/);
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}

/** Las materias orientan una revisión; nunca acreditan por sí solas una promoción. */
export function proponerDesdeHistorial(
  c: CandidatoInscripcion, h: HistorialInscripcion, destino: {id: string; fecha_inicio?: string | null},
): PropuestaHistorialInscripcion {
  const avisos: string[] = [];
  const periodo = c.tipo_periodo.trim().toUpperCase();
  const compatibles = h.ciclos.filter(x => x.tipo_periodo.trim().toUpperCase() === periodo);
  if (compatibles.length !== h.ciclos.length) avisos.push('Hay antecedentes con otra periodicidad: revisa su asociación.');
  const conNotas = compatibles.filter(x => x.materias.length > 0);
  const fechasCompletas = conNotas.every(x => x.fecha_inicio);
  const ordenados = [...conNotas].sort((a,b)=>(a.fecha_inicio||'').localeCompare(b.fecha_inicio||'')||a.id.localeCompare(b.id));
  let ingreso: CicloHistorialInscripcion | null = null;
  if (compatibles.length !== h.ciclos.length) avisos.push('No se propone el ingreso hasta aclarar los ciclos con periodicidad distinta.');
  else if (!destino.fecha_inicio) avisos.push('El ciclo de destino no tiene fecha de inicio; no se puede ordenar la trayectoria.');
  else if (!fechasCompletas) avisos.push('Faltan fechas de inicio en el historial; no se propone ingreso.');
  else if (ordenados.length) {
    const primero = ordenados[0];
    if (primero.fecha_inicio! > destino.fecha_inicio) avisos.push('El primer antecedente es posterior al destino.');
    else if (ordenados.filter(x=>x.fecha_inicio===primero.fecha_inicio).length>1) avisos.push('Dos ciclos comparten la fecha más antigua: revisa el ingreso.');
    else ingreso = primero;
  } else avisos.push('No hay calificaciones de este alumno en el mismo plan.');

  const previos = destino.fecha_inicio ? compatibles.filter(x => x.fecha_inicio && x.fecha_inicio < destino.fecha_inicio!
    && x.materias.length>0) : [];
  previos.sort((a,b)=>b.fecha_inicio!.localeCompare(a.fecha_inicio!)||a.id.localeCompare(b.id));
  let origen = previos[0] || null;
  if (origen && previos.filter(x=>x.fecha_inicio===origen!.fecha_inicio).length>1) {
    origen = null; avisos.push('El último ciclo anterior no es único; selecciona el origen tras revisarlo.');
  }
  if (origen && !origen.inscripcion) avisos.push('El origen muestra el último antecedente disponible, que puede corresponder a un recursamiento o examen; no acredita por sí solo el último ciclo cursado.');
  let grado: string | null = c.inscripcion?.grado_personal || null;
  const actual = compatibles.find(x=>x.id===destino.id);
  if (!grado && actual?.inscripcion?.estado==='CONFIRMADA') grado = actual.inscripcion.grado_personal;
  if (!grado && actual?.materias.length) {
    const periodos = new Set(actual.materias.map(m=>m.periodo));
    if (h.modelo.toUpperCase()==='RIGIDO' && periodos.size===1) {
      const n = [...periodos][0];
      if (n && n>0 && c.total_periodos && n<=c.total_periodos) grado = String(n);
    }
    if (!grado) avisos.push('Las materias del destino no determinan un grado personal único; revisa recursamientos, adelantos o modelo flexible.');
  }
  if (!grado && !actual?.materias.length && origen?.inscripcion?.estado==='CONFIRMADA') {
    const n=numeroGradoInscripcion(origen.inscripcion.grado_personal);
    if (n && c.total_periodos && n<c.total_periodos) {
      grado=String(n+1);
      avisos.push('El grado propuesto continúa la inscripción anterior; requiere autorización académica, no verifica aprobación de materias.');
    }
  }
  if (!grado) avisos.push('El grado actual del alumno queda como referencia; el historial no acredita un grado de destino.');
  if (ingreso) avisos.push('La fecha propuesta es el inicio del primer ciclo con calificaciones disponible; puede diferir del ingreso real.');
  return {ingreso, origen, grado, tipo:ingreso ? (ingreso.id===destino.id?'PRIMER_INGRESO':'REINGRESO') : 'DESCONOCIDO', avisos};
}

/** Aplicación solo al borrador abierto: conserva valores acreditados y nunca confirma matrícula. */
export function capturaDesdeHistorial(c:CandidatoInscripcion, p:PropuestaHistorialInscripcion, h?:HistorialInscripcion):CapturaInscripcion {
  const base=capturaInicial(c);
  return {...base, grado_personal:c.inscripcion?.grado_personal||p.grado||base.grado_personal,
    fecha_primer_ingreso:base.fecha_primer_ingreso||p.ingreso?.fecha_inicio||'',
    tipo_ingreso:base.tipo_ingreso==='DESCONOCIDO'?p.tipo:base.tipo_ingreso,
    ciclo_origen_id:base.ciclo_origen_id||p.origen?.id||'',
    referencia:h?.huella?{huella:h.huella,aplicar_ingreso:!base.fecha_primer_ingreso&&Boolean(p.ingreso),
      aplicar_grado:!c.inscripcion?.grado_personal&&Boolean(p.grado),ciclo_ingreso_id:p.ingreso?.id||null,
      fecha_ingreso_propuesta:p.ingreso?.fecha_inicio||null,grado_propuesto:p.grado}:undefined};
}

/** Una modificación manual deja de atribuir ese valor a la inferencia, conservando la revisión. */
export function normalizarReferenciaHistorial(v:CapturaInscripcion):CapturaInscripcion {
  if(!v.referencia)return v;
  return {...v,referencia:{...v.referencia,aplicar_ingreso:v.referencia.aplicar_ingreso&&v.fecha_primer_ingreso===v.referencia.fecha_ingreso_propuesta,
    ...(v.referencia.aplicar_desde!==undefined?{aplicar_desde:v.referencia.aplicar_desde&&v.desde===v.referencia.fecha_desde_propuesta}:{}),
    ...(v.referencia.aplicar_origen!==undefined?{aplicar_origen:v.referencia.aplicar_origen&&v.ciclo_origen_id===v.referencia.ciclo_origen_propuesto_id}:{}),
    aplicar_grado:v.referencia.aplicar_grado&&numeroGradoInscripcion(v.grado_personal)===numeroGradoInscripcion(v.referencia.grado_propuesto||'')}};
}
