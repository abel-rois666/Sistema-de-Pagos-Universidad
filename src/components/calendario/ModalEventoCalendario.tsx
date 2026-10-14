import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Save, X } from 'lucide-react';
import type { EventoAcademicoFormulario } from '../../calendario/service';

interface Props {
  evento: EventoAcademicoFormulario | null;
  guardando: boolean;
  onChange: (evento: EventoAcademicoFormulario) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}

const TIPOS_EVENTO = [
  ['INICIO', 'Inicio de clases'], ['TERMINO', 'Término de clases'], ['FESTIVO', 'Día festivo'],
  ['VACACIONES', 'Vacaciones'], ['EXAMENES', 'Exámenes ordinarios'],
  ['RECUPERACION', 'Exámenes de recuperación'], ['EXTRAORDINARIOS', 'Exámenes extraordinarios'],
  ['CAPTURA', 'Captura de calificaciones'], ['OTRO', 'Otro'],
] as const;
const SUSPENSION_OBLIGATORIA = new Set(['FESTIVO', 'VACACIONES', 'RECUPERACION', 'EXTRAORDINARIOS']);
const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';

export default function ModalEventoCalendario({ evento, guardando, onChange, onGuardar, onCancelar }: Props) {
  const dialogoRef = useRef<HTMLDivElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!evento) return;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    nombreRef.current?.focus();
    return () => focoAnterior?.focus();
  }, [Boolean(evento)]);
  if (!evento) return null;

  const tecla = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.stopPropagation(); if (!guardando) onCancelar(); return; }
    if (event.key !== 'Tab' || !dialogoRef.current) return;
    const elementos = [...dialogoRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')];
    const primero = elementos[0];
    const ultimo = elementos.at(-1);
    if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo?.focus(); }
    else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero?.focus(); }
  };

  return createPortal(<div className="fixed inset-0 z-[9000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
    onKeyDown={tecla}>
    <div ref={dialogoRef} role="dialog" aria-modal="true" aria-labelledby="titulo-evento-calendario"
      className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1c2228]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div><span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Calendario académico</span>
          <h2 id="titulo-evento-calendario" className="text-lg font-bold text-slate-900 dark:text-white">{evento.id ? 'Editar evento' : 'Añadir evento'}</h2></div>
        <button type="button" aria-label="Cerrar evento" onClick={onCancelar} disabled={guardando}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X size={20}/></button>
      </div>
      <div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100 sm:col-span-2">Nombre
          <input ref={nombreRef} className={campo} value={evento.nombre} disabled={guardando}
            onChange={e => onChange({ ...evento, nombre: e.target.value })} placeholder="Ej. Primer examen parcial" />
        </label>
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Tipo
          <select className={campo} value={evento.tipo} disabled={guardando} onChange={e => {
            const tipo = e.target.value;
            onChange({ ...evento, tipo, suspende_clases: SUSPENSION_OBLIGATORIA.has(tipo) });
          }}>{TIPOS_EVENTO.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Color
          <input type="color" className="mt-1 h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600" value={evento.color}
            disabled={guardando} onChange={e => onChange({ ...evento, color: e.target.value })} />
        </label>
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Desde
          <input type="date" className={campo} value={evento.fecha_inicio} disabled={guardando}
            onChange={e => onChange({ ...evento, fecha_inicio: e.target.value })} />
        </label>
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Hasta
          <input type="date" className={campo} value={evento.fecha_fin} disabled={guardando}
            onChange={e => onChange({ ...evento, fecha_fin: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 sm:col-span-2">
          <input type="checkbox" checked={evento.suspende_clases} disabled={guardando || SUSPENSION_OBLIGATORIA.has(evento.tipo)}
            onChange={e => onChange({ ...evento, suspende_clases: e.target.checked })} /> Excluir de los días efectivos
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">Festivos, vacaciones, recuperación y extraordinarios siempre se excluyen. Este evento se guarda por separado de los datos del calendario.</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
        <button type="button" onClick={onCancelar} disabled={guardando}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
        <button type="button" onClick={onGuardar} disabled={guardando}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Save size={16}/> Guardar evento</button>
      </div>
    </div>
  </div>, document.body);
}
