export const ESTADOS_PAGO_CERTIFICADO=[{value:'SIN_INICIAR',label:'Sin iniciar'},{value:'EN_CURSO',label:'En curso'},{value:'COMPLETADO',label:'Completado'}] as const;
export type EstadoPagoCertificado=typeof ESTADOS_PAGO_CERTIFICADO[number]['value'];
export interface PagoCertificadoCandidato {id:string|null;alumnoId:string;programaId:string|null;nombre:string;matricula:string;programa:string;estado:string;concluido:boolean;elegible:boolean;motivo:string;huella:string|null}
export function validarLotePago(filas:readonly PagoCertificadoCandidato[],estado:string,motivo:string,revisados:boolean):string|null{
 if(!filas.length||filas.length>50)return 'Selecciona entre 1 y 50 fichas.';
 if(new Set(filas.map(f=>f.id)).size!==filas.length||filas.some(f=>!f.id||!f.programaId||!f.huella||!f.elegible))return 'Selecciona únicamente fichas asociadas disponibles, sin duplicarlas.';
 if(!ESTADOS_PAGO_CERTIFICADO.some(e=>e.value===estado))return 'Selecciona un estado de pago válido.';
 if(motivo.trim().length<10||motivo.trim().length>1000)return 'Describe el motivo (10–1000 caracteres).';
 if(estado!=='COMPLETADO'&&filas.some(f=>f.concluido)&&!revisados)return 'Confirma la revisión del cambio en trámites concluidos.';
 return null;
}
export function etiquetaPagoCertificado(estado:string){return ESTADOS_PAGO_CERTIFICADO.find(e=>e.value===estado)?.label||'Por revisar';}

/** Selección explícita de las fichas disponibles de esta revisión, sin recortar el lote. */
export function seleccionarDisponiblesPagoCertificado(filas:readonly PagoCertificadoCandidato[]):Record<string,boolean>{
 const ids=[...new Set(filas.filter(f=>f.elegible&&f.id&&f.programaId&&f.huella).map(f=>f.id!))];
 if(ids.length>50)throw new Error('Hay más de 50 fichas disponibles. Selecciona individualmente hasta 50 para este lote.');
 return Object.fromEntries(ids.map(id=>[id,true]));
}
