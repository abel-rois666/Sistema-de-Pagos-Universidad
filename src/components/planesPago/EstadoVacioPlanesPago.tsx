import type { ReactNode } from 'react';
import { ArrowLeft, History, Inbox, Plus } from 'lucide-react';
import SelectorPeriodoFinanciero from './SelectorPeriodoFinanciero';
import './estadoVacioPlanesPago.css';

interface Props {
  periodo:string; periodos:string[]; onPeriodo:(valor:string)=>void;
  onHistorial?:()=>void; onCrear?:()=>void; onVolver:()=>void;
  volverTexto:string; hayPlanesDelPeriodo:boolean; buscador?:ReactNode;
}
export default function EstadoVacioPlanesPago({periodo,periodos,onPeriodo,onHistorial,onCrear,onVolver,volverTexto,hayPlanesDelPeriodo,buscador}:Props) {
  return <div className="planes-vacio">
    <section className="planes-vacio-consulta" aria-label="Consulta de planes de pago">
      <div className="planes-vacio-selector"><SelectorPeriodoFinanciero value={periodo} periodos={periodos} onChange={onPeriodo}/></div>
      <p className="planes-vacio-orientacion">Selecciona un ciclo para<br/> consultar sus planes registrados.</p>
      {onHistorial&&<button type="button" className="planes-vacio-historial" onClick={onHistorial}><History size={18} aria-hidden="true"/><span>Ver historial de todos los periodos</span></button>}
    </section>
    {buscador}
    <section className="planes-vacio-tarjeta" aria-labelledby="planes-vacio-titulo">
      <div className="planes-vacio-contenido">
        <div className="planes-vacio-icono"><Inbox size={40} strokeWidth={1.7} aria-hidden="true"/></div>
        <div className="planes-vacio-texto">
          <h2 id="planes-vacio-titulo">Sin Planes de Pago</h2>
          <p>{hayPlanesDelPeriodo?'Este alumno no tiene un plan en el periodo elegido.':'No hay planes de pago registrados en el periodo elegido.'}</p>
          <p>{hayPlanesDelPeriodo?'Busca otro alumno o consulta todos los periodos.':onCrear?'Selecciona otro periodo o crea un plan nuevo.':'Selecciona otro periodo para consultar sus planes.'}</p>
        </div>
      </div>
      <div className="planes-vacio-acciones">
        {onCrear&&<button type="button" className="planes-vacio-crear" onClick={onCrear}><Plus size={20} aria-hidden="true"/>Crear Nuevo Plan</button>}
        <button type="button" className="planes-vacio-volver" onClick={onVolver}><ArrowLeft size={18} aria-hidden="true"/>{volverTexto}</button>
      </div>
    </section>
  </div>;
}
