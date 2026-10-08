import { opcionesVistaHorario, type VistaHorario } from '../../horarios/cuadricula';
import type { EntradaHorario, SesionHorario } from '../../horarios/types';

interface Props {
  entrada: EntradaHorario;
  sesiones: SesionHorario[];
  vista: VistaHorario;
  onCambiar: (vista: VistaHorario) => void;
}

export default function SelectorVistaHorario({ entrada, sesiones, vista, onCambiar }: Props) {
  const opciones = opcionesVistaHorario(entrada, vista.tipo, sesiones);
  const seleccionados = new Set(vista.ids || []);

  return <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <div className="flex flex-wrap items-end gap-3">
      <label className="w-full min-w-0 text-xs font-semibold sm:w-auto">Mostrar horarios de
        <select value={vista.tipo} onChange={evento => onCambiar({ tipo: evento.target.value as VistaHorario['tipo'] })}
          className="mt-1 block w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 sm:w-auto">
          <option value="grupos">Grupos</option><option value="docentes">Docentes y vacantes</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Alcance de vista y exportación">
        <button type="button" onClick={() => onCambiar({ tipo: vista.tipo })}
          aria-pressed={!vista.ids} className={`rounded-lg border px-3 py-2 text-sm ${!vista.ids
            ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
            : 'border-slate-300 dark:border-slate-600'}`}>Todos</button>
        <button type="button" onClick={() => onCambiar({ tipo: vista.tipo, ids: vista.ids || opciones.slice(0, 1).map(opcion => opcion.id) })}
          aria-pressed={!!vista.ids} className={`rounded-lg border px-3 py-2 text-sm ${vista.ids
            ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
            : 'border-slate-300 dark:border-slate-600'}`}>Solo seleccionados</button>
      </div>
    </div>
    {vista.tipo === 'docentes' && <p className="text-xs text-slate-500 dark:text-slate-400">Las materias sin docente aparecen por licenciatura. Si sus horas se empalman, se abre otra vacante.</p>}
    {vista.ids && <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">La vista previa y los formatos de descarga disponibles usarán la misma selección.</p>
      <div className="flex flex-wrap gap-2">{opciones.map(opcion => <label key={opcion.id}
        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${seleccionados.has(opcion.id)
          ? 'border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-200'
          : opcion.clase === 'vacantes'
            ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20'
            : 'border-slate-300 dark:border-slate-600'}`}>
        <input type="checkbox" checked={seleccionados.has(opcion.id)} onChange={() => onCambiar({ tipo: vista.tipo,
          ids: seleccionados.has(opcion.id) ? vista.ids!.filter(id => id !== opcion.id) : [...vista.ids!, opcion.id] })}/>
        {opcion.nombre}
      </label>)}</div>
    </div>}
  </div>;
}
