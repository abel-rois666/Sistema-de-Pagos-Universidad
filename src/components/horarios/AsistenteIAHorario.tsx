import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BrainCircuit, CheckCircle2, Loader2, ShieldCheck, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBusquedaHorario } from '../../hooks/useBusquedaHorario';
import type { ResultadoAsignacionAutomatica } from '../../horarios/asignacionAutomatica';
import { construirEscenarioAsesoriaHorario, crearContextoAsesoriaHorario, tituloAccionAsesoria,
  type EscenarioAsesoriaHorario, type EstadoAsesoriaHorario, type SugerenciaAsesoriaHorario } from '../../horarios/asesoriaIA';
import { solicitarAsesoriaHorario } from '../../horarios/asesoriaIAService';
import type { ResultadoOptimizacionHorario } from '../../horarios/optimizacionHorario';
import type { EntradaHorario, IncidenciaHorario } from '../../horarios/types';

type ResultadoEnsayo = ResultadoAsignacionAutomatica | ResultadoOptimizacionHorario;
type Fase = 'inactivo' | 'consultando' | 'probando' | 'listo';
interface Ensayo {
  sugerencia: SugerenciaAsesoriaHorario;
  escenario: EscenarioAsesoriaHorario;
  resultado: ResultadoEnsayo;
}
interface Props {
  entrada: EntradaHorario;
  incidencias: IncidenciaHorario[];
  estado: EstadoAsesoriaHorario;
  deshabilitado: boolean;
  onAdoptar: (ensayo: { escenario: EscenarioAsesoriaHorario; resultado: ResultadoEnsayo }) => void;
}

export default function AsistenteIAHorario({ entrada, incidencias, estado, deshabilitado, onAdoptar }: Props) {
  const { buscar, cancelar: cancelarBusqueda, buscando, avance } = useBusquedaHorario();
  const [fase, setFase] = useState<Fase>('inactivo');
  const [ensayos, setEnsayos] = useState<Ensayo[]>([]);
  const [error, setError] = useState('');
  const [indice, setIndice] = useState(0);
  const controlador = useRef<AbortController | null>(null);
  const cancelado = useRef(false);
  const contexto = crearContextoAsesoriaHorario(entrada, incidencias, estado);

  useEffect(() => () => {
    cancelado.current = true;
    controlador.current?.abort();
    cancelarBusqueda();
  }, []);

  const cancelar = () => {
    cancelado.current = true;
    controlador.current?.abort();
    cancelarBusqueda();
    setFase(ensayos.length ? 'listo' : 'inactivo');
    toast('Asesoría cancelada; el horario anterior se conservó.');
  };

  const analizar = async () => {
    if (deshabilitado || buscando || fase === 'consultando' || fase === 'probando') return;
    if (!contexto.solicitud.acciones.length) return;
    cancelado.current = false;
    setEnsayos([]); setError(''); setIndice(0); setFase('consultando');
    controlador.current = new AbortController();
    try {
      const sugerencias = await solicitarAsesoriaHorario(contexto.solicitud, controlador.current.signal);
      if (cancelado.current) return;
      if (!sugerencias.length) {
        setFase('listo');
        return;
      }
      setFase('probando');
      for (const [posicion, sugerencia] of sugerencias.entries()) {
        if (cancelado.current) return;
        setIndice(posicion + 1);
        const escenario = construirEscenarioAsesoriaHorario(entrada, estado, contexto, sugerencia.accionId);
        if (!escenario) continue;
        const resultado = await buscar({ modo: estado.modo, politica: estado.politica,
          entrada: escenario.entrada, permitirVacantes: escenario.permitirVacantes,
          permitirNoPreferidas: escenario.permitirNoPreferidas,
          cargasFijas: escenario.cargasFijas, busquedaAmpliada: escenario.busquedaAmpliada });
        if (cancelado.current) return;
        setEnsayos(actual => [...actual, { sugerencia, escenario, resultado }]);
      }
      setFase('listo');
    } catch (fallo) {
      if (cancelado.current || (fallo instanceof Error && fallo.message === 'BUSQUEDA_CANCELADA')) return;
      const mensaje = fallo instanceof Error ? fallo.message : 'No se pudo completar la asesoría.';
      setError(mensaje); setFase('listo'); toast.error(mensaje);
    } finally { controlador.current = null; }
  };

  const enCurso = fase === 'consultando' || fase === 'probando';
  return <section aria-labelledby="asesoria-ia-titulo"
    className="overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-sm dark:border-teal-900 dark:bg-[#172430]">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-teal-100 bg-teal-50/70 p-5 dark:border-teal-900 dark:bg-teal-950/20">
      <div className="flex min-w-0 items-start gap-3">
        <span className="rounded-xl bg-teal-700 p-2.5 text-white dark:bg-teal-600"><BrainCircuit size={21} aria-hidden="true"/></span>
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-800 dark:text-teal-300">Asesoría opcional</p>
          <h3 id="asesoria-ia-titulo" className="mt-0.5 text-lg font-bold">Explorar mejoras con IA</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Groq sugiere hasta tres ajustes. El generador comprueba cada uno antes de mostrarlo; tu borrador no cambia hasta que elijas un resultado.</p>
        </div>
      </div>
      {enCurso ? <button type="button" onClick={cancelar}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800">
        <X size={16}/> Cancelar asesoría</button>
        : <button type="button" onClick={() => void analizar()}
          disabled={deshabilitado || !contexto.solicitud.acciones.length}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500">
          <Sparkles size={17}/>{fase === 'listo' ? 'Volver a analizar' : 'Analizar con IA'}</button>}
    </div>
    <div className="space-y-4 p-5">
      <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-teal-700 dark:text-teal-400"/>
        Se envían códigos de incidencia, conteos y referencias temporales. No se envían nombres de docentes, alumnos, materias ni claves de API.</p>
      {!contexto.solicitud.acciones.length && <p className="text-sm text-slate-600 dark:text-slate-300">No hay ajustes compatibles con esta revisión que la IA pueda probar automáticamente.</p>}
      {fase === 'consultando' && <p role="status" className="flex items-center gap-2 text-sm font-medium text-teal-800 dark:text-teal-300"><Loader2 size={16} className="animate-spin"/> Consultando sugerencias…</p>}
      {fase === 'probando' && <p role="status" className="flex items-center gap-2 text-sm font-medium text-teal-800 dark:text-teal-300"><Loader2 size={16} className="animate-spin"/> Probando escenario {indice} · {avance.soluciones} horario(s) completos revisados.</p>}
      {error && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{error}</p>}
      {fase === 'listo' && !ensayos.length && !error && <p className="text-sm text-slate-600 dark:text-slate-300">No hubo sugerencias verificables para esta combinación. Puedes seguir usando el generador y sus controles manuales.</p>}
      {ensayos.length > 0 && <div className="grid gap-3 lg:grid-cols-3">{ensayos.map(({ sugerencia, escenario, resultado }, posicion) => {
        const mejor = resultado.propuestas[0];
        const m = mejor?.metricas;
        return <article key={`${sugerencia.accionId}-${posicion}`} className="flex flex-col rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">Escenario {posicion + 1} · {mejor ? 'comprobado' : 'sin propuesta completa'}</p>
          <h4 className="mt-1 font-bold text-slate-900 dark:text-slate-100">{tituloAccionAsesoria(sugerencia.accionId, contexto.cargasPorRef, entrada)}</h4>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{sugerencia.motivo}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">La IA espera: {sugerencia.efectoEsperado}</p>
          {m ? <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800/70">
            <p className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={14}/> Resultado del motor {resultado.busquedaExhaustiva ? 'comprobado' : 'encontrado'}</p>
            <p className="mt-1">Vacantes: {estado.metricas?.vacantes ?? '—'} → <b>{m.vacantes}</b></p>
            <p>Jornadas cortas de grupos: {estado.metricas?.jornadasCortasGrupo ?? '—'} → <b>{m.jornadasCortasGrupo}</b></p>
            <p>Huecos de grupos: {estado.metricas?.huecosGrupo ?? '—'} → <b>{m.huecosGrupo}</b></p>
            <p>Jornadas cortas de docentes: {estado.metricas?.jornadasCortasDocente ?? '—'} → <b>{m.jornadasCortasDocente}</b></p>
            <p>Huecos de docentes: {estado.metricas?.huecosDocente ?? '—'} → <b>{m.huecosDocente}</b></p>
            {m.vacantes > 0 && <p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">Las vacantes impiden publicar.</p>}
          </div> : <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            {resultado.busquedaExhaustiva ? 'Este ensayo no produjo un horario completo.' : 'Se agotó el límite del ensayo; esto no demuestra imposibilidad.'}</p>}
          <div className="mt-auto pt-4">{mejor && <button type="button" disabled={deshabilitado || enCurso}
            onClick={() => onAdoptar({ escenario, resultado })}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-teal-600 px-3 py-2 text-sm font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-300 dark:hover:bg-teal-950/40">
            Usar este resultado <ArrowRight size={15}/></button>}</div>
        </article>;
      })}</div>}
    </div>
  </section>;
}
