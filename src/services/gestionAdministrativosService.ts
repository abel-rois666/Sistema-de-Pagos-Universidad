import { supabase } from '../lib/supabase';
import type { CuentaAdministrativo, RevisionAdministrativo } from '../personal/gestionAdministrativos';

function comprobar(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (['PGRST202', '42883', '42703'].includes(error.code || '')) throw new Error('Falta instalar la actualización de gestión de administrativos. El directorio y las fichas conservan su consulta.');
  throw new Error(error.message || 'No se pudo completar la operación.');
}
export const gestionAdministrativosService = {
  async cuentas(ids: string[]) {
    const filas: { empleado_id: string; cuentas: CuentaAdministrativo[] }[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.rpc('personal_cuentas_administrativas_v1', { p_ids: ids.slice(i, i + 200) });
      comprobar(error); filas.push(...(data || []));
    }
    return filas;
  },
  async revisar(id: string): Promise<RevisionAdministrativo> {
    const { data, error } = await supabase.rpc('personal_administrativo_revisar_v1', { p_empleado: id });
    comprobar(error);
    if (data?.empleado?.id !== id || !Array.isArray(data.cuentas) || !Array.isArray(data.dependencias)) throw new Error('El servidor no confirmó la revisión.');
    return data;
  },
  async buscar(busqueda: string): Promise<CuentaAdministrativo[]> {
    const { data, error } = await supabase.rpc('personal_cuentas_buscar_v1', { p_busqueda: busqueda.trim() });
    comprobar(error); return data || [];
  },
  async vincular(revision: RevisionAdministrativo, cuenta: CuentaAdministrativo, motivo: string) {
    const { data, error } = await supabase.rpc('personal_administrativo_vincular_cuenta_v1', {
      p_empleado: revision.empleado.id, p_usuario: cuenta.id, p_original: revision.empleado, p_motivo: motivo.trim(),
    });
    comprobar(error);
    if (data?.usuario_id !== cuenta.id) throw new Error('No se confirmó el vínculo. Consulta de nuevo antes de reintentar.');
  },
  async eliminar(revision: RevisionAdministrativo, motivo: string) {
    const { data, error } = await supabase.rpc('personal_administrativo_eliminar_v1', {
      p_empleado: revision.empleado.id, p_original: revision.empleado, p_motivo: motivo.trim(),
    });
    comprobar(error);
    if (data?.eliminado_id !== revision.empleado.id) throw new Error('No se confirmó la eliminación. Actualiza antes de reintentar.');
  },
  async crear(revision: RevisionAdministrativo, datos: { username: string; password: string; rol: string; email: string; motivo: string }) {
    const { data, error } = await supabase.functions.invoke('manage-users', { body: { action: 'CREATE_ADMINISTRATIVO', empleado_id: revision.empleado.id, original: revision.empleado, ...datos } });
    if (error) {
      const contexto = (error as { context?: Response }).context;
      const cuerpo = contexto ? await contexto.json().catch(() => null) : null;
      throw new Error(cuerpo?.error || 'No se pudo crear la cuenta. Revisa la conexión y el despliegue actualizado de manage-users.');
    }
    if (!data?.success) throw new Error(data?.error || 'No se confirmó la cuenta. Consulta antes de reintentar.');
  },
};
