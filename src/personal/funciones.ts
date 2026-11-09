import type { OrigenPersonal,PerfilPersonal } from './types';
import { nombreEstructurado } from './nombres';
export function validarAltaFuncion(origen:OrigenPersonal,perfil:PerfilPersonal,destino:OrigenPersonal['tipo'],clave:string,motivo:string,revisado:boolean,estatus='activo'):string[]{
 const e:string[]=[];
 if(!['activo','inactivo'].includes(estatus))e.push('Elige la situación de la función.');
 if(!perfil.original)e.push('Registra primero a la persona.');
 if(origen.tipo===destino||(destino==='DOCENTE'?perfil.docente_id:perfil.empleado_id))e.push('La persona ya tiene esa función. Abre su sección existente.');
 if(!revisado)e.push('Confirma que revisaste la identidad y los registros existentes.');
 if(motivo.trim().length<10)e.push('Describe el respaldo de identidad y la función que añades.');
 if(destino==='EMPLEADO'&&!nombreEstructurado(perfil.datos))e.push('Completa primero nombres y apellidos en Datos generales.');
 if(destino==='DOCENTE'&&(!clave.trim()||clave.trim().length>80))e.push('Escribe una clave docente única de hasta 80 caracteres.');
 return e;
}
