import { useEffect, useState } from 'react';
import { FolderOpen, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import type { BorradorHorarioGuardado } from '../../horarios/borradoresService';

interface Props {
  borradores: BorradorHorarioGuardado[];
  activoId: string | null;
  activoNombre: string;
  bloqueado: boolean;
  ocupado: boolean;
  error: string;
  puedeGuardar: boolean;
  onGuardar: (nombre: string, nuevo: boolean) => void;
  onAbrir: (borrador: BorradorHorarioGuardado) => void;
  onEliminar: (borrador: BorradorHorarioGuardado) => void;
  onActualizar: () => void;
}

export default function PanelBorradoresHorario({ borradores, activoId, activoNombre, bloqueado,
  ocupado, error, puedeGuardar, onGuardar, onAbrir, onEliminar, onActualizar }: Props) {
  const [nombre, setNombre] = useState(activoNombre);
  useEffect(() => { setNombre(activoNombre); }, [activoId, activoNombre]);
  return <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-900 dark:bg-[#162030]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Trabajo en curso</p>
        <h2 className="mt-1 text-lg font-bold">Borradores de este ciclo</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Guarda la propuesta actual para continuarla después. Las vacantes se conservan en el borrador.</p>
      </div>
      <button type="button" onClick={onActualizar} disabled={bloqueado || ocupado}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-600">
        {ocupado ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} Actualizar lista
      </button>
    </div>
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <label className="min-w-52 flex-1 text-xs font-semibold">Nombre del borrador
        <input value={nombre} maxLength={100} onChange={e => setNombre(e.target.value)}
          placeholder="Ej. Propuesta de octubre" disabled={bloqueado || ocupado}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"/>
      </label>
      <button type="button" onClick={() => onGuardar(nombre, false)}
        disabled={!puedeGuardar || bloqueado || ocupado || !nombre.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Save size={15}/>{activoId ? 'Actualizar borrador' : 'Guardar borrador'}</button>
      {activoId && <button type="button" onClick={() => onGuardar(nombre, true)}
        disabled={!puedeGuardar || bloqueado || ocupado || !nombre.trim()}
        className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40 dark:border-blue-700 dark:text-blue-300">Guardar copia</button>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>}
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {borradores.map(b => <div key={b.id} className={`rounded-xl border p-3 ${activoId === b.id
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold" title={b.nombre}>{b.nombre}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(b.actualizado_en).toLocaleString('es-MX')} · {b.contenido.sesiones?.length || 0} bloque(s)</p></div>
          {activoId === b.id && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">Abierto</span>}</div>
        <div className="mt-3 flex gap-3"><button type="button" onClick={() => onAbrir(b)} disabled={bloqueado || ocupado}
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 disabled:opacity-40 dark:text-blue-300"><FolderOpen size={14}/> Abrir</button>
          <button type="button" onClick={() => onEliminar(b)} disabled={bloqueado || ocupado}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 disabled:opacity-40 dark:text-red-300"><Trash2 size={14}/> Eliminar</button></div>
      </div>)}
      {!borradores.length && !ocupado && <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no hay borradores guardados para este ciclo.</p>}
    </div>
  </section>;
}
