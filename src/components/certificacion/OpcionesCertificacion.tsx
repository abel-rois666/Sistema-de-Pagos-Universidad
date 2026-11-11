import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Archive, ChevronDown } from 'lucide-react';

/** Acciones de mantenimiento secundarias, identificadas por la ficha afectada. */
export default function OpcionesCertificacion({descripcion,onArchivar,disabled=false}:{descripcion:string;onArchivar:()=>void;disabled?:boolean}) {
  const ref=useRef<HTMLDetailsElement>(null);
  const panel=useRef<HTMLDivElement>(null),[abierto,setAbierto]=useState(false),[izquierda,setIzquierda]=useState(0);
  useLayoutEffect(()=>{
    if(!abierto)return;
    const r=ref.current?.getBoundingClientRect(),ancho=panel.current?.offsetWidth;
    if(r&&ancho)setIzquierda(Math.max(12,Math.min(r.right-ancho,window.innerWidth-ancho-12))-r.left);
  },[abierto]);
  useEffect(()=>{
    const cerrar=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setAbierto(false);};
    const ajustar=()=>setAbierto(false);
    document.addEventListener('pointerdown',cerrar);window.addEventListener('resize',ajustar);
    return()=>{document.removeEventListener('pointerdown',cerrar);window.removeEventListener('resize',ajustar);};
  },[]);
  useEffect(()=>{if(disabled)setAbierto(false);},[disabled]);
  useEffect(()=>{
    if(!abierto)return;
    // Cierra primero estas opciones, antes del Escape del diálogo que las contiene.
    const tecla=(e:KeyboardEvent)=>{if(e.key==='Escape'&&ref.current?.contains(e.target as Node)){e.preventDefault();e.stopPropagation();setAbierto(false);ref.current.querySelector('summary')?.focus();}};
    window.addEventListener('keydown',tecla,true);return()=>window.removeEventListener('keydown',tecla,true);
  },[abierto]);
  return <details ref={ref} open={abierto} className="relative text-sm" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setAbierto(false);}}>
    <summary aria-label={`Más opciones: ${descripcion}`} aria-expanded={abierto} aria-disabled={disabled} onClick={e=>{e.preventDefault();if(!disabled)setAbierto(v=>!v);}} className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-gray-300 dark:hover:bg-gray-800">Más opciones<ChevronDown size={14}/></summary>
    <div ref={panel} style={{left:izquierda}} className="absolute bottom-full z-10 mb-1 w-64 max-w-[calc(100vw-4rem)] rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <button type="button" disabled={disabled} className="flex w-full items-start gap-2 rounded p-3 text-left text-sm text-amber-900 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-amber-200 dark:hover:bg-gray-700" onClick={()=>{setAbierto(false);ref.current?.querySelector('summary')?.focus();onArchivar();}}><Archive size={16} className="mt-0.5 shrink-0"/>Archivar {descripcion}</button>
    </div>
  </details>;
}
