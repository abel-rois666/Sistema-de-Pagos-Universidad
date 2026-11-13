/** Destino después de un inicio de sesión explícito; no reemplaza enlaces de sesiones vigentes. */
export function rutaInicialUsuario(rol:string){
 if(rol==='DOCENTE')return '/calificaciones';
 if(rol==='COORDINADOR FINANCIERO'||rol==='CAJERO')return '/';
 if(rol==='COORDINADOR RECURSOS HUMANOS')return '/rh';
 return '/dashboard';
}
export const usaInicioFinanciero=(rol?:string)=>rol==='COORDINADOR FINANCIERO'||rol==='CAJERO';
