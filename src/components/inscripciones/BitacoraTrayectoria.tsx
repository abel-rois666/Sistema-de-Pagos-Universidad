import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { aproximacionesEvento,camposEvento,datosEvento,ordenarEventos,textoCampoHistorial,tituloEvento,type EventoHistorial } from '../../inscripciones/historialCambios';

export interface ContextoHistorial {alumno?:string;matricula?:string;programa?:string;ciclo?:string}
export default function BitacoraTrayectoria({cambios,ciclo,onCerrar,contexto={},retornoFoco}:{cambios:unknown[];ciclo:(id:string|null)=>string;onCerrar:()=>void;contexto?:ContextoHistorial;retornoFoco?:HTMLElement|null}){
 const titulo=useId(),cerrar=useRef<HTMLButtonElement>(null),dialogo=useRef<HTMLElement>(null);
 useEffect(()=>{const anterior=retornoFoco||document.activeElement as HTMLElement|null;cerrar.current?.focus();return()=>{if(anterior?.isConnected)anterior.focus({preventScroll:true});};},[]);
 function teclado(e:KeyboardEvent){
  if(e.key==='Escape'){e.stopPropagation();onCerrar();}
  if(e.key!=='Tab')return;
  const controles=Array.from((dialogo.current?.querySelectorAll('button,summary,a[href],[tabindex="0"]')||[]) as ArrayLike<HTMLElement>).filter(el=>el.getClientRects().length);
  const primero=controles[0],ultimo=controles[controles.length-1];
  if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo?.focus();}
  else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero?.focus();}
 }
 const fecha=(v?:string)=>{const d=new Date(v||'');return Number.isNaN(d.getTime())?'Fecha no disponible':d.toLocaleString('es-MX',{timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short'});};
 return <div className="ic-modal ic-historial-modal" onKeyDown={teclado}><section ref={dialogo} className="ic-dialog ic-historial-dialog" role="dialog" aria-modal="true" aria-labelledby={titulo}>
  <header><div><h2 id={titulo}>Historial de cambios</h2>{contexto.alumno&&<p className="ic-historial-alumno">{contexto.alumno}{contexto.matricula?` · ${contexto.matricula}`:''}</p>}{(contexto.programa||contexto.ciclo)&&<small>{[contexto.programa,contexto.ciclo].filter(Boolean).join(' · ')}</small>}</div><button ref={cerrar} type="button" onClick={onCerrar}>Cerrar</button></header>
  <div className="ic-body"><p className="ic-historial-ayuda">Del más reciente al más antiguo. Consulta el detalle de cada operación para revisar los valores registrados.</p>
   {!cambios.length&&<p className="ic-vacio">No hay cambios registrados.</p>}
   <ol className="ic-historial-lista">{ordenarEventos(cambios as EventoHistorial[]).map((e,n)=>{
    const campos=camposEvento(e),inicial=!e.antes,datos=datosEvento(e.despues),marcas=aproximacionesEvento(e);
    return <li key={e.id||n} className="ic-historial-evento"><article><div className="ic-historial-evento-cabecera"><h3>{tituloEvento(e)}</h3><time dateTime={e.creado_en}>{fecha(e.creado_en)}</time></div>
     <p className="ic-historial-responsable">Responsable: <strong>{e.responsable||'No disponible'}</strong></p>
     <p><strong>Motivo:</strong> {e.motivo||String(datos.motivo||e.despues?.motivo||'Sin motivo registrado')}</p>
     {marcas.length>0&&<p className="ic-historial-marcas">{marcas.join(' · ')}. Revisa su respaldo antes de usar estos antecedentes.</p>}
     <details><summary>{inicial?'Ver datos del registro inicial':`Ver cambios (${campos.length})`}</summary>
      {!campos.length?<p>No se modificaron los campos de esta vista.</p>:<div className={`ic-historial-campos ${inicial?'ic-historial-inicial':''}`}>
       <div className="ic-historial-fila ic-historial-columnas" aria-hidden="true"><span>Campo</span>{!inicial&&<span>Antes</span>}<span>{inicial?'Valor registrado':'Después'}</span></div>
       {campos.map(c=><div className="ic-historial-fila" key={c.clave}><strong>{c.etiqueta}</strong>{!inicial&&<div><span className="ic-historial-movil">Antes</span>{textoCampoHistorial(c.clave,c.antes,ciclo)}</div>}<div><span className="ic-historial-movil">{inicial?'Valor registrado':'Después'}</span>{textoCampoHistorial(c.clave,c.despues,ciclo)}</div></div>)}
      </div>}
     </details>
    </article></li>;
   })}</ol>
  </div>
 </section></div>;
}
