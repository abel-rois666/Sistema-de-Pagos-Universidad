import type { DatosPersona } from './types';

export type PartesNombre = Pick<DatosPersona,'nombres'|'apellido_paterno'|'apellido_materno'>;
export const limpiarNombre = (valor?:string|null) => (valor||'').trim().replace(/\s+/g,' ');
export function partesNombre(datos:PartesNombre):string[] {
  return [datos.apellido_paterno,datos.apellido_materno,datos.nombres].map(limpiarNombre);
}
export function nombreEstructurado(datos:PartesNombre):boolean {
  return Boolean(limpiarNombre(datos.nombres)&&limpiarNombre(datos.apellido_paterno));
}
/** Conserva el orden histórico de los directorios: apellidos y nombres. No divide texto. */
export function componerNombrePersonal(datos:PartesNombre):string {
  return partesNombre(datos).filter(Boolean).join(' ');
}
export function cambioNombre(datos:PartesNombre,original:PartesNombre|null):boolean {
  return JSON.stringify(partesNombre(datos))!==JSON.stringify(partesNombre(original||{}));
}
export function validarNombrePersonal(datos:DatosPersona,original:DatosPersona|null,revisado:boolean):string[] {
  const partes=partesNombre(datos),cambio=cambioNombre(datos,original);
  // Un contacto histórico puede corregirse sin inventar apellidos ni cambiar su nombre.
  if(original&&!nombreEstructurado(original)&&!partes.some(Boolean))return [];
  if(!nombreEstructurado(datos))return ['Completa primer apellido y nombre(s). El segundo apellido es opcional.'];
  if(original&&cambio&&!revisado)return ['Confirma que revisaste los nombres y apellidos antes de guardar.'];
  return [];
}
