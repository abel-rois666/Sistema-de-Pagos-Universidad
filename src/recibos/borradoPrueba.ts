import { createError, createSuccess, type Result } from '../services/types';

interface ErrorBorrado { code?: string; message?: string; }
type EjecutarBorrado = (funcion: string, parametros: { p_recibo_id: string }) => PromiseLike<{ error: ErrorBorrado | null }>;

/** Sin fallback: el servidor anterior puede retroceder la secuencia. */
export async function borrarReciboPrueba(reciboId: string, ejecutar: EjecutarBorrado): Promise<Result<void>> {
  if (!reciboId) return createError('Selecciona el recibo de prueba.');
  try {
    const { error } = await ejecutar('borrar_recibo_prueba_v2', { p_recibo_id: reciboId });
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        return createError('Falta instalar o verificar la corrección de borrado sin reinicio de folios (20261109180000). El borrado no se realizó.');
      }
      if (error.code === '23503') return createError('El recibo tiene registros vinculados que impiden eliminarlo. Revisa sus dependencias; no se modificó el monedero.');
      if (error.code === '42501') return createError('Solo Administración con cuenta activa puede eliminar recibos de prueba.');
      return createError(error.message || 'No se pudo eliminar el recibo de prueba.');
    }
    return createSuccess(undefined);
  } catch {
    return createError('No se pudo confirmar el borrado. Actualiza la consulta antes de volver a intentarlo.');
  }
}
