import { CheckCircle2, Clock3, Users } from 'lucide-react';
import type { PropuestaHorario } from '../../horarios/evaluacionHorario';

interface Props {
  propuestas: PropuestaHorario[];
  seleccionada: number;
  busquedaExhaustiva: boolean;
  solucionesEvaluadas: number;
  ajustado?: boolean;
  deshabilitado?: boolean;
  onSeleccionar: (indice: number) => void;
}

export default function PanelPropuestasHorario({ propuestas, seleccionada, busquedaExhaustiva,
  solucionesEvaluadas, ajustado = false, deshabilitado = false, onSeleccionar }: Props) {
  if (!propuestas.length) return null;
  return <section aria-label="Propuestas de horario" className="mt-5 rounded-2xl border border-blue-200 bg-[#f5f8ff] p-4 sm:p-5 dark:border-blue-900 dark:bg-[#111d32]">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Comparación de propuestas</p>
        <h3 className="mt-1 text-lg font-bold">Elige el horario que deseas revisar</h3></div>
      <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
        {busquedaExhaustiva ? 'Mejor resultado comprobado' : 'Mejor resultado encontrado'}
      </span>
    </div>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
      Se evaluaron {solucionesEvaluadas.toLocaleString('es-MX')} horarios completos. Las propuestas mostradas cumplen las restricciones obligatorias.
      {!busquedaExhaustiva && ' Se alcanzó el límite de búsqueda; podría existir otra mejor.'}
    </p>
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {propuestas.map((propuesta, indice) => {
        const m = propuesta.metricas;
        const activa = seleccionada === indice;
        return <button key={propuesta.firma} type="button" onClick={() => onSeleccionar(indice)} disabled={deshabilitado}
          aria-pressed={activa} className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${activa
            ? 'border-blue-600 bg-white shadow-[0_5px_20px_rgba(20,86,240,0.12)] dark:border-blue-400 dark:bg-[#1d2b43]'
            : 'border-slate-300 bg-white/60 hover:border-blue-400 dark:border-slate-600 dark:bg-[#192536] dark:hover:border-blue-500'}`}>
          <span className="flex items-center justify-between gap-3"><span className="font-bold text-slate-900 dark:text-white">{indice === 0 ? 'Recomendada' : 'Alternativa'}</span>
            {activa && <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300"><CheckCircle2 size={15}/> {ajustado ? 'Base del ajuste' : 'En vista previa'}</span>}</span>
          {activa && ajustado && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Cifras de la propuesta original; la revisión inferior refleja tus cambios.</span>}
          <span className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <span className="rounded-lg bg-slate-100 px-2.5 py-2 dark:bg-slate-800"><b className="block text-base">{m.vacantes}</b><span className="text-xs text-slate-600 dark:text-slate-300">Vacantes</span></span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-2 dark:bg-slate-800"><b className="block text-base">{m.jornadasCortasGrupo}</b><span className="text-xs text-slate-600 dark:text-slate-300">Días cortos grupo</span></span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-2 dark:bg-slate-800"><b className="block text-base">{m.huecosGrupo} h</b><span className="text-xs text-slate-600 dark:text-slate-300">Huecos grupo</span></span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-2 dark:bg-slate-800"><b className="block text-base">{m.huecosDocente} h</b><span className="text-xs text-slate-600 dark:text-slate-300">Huecos docente</span></span>
          </span>
          <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1"><Clock3 size={13}/>{m.jornadasCortasDocente} jornadas docentes cortas</span>
            <span className="inline-flex items-center gap-1"><Users size={13}/>{m.materiasNoPreferidas} materias no preferidas</span>
            <span>Carga docente máxima: {m.maxHorasDocente} h</span>
          </span>
        </button>;
      })}
    </div>
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{ajustado
      ? 'La vista previa, descarga y publicación usan el horario ajustado. Elegir otra propuesta descarta los ajustes tras confirmarlo.'
      : 'La vista previa, la descarga y la publicación usan la propuesta seleccionada.'} Las vacantes solo pueden exportarse como borrador.</p>
  </section>;
}
