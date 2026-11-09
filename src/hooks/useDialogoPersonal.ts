import { useEffect, useRef, type KeyboardEvent } from 'react';
/** Contiene el foco y devuelve el control al botón que abrió la ficha. */
export function useDialogoPersonal(abierto:boolean,onCerrar:()=>void) {
  const dialogo=useRef<HTMLDivElement>(null),cerrar=useRef(onCerrar);cerrar.current=onCerrar;
  useEffect(()=>{if(!abierto)return;const anterior=document.activeElement as HTMLElement|null;
    dialogo.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    const valor=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=valor;if(anterior?.isConnected)anterior.focus({preventScroll:true});};
  },[abierto]);
  const teclado=(e:KeyboardEvent)=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cerrar.current();}
    if(e.key!=='Tab')return;
    const nodos=(Array.from(dialogo.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([tabindex="-1"]),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]')||[]) as HTMLElement[]).filter(n=>n.getClientRects().length>0);
    const primero=nodos[0],ultimo=nodos.at(-1);
    if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo?.focus();}
    else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero?.focus();}
  };
  return {dialogo,teclado};
}
