import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FichaAlumno from '../FichaAlumno';
import { useAppStore } from '../../store/useAppStore';
import { planesTitulacionAlumno } from '../../certificacion/seguimiento';
import { resumirPagoTitulacion } from '../../reportes/estadoPagoTitulacion';
import { conceptosFinancieros, describirPlan } from '../../finanzas/consulta';
import SelectorBusqueda from '../ui/SelectorBusqueda';

export interface DestinoAlumnoReporte { alumnoId: string; vista: 'datos_generales'|'certificacion'|'plan'; programaId?: string; planId?: string }
export default function ConsultaAlumnoReporte({destino,onCerrar,onActualizado}:{destino:DestinoAlumnoReporte;onCerrar:()=>void;onActualizado:()=>void}) {
  const panel=useRef<HTMLDivElement>(null), anterior=useRef<HTMLElement|null>(null);
  const {alumnos,plans,ciclos}=useAppStore();
  const [planId,setPlanId]=useState(destino.planId||'');
  const planes=planesTitulacionAlumno(plans,destino.alumnoId), plan=planes.find(p=>p.id===planId)||(planes.length===1?planes[0]:undefined);
  const alumno=alumnos.find(a=>a.id===destino.alumnoId);
  useEffect(()=>{
    anterior.current=document.activeElement as HTMLElement; const scroll=document.body.style.overflow;document.body.style.overflow='hidden';panel.current?.focus();
    const fondos=Array.from(document.body.children).filter((el):el is HTMLElement=>el instanceof HTMLElement&&!el.contains(panel.current));
    const previos=fondos.map(el=>el.inert);fondos.forEach(el=>{el.inert=true;});
    return ()=>{fondos.forEach((el,i)=>{el.inert=previos[i];});document.body.style.overflow=scroll;anterior.current?.focus();};
  },[]);
  return createPortal(<div ref={panel} role="dialog" aria-modal="true" aria-label={destino.vista==='plan'?'Consulta de planes de titulación':'Ficha del alumno desde el reporte'} tabIndex={-1}
    className="fixed inset-0 z-40 overflow-y-auto bg-gray-50 dark:bg-[#0f141b] text-gray-900 dark:text-gray-100"
    onKeyDown={e=>{
      // Las confirmaciones y los selectores en portal gestionan su propio foco y Escape.
      if(e.defaultPrevented||e.target!==e.currentTarget&&!panel.current?.contains(e.target as Node))return;
      if(e.key==='Escape'){e.stopPropagation();panel.current?.querySelector<HTMLButtonElement>('[data-cerrar-consulta]')?.click();}
      if(e.key==='Tab'){
        const visibles=(Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]) as HTMLElement[]).filter(el=>el.getClientRects().length);
        const primero=visibles[0],ultimo=visibles.at(-1);
        if(primero&&e.shiftKey&&(document.activeElement===primero||document.activeElement===panel.current)){e.preventDefault();ultimo?.focus();}
        else if(primero&&!e.shiftKey&&(document.activeElement===ultimo||document.activeElement===panel.current)){e.preventDefault();primero.focus();}
      }
    }}>
    {destino.vista==='plan'?<section className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <button data-cerrar-consulta type="button" onClick={onCerrar} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold">Volver al reporte</button>
      <header><h2 className="text-xl font-semibold">Planes de pago de titulación</h2><p className="mt-1 text-sm">{alumno?.nombre_completo||'Alumno no disponible'}</p><p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Consulta sin edición. Se conserva el texto original de cada estatus, incluidos abonos y folios.</p></header>
      {planes.length>1&&<div className="max-w-xl"><label className="block text-sm font-semibold mb-1" htmlFor="plan-titulacion-reporte">Plan que vas a consultar</label><SelectorBusqueda id="plan-titulacion-reporte" etiqueta="Plan que vas a consultar" value={plan?.id||''} onChange={setPlanId} opciones={planes.map(p=>({value:p.id,label:describirPlan(p,ciclos)}))}/></div>}
      {plan?<><p className="text-sm font-semibold">{describirPlan(plan,ciclos)} · {resumirPagoTitulacion(plan)}</p><div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c2228]"><table className="w-full text-left text-sm"><thead><tr>{['Concepto','Fecha','Importe','Estatus / recibo'].map(t=><th key={t} className="p-3 bg-gray-100 dark:bg-gray-800">{t}</th>)}</tr></thead><tbody>{conceptosFinancieros(plan).filter(c=>c.concepto.trim()!=='0').map(c=><tr key={c.indice} className="border-t border-gray-200 dark:border-gray-700"><td className="p-3 min-w-48">{c.concepto}</td><td className="p-3 whitespace-nowrap">{c.fecha||'Sin fecha'}</td><td className="p-3 whitespace-nowrap">{c.cantidad.toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td><td className="p-3 min-w-48">{c.estatus}</td></tr>)}</tbody></table></div></>:<p className="p-5 rounded-xl border border-gray-200 dark:border-gray-700">{planes.length?'Selecciona un plan por ciclo y folio.':'El alumno no tiene un plan de pagos de titulación identificado por ID.'}</p>}
    </section>:<FichaAlumno initialAlumnoId={destino.alumnoId} initialTab={destino.vista} initialProgramaId={destino.programaId} onBack={onCerrar} onBackToReporteEgresados={onCerrar} onCertificacionUpdated={onActualizado}/>}
  </div>,document.body);
}
