import { useEffect,useId,useRef,useState } from 'react';
import { ChevronRight,Search,X,GraduationCap,BookOpen,Wallet,Briefcase } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { TareaArea } from './navegacion';
import { AREAS_INICIO,tareasInicio,areaPreferidaInicio } from './inicioCatalogo';
import PanelFuncionesInicio from './PanelFuncionesInicio';
import './inicioArea.css';
const iconos={escolar:GraduationCap,academico:BookOpen,finanzas:Wallet,rh:Briefcase};
export default function InicioArea({area}:{area?:TareaArea['area']}){
 const rol=useAppStore(s=>s.currentUser?.rol),id=useId();
 const [busqueda,setBusqueda]=useState(''),[elegida,setElegida]=useState<TareaArea['area']|null>(area||null);
 const [ampliada,setAmpliada]=useState<string|null>(null),entrada=useRef<HTMLInputElement>(null);
 useEffect(()=>{const enfocar=(e:KeyboardEvent)=>{if(e.defaultPrevented||e.altKey||!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='k'||document.querySelector('[role="dialog"][aria-modal="true"]'))return;e.preventDefault();entrada.current?.focus();entrada.current?.select();};window.addEventListener('keydown',enfocar);return()=>window.removeEventListener('keydown',enfocar);},[]);
 const disponibles=AREAS_INICIO.filter(a=>(!area||a.id===area)&&tareasInicio(rol,a.id).length>0);
 const activa=disponibles.find(a=>a.id===(elegida||areaPreferidaInicio(rol)))||disponibles[0];
 const buscando=Boolean(busqueda.trim()),resultados=tareasInicio(rol,area,busqueda);
 const mostrar=buscando?disponibles.filter(a=>resultados.some(t=>t.area===a.id)):activa?[activa]:[];
 return <section className="inicio-directorio paleta-dashboard">
 <header className="inicio-cabecera"><h1>{area?AREAS_INICIO.find(a=>a.id===area)?.titulo:'¿Qué necesitas hacer?'}</h1><p>{area?'Selecciona una función de esta área o utiliza la búsqueda para encontrar una tarea.':'Selecciona un área para consultar sus funciones o utiliza la búsqueda para encontrar una tarea.'}</p></header>
 <div className="inicio-busqueda"><label className="sr-only" htmlFor={id}>Buscar una función{area?' del área':''}</label><div><Search size={20} aria-hidden="true"/><input ref={entrada} id={id} type="search" aria-keyshortcuts="Control+k Meta+k" placeholder={area==='rh'?'Buscar personal, evaluaciones o planes de acción…':'Buscar alumnos, boletas, recibos, docentes…'} value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>{busqueda&&<button type="button" aria-label="Limpiar búsqueda" onClick={()=>{setBusqueda('');entrada.current?.focus();}}><X size={17}/></button>}<kbd aria-hidden="true">{typeof navigator!=='undefined'&&/Mac/.test(navigator.platform)?'⌘ + K':'Ctrl + K'}</kbd></div></div>
 {!area&&disponibles.length>1&&<><h2 className="inicio-rotulo-areas" id={`${id}-areas`}>Áreas de trabajo</h2><nav className="inicio-areas" aria-labelledby={`${id}-areas`}>{disponibles.map(a=>{const Icono=iconos[a.id];return <button type="button" key={a.id} aria-pressed={!buscando&&activa?.id===a.id} aria-controls={`${id}-funciones`} onClick={()=>{setElegida(a.id);setBusqueda('');setAmpliada(null);}}><span className="inicio-area-icono"><Icono size={22} aria-hidden="true"/></span><span className="inicio-area-datos"><strong>{a.titulo}</strong><small>{tareasInicio(rol,a.id).length} accesos</small></span><ChevronRight size={17} aria-hidden="true"/></button>;})}</nav></>}
 <div id={`${id}-funciones`} className="inicio-resultados"><p className="inicio-conteo" role="status">{buscando?`${resultados.length} funciones encontradas`:activa?`${tareasInicio(rol,activa.id).length} funciones en ${activa.titulo}`:'No hay funciones disponibles para este perfil.'}</p>
 {mostrar.map(a=><PanelFuncionesInicio key={a.id} area={a} tareas={buscando?resultados.filter(t=>t.area===a.id):tareasInicio(rol,a.id)} buscando={buscando} ampliada={ampliada===a.id} onAlternar={()=>setAmpliada(v=>v===a.id?null:a.id)} id={`${id}-${a.id}`}/>)}
 {buscando&&!resultados.length&&<div className="inicio-vacio"><h2>Sin coincidencias</h2><p>Prueba con el nombre de una tarea o del área a la que pertenece.</p><button type="button" onClick={()=>setBusqueda('')}>Ver funciones disponibles</button></div>}
 </div></section>;
}
