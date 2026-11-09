import { Children, cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';

/** Ayuda que se puede leer con ratón, teclado o toque, incluso en formularios de solo lectura. */
export default function AyudaContextual({etiqueta,texto}:{etiqueta:string;texto:string}) {
  const [abierta,setAbierta]=useState(false),[fijada,setFijada]=useState(false);
  const [posicion,setPosicion]=useState({left:12,top:12,width:288});
  const ancla=useRef<HTMLDetailsElement>(null),panel=useRef<HTMLDivElement>(null),temporizador=useRef<ReturnType<typeof setTimeout>|null>(null);
  const id=useId();
  function cancelarCierre(){if(temporizador.current)clearTimeout(temporizador.current);}
  function cerrar(){cancelarCierre();setAbierta(false);setFijada(false);}
  function salir(){if(!fijada)temporizador.current=setTimeout(()=>setAbierta(false),180);}
  useEffect(()=>()=>cancelarCierre(),[]);
  useLayoutEffect(()=>{
    if(!abierta)return;
    const colocar=()=>{
      const r=ancla.current?.getBoundingClientRect();if(!r)return;
      const width=Math.min(288,window.innerWidth-24),altura=panel.current?.offsetHeight||90;
      setPosicion({width,left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),
        top:Math.max(8,r.bottom+8+altura<=window.innerHeight-8?r.bottom+8:r.top-altura-8)});
    };
    colocar();window.addEventListener('resize',colocar);window.addEventListener('scroll',colocar,true);
    return()=>{window.removeEventListener('resize',colocar);window.removeEventListener('scroll',colocar,true);};
  },[abierta,posicion.width]);
  useEffect(()=>{
    if(!abierta)return;
    const fuera=(e:PointerEvent)=>{if(!ancla.current?.contains(e.target as Node)&&!panel.current?.contains(e.target as Node))cerrar();};
    const tecla=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cerrar();}};
    document.addEventListener('pointerdown',fuera);document.addEventListener('keydown',tecla,true);
    return()=>{document.removeEventListener('pointerdown',fuera);document.removeEventListener('keydown',tecla,true);};
  },[abierta]);
  return <><details className="ayuda-contextual" ref={ancla} open={abierta}
    onPointerEnter={e=>{if(e.pointerType==='mouse'){cancelarCierre();setAbierta(true);}}} onPointerLeave={salir}>
    <summary aria-label={`Ayuda: ${etiqueta}`} aria-expanded={abierta} aria-controls={abierta?id:undefined} aria-describedby={abierta?id:undefined}
      onFocus={()=>{cancelarCierre();setAbierta(true);}} onBlur={()=>{if(!fijada)salir();}}
      onClick={e=>{e.preventDefault();cancelarCierre();setFijada(!fijada);setAbierta(!fijada);}}><CircleHelp size={14} strokeWidth={1.7} aria-hidden="true"/></summary>
  </details>{abierta&&createPortal(<div className="ayuda-contextual-panel" role="note" aria-label={etiqueta} id={id} ref={panel} style={posicion}
    onPointerEnter={cancelarCierre} onPointerLeave={salir}><p>{texto}</p></div>,document.body)}</>;
}

type ControlEtiquetado={id?:string;'aria-describedby'?:string};
/** Mantiene la etiqueta del campo separada del control de ayuda: sin botones dentro de labels. */
export function CampoConAyuda({etiqueta,ayuda,children,className=''}:{key?:string;etiqueta:string;ayuda:string;children:ReactNode;className?:string}) {
  const id=useId(),hijos=Children.toArray(children);
  const control=hijos.find(c=>isValidElement(c)&&(['input','select','textarea'].includes(String(c.type))||(typeof c.type!=='string'&&Boolean((c.props as ControlEtiquetado).id)))) as ReactElement<ControlEtiquetado>|undefined;
  const controlId=control?.props.id||id;
  return <div className={`campo-con-ayuda ${className}`}><div className="campo-con-ayuda-etiqueta"><label htmlFor={controlId}>{etiqueta}</label><AyudaContextual etiqueta={etiqueta} texto={ayuda}/></div>
    {hijos.map(c=>c===control?cloneElement(control,{id:controlId}):c)}</div>;
}
