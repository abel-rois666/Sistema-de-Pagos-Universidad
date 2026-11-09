import { useEffect, useRef } from 'react';
import { BookOpen, ChevronDown, Maximize2, Minimize2, Loader2, Download, CalendarDays } from 'lucide-react';
import { MultiSelectFilter } from '../MultiSelectFilter';
import type { Alumno } from '../../types';
import { formatearCreditos } from '../../utils/presentacionHistorial';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import { useId } from 'react';
import ColumnasHistorial from './ColumnasHistorial';
import type { ColumnaHistorialId } from '../../utils/columnasHistorial';

interface Props {
  alumno: Alumno; programas: any[]; planActivoId: string | null; onPlanChange: (id: string)=>void; formatPlanOption: (p:any)=>string;
  estadisticas: {promedioGeneral:string;aprobadas:number;totalMaterias:number;creditosCubiertos:number;creditosTotalesPlan:number;porcentajeAvance:string};
  conHistorial:boolean; especialidad:boolean; columnasElegidas:ColumnaHistorialId[]; onColumnasChange:(c:ColumnaHistorialId[])=>void;
  ocultarColumnasVacias:boolean; onOcultarColumnasVacias:(b:boolean)=>void;
  filtroEstatus:string[]; onEstatusChange:(e:string[])=>void; ocultarComplementarias:boolean; onOcultarComplementarias:(b:boolean)=>void;
  ampliado:boolean; onAmpliar?:()=>void; isSyncing:boolean; onSync:()=>void; onGenerarCarga:()=>void; onPrepararAvance?:()=>void;
}
export default function CabeceraHistorial(p:Props) {
  const menu = useRef<HTMLDetailsElement>(null), id = useId();
  useEffect(()=>{const cerrar=(e:PointerEvent)=>{if(menu.current&&!menu.current.contains(e.target as Node))menu.current.open=false;};document.addEventListener('pointerdown',cerrar);return()=>document.removeEventListener('pointerdown',cerrar);},[]);
  const accion=(fn:()=>void)=>{if(menu.current)menu.current.open=false;fn();};
  return <>
    <div className="historial-titulo"><div><h3><BookOpen size={19} aria-hidden="true"/>Historial académico</h3>
      {p.alumno.kardex_sincronizado_at && <p>Última sincronización: {new Date(p.alumno.kardex_sincronizado_at).toLocaleString('es-MX')}</p>}</div>
      {p.onAmpliar&&<button type="button" onClick={p.onAmpliar} aria-pressed={p.ampliado}>{p.ampliado?<Minimize2 size={15}/>:<Maximize2 size={15}/>}<span>{p.ampliado?'Salir de vista ampliada':'Ampliar historial'}</span></button>}
    </div>
    {p.conHistorial&&<dl className="historial-indicadores" aria-label="Resumen del programa completo">
      <div><dt>Promedio general</dt><dd>{p.estadisticas.promedioGeneral}</dd></div>
      <div><dt>Materias aprobadas</dt><dd>{p.estadisticas.aprobadas}<small> / {p.estadisticas.totalMaterias}</small></dd></div>
      <div><dt>Créditos cubiertos</dt><dd>{p.estadisticas.porcentajeAvance}%<small>{formatearCreditos(p.estadisticas.creditosCubiertos)} / {formatearCreditos(p.estadisticas.creditosTotalesPlan)}</small></dd></div>
    </dl>}
    <div className="historial-controles">
      {p.programas.length>0&&<div className="historial-control-plan"><label htmlFor={id}>Plan de estudios</label><SelectorBusqueda id={id} value={p.planActivoId||''} onChange={p.onPlanChange} etiqueta="Plan de estudios"
        opciones={p.programas.map(prog=>({value:prog.plan_id,label:p.formatPlanOption(prog)})).sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}))}/></div>}
      {p.conHistorial&&<div className="historial-control-estatus"><span>Situación de materias</span><MultiSelectFilter label="Estatus" options={['Acreditadas','Reprobadas','Por acreditar / Cursando']} selected={p.filtroEstatus} onChange={p.onEstatusChange}/></div>}
      <details ref={menu} className="historial-acciones" onKeyDown={e=>{if(e.key==='Escape'&&menu.current){e.stopPropagation();menu.current.open=false;menu.current.querySelector('summary')?.focus();}}}>
        <summary>Acciones <ChevronDown size={14}/></summary><div>
          <button type="button" disabled={!p.planActivoId} onClick={()=>accion(p.onGenerarCarga)}><CalendarDays size={15}/>Generar carga de materias</button>
          <button type="button" disabled={p.isSyncing} onClick={()=>accion(p.onSync)}>{p.isSyncing?<Loader2 size={15} className="animate-spin"/>:<Download size={15}/>} {p.isSyncing?'Importando…':'Importar GES 4'}</button>
          {p.onPrepararAvance&&<button type="button" onClick={()=>accion(p.onPrepararAvance!)}>Preparar avance, pagos y carga</button>}
        </div>
      </details>
    </div>
    {p.conHistorial&&<div className="historial-opciones"><ColumnasHistorial especialidad={p.especialidad} elegidas={p.columnasElegidas} onChange={p.onColumnasChange} ocultarVacias={p.ocultarColumnasVacias} onOcultarVacias={p.onOcultarColumnasVacias}/>
      <details className="historial-mas-filtros"><summary>Más filtros{p.ocultarComplementarias?' · 1':''}<ChevronDown size={14}/></summary><label><input type="checkbox" checked={p.ocultarComplementarias} onChange={e=>p.onOcultarComplementarias(e.target.checked)}/> Ocultar complementarias</label></details>
    </div>}
  </>;
}
