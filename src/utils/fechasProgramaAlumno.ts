/** La captura es un instante; la referencia académica es una fecha civil.
 * Ninguna de estas funciones completa el ingreso acreditado del programa. */
export function fechaCapturaPrograma(iso?:string){
 const fecha=new Date(iso||'');
 return Number.isNaN(fecha.getTime())?'No disponible':fecha.toLocaleDateString('es-MX',{timeZone:'America/Mexico_City'});
}
export function fechaCivilPrograma(iso?:string|null){
 return iso&&/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.split('-').reverse().join('/'):'Sin fecha registrada';
}
