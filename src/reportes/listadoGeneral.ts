import type { Alumno } from '../types';
import { STATE_MAPPING } from '../utils/geoUtils';

export type ColumnaListadoId='nombre'|'licenciatura'|'turno'|'estatus'|'telefonos'|'email'|'grado'|'edad'|'sexo'|'nacimiento'|'procedencia'|'residencia';
export interface ColumnaListado {id:ColumnaListadoId;nombre:string;ayuda?:string;opcional?:boolean;ancho:number;valor:(a:Alumno,fecha:string)=>string}
export function fechaActualListado(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function fechaCivilValida(iso:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return false;
 const [y,m,d]=iso.split('-').map(Number),f=new Date(0);f.setUTCFullYear(y,m-1,d);f.setUTCHours(0,0,0,0);
 return y>0&&f.getUTCFullYear()===y&&f.getUTCMonth()===m-1&&f.getUTCDate()===d;
}
export function edadListado(nacimiento:string|null|undefined,referencia:string):number|null{
 if(!nacimiento||!fechaCivilValida(nacimiento)||!fechaCivilValida(referencia)||nacimiento>referencia)return null;
 const [y,m,d]=nacimiento.split('-').map(Number),[ry,rm,rd]=referencia.split('-').map(Number);
 return ry-y-(rm<m||(rm===m&&rd<d)?1:0);
}
export const fechaLegibleListado=(f:string)=>fechaCivilValida(f)?f.split('-').reverse().join('/'):'Fecha no válida';
const normalizar=(s:string)=>s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\./g,'').toUpperCase();
const entidades=[['AGS','Aguascalientes'],['BC','Baja California'],['BCS','Baja California Sur'],['CAM','Campeche'],['COAH','Coahuila de Zaragoza'],['COL','Colima'],['CHIS','Chiapas'],['CHIH','Chihuahua'],['DF','Ciudad de México'],['DGO','Durango'],['GTO','Guanajuato'],['GRO','Guerrero'],['HGO','Hidalgo'],['JAL','Jalisco'],['MEX','Estado de México'],['MICH','Michoacán de Ocampo'],['MOR','Morelos'],['NAY','Nayarit'],['NL','Nuevo León'],['OAX','Oaxaca'],['PUE','Puebla'],['QRO','Querétaro'],['QROO','Quintana Roo'],['SLP','San Luis Potosí'],['SIN','Sinaloa'],['SON','Sonora'],['TAB','Tabasco'],['TAMPS','Tamaulipas'],['TLAX','Tlaxcala'],['VER','Veracruz de Ignacio de la Llave'],['YUC','Yucatán'],['ZAC','Zacatecas']];
const porClave=new Map(entidades.map(([clave,nombre])=>[clave,nombre]));
const alias=new Map(Object.entries(STATE_MAPPING).map(([nombre,clave])=>[normalizar(nombre),clave==='GR'?'GRO':clave]));
export function entidadListado(valor:string|null|undefined):string{
 const raw=valor?.trim();if(!raw)return 'Sin dato';const v=normalizar(raw);
 // Fuera de 01–32, una clave numérica no prueba residencia/nacimiento extranjero.
 if(['NE','EXT','EXTRANJERO','NACIDO EN EL EXTRANJERO'].includes(v))return 'Extranjero';
 if(/^\d{1,2}$/.test(v)){const n=Number(v);return entidades[n-1]?.[1]||`Por revisar (${raw})`;}
 const clave=v==='CDMX'?'DF':v==='GR'?'GRO':alias.get(v)||v;
 return porClave.get(clave)||`Por revisar (${raw})`;
}
export function gradoListado(valor:string|null|undefined){const v=valor?.trim();if(!v)return 'Sin dato';const m=v.toUpperCase().match(/^(\d+)(?:ER|RO|DO|TO|VO|MO|NO|º|°)?$/);return m&&Number(m[1])>0?String(Number(m[1])):`Por revisar (${v})`;}
export function sexoListado(a:Alumno){const v=a.sexo?.trim().toUpperCase();if(v==='H')return 'Hombre';if(v==='M')return 'Mujer';if(v)return `Por revisar (${v})`;return a.id_sexo===251?'Hombre':a.id_sexo===250?'Mujer':'Sin dato';}
const dato=(v?:string|null)=>v?.trim()||'Sin dato';
export const COLUMNAS_LISTADO:readonly ColumnaListado[]=[
 {id:'nombre',nombre:'Nombre completo',ancho:48,valor:a=>dato(a.nombre_completo)},
 {id:'licenciatura',nombre:'Licenciatura',ancho:36,valor:a=>dato(a.licenciatura)},
 {id:'turno',nombre:'Turno',ancho:25,valor:a=>dato(a.turno)},
 {id:'estatus',nombre:'Estatus',ancho:25,valor:a=>dato(a.estatus)},
 {id:'telefonos',nombre:'Teléfonos',ancho:34,valor:a=>[a.telefono,a.celular].filter(Boolean).join(' / ')||'Sin dato'},
 {id:'email',nombre:'Correo electrónico',opcional:true,ancho:45,valor:a=>dato(a.email)},
 {id:'grado',nombre:'Grado de avance actual',opcional:true,ancho:28,ayuda:'Grado personal actual del alumno. No es el grado del grupo ni reconstruye un grado histórico al elegir otro ciclo.',valor:a=>gradoListado(a.grado_actual)},
 {id:'edad',nombre:'Edad',opcional:true,ancho:27,ayuda:'Años cumplidos a la fecha de referencia. Una fecha de nacimiento ausente, inválida o posterior queda sin dato.',valor:(a,f)=>{const n=edadListado(a.fecha_nacimiento,f);return n===null?'Sin dato':String(n);}},
 {id:'sexo',nombre:'Sexo',opcional:true,ancho:22,valor:sexoListado},
 {id:'nacimiento',nombre:'Entidad de nacimiento',opcional:true,ancho:38,valor:a=>entidadListado(a.estado_nacimiento)},
 {id:'procedencia',nombre:'Entidad de escolaridad de procedencia',opcional:true,ancho:40,ayuda:'Estado de escolaridad registrado. En licenciatura suele corresponder al bachillerato; en posgrado puede representar otro antecedente. No se reclasifica automáticamente.',valor:a=>entidadListado(a.estado_escolaridad)},
 {id:'residencia',nombre:'Entidad de residencia',opcional:true,ancho:38,valor:a=>entidadListado(a.estado)},
];
export const columnasListado=(seleccion:readonly ColumnaListadoId[])=>COLUMNAS_LISTADO.filter(c=>!c.opcional||seleccion.includes(c.id));
export const etiquetaColumnaListado=(c:ColumnaListado,fecha:string)=>c.id==='edad'?`Edad al ${fechaLegibleListado(fecha)} (años)`:c.nombre;
export function ordenarListado(alumnos:readonly Alumno[],columna:ColumnaListadoId,descendente:boolean,fecha:string){
 const c=COLUMNAS_LISTADO.find(c=>c.id===columna)||COLUMNAS_LISTADO[0];
 return [...alumnos].sort((a,b)=>(descendente?-1:1)*c.valor(a,fecha).localeCompare(c.valor(b,fecha),'es-MX',{numeric:true,sensitivity:'base'})||a.nombre_completo.localeCompare(b.nombre_completo,'es-MX')||a.id.localeCompare(b.id));
}
export function csvListado(alumnos:readonly Alumno[],columnas:readonly ColumnaListado[],fecha:string){
 const celda=(valor:string)=>'"'+(/^[\s]*[=+@-]/.test(valor)?"'"+valor:valor).replace(/"/g,'""')+'"';
 return '\uFEFF'+[columnas.map(c=>etiquetaColumnaListado(c,fecha)),...alumnos.map(a=>columnas.map(c=>c.valor(a,fecha)))].map(f=>f.map(celda).join(',')).join('\r\n');
}
