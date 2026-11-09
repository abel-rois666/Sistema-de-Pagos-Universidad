import type { FichaCertificacion, PaymentPlan } from '../types';
import { resumirPagoTitulacion } from '../reportes/estadoPagoTitulacion';

export interface ResumenCertificacion {
  alumno_id: string;
  id?: string | null;
  alumno_programa_id?: string | null;
  programa?: string | null;
  pago_certificado?: string | null;
  tramite_completado: boolean | null;
  fecha_inicio_tramite?: string | null;
  sin_ficha?: boolean;
}
export function estadoTramiteCertificado(ficha?: Pick<ResumenCertificacion, 'tramite_completado' | 'fecha_inicio_tramite' | 'sin_ficha'> | null) {
  if (!ficha || ficha.sin_ficha) return 'Sin registro';
  if (ficha.tramite_completado) return 'Completado';
  return ficha.fecha_inicio_tramite ? 'En trámite' : 'En preparación';
}
export function estadoPagoCertificado(ficha?: ResumenCertificacion | null) {
  if (!ficha || ficha.sin_ficha) return 'Sin registro';
  return ({ SIN_INICIAR: 'Sin iniciar', EN_CURSO: 'En curso', COMPLETADO: 'Completado' } as Record<string, string>)[ficha.pago_certificado || ''] || 'Por revisar';
}
export const etiquetaProgramaCertificado = (f: ResumenCertificacion) => f.alumno_programa_id ? f.programa || 'Programa sin descripción' : 'Ficha anterior sin asociar';
export function certificacionesAlumno(filas: readonly ResumenCertificacion[], alumnoId: string) {
  return filas.filter(f=>f.alumno_id===alumnoId).sort((a,b)=>Number(!a.alumno_programa_id)-Number(!b.alumno_programa_id)
    || etiquetaProgramaCertificado(a).localeCompare(etiquetaProgramaCertificado(b),'es',{numeric:true}) || (a.id||'').localeCompare(b.id||''));
}
export function textoCertificaciones(filas: readonly ResumenCertificacion[], alumnoId: string, campo: 'pagoCertificado' | 'certificacion') {
  const propias = certificacionesAlumno(filas,alumnoId);
  if (!propias.length) return 'Sin registro';
  return propias.map(f => `${etiquetaProgramaCertificado(f)}: ${campo === 'pagoCertificado' ? estadoPagoCertificado(f) : estadoTramiteCertificado(f)}`).join(' · ');
}
export function planesTitulacionAlumno(planes: readonly PaymentPlan[], alumnoId: string) {
  return planes.filter(p => p.alumno_id === alumnoId && p.tipo_plan === 'Titulación')
    .sort((a,b) => (b.ciclo_escolar || '').localeCompare(a.ciclo_escolar || '', 'es', { numeric: true }) || (a.no_plan_pagos || '').localeCompare(b.no_plan_pagos || '', 'es', { numeric: true }) || a.id.localeCompare(b.id));
}
export function textoPagosTitulacion(planes: readonly PaymentPlan[], alumnoId: string) {
  const propios = planesTitulacionAlumno(planes, alumnoId);
  if (!propios.length) return 'Sin plan';
  if (propios.length === 1) return resumirPagoTitulacion(propios[0]);
  return propios.map(p => `${p.ciclo_escolar || 'Sin ciclo'} / ${p.no_plan_pagos || p.id}: ${resumirPagoTitulacion(p)}`).join(' · ');
}
export const requisitosCertificado = (f: Partial<FichaCertificacion>, especialidad: boolean) => f.pago_certificado === 'COMPLETADO'
  && ['doc_acta_nacimiento', 'doc_curp', 'doc_antecedente', ...(especialidad ? ['doc_titulo_profesional', 'doc_cedula_profesional'] : [])].every(c => (f as Record<string, unknown>)[c] === 'APROBADO') && Boolean(f.tipo_certificado);
export function reabrirCertificado(f: FichaCertificacion): FichaCertificacion {
  // Reabrir conserva pago, documentos, tipo, fechas y expediente digital.
  return { ...f, tramite_completado: false, fecha_completado: null };
}
export function terminoOrientativoCertificado(inicio: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return null;
  const d=new Date(inicio+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==inicio)return null;
  let n=0;
  while(n<70){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)n++;}
  const resultado=d.toISOString();
  return /^\d{4}-/.test(resultado)?resultado.slice(0,10):null;
}
