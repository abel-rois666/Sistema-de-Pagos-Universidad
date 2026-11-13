import { useMemo } from 'react';
import type { Alumno } from '../../types';

interface Props {
  alumnos: readonly Alumno[]; filtrados: number; elegidos: string[]; seleccionando: boolean; pendiente: boolean;
  onAlternar: () => void; onConsultar: () => void; onQuitar: (id: string) => void; onLimpiar: () => void;
}
export default function BarraConsultaPagosListado({ alumnos, filtrados, elegidos, seleccionando, pendiente, onAlternar, onConsultar, onQuitar, onLimpiar }: Props) {
  const nombres = useMemo(() => new Map(alumnos.map(a => [a.id, a.nombre_completo])), [alumnos]);
  return <section aria-label="Consulta de pagos" className="rounded-xl border border-gray-200 p-4 text-sm dark:border-gray-600 space-y-3">
    <div><h3 className="font-semibold">Consultar pagos y recibos</h3><p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Certificados y planes de titulación. Consulta sin edición; no cambia pagos ni trámites.</p></div>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="min-h-10 rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={pendiente || !(elegidos.length || filtrados)} onClick={onConsultar}>Consultar pagos de {elegidos.length || filtrados} {elegidos.length ? elegidos.length === 1 ? 'seleccionado' : 'seleccionados' : filtrados === 1 ? 'filtrado' : 'filtrados'}</button>
      <button type="button" className="min-h-10 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800" onClick={onAlternar}>{seleccionando ? 'Ocultar casillas de consulta' : 'Elegir alumnos para consultar'}</button>
      {elegidos.length > 0 && <><button type="button" className="min-h-10 px-2 underline" onClick={onLimpiar}>Limpiar selección ({elegidos.length})</button><details><summary className="min-h-10 cursor-pointer py-2">Ver seleccionados</summary><ul className="max-h-48 overflow-y-auto">{elegidos.map(id => <li key={id} className="flex items-center justify-between gap-3 py-1"><span>{nombres.get(id) || 'Alumno no disponible'}</span><button type="button" className="min-h-9 underline" onClick={() => onQuitar(id)} aria-label={`Quitar a ${nombres.get(id) || 'alumno'} de la consulta`}>Quitar</button></li>)}</ul></details></>}
    </div>
    {seleccionando && <p className="text-xs text-gray-600 dark:text-gray-300">La casilla «Consulta» marca solo esta página. La selección se conserva al cambiar de página o filtro. La actualización administrativa usa sus propias casillas.</p>}
  </section>;
}
