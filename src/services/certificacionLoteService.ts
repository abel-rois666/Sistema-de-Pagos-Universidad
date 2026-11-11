import {supabase} from '../lib/supabase';
export interface ProgramaDestinoCertificacion {id:string;etiqueta:string;disponible:boolean;motivo:string}
export interface CandidatoCertificacion {id:string;alumnoId:string;nombre:string;matricula:string;programaId:string|null;programa:string|null;elegible:boolean;motivo:string;pago:string;tramite:string;huella:string;detalle?:Record<string,unknown>;opciones?:ProgramaDestinoCertificacion[];cantidadProgramas?:number;revisable?:boolean}
const mensaje=(e:{code?:string;message:string})=>new Error(['PGRST202','42883'].includes(e.code||'')?'Falta instalar la asociación masiva (20261110020000). No se modificó ninguna ficha.':e.message);
export const certificacionLoteService={
 async consultar(desde:number,busqueda:string,signal:AbortSignal,vista='todos',alumno=''):Promise<{total:number;filas:CandidatoCertificacion[]}>{
  const {data,error}=await supabase.rpc('certificacion_lote_preview_v2',{p_desde:desde,p_busqueda:busqueda,p_vista:vista,p_alumno:alumno||null}).abortSignal(signal);
  if(error)throw mensaje(error);
  if(!data||!Number.isInteger(data.total)||!Array.isArray(data.filas))throw new Error('El servidor no confirmó la vista previa.');
  return data;
 },
 async asociar(filas:CandidatoCertificacion[],motivo:string){
  const {data,error}=await supabase.rpc('certificacion_asociar_lote_v2',{p_filas:filas.map(f=>({id:f.id,programaId:f.programaId,huella:f.huella})),p_motivo:motivo.trim()});
  if(error)throw mensaje(error);
  if(data!==filas.length)throw new Error('No se pudo confirmar el lote. Actualiza la consulta antes de reintentar.');
  return data as number;
 }
};
