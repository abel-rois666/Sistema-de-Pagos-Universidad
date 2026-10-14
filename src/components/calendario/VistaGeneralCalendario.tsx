import { CalendarRange, ListChecks, Layers3, Trash2 } from 'lucide-react';
import { mesesInvolucrados } from '../../calendario/meses';
import { actividadesCalendario } from '../../calendario/actividades';
import type { EventoAcademico } from '../../calendario/service';
import VistaMensualCalendario, { type EventoVistaCalendario } from './VistaMensualCalendario';

interface PlanResumen { id: string; nombre: string; clave_legado: string; carreras?: { nombre: string } | null }

interface Props {
  inicio: string;
  fin: string;
  eventos: readonly EventoAcademico[];
  planes: readonly PlanResumen[];
  planIds: readonly string[];
  fechaSeleccionada: string;
  onSeleccionarFecha: (fecha: string) => void;
  onEditarEvento: (evento: EventoAcademico) => void;
  onEliminarEvento?: (evento: EventoAcademico) => void;
}

const etiquetaMes = (mes: string) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${mes}-01T12:00:00Z`));

export default function VistaGeneralCalendario({ inicio, fin, eventos, planes, planIds, fechaSeleccionada,
  onSeleccionarFecha, onEditarEvento, onEliminarEvento }: Props) {
  const meses = mesesInvolucrados(inicio, fin, eventos);
  const actividades = actividadesCalendario(inicio, fin, eventos);
  const eventosVista: EventoVistaCalendario[] = actividades.map(item => ({
    id: item.id, nombre: item.nombre, tipo: item.tipo, color: item.color,
    fechaInicio: item.fecha_inicio, fechaFin: item.fecha_fin, suspendeClases: item.suspende_clases,
  }));
  const asociados = planes.filter(plan => planIds.includes(plan.id)).sort((a, b) =>
    (a.carreras?.nombre || a.nombre).localeCompare(b.carreras?.nombre || b.nombre, 'es'));

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(330px,0.9fr)_minmax(0,1.1fr)]">
    <div className="min-w-0 space-y-4">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><CalendarRange size={16}/> Meses del calendario</div>
      {meses.map(mes => <section key={mes} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/30">
        <h3 className="mb-2 text-sm font-bold capitalize">{etiquetaMes(mes)}</h3>
        <VistaMensualCalendario compacta mes={mes} eventos={eventosVista} fechaSeleccionada={fechaSeleccionada} onSeleccionarFecha={onSeleccionarFecha}/>
      </section>)}
      {!meses.length && <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Define fechas válidas para ver los meses.</p>}
    </div>
    <div className="min-w-0 space-y-5 xl:sticky xl:top-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3 dark:bg-slate-800/60"><h3 className="flex items-center gap-2 font-bold"><ListChecks size={17}/> Actividades</h3><span className="text-xs font-semibold text-slate-500">{actividades.length} fecha{actividades.length === 1 ? '' : 's'}</span></div>
        {actividades.length ? <div className="divide-y divide-slate-200 dark:divide-slate-700">{actividades.map(item => <div key={item.id} className="flex items-center gap-1 pr-2">
          <button type="button" disabled={!item.evento} onClick={() => { if (item.evento) onEditarEvento(item.evento); }}
            className="grid min-w-0 flex-1 gap-1 px-4 py-3 text-left transition-colors enabled:hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:enabled:hover:bg-blue-950/30 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
            <span className="flex min-w-0 items-start gap-2"><span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }}/><span className="min-w-0"><span className="block font-semibold">{item.nombre}</span><span className="block text-xs text-slate-500 dark:text-slate-400">{item.tipo.replaceAll('_', ' ').toLowerCase()}{item.suspende_clases ? ' · Sin clase efectiva' : ''}</span></span></span>
            <span className="whitespace-nowrap pt-0.5 text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{item.fecha_inicio === item.fecha_fin ? item.fecha_inicio : `${item.fecha_inicio} — ${item.fecha_fin}`}</span>
          </button>{onEliminarEvento && item.evento && <button type="button" aria-label={`Eliminar ${item.nombre}`} title="Eliminar evento" onClick={() => onEliminarEvento(item.evento!)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={16}/></button>}
        </div>)}</div> : <p className="p-4 text-sm text-slate-500">Todavía no hay actividades. Selecciona un día para añadir la primera.</p>}
      </section>
      <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <h3 className="flex items-center gap-2 font-bold"><Layers3 size={17}/> Planes asociados</h3>
        {asociados.length ? <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{asociados.map(plan => <li key={plan.id} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"><span className="font-semibold">{plan.carreras?.nombre || plan.nombre}</span><span className="block text-xs text-slate-500">{plan.clave_legado}</span></li>)}</ul>
          : <p className="mt-2 text-sm text-slate-500">Sin planes asociados.</p>}
      </section>
    </div>
  </div>;
}
