import type { Alumno, PaymentPlan } from '../types';
import { estadoPagoCertificado, estadoTramiteCertificado, planesTitulacionAlumno, type ResumenCertificacion } from '../certificacion/seguimiento';
import { resumirPagoTitulacion } from './estadoPagoTitulacion';
import { fechaLegibleListado } from './listadoGeneral';

/** Columnas del formato por alumno: cada reporte conserva su selección y su presentación. */
export interface ColumnaCSVAlumno {
  id: string; nombre: string; nombreDetalle?: string; valor: (alumno: Alumno, fecha: string) => string;
}
const etiquetaCSV = (c: ColumnaCSVAlumno, fecha: string) => c.id === 'edad' ? `Edad al ${fechaLegibleListado(fecha)} (años)` : c.nombre;
export function tablaAlumnosCSV(alumnos: readonly Alumno[], columnas: readonly ColumnaCSVAlumno[], fecha: string): TablaCSV {
  return { cabeceras: columnas.map(c => etiquetaCSV(c, fecha)), filas: alumnos.map(a => columnas.map(c => c.valor(a, fecha))) };
}

/** La unidad de esta exportación es la asociación, nunca el nombre de la carrera. */
export interface ProgramaCSV {
  id: string; alumno_id: string; plan_id: string; estatus: string; es_vigente: boolean | null;
  planes_estudio: { nombre: string; clave_legado: string; tipo_periodo: string | null; modalidad: string | null; carreras: { nombre: string } | null } | null;
}
export interface TablaCSV { cabeceras: string[]; filas: string[][] }
function agruparAlumno<T extends { alumno_id: string }>(filas: readonly T[]) {
  const mapa = new Map<string, T[]>();
  for (const fila of filas) { const grupo = mapa.get(fila.alumno_id) || []; grupo.push(fila); mapa.set(fila.alumno_id, grupo); }
  return mapa;
}
export function serializarTablaCSV(tabla: TablaCSV) {
  const celda = (valor: string) => '"' + (/^\s*[=+@-]/.test(valor) ? "'" + valor : valor).replace(/"/g, '""') + '"';
  return '\uFEFF' + [tabla.cabeceras, ...tabla.filas].map(f => f.map(celda).join(',')).join('\r\n');
}

export function detalleProgramasCSV(alumnos: readonly Alumno[], programas: readonly ProgramaCSV[], certificaciones: readonly ResumenCertificacion[], columnas: readonly ColumnaCSVAlumno[], fecha: string, ids = false): TablaCSV {
  // Los estados financieros del alumno no se atribuyen a sus programas académicos.
  const generales = columnas.filter(c => !['licenciatura', 'pagoTitulacion', 'pagoCertificado', 'certificacion'].includes(c.id));
  const cabeceras = ['Tipo de registro', 'Matrícula', ...generales.map(c => c.nombreDetalle || (c.id === 'estatus' ? 'Estatus institucional' : etiquetaCSV(c, fecha))),
    'Carrera del programa', 'Clave del plan de estudios', 'Nombre del plan de estudios', 'Periodicidad del plan de estudios', 'Modalidad', 'Estatus del programa', 'Programa principal', 'Tiene ficha de certificación', 'Pago del certificado', 'Trámite del certificado',
    ...(ids ? ['alumno_id', 'alumno_programa_id', 'plan_estudios_id', 'ficha_certificacion_id'] : [])];
  const filas: string[][] = [];
  if (new Set(programas.map(p => p.id)).size !== programas.length) throw new Error('Los programas cambiaron durante la consulta. Actualiza la exportación.');
  const clavesFichas = certificaciones.map(f => `${f.alumno_id}/${f.alumno_programa_id || ''}/${f.id || ''}`);
  if (new Set(clavesFichas).size !== clavesFichas.length) throw new Error('El seguimiento cambió durante la consulta. Actualiza la exportación.');
  const programasAlumno = agruparAlumno(programas);
  const fichasAlumno = agruparAlumno(certificaciones);
  for (const alumno of alumnos) {
    const propios = [...(programasAlumno.get(alumno.id) || [])].sort((a, b) =>
      (a.planes_estudio?.carreras?.nombre || '').localeCompare(b.planes_estudio?.carreras?.nombre || '', 'es') ||
      (a.planes_estudio?.clave_legado || '').localeCompare(b.planes_estudio?.clave_legado || '', 'es', { numeric: true }) || a.id.localeCompare(b.id));
    const fichas = fichasAlumno.get(alumno.id) || [];
    const base = [alumno.matricula || '', ...generales.map(c => c.valor(alumno, fecha))];
    for (const p of propios) {
      const f = fichas.filter(f => f.alumno_programa_id === p.id);
      if (f.length !== 1) throw new Error('El seguimiento cambió o está incompleto. Actualiza la exportación antes de descargar.');
      const ficha = f[0], plan = p.planes_estudio;
      if (!ficha.sin_ficha && !ficha.id) throw new Error('No se identificó la ficha del programa. Actualiza la exportación.');
      filas.push(['ALUMNO_PROGRAMA', ...base, plan?.carreras?.nombre || 'Sin dato', plan?.clave_legado || '', plan?.nombre || '', plan?.tipo_periodo || '', plan?.modalidad || '', p.estatus || '', p.es_vigente === true ? 'Sí' : p.es_vigente === false ? 'No' : 'Sin dato', ficha.sin_ficha ? 'No' : 'Sí', estadoPagoCertificado(ficha), estadoTramiteCertificado(ficha),
        ...(ids ? [alumno.id, p.id, p.plan_id, ficha.id || ''] : [])]);
    }
    for (const f of fichas) {
      if (f.alumno_programa_id && !propios.some(p => p.id === f.alumno_programa_id)) throw new Error('Los programas cambiaron durante la consulta. Actualiza la exportación.');
      if (!f.alumno_programa_id) {
        if (!f.id || f.sin_ficha) throw new Error('No se identificó la ficha anterior. Actualiza la exportación.');
        filas.push(['FICHA_SIN_PROGRAMA', ...base, '', '', '', '', '', '', '', 'Sí', estadoPagoCertificado(f), estadoTramiteCertificado(f), ...(ids ? [alumno.id, '', '', f.id] : [])]);
      }
    }
    if (!propios.length && !fichas.length) filas.push(['ALUMNO_SIN_PROGRAMA', ...base, '', '', '', '', '', '', '', 'No', 'Sin registro', 'Sin registro', ...(ids ? [alumno.id, '', '', ''] : [])]);
  }
  return { cabeceras, filas };
}

export function detallePagosTitulacionCSV(alumnos: readonly Alumno[], planes: readonly PaymentPlan[], ciclos: readonly { id: string; nombre: string; tipo_periodo?: string | null }[], ids = false): TablaCSV {
  const porCiclo = new Map(ciclos.map(c => [c.id, c]));
  const cabeceras = ['Matrícula', 'Nombre completo', 'Número del plan de pagos', 'Ciclo del plan de pagos', 'Tipo del ciclo', 'Tipo de plan de pagos', 'Fecha del plan de pagos (dato original)', 'Estado del pago de titulación', 'Asociación con programa académico', ...(ids ? ['alumno_id', 'plan_pago_id', 'ciclo_id'] : [])];
  const filas = alumnos.flatMap(a => planesTitulacionAlumno(planes, a.id).map(p => {
    const ciclo = p.ciclo_id ? porCiclo.get(p.ciclo_id) : undefined;
    return [a.matricula || '', a.nombre_completo, p.no_plan_pagos || '', ciclo?.nombre || p.ciclo_escolar || '', ciclo?.tipo_periodo || 'Sin dato', p.tipo_plan || '', p.fecha_plan || '', resumirPagoTitulacion(p), 'Sin asociación a programa', ...(ids ? [a.id, p.id, p.ciclo_id || ''] : [])];
  }));
  return { cabeceras, filas };
}
