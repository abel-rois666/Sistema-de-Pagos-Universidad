import { supabase } from '../lib/supabase';

export interface RevisionRetiroPrograma {
  alumnoId: string; programaId: string; planId: string; programa: string; huella: string;
  puedeRetirar: boolean; motivos: string[];
  esPrueba?: boolean; materiasVacias?: number; certificacionesPrueba?: number;
  antecedentes: { clave: string; etiqueta: string; cantidad: number | null; bloquea: boolean }[];
}
const errorRetiro = (e: { code?: string; message: string }) => new Error(['PGRST202', '42883'].includes(e.code || '')
  ? 'Falta instalar la revisión segura de asociaciones (20261109210000). No se retiró ningún programa.'
  : e.code === '55P03' ? 'Otra operación está utilizando los antecedentes. Espera y actualiza la revisión.' : e.message);
export const retiroAsociacionProgramaService = {
  async revisar(alumnoId: string, programaId: string, signal?: AbortSignal, prueba=false): Promise<RevisionRetiroPrograma> {
    let q = supabase.rpc(prueba?'ap_revisar_prueba_v1':'ap_revisar_retiro_v1', { p_alumno: alumnoId, p_programa: programaId });
    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q; if (error) {if(prueba&&['PGRST202','42883'].includes(error.code||''))throw new Error('Falta instalar el retiro de asociaciones de prueba (20261109220000). No se modificó información.');throw errorRetiro(error);}
    if (!data || data.alumnoId !== alumnoId || data.programaId !== programaId || typeof data.puedeRetirar !== 'boolean'
      || !/^[a-f0-9]{32}$/.test(data.huella || '') || !Array.isArray(data.motivos) || !Array.isArray(data.antecedentes)) {
      throw new Error('El servidor no confirmó la revisión de esta asociación. No se permite retirarla.');
    }
    if(prueba&&(data.esPrueba!==true||!Number.isInteger(data.materiasVacias)||data.materiasVacias<0||!Number.isInteger(data.certificacionesPrueba)||data.certificacionesPrueba<0))throw new Error('El servidor no confirmó el alcance de la revisión de prueba.');
    return data;
  },
  async retirar(revision: RevisionRetiroPrograma, motivo: string, confirmacion=''): Promise<void> {
    if (!revision.puedeRetirar || motivo.trim().length < 10) throw new Error('Revisa los antecedentes y explica el error de asociación.');
    if(revision.esPrueba&&confirmacion!=='RETIRAR PRUEBA')throw new Error('Escribe RETIRAR PRUEBA para confirmar la depuración.');
    const { data, error } = await supabase.rpc(revision.esPrueba?'ap_retirar_prueba_v1':'ap_retirar_asociacion_v1', { p_alumno: revision.alumnoId, p_programa: revision.programaId, p_huella: revision.huella, p_motivo: motivo.trim(),...(revision.esPrueba?{p_confirmacion:confirmacion}:{}) });
    if (error) throw errorRetiro(error);
    if (!data?.retirado || data.programaId !== revision.programaId || data.alumnoId !== revision.alumnoId) throw new Error('No se pudo confirmar el retiro. Actualiza la ficha antes de reintentar.');
  },
};
