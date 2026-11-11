import { useId } from 'react';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import type { CicloEscolar } from '../../types';
import { resolverCicloPlanPagoImportado, tipoPeriodoPlanPago, validarCicloPlanPago } from '../../utils/cicloPlanPago';

interface Props {
  ciclos: readonly CicloEscolar[];
  cicloId: string;
  tipoPlan: string;
  nombrePeriodo: string;
  periodicidadAcademica?: string;
  onChange: (id: string) => void;
}

/** El nombre del periodo orienta la sugerencia; solo el ID elegido se guarda. */
export default function SelectorCicloPlanPago({ ciclos, cicloId, tipoPlan, nombrePeriodo,
  periodicidadAcademica, onChange }: Props) {
  const selectorId = useId();
  const tipo = tipoPeriodoPlanPago(tipoPlan);
  const sugerido = resolverCicloPlanPagoImportado(ciclos, nombrePeriodo, periodicidadAcademica || tipoPlan);
  const elegido = ciclos.find(ciclo => ciclo.id === cicloId);
  const error = elegido ? validarCicloPlanPago(elegido, tipoPlan) : null;

  return <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <label htmlFor={selectorId} className="block text-sm font-bold text-slate-800 dark:text-slate-100">Ciclo escolar del plan</label>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {periodicidadAcademica ? `Plan de estudios detectado: ${periodicidadAcademica}. ` : ''}
          {sugerido ? `Sugerido: ${sugerido.nombre} · ${sugerido.tipo_periodo}.` : 'Elige el ciclo exacto antes de guardar.'}
        </p>
      </div>
      {sugerido && elegido?.id !== sugerido.id &&
        <button type="button" onClick={() => onChange(sugerido.id)}
          className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-blue-900">
          Usar sugerido
        </button>}
    </div>
    <div className="mt-3 w-full max-w-[300px]"><SelectorBusqueda id={selectorId} value={cicloId} onChange={onChange} etiqueta="Ciclo escolar del plan"
      placeholder="Selecciona el ciclo exacto" opciones={[{value:'',label:'Selecciona el ciclo exacto'},...[...ciclos].sort((a,b)=>b.nombre.localeCompare(a.nombre,'es-MX',{numeric:true})||(a.tipo_periodo||'').localeCompare(b.tipo_periodo||'','es-MX')).map(ciclo=>({value:ciclo.id,label:`${ciclo.nombre} · ${ciclo.tipo_periodo}${ciclo.id===sugerido?.id?' (sugerido)':''}`}))]}/></div>
    {error && <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">{error} Corrige el tipo o el ciclo antes de guardar.</p>}
    {!error && elegido && tipo && periodicidadAcademica
      && tipo !== periodicidadAcademica.trim().toLocaleLowerCase('es-MX') &&
      <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
        La periodicidad del plan de estudios no coincide con el tipo de plan de pagos.
      </p>}
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Puedes cambiar la sugerencia manualmente. El sistema validará el ID y el plan de estudios al guardar.</p>
  </div>;
}
