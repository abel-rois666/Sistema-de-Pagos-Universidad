import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CicloEscolar, PaymentPlan } from '../../types';
import AyudaContextual from '../ui/AyudaContextual';

export default function CabeceraPlanesAlumno({ seleccionado, planesAlumno, ciclos, nombreAlumno, indice, total, anterior, siguiente, onSeleccion }: {
  seleccionado: PaymentPlan; planesAlumno: PaymentPlan[]; ciclos: CicloEscolar[]; nombreAlumno: string;
  indice: number; total: number; anterior: PaymentPlan | null; siguiente: PaymentPlan | null; onSeleccion: (plan: PaymentPlan) => void;
}) {
  const id = useId();
  const detalle = (p: PaymentPlan) => `${p.ciclo_escolar || 'Sin periodo'} · ${ciclos.find(c => c.id === p.ciclo_id)?.tipo_periodo || 'Sin tipo de ciclo'} · ${p.no_plan_pagos || 'Sin folio'}`;
  return <header className="planes-calendario-cabecera print:hidden">
    <div className="planes-calendario-titulo">
      <div><h2>Calendario de pagos</h2><p>{nombreAlumno}</p></div>
      <nav className="planes-calendario-navegacion" aria-label="Navegar entre planes del periodo">
        <div className="planes-calendario-alcance"><span>Planes del periodo</span><AyudaContextual etiqueta="Navegar entre planes" texto="Las flechas recorren todos los planes de la consulta en orden alfabético de alumno. Pueden cambiar de alumno. Para otro plan del mismo alumno, usa las opciones inferiores."/></div>
        <div className="planes-calendario-flechas">
          <button type="button" disabled={!anterior} onClick={() => anterior && onSeleccion(anterior)} aria-label="Plan anterior del periodo" title={anterior ? `${anterior.nombre_alumno} · ${anterior.tipo_plan} · ${anterior.no_plan_pagos || ''}` : 'Primer plan'}><ChevronLeft size={18}/></button>
          <span aria-live="polite" aria-atomic="true">{indice + 1} de {total}</span>
          <button type="button" disabled={!siguiente} onClick={() => siguiente && onSeleccion(siguiente)} aria-label="Plan siguiente del periodo" title={siguiente ? `${siguiente.nombre_alumno} · ${siguiente.tipo_plan} · ${siguiente.no_plan_pagos || ''}` : 'Último plan'}><ChevronRight size={18}/></button>
        </div>
      </nav>
    </div>
    {planesAlumno.length > 1 ? <div className="planes-alumno-opciones">
      <label htmlFor={id}>Planes de este alumno <span>({planesAlumno.length})</span></label>
      <select id={id} className={planesAlumno.length <= 4 ? 'planes-alumno-selector compacto-movil' : 'planes-alumno-selector'} value={seleccionado.id} onChange={e => { const p = planesAlumno.find(p => p.id === e.target.value); if (p) onSeleccion(p); }}>
        {planesAlumno.map(p => <option key={p.id} value={p.id}>{p.tipo_plan || 'Plan'} · {detalle(p)}</option>)}
      </select>
      <p className="planes-alumno-detalle">{detalle(seleccionado)}</p>
      {planesAlumno.length <= 4 && <nav className="planes-alumno-botones" aria-label="Planes de este alumno">
        {planesAlumno.map(p => <button key={p.id} type="button" aria-pressed={p.id === seleccionado.id} onClick={() => onSeleccion(p)}><strong>{p.tipo_plan || 'Plan'}</strong><span>{detalle(p)}</span></button>)}
      </nav>}
    </div> : <p className="planes-alumno-unico">{seleccionado.tipo_plan || 'Plan'} <span>· {detalle(seleccionado)}</span></p>}
  </header>;
}
