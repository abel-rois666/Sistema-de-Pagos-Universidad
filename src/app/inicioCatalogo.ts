import { puedeAccederRuta } from './capacidades';
import { tareasAreas,type TareaArea } from './navegacion';
export const AREAS_INICIO = [
 {id:'escolar',titulo:'Control Escolar',descripcion:'Alumnos, inscripciones, documentos y reportes.'},
 {id:'academico',titulo:'Control Académico',descripcion:'Docentes, asignaturas y horarios.'},
 {id:'finanzas',titulo:'Control Financiero',descripcion:'Planes de pago, recibos y consultas.'},
 {id:'rh',titulo:'Recursos Humanos',descripcion:'Personal, expedientes y NOM-035.'},
] as const;
export function areaPreferidaInicio(rol?:string):TareaArea['area']{return rol==='COORDINADOR ACADEMICO'||rol==='DOCENTE'?'academico':rol==='COORDINADOR RECURSOS HUMANOS'?'rh':rol==='CAJERO'||rol==='COORDINADOR FINANCIERO'?'finanzas':'escolar';}
/** Solo tareas operativas. Las herramientas de corrección conservan su acceso en el menú. */
export function tareasInicio(rol:string|undefined,area?:TareaArea['area'],busqueda=''){
 const normalizar=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const palabras=normalizar(busqueda).trim().split(/\s+/).filter(Boolean);
 return tareasAreas.filter(t=>t.ruta!=='/herramientas-escolares'&&(!area||t.area===area)&&t.roles.includes(rol||'')&&puedeAccederRuta(rol,t.ruta))
 .filter(t=>palabras.every(p=>normalizar(`${t.titulo} ${t.descripcion} ${AREAS_INICIO.find(a=>a.id===t.area)?.titulo||''}`).includes(p)));
}
