import {validarArchivoTitulacion} from '../titulacion/revision';
import {supabase} from '../lib/supabase';
import type {FichaTitulacion,AlumnoPrograma} from '../types';
const campos=['modalidad','pago_titulacion','certificado_estudios','ingles','servicio_social_req','fotografias','doc_antecedente','doc_antecedente_nota','doc_acta_nacimiento','doc_acta_nacimiento_nota','doc_curp','doc_curp_nota','doc_titulo_profesional','doc_titulo_profesional_nota','doc_cedula_profesional','doc_cedula_profesional_nota','promedio_alto_rendimiento','fecha_inicio_tramite','fecha_estimada_culminacion','enlace_drive','libro','foja','folio_control','fecha_examen','fecha_exencion'];
export async function guardarTitulacion(alumno:string,programa:string,ficha:FichaTitulacion|null,draft:object,accion='GUARDAR',motivo='Actualización revisada del trámite'){
 if(motivo.trim().length<5)throw new Error('Describe el motivo de la operación (mínimo 5 caracteres).');
 const datos=Object.fromEntries(Object.entries(draft).filter(([k])=>campos.includes(k)));
 const {data,error}=await supabase.rpc('titulacion_guardar_v1',{p_alumno:alumno,p_programa:programa,p_id:ficha?.id||null,p_revision:(ficha as any)?.revision??0,p_datos:datos,p_accion:accion,p_motivo:motivo});
 if(error)throw new Error(['PGRST202','42883'].includes(error.code)?'Falta instalar titulación por programa (20261110100000). La captura se conserva.':error.message);
 if(!data?.id)throw new Error('El servidor no confirmó el guardado. Consulta antes de repetir.');return data as FichaTitulacion;
}

export interface ConsultaTitulacion {fichas:FichaTitulacion[];programas:AlumnoPrograma[];ocupados:string[]}
function falloRevision(error:{code?:string;message:string}){return new Error(['PGRST202','42883'].includes(error.code||'')?'Falta instalar la revisión y archivo de titulación (20261110120000). No se modificó ninguna ficha.':error.message);}
export async function consultarTitulacion(alumno:string,signal?:AbortSignal):Promise<ConsultaTitulacion>{
 let q=supabase.rpc('titulacion_consultar_v1',{p_alumno:alumno});if(signal)q=q.abortSignal(signal);const {data,error}=await q;
 if(error)throw falloRevision(error);if(!data||!Array.isArray(data.fichas)||!Array.isArray(data.programas)||!Array.isArray(data.ocupados))throw new Error('Consulta de titulación incompleta.');return data;
}
export async function archivarTitulacion(ficha:FichaTitulacion,motivo:string){
 validarArchivoTitulacion(ficha,motivo);
 const {error}=await supabase.rpc('titulacion_archivar_v1',{p_id:ficha.id,p_revision:ficha.revision??0,p_motivo:motivo.trim()});if(error)throw falloRevision(error);
}
export async function asociarTitulacionAnterior(ficha:FichaTitulacion,programa:string,motivo:string):Promise<FichaTitulacion>{
 const {data,error}=await supabase.rpc('titulacion_asociar_anterior_v1',{p_id:ficha.id,p_revision:ficha.revision??0,p_programa:programa,p_motivo:motivo.trim()});if(error)throw falloRevision(error);if(!data?.id)throw new Error('No se confirmó la asignación. Actualiza antes de reintentar.');return data;
}
