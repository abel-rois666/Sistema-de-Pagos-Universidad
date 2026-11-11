export interface IncidenciaPagoCertificado {id:string;motivo:string}
/** Una respuesta incompleta nunca habilita la confirmación del lote. */
export function interpretarValidacionPagoLote(data:unknown):IncidenciaPagoCertificado[]{
 const r=data as {valido?:unknown;incidencias?:unknown};
 if(!r||typeof r.valido!=='boolean'||!Array.isArray(r.incidencias)||r.incidencias.some(i=>!i||typeof i.id!=='string'||!i.id.trim()||typeof i.motivo!=='string'||!i.motivo.trim())||r.valido!==(r.incidencias.length===0))throw new Error('El servidor no confirmó la validación del lote. No se continuará al resumen.');
 return r.incidencias;
}
