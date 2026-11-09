import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import './personal.css';

export interface SeccionPersonal { id: string; titulo: string; icono?: ReactNode }
export default function NavegacionPersonal({secciones,activa,onCambiar,children}:{secciones:SeccionPersonal[];activa:string;onCambiar:(id:string)=>void;children:ReactNode}) {
  const id=useId(), menu=useRef<HTMLDetailsElement>(null),panel=useRef<HTMLElement>(null),anterior=useRef(activa);
  const actual=secciones.find(s=>s.id===activa);
  useEffect(()=>{if(anterior.current!==activa){anterior.current=activa;panel.current?.focus({preventScroll:true});}},[activa]);
  useEffect(()=>{const cerrar=(e:PointerEvent)=>{if(menu.current?.open&&!menu.current.contains(e.target as Node))menu.current.open=false;};document.addEventListener('pointerdown',cerrar);return()=>document.removeEventListener('pointerdown',cerrar);},[]);
  const opciones=()=>secciones.map(s=><button key={s.id} type="button" aria-current={activa===s.id?'page':undefined} aria-controls={`${id}-panel`} onClick={()=>{if(menu.current)menu.current.open=false;onCambiar(s.id);}}>{s.icono}<span>{s.titulo}</span></button>);
  return <div className="personal-layout"><nav className="personal-lateral" aria-label="Secciones de la ficha de personal">{opciones()}</nav><details ref={menu} className="personal-navegacion-compacta" onKeyDown={e=>{if(e.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}><summary><span><small>Sección de la ficha</small><strong>{actual?.titulo}</strong></span><ChevronDown size={18}/></summary><nav aria-label="Elegir sección de personal">{opciones()}</nav></details><section ref={panel} id={`${id}-panel`} tabIndex={-1} className="personal-contenido" aria-label={actual?.titulo}>{children}</section></div>;
}
