import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Alumno, CicloEscolar, PaymentPlan } from '../../types';
import { buscarPlanesPago } from '../../utils/planesPagoVista';

/** Consulta local; seleccionar un resultado conserva el ID del plan, incluso con ciclos homónimos. */
export default function BuscadorPlanesPago({ planes, alumnos, ciclos, value, onChange, onSelect }: {
  planes: PaymentPlan[]; alumnos: Alumno[]; ciclos: CicloEscolar[]; value: string;
  onChange: (texto: string) => void; onSelect: (plan: PaymentPlan) => void;
}) {
  const id = useId(), raiz = useRef<HTMLDivElement>(null), campo = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false), [limite, setLimite] = useState(30), [activo, setActivo] = useState(-1);
  const alcance = planes.map(p => p.id).join('|');
  const resultados = buscarPlanesPago(planes, alumnos, ciclos, value), visibles = resultados.slice(0, limite);
  useEffect(() => {
    const fuera = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, []);
  useEffect(() => { setAbierto(false); setActivo(-1); setLimite(30); }, [alcance]);
  useEffect(() => { if (activo >= 0) document.getElementById(`${id}-${activo}`)?.scrollIntoView({ block: 'nearest' }); }, [activo, id]);
  function elegir(plan: PaymentPlan) { onSelect(plan); setAbierto(false); setActivo(-1); }
  return <div className="planes-buscador" ref={raiz} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setAbierto(false); }}>
    <label htmlFor={id}>Buscar alumno o plan</label>
    <div className="planes-buscador-campo">
      <Search size={17} aria-hidden="true" />
      <input id={id} ref={campo} value={value} placeholder="Nombre, matrícula o folio…" autoComplete="off"
        role="combobox" aria-autocomplete="list" aria-expanded={abierto} aria-controls={abierto ? `${id}-lista` : undefined}
        aria-activedescendant={abierto && activo >= 0 && visibles[activo] ? `${id}-${activo}` : undefined}
        onFocus={() => setAbierto(true)} onChange={e => { onChange(e.target.value); setActivo(-1); setLimite(30); setAbierto(true); }}
        onKeyDown={e => {
          if (e.key === 'Escape') { setAbierto(false); setActivo(-1); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault(); setAbierto(true);
            setActivo(i => e.key === 'ArrowDown' ? Math.min(i + 1, visibles.length - 1) : Math.max(0, i - 1));
          }
          if (e.key === 'Enter' && abierto && visibles[activo]) { e.preventDefault(); elegir(visibles[activo]); }
        }} />
      {value && <button type="button" aria-label="Limpiar búsqueda" onClick={() => { onChange(''); setActivo(-1); setAbierto(true); campo.current?.focus(); }}><X size={17} /></button>}
    </div>
    {abierto && <div className="planes-buscador-resultados">
      <div id={`${id}-lista`} role="listbox" aria-label="Planes encontrados en el periodo">
        {visibles.map((plan, i) => <button type="button" role="option" aria-selected={i === activo} tabIndex={-1}
          id={`${id}-${i}`} key={plan.id} onMouseDown={e => e.preventDefault()} onClick={() => elegir(plan)}>
          <strong>{plan.nombre_alumno || alumnos.find(a => a.id === plan.alumno_id)?.nombre_completo}</strong>
          <span>{alumnos.find(a => a.id === plan.alumno_id)?.matricula} · {plan.tipo_plan} · {plan.ciclo_escolar} · {ciclos.find(c => c.id === plan.ciclo_id)?.tipo_periodo || 'Sin tipo de ciclo'} · {plan.no_plan_pagos || 'Sin folio'}</span>
        </button>)}
      </div>
      {!visibles.length && <p role="status">{value.trim() ? 'No hay coincidencias en este periodo.' : 'Escribe un nombre, matrícula o folio.'}</p>}
      {resultados.length > limite && <button className="planes-buscador-mas" type="button" onMouseDown={e => e.preventDefault()} onClick={() => setLimite(n => n + 30)}>Mostrar más ({resultados.length - limite} restantes)</button>}
    </div>}
  </div>;
}
