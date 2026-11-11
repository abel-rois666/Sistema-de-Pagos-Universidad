import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { posicionarSelector, type PosicionSelector } from '../../utils/posicionSelector';

export interface OpcionSelector { value: string; label: string }
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

/** Selección controlada: la búsqueda nunca modifica el valor guardado. */
export default function SelectorBusqueda({ id, value, opciones, onChange, etiqueta, placeholder = 'Selecciona una opción', disabled = false }: {
  id: string; value: string; opciones: readonly OpcionSelector[]; onChange: (valor: string) => void;
  etiqueta: string; placeholder?: string; disabled?: boolean;
}) {
  const uid = useId(), listaId = `${uid}-lista`;
  const [abierto, setAbierto] = useState(false), [busqueda, setBusqueda] = useState(''), [activo, setActivo] = useState(0);
  const [posicion, setPosicion] = useState<PosicionSelector>({ left: 0, top: 0, width: 280, maxHeight: 340 });
  const boton = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), entrada = useRef<HTMLInputElement>(null);
  const filtradas = opciones.filter(o => normalizar(o.label).includes(normalizar(busqueda)));
  const cerrar = (volver = false) => { setAbierto(false); if (volver) boton.current?.focus(); };
  const abrir = () => { setBusqueda(''); setActivo(Math.max(0, opciones.findIndex(o => o.value === value))); setAbierto(true); };
  const elegir = (valor: string) => { onChange(valor); cerrar(true); };
  useLayoutEffect(() => {
    if (!abierto) return;
    const colocar = () => {
      const r = boton.current?.getBoundingClientRect(); if (!r) return;
      const lista = panel.current?.querySelector<HTMLElement>('[role="listbox"]');
      // Altura natural, incluido el buscador: no confundir el límite con el alto real.
      const alturaContenido = panel.current && lista
        ? panel.current.getBoundingClientRect().height - lista.clientHeight + lista.scrollHeight : 340;
      const siguiente = posicionarSelector(r, { width: window.innerWidth, height: window.innerHeight }, alturaContenido);
      setPosicion(previa => Object.keys(siguiente).every(k => previa[k as keyof PosicionSelector] === siguiente[k as keyof PosicionSelector]) ? previa : siguiente);
    };
    colocar();
    const medidas = new ResizeObserver(colocar);
    if (panel.current) medidas.observe(panel.current);
    // Un cambio de navegación lateral puede mover el control sin variar su ancho.
    // Observar el contexto evita conservar coordenadas del diseño anterior.
    for (let nodo: HTMLElement | null = boton.current; nodo && nodo !== document.body; nodo = nodo.parentElement) medidas.observe(nodo);
    window.addEventListener('resize', colocar); window.addEventListener('scroll', colocar, true);
    return () => { medidas.disconnect(); window.removeEventListener('resize', colocar); window.removeEventListener('scroll', colocar, true); };
  }, [abierto, busqueda, opciones]);
  useLayoutEffect(() => { if (abierto) entrada.current?.focus(); }, [abierto]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!boton.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node)) cerrar(); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(true); } };
    document.addEventListener('pointerdown', fuera); document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', escape, true); };
  }, [abierto]);
  useEffect(() => { if (disabled) setAbierto(false); }, [disabled]);
  useEffect(() => { panel.current?.querySelector(`[data-indice="${activo}"]`)?.scrollIntoView({ block: 'nearest' }); }, [activo, busqueda, abierto]);
  return <>
    <button id={id} ref={boton} type="button" className="selector-busqueda-control" aria-label={etiqueta} aria-describedby={`${id}-valor`} aria-haspopup="listbox" aria-expanded={abierto} aria-controls={abierto ? listaId : undefined}
      disabled={disabled} onClick={() => abierto ? cerrar() : abrir()} onKeyDown={e => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); abrir(); } }}>
      <span id={`${id}-valor`}>{opciones.find(o => o.value === value)?.label || placeholder}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {abierto && createPortal(<div ref={panel} className="selector-busqueda-panel" data-selector-busqueda-panel="true" style={posicion}>
      <div className="selector-busqueda-buscar"><Search size={15} aria-hidden="true"/><input ref={entrada} role="combobox" aria-label={`Buscar en ${etiqueta}`} aria-autocomplete="list" aria-expanded="true" aria-controls={listaId}
        aria-activedescendant={filtradas[activo] ? `${uid}-${activo}` : undefined} placeholder="Buscar…" value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setActivo(0); }} onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(0, Math.min(filtradas.length - 1, a + (e.key === 'ArrowDown' ? 1 : -1)))); }
          if (e.key === 'Home' || e.key === 'End') { if (e.ctrlKey) { e.preventDefault(); setActivo(e.key === 'Home' ? 0 : filtradas.length - 1); } }
          if (e.key === 'Enter') { e.preventDefault(); if (filtradas[activo]) elegir(filtradas[activo].value); }
          if (e.key === 'Tab') cerrar(true);
        }}/></div>
      <div role="listbox" id={listaId} aria-label={etiqueta} className="selector-busqueda-opciones">
        {filtradas.map((o, i) => <div key={o.value} id={`${uid}-${i}`} data-indice={i} role="option" aria-selected={o.value === value} data-activo={i === activo}
          onPointerMove={() => setActivo(i)} onMouseDown={e => e.preventDefault()} onClick={() => elegir(o.value)}><span>{o.label}</span>{o.value === value && <Check size={15} aria-hidden="true"/>}</div>)}
        {!filtradas.length && <p role="status">No hay opciones que coincidan.</p>}
      </div>
    </div>, boton.current?.closest('[role="dialog"], [role="alertdialog"]') || document.body)}
  </>;
}
