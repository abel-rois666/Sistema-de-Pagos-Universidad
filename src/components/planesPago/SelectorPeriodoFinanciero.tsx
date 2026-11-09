import SelectorBusqueda from '../ui/SelectorBusqueda';
import { useId } from 'react';
import { TODOS_PERIODOS, SIN_PERIODO } from '../../finanzas/consulta';
import { CampoConAyuda } from '../ui/AyudaContextual';
import '../ui/ayudaContextual.css';

export default function SelectorPeriodoFinanciero({ value, periodos, onChange, etiqueta = 'Periodo de consulta' }: { value: string; periodos: string[]; onChange: (valor: string) => void; etiqueta?: string }) {
  const id = useId();
  return <div className="w-full sm:max-w-[230px] print:hidden">
    <CampoConAyuda className="[&_.campo-con-ayuda-etiqueta]:text-sm" etiqueta={etiqueta} ayuda="Agrupa los ciclos homónimos del periodo. Consultar no cambia IDs, recibos ni planes.">
      <SelectorBusqueda id={id} value={value} onChange={onChange} etiqueta={etiqueta} placeholder="Selecciona un periodo"
        opciones={[{value:TODOS_PERIODOS,label:'Todos los periodos'},...periodos.slice().sort((a,b)=>a===SIN_PERIODO?1:b===SIN_PERIODO?-1:b.localeCompare(a,'es-MX',{numeric:true})).map(p=>({value:p,label:p===SIN_PERIODO?'Sin periodo identificado':p}))]}/>

    </CampoConAyuda>
  </div>;
}
