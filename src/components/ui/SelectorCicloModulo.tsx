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
  const selector = <select value={cicloId} disabled={disabled} onChange={event => onChange(event.target.value)}
      className="h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-slate-600 dark:bg-[#1c2228] dark:text-white">
      <option value="">Selecciona un ciclo</option>
      {[...ciclos].sort((a, b) => b.nombre.localeCompare(a.nombre, 'es-MX', { numeric: true })
        || formatCicloEscolar(a).localeCompare(formatCicloEscolar(b), 'es-MX')).map(ciclo =>
        <option key={ciclo.id} value={ciclo.id}>{formatCicloEscolar(ciclo)}</option>)}
    </select>;
  if (ayuda) return <CampoConAyuda etiqueta={label} ayuda={ayuda} className={className}>{selector}</CampoConAyuda>;
  return <label className={`block min-w-48 ${className}`}>
    <span className="mb-1 block text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
    {selector}
  </label>;
}
