import { supabase } from '../lib/supabase';
import { leerConfiguracionVista, type ConfiguracionVistaListado, type VistaListado } from '../reportes/vistasListado';

const errorVista = (e: { code?: string; message: string }) => new Error(['PGRST202', '42883'].includes(e.code || '')
  ? 'Falta instalar la actualización de vistas guardadas (20261109200000). Puedes seguir usando los filtros de esta consulta.' : e.message);
function leerFilas(data: unknown): VistaListado[] {
  if (!Array.isArray(data)) throw new Error('El servidor no confirmó la consulta de vistas.');
  return data.map(v => ({ ...v, configuracion: leerConfiguracionVista(v.configuracion) }))
    .sort((a,b)=>a.nombre.localeCompare(b.nombre,'es',{numeric:true})||a.id.localeCompare(b.id));
}
export const vistasListadoService = {
  async consultar(signal?: AbortSignal): Promise<VistaListado[]> {
    let q = supabase.rpc('listado_vistas_consultar_v1'); if (signal) q = q.abortSignal(signal);
    const { data, error } = await q; if (error) throw errorVista(error); return leerFilas(data);
  },
  async guardar(id: string, revision: number, nombre: string, configuracion: ConfiguracionVistaListado, predeterminada: boolean): Promise<VistaListado[]> {
    const { data, error } = await supabase.rpc('listado_vista_guardar_v1', { p_id: id, p_revision: revision,
      p_nombre: nombre.trim(), p_configuracion: leerConfiguracionVista(configuracion), p_predeterminada: predeterminada });
    if (error) throw errorVista(error); return leerFilas(data);
  },
  async eliminar(vista: VistaListado): Promise<VistaListado[]> {
    const { data, error } = await supabase.rpc('listado_vista_eliminar_v1', { p_id: vista.id, p_revision: vista.revision });
    if (error) throw errorVista(error); return leerFilas(data);
  },
};
