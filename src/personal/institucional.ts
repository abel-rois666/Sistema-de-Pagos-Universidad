import type { ConfiguracionInstitucionalPersonal } from './types';
export const PUESTOS_PERSONAL=[
 {clave:1,nombre:'Director'},{clave:2,nombre:'Subdirector'},{clave:3,nombre:'Rector'},
 {clave:4,nombre:'Coordinador de Control Escolar'},{clave:5,nombre:'Responsable de Expedición'},
 {clave:6,nombre:'Coordinador de Relaciones Públicas'},{clave:7,nombre:'Coordinador Financiero'},
 {clave:8,nombre:'Coordinador Académico'},{clave:9,nombre:'Intendente'},{clave:10,nombre:'Auxiliar Administrativo'},
 {clave:11,nombre:'Coordinador de Recursos Humanos y Materiales'},{clave:12,nombre:'Tutoría y Bienestar'},{clave:13,nombre:'Portero'}
].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
export const AREAS_PERSONAL=['Rectoría','Dirección','Coordinación Académica','Coordinación Control Escolar','Coordinación Financiera','Coordinación de Recursos Humanos y Materiales','Coordinación de Vinculación','Coordinación de Relaciones Públicas'].sort((a,b)=>a.localeCompare(b,'es'));
export function validarInstitucional(d:ConfiguracionInstitucionalPersonal,original?:ConfiguracionInstitucionalPersonal|null):string[]{
 const e:string[]=[];
 if(d.puesto&&(!original||d.puesto!==original.puesto||d.clave_puesto!==original.clave_puesto)&&PUESTOS_PERSONAL.find(p=>p.nombre===d.puesto)?.clave!==d.clave_puesto)e.push('Revisa el cargo y su clave institucional.');
 if((d.firmante_certificados||d.firmante_titulos)&&![1,2,3,4,5].includes(d.clave_puesto))e.push('El cargo elegido no admite firma de certificados o títulos; desmarca esa autorización antes de guardar.');
 if(d.firmante_boletas&&![1,2,3,4,5,8].includes(d.clave_puesto))e.push('El cargo elegido no admite firma de boletas; desmarca esa autorización antes de guardar.');
 return e;
}
