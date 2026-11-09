import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Columns3, ChevronDown, RotateCcw } from 'lucide-react';
import { catalogoColumnasHistorial, COLUMNAS_INICIALES, type ColumnaHistorialId } from '../../utils/columnasHistorial';

export default function ColumnasHistorial({especialidad,elegidas,onChange,ocultarVacias,onOcultarVacias}:{
  especialidad:boolean;elegidas:ColumnaHistorialId[];onChange:(c:ColumnaHistorialId[])=>void;ocultarVacias:boolean;onOcultarVacias:(b:boolean)=>void;
}) {
  const menu=useRef<HTMLDetailsElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
  const [abierto,setAbierto]=useState(false),[posicion,setPosicion]=useState({left:12,top:12,width:320,maxHeight:400});
  const cerrar=(foco=false)=>{setAbierto(false);if(foco)menu.current?.querySelector('summary')?.focus();};
  useLayoutEffect(()=>{
    if(!abierto)return;
    const colocar=()=>{const r=menu.current?.getBoundingClientRect();if(!r)return;
      const width=Math.min(340,innerWidth-24),debajo=innerHeight-r.bottom-16,encima=r.top-16,abajo=debajo>=340||debajo>=encima;
      const maxHeight=Math.min(460,Math.max(120,abajo?debajo:encima)),altura=Math.min(panel.current?.scrollHeight||460,maxHeight);
      setPosicion({width,maxHeight,left:Math.max(12,Math.min(r.left,innerWidth-width-12)),top:abajo?r.bottom+6:Math.max(8,r.top-altura-6)});
    };colocar();panel.current?.querySelector('input')?.focus();
    window.addEventListener('resize',colocar);window.addEventListener('scroll',colocar,true);
    return()=>{window.removeEventListener('resize',colocar);window.removeEventListener('scroll',colocar,true);};
  },[abierto]);
  useEffect(()=>{if(!abierto)return;const fuera=(e:PointerEvent)=>{if(!menu.current?.contains(e.target as Node)&&!panel.current?.contains(e.target as Node))cerrar();};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cerrar(true);}};
    document.addEventListener('pointerdown',fuera);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',fuera);document.removeEventListener('keydown',escape,true);};
  },[abierto]);
  return <><details ref={menu} open={abierto} className="historial-columnas">
    <summary aria-expanded={abierto} aria-controls={abierto?id:undefined} onClick={e=>{e.preventDefault();setAbierto(a=>!a);}}><Columns3 size={15} aria-hidden="true"/>Columnas<ChevronDown size={14} aria-hidden="true"/></summary>
  </details>{abierto&&createPortal(<div id={id} ref={panel} role="group" aria-label="Configurar columnas del historial" className="historial-columnas-panel" style={posicion} onKeyDown={e=>{
    if(e.key!=='Tab')return;
    const controles=panel.current?.querySelectorAll<HTMLElement>('input,button');if(!controles?.length)return;
    if((e.shiftKey&&document.activeElement===controles[0])||(!e.shiftKey&&document.activeElement===controles[controles.length-1]))cerrar(true);
  }}><p>Siempre visibles: asignatura, ciclo, {especialidad?'evaluación final':'parciales (P1, P2, P3)'} y resultado final.</p>
      <fieldset><legend>Columnas opcionales</legend>{catalogoColumnasHistorial(especialidad).filter(c=>!c.fija).map(c=><label key={c.id}><input type="checkbox" checked={elegidas.includes(c.id)} onChange={e=>onChange(e.target.checked?[...elegidas,c.id]:elegidas.filter(id=>id!==c.id))}/>{c.nombre}</label>)}</fieldset>
      <label className="historial-columnas-vacias"><input type="checkbox" checked={ocultarVacias} onChange={e=>onOcultarVacias(e.target.checked)}/>Ocultar columnas de evaluación sin registros</label>
      <p>Se revisa todo el programa. 0 y NP cuentan como registros. {especialidad?'La evaluación final permanece visible.':'Los parciales permanecen visibles.'}</p>
      <button type="button" onClick={()=>{onChange([...COLUMNAS_INICIALES]);onOcultarVacias(false);}}><RotateCcw size={14} aria-hidden="true"/>Restaurar columnas iniciales</button>
    </div>,document.body)}</>;
}
