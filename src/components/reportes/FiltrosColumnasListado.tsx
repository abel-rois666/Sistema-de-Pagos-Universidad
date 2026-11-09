import { Filter, X } from 'lucide-react';
import { MultiSelectFilter } from '../MultiSelectFilter';
import AyudaContextual, { CampoConAyuda } from '../ui/AyudaContextual';
import { etiquetaOpcionColumna, type FiltroColumnaListado, type SeleccionFiltrosColumnas } from '../../reportes/filtrosColumnasListado';
import { fechaActualListado, type ColumnaListadoId } from '../../reportes/listadoGeneral';

interface Props {
  filtros: FiltroColumnaListado[];
  seleccion: SeleccionFiltrosColumnas;
  onCambiar: (id: ColumnaListadoId, valores: string[]) => void;
  onLimpiar: () => void;
  fecha: string;
  fechaValida: boolean;
  onFecha: (fecha: string) => void;
  cargandoCertificacion: boolean;
  errorCertificacion: boolean;
}

export default function FiltrosColumnasListado({ filtros, seleccion, onCambiar, onLimpiar, fecha, fechaValida, onFecha, cargandoCertificacion, errorCertificacion }: Props) {
  if (!filtros.length) return null;
  const activos = filtros.filter(f => seleccion[f.id]?.length);
  return <section aria-labelledby="filtros-columnas-titulo" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252d36] p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
      <div><h3 id="filtros-columnas-titulo" className="flex flex-wrap items-center gap-2 text-sm font-semibold"><Filter size={16} className="text-blue-600 dark:text-blue-400"/>Filtrar columnas elegidas{activos.length > 0 && <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-2 py-0.5 text-xs">{activos.length} {activos.length === 1 ? 'activo' : 'activos'}</span>}</h3>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Aparecen al activar una columna. Sin selección, se incluyen todos sus valores.</p></div>
      <div className="flex flex-wrap items-end gap-3 w-full sm:w-auto">
        {filtros.some(f => f.id === 'edad') && <div className="w-full sm:w-44"><CampoConAyuda etiqueta="Calcular edad al" ayuda="Años cumplidos a esta fecha. Cambiarla actualiza las edades y el filtro; conserva las edades seleccionadas aunque no tengan coincidencias."><input className="w-full h-[42px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1c2228] px-3 text-sm text-gray-900 dark:text-gray-100" type="date" value={fecha} max={fechaActualListado()} onChange={e => onFecha(e.target.value)} aria-invalid={!fechaValida}/></CampoConAyuda>{!fechaValida && <p role="alert" className="mt-1 max-w-44 text-xs text-red-700 dark:text-red-300">Elige una fecha válida, no posterior a hoy, para filtrar y exportar.</p>}</div>}
        {activos.length > 0 && <button type="button" onClick={onLimpiar} className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline rounded px-2 min-h-[42px]">Limpiar estos filtros</button>}
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4 items-start">
      {filtros.map(f => {
        const elegidos = seleccion[f.id] || [];
        const pendiente = f.requiereCertificacion && (cargandoCertificacion || errorCertificacion);
        const deshabilitado = pendiente || f.id === 'edad' && !fechaValida;
        return <div key={f.id} className="min-w-0">
          <div className="flex items-start justify-between gap-2 min-h-10 text-sm font-semibold"><span id={`etiqueta-filtro-${f.id}`}>{f.nombre}</span>{f.ayuda && <AyudaContextual etiqueta={`Filtro: ${f.nombre}`} texto={f.ayuda}/>}</div>
          <fieldset disabled={deshabilitado} aria-labelledby={`etiqueta-filtro-${f.id}`} className="min-w-0 max-w-sm [&>div>button]:min-h-[42px] disabled:cursor-wait">
            <MultiSelectFilter fullWidth ariaLabel={`Filtrar ${f.nombre}`} label={elegidos.length === 1 ? etiquetaOpcionColumna(f.id, elegidos[0]) : elegidos.length ? `${elegidos.length} opciones` : 'Todos los valores'} options={f.opciones} selected={elegidos} formatLabel={v => etiquetaOpcionColumna(f.id, v)} onChange={v => onCambiar(f.id, v)}/>
          </fieldset>
          {pendiente && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{errorCertificacion ? 'Reintenta la consulta de certificación para filtrar.' : 'Consultando estados…'}</p>}
        </div>;
      })}
    </div>
    {activos.length > 0 && <div aria-label="Filtros de columnas aplicados" className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
      {activos.map(f => <button key={f.id} type="button" aria-label={`Quitar filtro ${f.nombre}`} onClick={() => onCambiar(f.id, [])} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-2 text-xs text-blue-800 dark:text-blue-200"><span className="text-left break-words min-w-0">{f.nombre}: {seleccion[f.id]!.length === 1 ? etiquetaOpcionColumna(f.id, seleccion[f.id]![0]) : `${seleccion[f.id]!.length} opciones`}</span><X size={14} className="shrink-0"/></button>)}
    </div>}
  </section>;
}
