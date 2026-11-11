import type {FichaTitulacion,AlumnoPrograma} from '../types';
export function validarArchivoTitulacion(ficha:FichaTitulacion,motivo:string){
 if(ficha.archivado_en)throw new Error('La ficha ya está archivada. Actualiza la consulta.');
 if(motivo.trim().length<5||motivo.trim().length>1000)throw new Error('Describe el motivo (5–1000 caracteres).');
}
export function prepararAsociacionTitulacion(ficha:FichaTitulacion,destino:string,motivo:string,programas:readonly AlumnoPrograma[],ocupados:readonly string[]){
 validarArchivoTitulacion(ficha,motivo);
 if(ficha.alumno_programa_id)throw new Error('La ficha ya está asociada; no se reasigna mediante este flujo.');
 if(!programas.some(p=>p.id===destino&&p.alumno_id===ficha.alumno_id))throw new Error('Selecciona un programa de este alumno.');
 if(ocupados.includes(destino))throw new Error('El programa tiene otra ficha, incluso archivada. No se sobrescribirá.');
 return ficha;
}
