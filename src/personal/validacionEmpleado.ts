import type {Empleado} from '../types';
export type CampoEmpleado='nombres'|'apellido_paterno'|'fecha_nacimiento'|'fecha_ingreso';
export interface ErrorCampoEmpleado {campo:CampoEmpleado;mensaje:string;tab:'generales'|'laborales'}
const fechaValida=(valor:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(valor))return false;
 const d=new Date(valor+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===valor;
};
export function validarEmpleadoBasico(form:Partial<Empleado>):ErrorCampoEmpleado[]{
 const errores:ErrorCampoEmpleado[]=[];
 if(!form.nombres?.trim())errores.push({campo:'nombres',tab:'generales',mensaje:'Escribe el nombre o los nombres.'});
 if(!form.apellido_paterno?.trim())errores.push({campo:'apellido_paterno',tab:'generales',mensaje:'Escribe el apellido paterno.'});
 for(const [campo,label,tab] of [['fecha_nacimiento','Fecha de nacimiento','generales'],['fecha_ingreso','Fecha de ingreso','laborales']] as const){const v=form[campo]?.trim();if(v&&!fechaValida(v))errores.push({campo,tab,mensaje:`${label}: selecciona una fecha válida o deja el campo vacío; es opcional.`});}
 return errores;
}
/** Las fechas opcionales vacías son NULL; los demás datos y valores históricos se conservan. */
export function normalizarEmpleado(form:Partial<Empleado>):Partial<Empleado>{return {...form,fecha_nacimiento:form.fecha_nacimiento?.trim()||null,fecha_ingreso:form.fecha_ingreso?.trim()||null};}
const etiquetas:Record<string,string>={nombres:'Nombre(s)',apellido_paterno:'Apellido paterno',fecha_ingreso:'Fecha de ingreso',fecha_nacimiento:'Fecha de nacimiento',puesto:'Puesto',departamento:'Departamento',tipo_contratacion:'Tipo de contratación',tipo_jornada:'Tipo de jornada'};
export function mensajeErrorEmpleado(error:unknown):string{
 const e=error as {code?:string;message?:string};
 if(e?.code==='23502'){const campo=e.message?.match(/column "([^"]+)"/)?.[1];return campo&&etiquetas[campo]?`Falta completar «${etiquetas[campo]}», requerido por la configuración de la base de datos.`:'Falta un dato obligatorio requerido por la base de datos. Revisa los campos señalados antes de guardar.';}
 if(e?.code==='22007'||e?.code==='22008'||e?.code==='22P02')return 'No se pudo interpretar una fecha o un dato numérico. Revisa Fecha de nacimiento, Fecha de ingreso y Clave de puesto. Las fechas son opcionales: puedes dejarlas vacías.';
 if(e?.code==='42501')return 'No tienes permiso para guardar este empleado. Solicita a Administración que revise tu acceso.';
 if(e?.code==='23505')return 'Ya existe un registro con alguno de estos identificadores. Revisa RFC y CURP antes de guardar.';
 if(e?.code)return 'No se pudo guardar el empleado. La captura se conserva; vuelve a intentarlo o solicita a Administración revisar el problema.';
 return e?.message||'No se pudo guardar el empleado. La captura se conserva.';
}
