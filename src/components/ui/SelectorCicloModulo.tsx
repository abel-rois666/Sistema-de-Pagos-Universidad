import { useId } from 'react';
import SelectorBusqueda from './SelectorBusqueda';
import type { CicloEscolar } from '../../types';
import { formatCicloEscolar } from '../../utils/formatUtils';
import { CampoConAyuda } from './AyudaContextual';

interface Props {
  ciclos: readonly CicloEscolar[];
  cicloId: string;
  onChange: (id: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  ayuda?: string;
}

/** Selector de contexto de cada módulo; conserva el ID exacto del ciclo. */
export default function SelectorCicloModulo({ ciclos, cicloId, onChange,
  label = 'Ciclo de trabajo', disabled = false, className = '', ayuda }: Props) {
  const id = useId();
  const opciones = [...ciclos].sort((a, b) => b.nombre.localeCompare(a.nombre, 'es-MX', { numeric: true })
    || formatCicloEscolar(a).localeCompare(formatCicloEscolar(b), 'es-MX'))
    .map(ciclo => ({ value: ciclo.id, label: formatCicloEscolar(ciclo) }));
  const selector = <SelectorBusqueda id={id} value={cicloId} disabled={disabled} onChange={onChange}
    etiqueta={label} placeholder="Selecciona un ciclo" opciones={[{value:'',label:'Selecciona un ciclo'},...opciones]}/>;
  if (ayuda) return <CampoConAyuda etiqueta={label} ayuda={ayuda} className={`selector-ciclo-modulo w-full max-w-[300px] ${className}`}>{selector}</CampoConAyuda>;
  return <div className={`selector-ciclo-modulo block w-full max-w-[300px] ${className}`}>
    <label htmlFor={id} className="mb-1.5 block min-h-6 text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</label>
    {selector}
  </div>;
}
