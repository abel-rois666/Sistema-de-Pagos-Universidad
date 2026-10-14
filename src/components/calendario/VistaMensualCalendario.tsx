import type { EventoCalendarioCalculable } from '../../calendario/calculos';
import { excluyeDiaLectivo } from '../../calendario/calculos';

export interface EventoVistaCalendario extends EventoCalendarioCalculable {
  id: string;
  nombre: string;
  color: string;
}

interface Props {
  mes: string;
  eventos: readonly EventoVistaCalendario[];
  fechaSeleccionada: string;
  onSeleccionarFecha: (fecha: string) => void;
  compacta?: boolean;
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function fechaIso(valor: number): string {
  return new Date(valor).toISOString().slice(0, 10);
}

export default function VistaMensualCalendario({ mes, eventos, fechaSeleccionada, onSeleccionarFecha, compacta = false }: Props) {
  const [anio, numeroMes] = mes.split('-').map(Number);
  const inicio = Date.UTC(anio, numeroMes - 1, 1);
  const desfase = (new Date(inicio).getUTCDay() + 6) % 7;
  const primerDia = inicio - desfase * 86_400_000;
  const diasDelMes = new Date(Date.UTC(anio, numeroMes, 0)).getUTCDate();
  const semanas = Math.ceil((desfase + diasDelMes) / 7);

  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#1c2228]">
    <div className={`grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 ${compacta ? '' : 'min-w-[660px]'}`}>
      {DIAS.map(dia => <div key={dia} className={compacta ? 'py-2' : 'py-3'}>{dia}</div>)}
    </div>
    <div className={`grid grid-cols-7 ${compacta ? '' : 'min-w-[660px]'}`}>
      {Array.from({ length: semanas * 7 }, (_, indice) => {
        const fecha = fechaIso(primerDia + indice * 86_400_000);
        const esMes = fecha.slice(0, 7) === mes;
        const delDia = eventos.filter(evento => evento.fechaInicio <= fecha && fecha <= evento.fechaFin);
        const suspendido = delDia.some(excluyeDiaLectivo);
        const seleccionada = fecha === fechaSeleccionada;
        return <button key={fecha} type="button" onClick={() => onSeleccionarFecha(fecha)}
          aria-label={`${fecha}: ${delDia.length} evento${delDia.length === 1 ? '' : 's'}${suspendido ? ', sin clase efectiva' : ''}`}
          aria-pressed={seleccionada}
          className={`${compacta ? 'min-h-12 p-1 text-center' : 'min-h-28 p-2 text-left'} border-b border-r border-slate-200 align-top transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:hover:bg-blue-950/40 ${esMes ? '' : 'bg-slate-50/70 text-slate-400 dark:bg-slate-900/40'} ${seleccionada ? 'ring-2 ring-inset ring-blue-500' : ''}`}>
          <span className={`inline-flex items-center justify-center rounded-full px-1 text-xs font-bold ${compacta ? 'h-5 min-w-5' : 'h-7 min-w-7'} ${seleccionada ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-200'}`}>{Number(fecha.slice(-2))}</span>
          {compacta ? <span className="mt-1 flex justify-center gap-0.5" aria-hidden="true">{delDia.slice(0, 3).map(evento => <span key={evento.id} className="size-1.5 rounded-full" style={{ backgroundColor: evento.color }}/>)}</span> : <span className="mt-1 block space-y-1">
            {delDia.slice(0, 2).map(evento => <span key={evento.id}
              className="block truncate rounded-md border-l-[3px] bg-slate-100 px-1.5 py-1 text-[11px] font-medium leading-tight text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              style={{ borderLeftColor: evento.color }} title={evento.nombre}>{evento.nombre}</span>)}
            {delDia.length > 2 && <span className="block pl-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">+{delDia.length - 2} más</span>}
          </span>}
        </button>;
      })}
    </div>
  </div>;
}
