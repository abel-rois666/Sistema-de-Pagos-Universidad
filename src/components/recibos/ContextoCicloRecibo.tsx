import { useId } from 'react';
import type { CicloEscolar } from '../../types';
import { formatCicloEscolar } from '../../utils/formatUtils';
import SelectorCicloModulo from '../ui/SelectorCicloModulo';

interface Props {
  ciclos: readonly CicloEscolar[];
  cicloId: string;
  onChange: (id: string) => void;
  desdePlan: boolean;
  referenciaPlan?: string;
  error?: string;
  confirmado: boolean;
  onConfirmar: (confirmado: boolean) => void;
  disabled?: boolean;
}

export default function ContextoCicloRecibo({ ciclos, cicloId, onChange, desdePlan,
  referenciaPlan, error, confirmado, onConfirmar, disabled }: Props) {
  const confirmacionId = useId();
  const ciclo = ciclos.find(item => item.id === cicloId);
  return <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
    <SelectorCicloModulo ciclos={ciclos} cicloId={cicloId} label="Ciclo del recibo"
      disabled={disabled || desdePlan} onChange={onChange} className="w-full sm:max-w-sm" />
    {desdePlan ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
      {referenciaPlan ? `Ciclo heredado del plan ${referenciaPlan}.` : 'Consultando el ciclo del plan…'}
      {' '}Los conceptos de este cobro se registran en ese ciclo.
    </p> : <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
      Elige el ciclo al que corresponde el cobro. Los conceptos independientes se guardan sin aplicarse a un plan.
    </p>}
    {error && <p role="alert" className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-300">{error}</p>}
    {!desdePlan && ciclo && !error && <label htmlFor={confirmacionId}
      className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
      <input id={confirmacionId} type="checkbox" checked={confirmado} disabled={disabled}
        onChange={event => onConfirmar(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
      <span>Confirmo emitir este recibo en {formatCicloEscolar(ciclo)}.</span>
    </label>}
  </div>;
}
