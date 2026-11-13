import { Link } from 'react-router-dom';
import { ArrowRight,ChevronDown,FileText,Users,UserPlus,Calendar,BookOpen,Wallet,GraduationCap,Clock,ClipboardList,BarChart3,Briefcase } from 'lucide-react';
import type { TareaArea } from './navegacion';
import { AREAS_INICIO } from './inicioCatalogo';
const iconosArea={escolar:GraduationCap,academico:BookOpen,finanzas:Wallet,rh:Briefcase};
function iconoTarea(ruta:string){
 if(ruta.includes('inscripciones')||ruta.includes('prospectos'))return UserPlus;
 if(ruta.includes('alumnos')||ruta.includes('grupos')||ruta.includes('docentes'))return Users;
 if(ruta.includes('calendarios'))return Calendar;
 if(ruta.includes('horarios'))return Clock;
 if(ruta.includes('planes-estudio'))return BookOpen;
 if(ruta.includes('estadistica'))return BarChart3;
 if(ruta.includes('calificaciones'))return ClipboardList;
 return FileText;
}
export default function PanelFuncionesInicio({area,tareas,ampliada,buscando,onAlternar,id}:{key?:string;area:typeof AREAS_INICIO[number];tareas:readonly TareaArea[];ampliada:boolean;buscando:boolean;onAlternar:()=>void;id:string}){
 const visibles=buscando||ampliada?tareas:tareas.slice(0,6),restantes=tareas.length-visibles.length,Icono=iconosArea[area.id];
 return <section className="inicio-panel" aria-labelledby={`${id}-titulo`}><header><span className="inicio-panel-icono"><Icono size={25} aria-hidden="true"/></span><div><h2 id={`${id}-titulo`}>{area.titulo}</h2><p>{area.descripcion}</p></div><span className="inicio-panel-total">{tareas.length} {buscando?'coincidencias':'accesos del área'}</span></header>
 <div className="inicio-enlaces" id={`${id}-lista`}>{visibles.map(t=>{const IconoTarea=iconoTarea(t.ruta);return <Link key={t.ruta} to={t.ruta}><span className="inicio-funcion-icono"><IconoTarea size={19} aria-hidden="true"/></span><div><h3>{t.titulo}</h3><p>{t.descripcion}</p></div><ArrowRight size={18} aria-hidden="true"/></Link>;})}</div>
 <footer className="inicio-panel-pie"><p>Selecciona una función para abrirla.</p>{!buscando&&tareas.length>6&&<button type="button" onClick={onAlternar} aria-expanded={ampliada} aria-controls={`${id}-lista`}>{ampliada?'Mostrar menos funciones':`Mostrar ${restantes} ${restantes===1?'función más':'funciones más'}`}<ChevronDown size={17} aria-hidden="true" className={ampliada?'inicio-chevron-abierto':''}/></button>}</footer>
 </section>;
}
