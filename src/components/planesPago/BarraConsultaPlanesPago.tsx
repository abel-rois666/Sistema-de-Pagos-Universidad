import { ArrowLeft, Edit, Loader2, Plus, Printer, User } from 'lucide-react';
import type { Alumno, CicloEscolar, PaymentPlan } from '../../types';
import SelectorPeriodoFinanciero from './SelectorPeriodoFinanciero';
import BuscadorPlanesPago from './BuscadorPlanesPago';
import './consultaPlanesPago.css';

export default function BarraConsultaPlanesPago({ periodo, periodos, onPeriodo, planes, alumnos, ciclos, busqueda, onBusqueda, onSeleccion,
  onBack, textoVolver, onFicha, onRecibo, onNuevo, onEditar, onPdf, generando }: {
  periodo: string; periodos: string[]; onPeriodo: (valor: string) => void; planes: PaymentPlan[]; alumnos: Alumno[]; ciclos: CicloEscolar[];
  busqueda: string; onBusqueda: (texto: string) => void; onSeleccion: (plan: PaymentPlan) => void;
  onBack: () => void; textoVolver: string; onFicha?: () => void; onRecibo?: () => void;
  onNuevo?: () => void; onEditar?: () => void; onPdf: () => void; generando: boolean;
}) {
  return <div className="planes-consulta-cabecera print:hidden">
    <nav className="planes-consulta-regreso" aria-label="Regresar desde planes de pago">
      <button type="button" onClick={onBack}><ArrowLeft size={17}/>{textoVolver}</button>
      {onFicha && <button type="button" onClick={onFicha}><User size={16}/>Regresar a Ficha</button>}
      {onRecibo && <button type="button" onClick={onRecibo}><ArrowLeft size={16}/>Volver al Recibo</button>}
    </nav>
    <div className="planes-consulta-barra">
      <SelectorPeriodoFinanciero value={periodo} periodos={periodos} onChange={onPeriodo}/>
      <BuscadorPlanesPago planes={planes} alumnos={alumnos} ciclos={ciclos} value={busqueda} onChange={onBusqueda} onSelect={onSeleccion}/>
      <div className="planes-consulta-acciones">
        {onNuevo && <button type="button" className="planes-accion-primaria" onClick={onNuevo} aria-label="Crear nuevo plan"><Plus size={17}/><span className="planes-etiqueta-completa">Nuevo Plan</span><span className="planes-etiqueta-corta">Nuevo</span></button>}
        {onEditar && <button type="button" className="planes-accion-secundaria" onClick={onEditar}><Edit size={16}/>Editar</button>}
        <button type="button" className="planes-accion-pdf" onClick={onPdf} disabled={generando} aria-label={generando ? 'Generando PDF' : 'PDF / Imprimir'}>
          {generando ? <Loader2 size={17} className="animate-spin"/> : <Printer size={17}/>}<span className="planes-etiqueta-completa">{generando ? 'Generando…' : 'PDF / Imprimir'}</span><span className="planes-etiqueta-corta">{generando ? 'PDF…' : 'PDF'}</span>
        </button>
      </div>
    </div>
  </div>;
}
