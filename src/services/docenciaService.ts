import { supabase } from '../lib/supabase';
import type { ContextoDocencia, CorteDocente, EntregaAsignatura } from '../docencia/types';
import type { OrigenPersonal } from '../personal/types';
import { datosPagoPersonalValidados, type DatosPagoPersonal } from '../personal/datosPago';
async function rpc<T>(nombre:string,parametros:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(nombre,parametros);
 if(error){if(['PGRST202','42883'].includes(error.code))throw new Error('Esta función requiere instalar la actualización de Docencia y datos privados de Personal.');throw new Error(error.message);}
 if(!data)throw new Error('El servidor no confirmó la operación. Actualiza la consulta antes de reintentar.');return data as T;
}
export interface PerfilPagoPersonal {persona_id:string|null;revision:number;puede_editar:boolean;datos:DatosPagoPersonal}
function confirmarRevision(r:{revision:number},anterior:number){if(r.revision!==anterior+1)throw new Error('El servidor no confirmó la revisión esperada. Actualiza antes de reintentar.');return r;}
export const docenciaService={
 async consultar(docente:string,ciclo:string){const c=await rpc<ContextoDocencia>('docencia_consultar_v1',{p_docente:docente,p_ciclo:ciclo});if(c.ciclo?.id!==ciclo||!Array.isArray(c.cargas)||!Array.isArray(c.sesiones)||!Array.isArray(c.calendarios)||!Array.isArray(c.eventos)||!Array.isArray(c.expediente?.entregas)||!Number.isInteger(c.expediente.revision))throw new Error('La consulta de Docencia está incompleta. Actualiza antes de continuar.');return c;},
 async guardarExpediente(docente:string,ciclo:string,horario:string,revision:number,entregas:EntregaAsignatura[],carpeta:string|null,motivo:string){return confirmarRevision(await rpc<{revision:number}>('docencia_expediente_guardar_v1',{p_docente:docente,p_ciclo:ciclo,p_horario:horario,p_revision:revision,p_entregas:entregas.map(e=>({asignatura_id:e.asignatura_id,examenes:e.examenes,entregados:e.entregados})),p_carpeta:carpeta||null,p_motivo:motivo}),revision);},
 async guardarTarifa(ciclo:string,docente:string|null,revision:number,monto:number|null,cortes:CorteDocente[],motivo:string){return confirmarRevision(await rpc<{revision:number}>('docencia_tarifa_guardar_v1',{p_ciclo:ciclo,p_docente:docente,p_revision:revision,p_monto:monto,p_cortes:cortes,p_motivo:motivo}),revision);},
 consultarPago:(o:OrigenPersonal)=>rpc<PerfilPagoPersonal>('personal_pago_consultar_v1',{p_tipo:o.tipo,p_id:o.id}),
 async guardarPago(o:OrigenPersonal,perfil:PerfilPagoPersonal,datos:DatosPagoPersonal,motivo:string){return confirmarRevision(await rpc<{revision:number}>('personal_pago_guardar_v1',{p_tipo:o.tipo,p_id:o.id,p_persona:perfil.persona_id,p_revision:perfil.revision,p_datos:datosPagoPersonalValidados(datos),p_motivo:motivo}),perfil.revision);},
};
