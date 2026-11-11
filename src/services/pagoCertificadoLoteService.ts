import {interpretarValidacionPagoLote,type IncidenciaPagoCertificado} from '../certificacion/validacionPagoLote';
export type {IncidenciaPagoCertificado} from '../certificacion/validacionPagoLote';
import {supabase} from '../lib/supabase';
import {validarLotePago,type PagoCertificadoCandidato,type EstadoPagoCertificado} from '../certificacion/pagoLote';
const errorLote=(e:{code?:string;message:string})=>new Error(['PGRST202','42883','42702'].includes(e.code||'')?'Falta instalar la corrección y validación previa del pago de certificados (20261110140000). No se modificó ninguna ficha.':e.message);
export async function consultarPagoCertificadoLote(ids:string[],signal:AbortSignal):Promise<PagoCertificadoCandidato[]>{const {data,error}=await supabase.rpc('certificacion_pago_lote_preview_v1',{p_alumnos:ids}).abortSignal(signal);if(error)throw errorLote(error);if(!Array.isArray(data))throw new Error('El servidor no confirmó la vista previa.');return data;}
export async function aplicarPagoCertificadoLote(filas:PagoCertificadoCandidato[],estado:EstadoPagoCertificado,motivo:string,revisados:boolean){const aviso=validarLotePago(filas,estado,motivo,revisados);if(aviso)throw new Error(aviso);const {data,error}=await supabase.rpc('certificacion_pago_lote_aplicar_v1',{p_filas:filas.map(f=>({id:f.id,alumnoId:f.alumnoId,programaId:f.programaId,huella:f.huella})),p_estado:estado,p_motivo:motivo.trim(),p_revisar_concluidos:revisados});if(error)throw errorLote(error);if(data!==filas.length)throw new Error('Resultado no confirmado. Actualiza antes de repetir la operación.');}

export async function validarPagoCertificadoLote(filas:PagoCertificadoCandidato[],estado:EstadoPagoCertificado,motivo:string,revisados:boolean):Promise<IncidenciaPagoCertificado[]>{
 const aviso=validarLotePago(filas,estado,motivo,revisados);if(aviso)throw new Error(aviso);
 const {data,error}=await supabase.rpc('certificacion_pago_lote_validar_v1',{p_filas:filas.map(f=>({id:f.id,alumnoId:f.alumnoId,programaId:f.programaId,huella:f.huella})),p_estado:estado,p_motivo:motivo.trim(),p_revisar_concluidos:revisados});
 if(error)throw errorLote(error);
 return interpretarValidacionPagoLote(data);
}
