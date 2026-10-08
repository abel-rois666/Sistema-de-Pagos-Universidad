import { ArrowRight, Compass, RefreshCw } from 'lucide-react';
import { pasosParaDesbloquear, type AccionDesbloqueo, type PasoDesbloqueo } from '../../horarios/orientacionHorario';
import { incidenciaSuave, type EntradaHorario, type IncidenciaHorario } from '../../horarios/types';

interface Props {
  entrada: EntradaHorario;
  incidencias: IncidenciaHorario[];
  modo: 'manual' | 'automatico';
  permitirVacantes: boolean;
  permitirNoPreferidas: boolean;
  cargasFijas: ReadonlySet<string>;
  busquedaAmpliadaUsada: boolean;
  bloqueado: boolean;
  onAccion: (accion: AccionDesbloqueo, cargaId?: string, incidenciaCodigo?: string) => void;
}

const prioridad = (incidencia: IncidenciaHorario, paso: PasoDesbloqueo) => {
  if (incidencia.codigo.startsWith('JORNADA_') || incidencia.codigo.startsWith('HUECO_'))
    return paso.accion === 'revisar_limites' ? 0 : paso.accion === 'revisar_cargas' ? 1 : 2;
  if (incidencia.codigo === 'BUSQUEDA_AGOTADA')
    return paso.accion === 'ampliar_busqueda' ? 0 : 1;
  if (incidencia.codigo === 'SIN_ESPACIO' || incidencia.codigo === 'DOCENTE_FIJO_SIN_SOLUCION')
    return paso.accion === 'liberar_docente' ? 0 : paso.accion === 'revisar_cargas' ? 1 : 2;
  return 1;
};

const etiquetaAccion = (paso: PasoDesbloqueo, codigo: string) => {
  if (paso.accion === 'ampliar_busqueda') return 'Reintentar búsqueda ampliada';
  if (paso.accion === 'permitir_vacantes') return 'Activar vacantes';
  if (paso.accion === 'permitir_no_preferidas') return 'Permitir no preferidas';
  if (paso.accion === 'liberar_docente') return 'Liberar esta asignación';
  if (paso.accion === 'revisar_limites') {
    if (codigo === 'JORNADA_CORTA_GRUPO') return 'Ajustar mínimo del grupo';
    if (codigo === 'JORNADA_CORTA_DOCENTE') return 'Ajustar mínimo del docente';
    return 'Ir al límite correspondiente';
  }
  return 'Revisar materias y docentes';
};

export default function GuiaDesbloqueoHorario({ entrada, incidencias, modo, permitirVacantes,
  permitirNoPreferidas, cargasFijas, busquedaAmpliadaUsada, bloqueado, onAccion }: Props) {
  if (!incidencias.length) return null;
  const opciones = { modo, permitirVacantes, permitirNoPreferidas, cargasFijas,
    busquedaAmpliadaUsada, configuracion: entrada.configuracion };
  const grupos = new Map(entrada.grupos.map(grupo => [grupo.id, grupo.codigo]));
  const docentes = new Map(entrada.docentes.map(docente => [docente.id, docente.nombre]));
  const materias = new Map(entrada.cargas.map(carga => [carga.id, carga.asignatura]));
  const docentesPorCarga = new Map(entrada.cargas.map(carga => [carga.id, carga.docenteId]));
  const unicas = [...new Map(incidencias.map(incidencia =>
    [`${incidencia.codigo}:${incidencia.grupoId || ''}:${incidencia.cargaId || ''}:${incidencia.docenteId || ''}:${incidencia.mensaje}`, incidencia])).values()];

  const tarjeta = (incidencia: IncidenciaHorario, indice: number) => {
    const docenteId = incidencia.docenteId || docentesPorCarga.get(incidencia.cargaId || '') || '';
    const contexto = [incidencia.grupoId && grupos.get(incidencia.grupoId),
      incidencia.cargaId && materias.get(incidencia.cargaId), docentes.get(docenteId)]
      .filter(Boolean).join(' · ') || 'Horario general';
    const pasos = pasosParaDesbloquear([incidencia], opciones).sort((a, b) =>
      prioridad(incidencia, a) - prioridad(incidencia, b));
    const accion = (paso: PasoDesbloqueo) => <div key={paso.id}
      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{paso.titulo}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{paso.detalle}</p>
      <button type="button" disabled={bloqueado}
        onClick={() => onAccion(paso.accion, paso.cargaId, incidencia.codigo)}
        className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-950/50">
        {paso.accion === 'ampliar_busqueda' ? <RefreshCw size={15}/> : <ArrowRight size={15}/>}
        {etiquetaAccion(paso, incidencia.codigo)}
      </button>
    </div>;
    return <article key={`${incidencia.codigo}-${indice}`}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#182331]">
      <div className={`border-l-4 p-4 ${incidenciaSuave(incidencia)
        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/20'
        : 'border-red-500 bg-red-50/70 dark:bg-red-950/20'}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Incidencia {indice + 1} · {contexto}</p>
        <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{incidencia.mensaje}</p>
      </div>
      <div className="space-y-2 p-3 sm:p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-800 dark:text-blue-300">Qué puedes hacer</p>
        {pasos.length ? pasos.slice(0, 2).map(accion) : <p className="text-sm text-slate-600 dark:text-slate-300">Revisa esta incidencia y ajusta los datos antes de volver a generar.</p>}
        {pasos.length > 2 && <details className="text-sm text-blue-800 dark:text-blue-300">
          <summary className="cursor-pointer font-semibold">Ver {pasos.length - 2} alternativa(s) más</summary>
          <div className="mt-2 space-y-2">{pasos.slice(2).map(accion)}</div>
        </details>}
      </div>
    </article>;
  };

  return <section aria-labelledby="guia-desbloqueo-titulo"
    className="mt-4 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20">
    <div className="flex items-start gap-3 border-b border-blue-200 px-4 py-4 dark:border-blue-900 sm:px-5">
      <div className="rounded-xl bg-blue-600 p-2 text-white"><Compass size={20} aria-hidden="true"/></div>
      <div className="min-w-0"><h3 id="guia-desbloqueo-titulo" className="font-bold text-blue-950 dark:text-blue-100">
        Resultado de la revisión ({unicas.length})</h3>
        <p className="mt-1 text-sm text-blue-900/80 dark:text-blue-200/80">Cada incidencia muestra sus acciones. Ninguna cambia datos guardados sin que la elijas; después de ajustar, vuelve a generar el borrador.</p>
      </div>
    </div>
    <div className="grid gap-3 p-4 sm:p-5 xl:grid-cols-2">{unicas.slice(0, 6).map(tarjeta)}</div>
    {unicas.length > 6 && <details className="px-4 pb-4 sm:px-5 sm:pb-5">
      <summary className="cursor-pointer text-sm font-semibold text-blue-800 dark:text-blue-200">
        Ver {unicas.length - 6} incidencia(s) más</summary>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">{unicas.slice(6).map((incidencia, indice) => tarjeta(incidencia, indice + 6))}</div>
    </details>}
  </section>;
}
