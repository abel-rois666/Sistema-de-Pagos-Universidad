import type {FichaTitulacion} from '../types';
export type EstadosRequisitos = Pick<FichaTitulacion,'certificado_estudios'|'ingles'|'servicio_social_req'|'pago_titulacion'|'promedio_alto_rendimiento'>;
export interface RequisitosTitulacion {
 estados:EstadosRequisitos; alumno_id:string;alumno_programa_id:string;plan_id:string; plan_pago_id:string|null; servicio_social_id:string|null; certificacion_id:string|null;
 ingles_total:number;ingles_aprobadas:number;materias_plan:number;promedio:number|null;materias_promedio:number;materias_con_nota:number;
 pago_revisar:boolean;pago_conceptos:number;pago_pagados:number;verificado_en:string;criterio_promedio:string;
 planes_pago:{id:string;folio:string|null;licenciatura:string|null;ciclo:string;tipo_periodo:string}[];
 servicios_sociales:{id:string;empresa:string;estado:string;fecha:string|null}[];
}
/** No presupone que un promedio parcial o redondeado alcance el umbral institucional. */
export function altoRendimiento(promedio:number|null,esperadas:number,conNota:number):EstadosRequisitos['promedio_alto_rendimiento'] {
 if(promedio===null||!Number.isFinite(promedio)||esperadas<=0||conNota<esperadas)return 'SIN_INICIAR';
 return Math.trunc(promedio*100)/100>=9.50?'APLICA':'NO_APLICA';
}
export function aplicarRequisitos<T extends EstadosRequisitos>(draft:T,r:RequisitosTitulacion):T {
 return {...draft,...r.estados,plan_pago_requisito_id:r.plan_pago_id,servicio_social_requisito_id:r.servicio_social_id};
}
export function verificarRespuestaRequisitos(r:unknown):asserts r is RequisitosTitulacion {
 const d=r as RequisitosTitulacion;
 if(!d?.estados||!d.plan_id||!d.alumno_id||!d.alumno_programa_id||d.criterio_promedio!=='>=9.50'||!Array.isArray(d.planes_pago)||!Array.isArray(d.servicios_sociales))throw new Error('La consulta de requisitos está incompleta. Actualiza antes de guardar.');
 if(d.promedio!==null&&(typeof d.promedio!=='number'||!Number.isFinite(d.promedio)||d.promedio<0||d.promedio>10))throw new Error('La comprobación no devolvió un promedio válido.');
 for(const k of ['ingles_total','ingles_aprobadas','materias_plan','materias_promedio','materias_con_nota','pago_conceptos','pago_pagados'] as const)if(!Number.isInteger(d[k])||d[k]<0)throw new Error('La comprobación de requisitos no devolvió conteos válidos.');
 const permitidos={certificado_estudios:['SIN_INICIAR','EN_TRAMITE','TRAMITADO'],ingles:['SIN_INICIAR','EN_CURSO','COMPLETADO'],servicio_social_req:['SIN_INICIAR','EN_CURSO','COMPLETADO'],pago_titulacion:['SIN_INICIAR','EN_CURSO','COMPLETADO'],promedio_alto_rendimiento:['SIN_INICIAR','NO_APLICA','APLICA']};
 for(const key of Object.keys(permitidos) as (keyof EstadosRequisitos)[])if(!permitidos[key].includes(d.estados[key]||''))throw new Error('El servidor devolvió un estado de requisito no reconocido.');
 if(d.estados.promedio_alto_rendimiento!==altoRendimiento(d.promedio,d.materias_promedio,d.materias_con_nota))throw new Error('El criterio de promedio del servidor no coincide con 9.50 o superior.');
}
