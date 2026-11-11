import { DOCUMENTOS_BASE, EXAMENES, type EntregaAsignatura, type MateriaDocente } from './types';
export function entregaInicial(asignaturaId: string): EntregaAsignatura { return { asignatura_id: asignaturaId, examenes: ['P1','P2','P3'], entregados: [] }; }
export const documentosEntrega = (entrega: EntregaAsignatura) => [...DOCUMENTOS_BASE, ...entrega.examenes];
export function validarEntregas(entregas: readonly EntregaAsignatura[]) {
  if (entregas.length > 300 || new Set(entregas.map(e => e.asignatura_id)).size !== entregas.length) return 'Revisa las asignaturas del expediente.';
  for (const e of entregas) {
    if (!e.asignatura_id || e.examenes.length<1 || e.examenes.some(x => !EXAMENES.includes(x)) || new Set(e.examenes).size !== e.examenes.length) return 'Revisa los exámenes requeridos por asignatura.';
    const requeridos = documentosEntrega(e);
    if (e.entregados.some(x => !requeridos.includes(x as typeof requeridos[number])) || new Set(e.entregados).size !== e.entregados.length) return 'Hay entregas que no corresponden a los documentos requeridos.';
  }
  return '';
}
export function marcarEntregasVisibles(entregas: readonly EntregaAsignatura[], materias: readonly MateriaDocente[], marcar: boolean) {
  const ids = new Set(materias.map(m => m.asignaturaId).filter(Boolean));
  return entregas.map(e => ids.has(e.asignatura_id) ? { ...e, entregados: marcar ? documentosEntrega(e) : [] } : e);
}
export function validarCarpetaAsignatura(url: string | null) {
  if (!url) return '';
  try { const u=new URL(url); if (url.length<=2048 && /^https:\/\/(drive|docs)\.google\.com\//.test(url) && !/\s/.test(url) && u.protocol==='https:' && ['drive.google.com','docs.google.com'].includes(u.hostname)) return ''; } catch {}
  return 'Usa un enlace HTTPS de Google Drive para el expediente de asignatura.';
}
