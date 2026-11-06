export interface InferenciaIngreso911 {
  alumno_programa_id:string; estado:'PROPUESTA'|'SIN_HISTORIAL'|'SIN_FECHA'|'AMBIGUA'|'POSTERIOR';
  ciclo_id:string|null; ciclo:string|null; fecha:string|null; registros:number;
}
export interface CandidatoIngreso911 {
  alumno_programa_id:string;alumno_id:string;matricula:string;nombre:string;plan_id:string;programa:string;grado:string;
  fuente_id:string|null;actualizado_en:string|null;desde:string;hasta:string|null;evidencia:string;
  tipo_ingreso:'PRIMER_INGRESO'|'REINGRESO'|'DESCONOCIDO';fecha_primer_ingreso:string;
  ingreso_procedencia:Record<string,unknown>;propuesta?:InferenciaIngreso911;
}
export function aplicarInferencias911(filas:CandidatoIngreso911[],seleccion:readonly string[],ciclo:string,reemplazar=false):CandidatoIngreso911[] {
  return filas.map(f=>{
    const p=f.propuesta;
    if(!seleccion.includes(f.alumno_programa_id)||p?.estado!=='PROPUESTA'||!p.fecha||(!reemplazar&&f.fecha_primer_ingreso))return f;
    return {...f,fecha_primer_ingreso:p.fecha,tipo_ingreso:f.tipo_ingreso==='DESCONOCIDO'?(p.ciclo_id===ciclo?'PRIMER_INGRESO':'REINGRESO'):f.tipo_ingreso,
      ingreso_procedencia:{origen:'CALIFICACIONES',ciclo_id:p.ciclo_id,ciclo:p.ciclo,fecha:p.fecha,confirmada:true}};
  });
}
export function validarLoteIngreso911(filas:CandidatoIngreso911[],seleccion:readonly string[],desde:string,hasta:string,evidencia:string):string[] {
  const xs=filas.filter(f=>seleccion.includes(f.alumno_programa_id)),errores:string[]=[];
  if(!xs.length)errores.push('Selecciona al menos un alumno.');
  if(xs.length>1000)errores.push('Confirma como máximo 1000 fuentes por operación.');
  for(const f of xs){
    const d=desde||f.desde,h=hasta||f.hasta,p=f.matricula||f.nombre;
    if(!d)errores.push(`${p}: falta la fecha de inscripción acreditada en este ciclo.`);
    if(h&&d&&h<d)errores.push(`${p}: el término de vigencia es anterior al inicio.`);
    if(!(evidencia||f.evidencia)?.trim())errores.push(`${p}: falta evidencia de inscripción.`);
    if(!f.grado.trim())errores.push(`${p}: falta el grado personal.`);
    if(f.tipo_ingreso==='PRIMER_INGRESO'&&!f.fecha_primer_ingreso)errores.push(`${p}: primer ingreso requiere fecha de inicio en el programa.`);
    if(f.fecha_primer_ingreso&&d&&f.fecha_primer_ingreso>d)errores.push(`${p}: el primer ingreso es posterior a la vigencia capturada.`);
  }
  return errores;
}
