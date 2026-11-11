import type {CandidatoCertificacion} from '../services/certificacionLoteService';
/** La elección explícita reemplaza la propuesta; un destino ocupado nunca habilita la fila. */
export function prepararDestinoLote(f:CandidatoCertificacion,destino?:string):CandidatoCertificacion{
 const id=destino??f.programaId??'',op=f.opciones?.find(o=>o.id===id&&o.disponible);
 return {...f,programaId:op?.id||null,programa:op?.etiqueta||null,elegible:Boolean(f.revisable&&op)};
}
