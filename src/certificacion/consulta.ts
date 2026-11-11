import type { AlumnoPrograma, FichaCertificacion } from '../types';

/** Consultar la ficha anterior nunca oculta una asociación ya guardada. */
export function resolverVistaCertificacion(
  fichas: readonly FichaCertificacion[], programaId: string, solicitarAnterior: boolean
) {
  const legado = fichas.filter(f => !f.alumno_programa_id);
  const delPrograma = fichas.find(f => f.alumno_programa_id === programaId) || null;
  const fichaAnterior = solicitarAnterior && legado.length > 0;
  const ficha = fichaAnterior ? legado[0] : delPrograma;
  return {
    ficha, legado, fichaAnterior,
    destinoOcupado: Boolean(fichaAnterior && delPrograma && ficha?.id !== delPrograma.id)
  };
}

/** Solo cambia el destino: preserva ID, revisión, estados y documentos de la fuente. */
export function prepararAsociacionCertificacion(fichaId: string, programaId: string, motivo: string,
  fichas: readonly FichaCertificacion[], programas: readonly AlumnoPrograma[]) {
  const ficha = fichas.find(f => f.id === fichaId);
  if (!ficha || ficha.archivado_en || ficha.alumno_programa_id) throw new Error('La ficha anterior ya no está disponible. Actualiza la consulta.');
  if (!programas.some(p => p.id === programaId && p.alumno_id === ficha.alumno_id)) throw new Error('Elige un programa de este alumno.');
  if (fichas.some(f => f.alumno_programa_id === programaId && !f.archivado_en && f.id !== fichaId)) throw new Error('Este programa ya tiene certificación. Elige otro destino; no se sobrescribirá la existente.');
  if (motivo.trim().length < 5) throw new Error('Indica el respaldo para asignar el programa.');
  return { ...ficha, alumno_programa_id: programaId };
}
