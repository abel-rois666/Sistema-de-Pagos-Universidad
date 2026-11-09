import { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface AccionDirectorio { texto: string; ejecutar: () => void; peligro?: boolean }

/** Desplegable de acciones secundarias, con cierre exterior y recorrido de teclado. */
export default function MenuDirectorio({ nombre, acciones, etiqueta = 'Más' }: { nombre: string; acciones: AccionDirectorio[]; etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null), boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState({ top: 0, left: 0 });
  const id = useId();
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: PointerEvent) => { if (!contenedor.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node)) setAbierto(false); };
    const recolocar = () => setAbierto(false);
    document.addEventListener('pointerdown', cerrar);
    window.addEventListener('resize', recolocar);
    const desplazar = (e: Event) => { if (!panel.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('scroll', desplazar, true);
    return () => { document.removeEventListener('pointerdown', cerrar); window.removeEventListener('resize', recolocar); document.removeEventListener('scroll', desplazar, true); };
  }, [abierto]);
  if (!acciones.length) return null;
  const abrir = () => { const rect = boton.current!.getBoundingClientRect(); const altura = acciones.length * 40 + 16; setPosicion({ left: Math.max(12, Math.min(rect.right - 232, window.innerWidth - 244)), top: Math.max(12, rect.bottom + altura + 12 > window.innerHeight ? rect.top - altura - 6 : rect.bottom + 6) }); setAbierto(true); requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()); };
  return <div ref={contenedor} className="directorio-menu" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && !panel.current?.contains(e.relatedTarget as Node)) setAbierto(false); }} onKeyDown={e => {
    if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); boton.current?.focus(); }
    if (e.key === 'Tab' && abierto) { setAbierto(false); boton.current?.focus(); }
    if (abierto && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); const opciones = Array.from(panel.current!.querySelectorAll<HTMLButtonElement>('[role=menuitem]')) as HTMLButtonElement[];
      const indice = opciones.indexOf(document.activeElement as HTMLButtonElement);
      opciones[e.key === 'Home' ? 0 : e.key === 'End' ? opciones.length - 1 : (indice + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length]?.focus();
    }
  }}>
    <button ref={boton} type="button" aria-label={`${etiqueta}: ${nombre}`} aria-expanded={abierto} aria-haspopup="menu" aria-controls={abierto ? id : undefined} onClick={() => abierto ? setAbierto(false) : abrir()} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); abrir(); } }}><MoreHorizontal size={17}/><span>{etiqueta}</span></button>
    {abierto && createPortal(<div ref={panel} id={id} role="menu" aria-label={`Acciones de ${nombre}`} style={posicion} className="directorio-menu-panel">{acciones.map(a => <button type="button" role="menuitem" key={a.texto} className={a.peligro ? 'directorio-peligro' : ''} onClick={() => { setAbierto(false); boton.current?.focus(); a.ejecutar(); }}>{a.texto}</button>)}</div>, document.body)}
  </div>;
}
