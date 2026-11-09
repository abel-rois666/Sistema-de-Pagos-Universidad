import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TabDef, TabId } from '../../hooks/useFichaAlumnoLogic';
import './fichaSecciones.css';

export default function FichaSecciones({secciones,activa,onCambiar,children,ampliado=false}:{secciones:TabDef[];activa:TabId;onCambiar:(id:TabId)=>void;children:ReactNode;ampliado?:boolean}){
 const [ancha,setAncha]=useState(false),[focoTeclado,setFocoTeclado]=useState(false),raiz=useRef<HTMLDivElement>(null);
 const id=useId(),menu=useRef<HTMLDetailsElement>(null),panel=useRef<HTMLElement>(null),anterior=useRef(activa);
 useEffect(()=>{const nodo=raiz.current;if(!nodo)return;const observar=new ResizeObserver(entradas=>setAncha(entradas[0].contentRect.width>=1120));observar.observe(nodo);return()=>observar.disconnect();},[]);
 useEffect(()=>{if(ancha&&menu.current)menu.current.open=false;},[ancha]);
 const seleccionada=secciones.find(s=>s.id===activa);
 useEffect(()=>{
  if(anterior.current===activa)return;
  anterior.current=activa;
  panel.current?.focus({preventScroll:true});
  // Solo recupera el inicio si se cambió de sección desde un punto avanzado.
  // Cuando la ficha ya está visible, conserva cabecera y navegación en su lugar.
  const inicioVisible=raiz.current?.closest('main')?.getBoundingClientRect().top??0;
  if(panel.current&&panel.current.getBoundingClientRect().top<inicioVisible)raiz.current?.scrollIntoView({block:'start'});
 },[activa]);
 useEffect(()=>{const cerrar=(e:PointerEvent)=>{if(menu.current?.open&&!menu.current.contains(e.target as Node))menu.current.open=false;};document.addEventListener('pointerdown',cerrar);return()=>document.removeEventListener('pointerdown',cerrar);},[]);
 const opciones=(compacto:boolean)=><ul>{secciones.map(s=><li key={s.id}><button type="button" aria-current={s.id===activa?'page':undefined} aria-controls={`${id}-panel`} onClick={()=>{if(menu.current)menu.current.open=false;onCambiar(s.id);}}><span aria-hidden="true">{s.icon}</span><span>{s.label}</span>{compacto&&s.id===activa&&<span className="ficha-seccion-marca">Actual</span>}</button></li>)}</ul>;
 return <div ref={raiz} className="ficha-secciones-root" data-ancha={ancha&&!ampliado} data-foco-teclado={focoTeclado} onPointerDownCapture={()=>setFocoTeclado(false)} onKeyDownCapture={()=>setFocoTeclado(true)}><div className="ficha-secciones-layout">
  <nav className="ficha-secciones-lateral" aria-label="Secciones de la ficha"><p>Secciones de la ficha</p>{opciones(false)}</nav>
  <details ref={menu} className="ficha-secciones-compactas" onKeyDown={e=>{if(e.key==='Escape'&&menu.current){menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}>
   <summary><span><small>Secciones de la ficha</small><strong>{seleccionada?.label||'Elige una sección'}</strong></span><ChevronDown size={19} aria-hidden="true"/></summary>
   <nav aria-label="Elegir sección de la ficha">{opciones(true)}</nav>
  </details>
  <section ref={panel} tabIndex={-1} id={`${id}-panel`} className="ficha-seccion-contenido" aria-label={seleccionada?.label||'Contenido de la ficha'}>{children}</section>
 </div></div>;
}
