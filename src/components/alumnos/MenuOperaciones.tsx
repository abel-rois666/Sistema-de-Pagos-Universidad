import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface OpcionOperacion { texto:string; ejecutar:()=>void; peligro?:boolean; disabled?:boolean }
/** Menú fuera del scroll de tablas, accesible con teclado y toque. */
export default function MenuOperaciones({etiqueta,opciones,textoBoton}:{etiqueta:string;opciones:OpcionOperacion[];textoBoton?:string}) {
  const [abierto,setAbierto]=useState(false),[posicion,setPosicion]=useState({top:0,left:0,width:240});
  const boton=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
  useEffect(()=>{
    if(!abierto)return;
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const cerrar=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!boton.current?.contains(e.target as Node))setAbierto(false);};
    const mover=()=>setAbierto(false);
    const scroll=(e:Event)=>{if(!panel.current?.contains(e.target as Node))setAbierto(false);};
    document.addEventListener('pointerdown',cerrar);window.addEventListener('resize',mover);document.addEventListener('scroll',scroll,true);
    return()=>{document.removeEventListener('pointerdown',cerrar);window.removeEventListener('resize',mover);document.removeEventListener('scroll',scroll,true);};
  },[abierto]);
  return <><button type="button" className="alumnos-boton-secundario" ref={boton} aria-label={etiqueta} aria-haspopup="menu" aria-expanded={abierto} aria-controls={abierto?id:undefined}
    onClick={()=>{const r=boton.current!.getBoundingClientRect();const width=Math.min(260,window.innerWidth-24);const alto=opciones.length*46+16;setPosicion({width,left:Math.max(12,Math.min(r.right-width,window.innerWidth-width-12)),top:r.bottom+alto<window.innerHeight?r.bottom+6:Math.max(12,r.top-alto-6)});setAbierto(!abierto);}}>{textoBoton||etiqueta}<ChevronDown size={15}/></button>
    {abierto&&createPortal(<div id={id} role="menu" aria-label={etiqueta} ref={panel} className="alumnos-menu" style={posicion} onKeyDown={e=>{
      const items=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]) as HTMLButtonElement[],actual=items.indexOf(document.activeElement as HTMLButtonElement);
      if(e.key==='Escape'){e.preventDefault();setAbierto(false);boton.current?.focus();}
      if(e.key==='Tab'){setAbierto(false);boton.current?.focus();}
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(actual+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
    }}>{opciones.map(o=><button key={o.texto} role="menuitem" type="button" disabled={o.disabled} className={o.peligro?'peligro':''} onClick={()=>{setAbierto(false);boton.current?.focus();o.ejecutar();}}>{o.texto}</button>)}</div>,document.body)}</>;
}
