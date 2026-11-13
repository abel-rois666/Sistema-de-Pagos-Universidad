import { puedeAccederRuta } from './capacidades';

export type IconoNavegacion = 'inicio' | 'escolar' | 'financiero' | 'academico' | 'rh' | 'configuracion' | 'alumnos' | 'calendario' | 'horarios' | 'documento' | 'docentes' | 'inscripciones';
export interface ElementoMenu { name: string; shortName?: string; path: string; icon: IconoNavegacion; children?: ElementoMenu[]; incluirInicioMovil?: boolean }

/** Un único catálogo alimenta la barra lateral y la navegación móvil, sin ampliar permisos. */
export function menuAplicacion(rol: string): ElementoMenu[] {
  if (rol === 'DOCENTE') return [{name:'Captura de Calificaciones',shortName:'Calificaciones',path:'/calificaciones',icon:'academico'}];
  let items: ElementoMenu[] = [
    {name:'Inicio',path:'/dashboard',icon:'inicio'},
    {name:'Control Escolar',shortName:'C. Escolar',path:'/control-escolar',icon:'escolar',children:[
      {name:'Gestión de Alumnos',path:'/alumnos',icon:'alumnos'},
      {name:'Inscripciones por ciclo',path:'/inscripciones',icon:'inscripciones'},
      {name:'Grupos',path:'/grupos',icon:'alumnos'},
      {name:'Calendarios académicos',path:'/calendarios',icon:'calendario'},
      {name:'Comunicados',path:'/comunicados',icon:'documento'},
      {name:'Estadística 911',path:'/estadistica-911',icon:'documento'},
      {name:'Planes de Estudio',path:'/planes-estudio',icon:'academico'},
      {name:'Calificaciones',path:'/calificaciones',icon:'academico'},
      {name:'Exportar certificados',path:'/certificacion',icon:'documento'},
      {name:'Exportar títulos',path:'/titulacion',icon:'documento'},
      {name:'Herramientas administrativas',path:'/herramientas-escolares',icon:'configuracion'},
      {name:'Reportes',path:'/reportes-escolares',icon:'documento'},
      {name:'Aprobación Prospectos',path:'/aprobacion-prospectos',icon:'inscripciones'},
    ]},
    {name:'Control Financiero',shortName:'Financiero',path:'/',icon:'financiero',incluirInicioMovil:false,children:[
      {name:'Planes de pago',path:'/plan-pagos',icon:'documento'},
      {name:'Registrar pago',path:'/control-ingresos/registrar',icon:'financiero'},
      {name:'Consultar recibos',path:'/control-ingresos/consultar',icon:'documento'},
      {name:'Ficha del alumno',path:'/ficha-alumno',icon:'alumnos'},
      {name:'Estadísticas financieras',path:'/estadisticas',icon:'financiero'},
      {name:'Deudores',path:'/deudores',icon:'alumnos'},
      {name:'Pagos y adeudos por alumno',path:'/pagos-adeudos-alumnos',icon:'documento'},
      {name:'Cobertura de planes de pago',path:'/cobertura-planes-pago',icon:'documento'},
    ]},
    {name:'Control Académico',shortName:'Académico',path:'/control-academico',icon:'academico',children:[
      {name:'Docentes',path:'/docentes',icon:'docentes'},
      {name:'Generador de Horarios',path:'/horarios',icon:'horarios'},
    ]},
    {name:'Recursos Humanos',shortName:'RRHH',path:'/rh',icon:'rh',incluirInicioMovil:false,children:[
      {name:'Personal administrativo',path:'/rh/personal',icon:'alumnos'},
      {name:'Evaluaciones y resultados NOM-035',path:'/rh/resultados',icon:'documento'},
      {name:'Planes de acción NOM-035',path:'/rh/planes',icon:'documento'},
      {name:'Portal de evaluación NOM-035',path:'/rh/evaluacion',icon:'documento'},
    ]},
  ];
  const porRol: Record<string,string[]> = {
    'COORDINADOR FINANCIERO':['Control Financiero'], CAJERO:['Control Financiero'],
    'COORDINADOR CONTROL ESCOLAR':['Inicio','Control Escolar'],
    'COORDINADOR RECURSOS HUMANOS':['Inicio','Recursos Humanos'],
    'COORDINADOR ACADEMICO':['Inicio','Control Académico'],
  };
  if (porRol[rol]) items=items.filter(i=>porRol[rol].includes(i.name));
  if (rol === 'ADMINISTRADOR') items.push({name:'Configuración',path:'#',icon:'configuracion',children:[
    {name:'Catálogos',path:'/catalogos',icon:'academico'},
    {name:'Plantillas',path:'/plantillas',icon:'documento'},
    {name:'Ciclos Escolares',path:'/ciclos',icon:'calendario'},
    {name:'Usuarios',path:'/usuarios',icon:'alumnos'},
    {name:'Generales',path:'/configuracion-app',icon:'configuracion'},
  ]});
  if (['COORDINADOR ACADEMICO','COORDINADOR RECURSOS HUMANOS','COORDINADOR FINANCIERO'].includes(rol))
    items.push({name:'Estadística 911',shortName:'911',path:'/estadistica-911',icon:'documento'});
  return items.map(i=>({...i,...(i.children?{children:i.children.filter(h=>puedeAccederRuta(rol,h.path))}:{})}))
    .filter(i=>i.children?i.children.length>0:puedeAccederRuta(rol,i.path));
}
const coincide=(ruta:string,path:string)=>ruta===path||ruta.startsWith(path+'/');
/** Un solo hijo activo; los enlaces de inicio no son prefijos de todas las pantallas. */
export function destinoActivoMenu(items:readonly ElementoMenu[],ruta:string){
 const path=ruta.split('?')[0];
 if(path==='/dashboard'&&items.some(i=>i.path==='/'))return '/';
 return [...items].sort((a,b)=>b.path.length-a.path.length).find(i=>i.path==='/'||i.path==='/rh'?path===i.path:coincide(path,i.path))?.path;
}
export function menuActivo(items: readonly ElementoMenu[], ruta: string): ElementoMenu | undefined {
  const path=ruta.split('?')[0];
  const exacto=items.find(i=>i.children?.some(h=>coincide(path,h.path))||(i.path!=='/'&&i.path!=='#'&&coincide(path,i.path)));
  if (exacto) return exacto;
  if (path==='/'||path==='/dashboard'||['/control-ingresos','/plan-pagos','/ficha-alumno','/estadisticas','/deudores','/cobertura-planes-pago','/pagos-adeudos-alumnos'].some(p=>coincide(path,p)))
    return items.find(i=>i.path==='/') || (path==='/pagos-adeudos-alumnos'?items.find(i=>i.path==='/control-escolar'):undefined);
  // Las rutas académicas compartidas conservan la sección disponible para ese rol.
  if (['/calificaciones','/grupos','/planes-estudio'].some(p=>coincide(path,p))) return items.find(i=>i.path==='/control-academico');
  return undefined;
}
export function dividirMenuMovil(items: readonly ElementoMenu[]) {
  return { principales:items.slice(0,4), adicionales:items.slice(4) };
}
