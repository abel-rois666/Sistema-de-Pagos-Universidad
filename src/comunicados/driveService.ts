import { supabase } from '../lib/supabase';
import type { DocumentoPreparado } from './documentos';
import type { PlantillasComunicado } from './preparacion';

export interface EmisionComunicado {
  id: string;
  alumno_id: string;
  ciclo_id: string;
  ciclo_boleta_id: string | null;
  boleta_no_aplica: boolean;
  numero: number;
  estado: 'BORRADOR' | 'LISTO' | 'ENVIADO' | 'REVOCADO' | 'ELIMINADO';
  enlace: string | null;
  creada_en: string;
  enviada_en: string | null;
  comunicados_documentos?: { tipo: DocumentoPreparado['tipo']; ciclo_id: string | null;
    nombre: string; subido_en: string }[];
}

interface RespuestaEstado {
  conexion: { correo: string; carpetaRaizId: string } | null;
  emisiones: EmisionComunicado[];
  plantilla: PlantillasComunicado | string;
}

async function invocar<T>(cuerpo: Record<string, unknown> | FormData): Promise<T> {
  const { data, error } = await supabase.functions.invoke('comunicados-drive', { body: cuerpo });
  if (error) {
    let mensaje = error.message;
    const contexto = (error as { context?: Response }).context;
    if (contexto?.json) {
      try { mensaje = (await contexto.json())?.error || mensaje; } catch { /* Respuesta no JSON. */ }
    }
    throw new Error(mensaje);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const estadoDrive = (cicloId: string) => invocar<RespuestaEstado>({ accion: 'estado', cicloId });
export const guardarPlantillaMensaje = async (plantilla: PlantillasComunicado): Promise<PlantillasComunicado> => {
  const respuesta = await invocar<{ plantilla: PlantillasComunicado | string }>({ accion: 'guardar_plantilla', ...plantilla });
  if (typeof respuesta.plantilla === 'string')
    throw new Error('Despliega la versión nueva de comunicados-drive antes de guardar las tres plantillas.');
  return respuesta.plantilla;
};
export const iniciarConexionDrive = async (): Promise<string> =>
  (await invocar<{ url: string }>({ accion: 'autorizar' })).url;
export const prepararEmision = async (
  alumnoId: string, cicloId: string, cicloBoletaId: string | null, tipos: DocumentoPreparado['tipo'][],
): Promise<EmisionComunicado> =>
  (await invocar<{ emision: EmisionComunicado }>({ accion: 'preparar', alumnoId, cicloId, cicloBoletaId, tipos })).emision;
export async function subirDocumento(emisionId: string, documento: DocumentoPreparado): Promise<void> {
  const datos = new FormData();
  datos.append('accion', 'subir');
  datos.append('emisionId', emisionId);
  datos.append('tipo', documento.tipo);
  datos.append('cicloId', documento.cicloId);
  datos.append('archivo', new File([documento.blob], documento.nombre, { type: 'application/pdf' }));
  await invocar(datos);
}
export const habilitarEnlace = async (emisionId: string): Promise<EmisionComunicado> =>
  (await invocar<{ emision: EmisionComunicado }>({
    accion: 'habilitar_enlace', emisionId, confirmado: true,
  })).emision;
export const marcarEnviado = async (emisionId: string): Promise<void> => {
  await invocar({ accion: 'marcar_enviado', emisionId });
};
export const revocarEnlace = async (emisionId: string): Promise<void> => {
  await invocar({ accion: 'revocar', emisionId });
};
export const eliminarEmisionAnterior = async (emisionId: string): Promise<void> => {
  await invocar({ accion: 'eliminar_emision', emisionId });
};
