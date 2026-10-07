import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

interface PlanOpcion {
  id: string;
  nombre: string;
  carrera?: { nombre: string } | null;
}

interface AsignaturaOpcion {
  id: string;
  nombre: string;
  clave_legado: string;
  plan_id: string;
}

interface Props {
  planes: PlanOpcion[];
  planIds: string[];
  asignaturas: AsignaturaOpcion[];
  asignaturaIds: string[];
  onAlternar: (id: string) => void;
}

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export default function SelectorAsignaturasPreferidas({ planes, planIds, asignaturas, asignaturaIds, onAlternar }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const planesPorId = useMemo(() => new Map(planes.map(plan => [plan.id, plan])), [planes]);
  const planIdsSeleccionados = useMemo(() => new Set(planIds), [planIds]);
  const asignaturaIdsSeleccionadas = useMemo(() => new Set(asignaturaIds), [asignaturaIds]);
  const visibles = useMemo(() => asignaturas.filter(asignatura => planIdsSeleccionados.has(asignatura.plan_id)), [asignaturas, planIdsSeleccionados]);
  const termino = normalizar(busqueda);
  const filtradas = useMemo(() => visibles.filter(asignatura => {
    if (!termino) return true;
    const plan = planesPorId.get(asignatura.plan_id);
    return normalizar([asignatura.nombre, asignatura.clave_legado, plan?.nombre || '', plan?.carrera?.nombre || ''].join(' ')).includes(termino);
  }), [visibles, termino, planesPorId]);
  const seleccionadas = visibles.filter(asignatura => asignaturaIdsSeleccionadas.has(asignatura.id)).length;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
        <h3 className="font-bold text-slate-900 dark:text-white">Asignaturas preferidas</h3>
        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{seleccionadas} seleccionadas</span>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Ayudan a ordenar alternativas; no sustituyen la disponibilidad.</p>
      <div className="relative mb-2">
        <label htmlFor="buscar-asignaturas-docente" className="sr-only">Buscar asignaturas por nombre, clave, licenciatura o plan</label>
        <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input id="buscar-asignaturas-docente" type="search" value={busqueda} onChange={event => setBusqueda(event.target.value)} disabled={!visibles.length} placeholder="Buscar materia, clave, licenciatura o plan" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500" />
        {busqueda && <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda de asignaturas" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><X size={14} /></button>}
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
        {!visibles.length ? <p className="p-2 text-sm text-slate-500 dark:text-slate-400">Selecciona un plan primero.</p> : !filtradas.length ? <p className="p-2 text-sm text-slate-500 dark:text-slate-400">No hay materias que coincidan con la búsqueda.</p> : filtradas.map(asignatura => {
          const plan = planesPorId.get(asignatura.plan_id);
          return <label key={asignatura.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2.5 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800">
            <input type="checkbox" checked={asignaturaIdsSeleccionadas.has(asignatura.id)} onChange={() => onAlternar(asignatura.id)} className="mt-1 shrink-0 accent-blue-600" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{asignatura.nombre}</span>
              <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] leading-snug">
                <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">{plan?.carrera?.nombre || 'Carrera sin definir'}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-700 dark:text-slate-200">{plan?.nombre || 'Plan sin definir'}</span>
                {asignatura.clave_legado && <span className="px-1 py-0.5 text-slate-500 dark:text-slate-400">{asignatura.clave_legado}</span>}
              </span>
            </span>
          </label>;
        })}
      </div>
      {busqueda && visibles.length > 0 && <p role="status" className="mt-1 text-xs text-slate-500 dark:text-slate-400">{filtradas.length} de {visibles.length} materias. Las selecciones se conservan al cambiar la búsqueda.</p>}
    </div>
  );
}
