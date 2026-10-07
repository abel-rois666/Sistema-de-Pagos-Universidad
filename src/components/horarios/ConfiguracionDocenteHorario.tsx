import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Copy, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { leerTodasFilas } from '../../horarios/consultas';
import { DIAS_HORARIO, NOMBRES_DIAS, type DiaHorario, type VentanaHorario } from '../../horarios/types';
import { useAppStore } from '../../store/useAppStore';
import { formatCicloEscolar } from '../../utils/formatUtils';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorAsignaturasPreferidas from './SelectorAsignaturasPreferidas';

interface Props { docenteId: string; docenteNombre: string; cicloId: string; onClose: () => void }
interface PlanOpcion { id: string; nombre: string; carrera?: { nombre: string } | null }
interface AsignaturaOpcion { id: string; nombre: string; clave_legado: string; plan_id: string }
interface GrupoOpcion { id: string; codigo_grupo: string; turno: string }
interface ConfiguracionGuardada {
  disponibilidad: VentanaHorario[];
  plan_ids: string[];
  asignatura_ids_preferidas: string[];
  grupo_ids_restringidos: string[];
}
interface ConfiguracionPorCiclo extends ConfiguracionGuardada { ciclo_id: string }
type ConfirmacionPendiente =
  | { tipo: 'ciclo'; destinoId: string }
  | { tipo: 'cerrar' }
  | { tipo: 'copiar'; origenId: string };

const textosConfirmacion: Record<ConfirmacionPendiente['tipo'], { titulo: string; mensaje: string; confirmar: string }> = {
  ciclo: { titulo: 'Cambiar ciclo escolar', mensaje: 'Se descartarán los cambios sin guardar de este ciclo.', confirmar: 'Cambiar ciclo' },
  cerrar: { titulo: 'Cerrar disponibilidad', mensaje: 'Se perderán los cambios de disponibilidad y materias que aún no has guardado.', confirmar: 'Descartar y cerrar' },
  copiar: { titulo: 'Reemplazar configuración', mensaje: 'La copia reemplazará los cambios sin guardar de este ciclo. Los grupos restringidos no se copian.', confirmar: 'Copiar configuración' },
};

const snapshot = (horas: Set<string>, planes: string[], asignaturas: string[], grupos: string[]) =>
  JSON.stringify([Array.from(horas).sort(), [...planes].sort(), [...asignaturas].sort(), [...grupos].sort()]);

const claveHora = (dia: number, hora: number) => `${dia}-${hora}`;
const horasDeVentanas = (ventanas: VentanaHorario[]) => new Set(ventanas.flatMap(v =>
  Array.from({ length: Math.max(0, v.fin - v.inicio) }, (_, index) => claveHora(v.dia, v.inicio + index))));
const ventanasDeHoras = (horas: Set<string>): VentanaHorario[] => {
  const ventanas: VentanaHorario[] = [];
  for (const dia of DIAS_HORARIO) {
    let inicio: number | null = null;
    for (let hora = 7; hora <= 21; hora++) {
      if (hora < 21 && horas.has(claveHora(dia, hora))) {
        if (inicio === null) inicio = hora;
      } else if (inicio !== null) {
        ventanas.push({ dia, inicio, fin: hora });
        inicio = null;
      }
    }
  }
  return ventanas;
};

export default function ConfiguracionDocenteHorario({ docenteId, docenteNombre, cicloId, onClose }: Props) {
  const ciclos = useAppStore(state => state.ciclos);
  const [cicloSeleccionadoId, setCicloSeleccionadoId] = useState(() => ciclos.some(ciclo => ciclo.id === cicloId) ? cicloId : '');
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [horas, setHoras] = useState<Set<string>>(new Set());
  const [planes, setPlanes] = useState<PlanOpcion[]>([]);
  const [asignaturas, setAsignaturas] = useState<AsignaturaOpcion[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([]);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [asignaturaIds, setAsignaturaIds] = useState<string[]>([]);
  const [grupoIds, setGrupoIds] = useState<string[]>([]);
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionPorCiclo[]>([]);
  const [origenId, setOrigenId] = useState('');
  const [snapshotGuardado, setSnapshotGuardado] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);
  const ciclosOrdenados = useMemo(() => [...ciclos].sort((a, b) => b.nombre.localeCompare(a.nombre, 'es', { numeric: true }) || formatCicloEscolar(a).localeCompare(formatCicloEscolar(b), 'es')), [ciclos]);
  const configuracionesOrigen = configuraciones.filter(config => config.ciclo_id !== cicloSeleccionadoId && ciclos.some(ciclo => ciclo.id === config.ciclo_id));
  const cambiosSinGuardar = snapshotGuardado !== null && snapshot(horas, planIds, asignaturaIds, grupoIds) !== snapshotGuardado;
  const visibles = useMemo(() => asignaturas.filter(asignatura => planIds.includes(asignatura.plan_id)), [asignaturas, planIds]);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      setCargando(true);
      setErrorCarga(false);
      setSnapshotGuardado(null);
      setOrigenId('');
      if (!cicloSeleccionadoId) { setCargando(false); return; }
      try {
        const [config, planesData, asignaturasData, gruposData] = await Promise.all([
          supabase.from('docente_configuraciones_horario').select('ciclo_id,disponibilidad,plan_ids,asignatura_ids_preferidas,grupo_ids_restringidos').eq('docente_id', docenteId),
          leerTodasFilas<PlanOpcion>('planes_estudio', 'id,nombre,carrera:carreras(nombre)'),
          leerTodasFilas<AsignaturaOpcion>('asignaturas', 'id,nombre,clave_legado,plan_id', 'id', { campo: 'activo', valor: true }),
          leerTodasFilas<GrupoOpcion>('grupos', 'id,codigo_grupo,turno', 'id', { campo: 'ciclo_id', valor: cicloSeleccionadoId }),
        ]);
        if (config.error) throw config.error;
        if (!vigente) return;
        const todas = (config.data || []) as ConfiguracionPorCiclo[];
        const guardada = todas.find(item => item.ciclo_id === cicloSeleccionadoId);
        const horasCargadas = horasDeVentanas(guardada?.disponibilidad || []);
        const planesCargados = guardada?.plan_ids || [];
        const asignaturasCargadas = guardada?.asignatura_ids_preferidas || [];
        const gruposCargados = guardada?.grupo_ids_restringidos || [];
        setHoras(horasCargadas);
        setPlanIds(planesCargados);
        setAsignaturaIds(asignaturasCargadas);
        setGrupoIds(gruposCargados);
        setConfiguraciones(todas);
        setPlanes(planesData.sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')));
        setAsignaturas(asignaturasData.sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')));
        setGrupos(gruposData.sort((a,b) => a.codigo_grupo.localeCompare(b.codigo_grupo, 'es')));
        setSnapshotGuardado(snapshot(horasCargadas, planesCargados, asignaturasCargadas, gruposCargados));
      } catch (error) {
        if (vigente) setErrorCarga(true);
        toast.error(`No se pudo cargar la configuración: ${error instanceof Error ? error.message : String(error)}`);
      } finally { if (vigente) setCargando(false); }
    }
    void cargar();
    return () => { vigente = false; };
  }, [docenteId, cicloSeleccionadoId]);

  const alternar = (valores: string[], valor: string, cambiar: (nuevos: string[]) => void) =>
    cambiar(valores.includes(valor) ? valores.filter(item => item !== valor) : [...valores, valor]);
  const alternarHora = (dia: DiaHorario, hora: number) => setHoras(prev => {
    const siguiente = new Set(prev);
    const clave = claveHora(dia, hora);
    if (siguiente.has(clave)) siguiente.delete(clave); else siguiente.add(clave);
    return siguiente;
  });
  const aplicarTurno = (dias: DiaHorario[], inicio: number, fin: number) => setHoras(prev => {
    const siguiente = new Set(prev);
    for (const dia of dias) for (let hora = inicio; hora < fin; hora++) siguiente.add(claveHora(dia, hora));
    return siguiente;
  });

  const cambiarCiclo = (nuevoId: string) => {
    if (nuevoId === cicloSeleccionadoId || guardando) return;
    if (cambiosSinGuardar) { setConfirmacion({ tipo: 'ciclo', destinoId: nuevoId }); return; }
    aplicarCiclo(nuevoId);
  };

  const aplicarCiclo = (nuevoId: string) => {
    setCargando(true);
    setSnapshotGuardado(null);
    setCicloSeleccionadoId(nuevoId);
  };

  const cerrar = () => {
    if (guardando) return;
    if (cambiosSinGuardar) setConfirmacion({ tipo: 'cerrar' });
    else onClose();
  };

  const copiarOtroCiclo = () => {
    const origen = configuracionesOrigen.find(config => config.ciclo_id === origenId);
    if (!origen) return toast.error('Selecciona un ciclo con configuración para copiar.');
    if (cambiosSinGuardar) { setConfirmacion({ tipo: 'copiar', origenId }); return; }
    aplicarCopia(origen);
  };

  const aplicarCopia = (origen: ConfiguracionPorCiclo) => {
    setHoras(horasDeVentanas(origen.disponibilidad || []));
    setPlanIds(origen.plan_ids || []);
    setAsignaturaIds(origen.asignatura_ids_preferidas || []);
    setGrupoIds([]);
    toast('Disponibilidad y materias copiadas. Los grupos restringidos no se copian; revisa y guarda la configuración.');
  };

  const confirmarCambio = () => {
    if (!confirmacion || guardando) return;
    const pendiente = confirmacion;
    setConfirmacion(null);
    if (pendiente.tipo === 'cerrar') onClose();
    else if (pendiente.tipo === 'ciclo') aplicarCiclo(pendiente.destinoId);
    else {
      const origen = configuracionesOrigen.find(config => config.ciclo_id === pendiente.origenId);
      if (origen) aplicarCopia(origen);
      else toast.error('El ciclo de origen ya no está disponible. Selecciona otro.');
    }
  };

  const guardar = async () => {
    if (!ciclos.some(ciclo => ciclo.id === cicloSeleccionadoId) || cargando || errorCarga) return toast.error('Selecciona y carga un ciclo escolar válido.');
    if (!horas.size) return toast.error('Selecciona al menos una hora disponible.');
    if (!planIds.length) return toast.error('Selecciona al menos un plan de estudio.');
    setGuardando(true);
    try {
      const { error } = await supabase.from('docente_configuraciones_horario').upsert({
        docente_id: docenteId, ciclo_id: cicloSeleccionadoId, disponibilidad: ventanasDeHoras(horas),
        plan_ids: planIds, asignatura_ids_preferidas: asignaturaIds.filter(id => visibles.some(a => a.id === id)),
        grupo_ids_restringidos: grupoIds, actualizado_en: new Date().toISOString(),
      }, { onConflict: 'docente_id,ciclo_id' });
      if (error) throw error;
      toast.success('Configuración docente guardada para este ciclo.');
      onClose();
    } catch (error) {
      toast.error(`No se guardó la configuración: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Configuración horaria del docente">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1c2228]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-700">
          <div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2 text-blue-700 dark:text-blue-400"><CalendarClock size={20}/><span className="text-xs font-bold uppercase tracking-widest">Disponibilidad por ciclo</span></div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">{docenteNombre}</h2>
            <label htmlFor="ciclo-disponibilidad-docente" className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-200">Ciclo escolar de esta configuración</label>
            <select id="ciclo-disponibilidad-docente" value={cicloSeleccionadoId} onChange={event => cambiarCiclo(event.target.value)} disabled={cargando || guardando} className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
              <option value="">Selecciona un ciclo...</option>
              {ciclosOrdenados.map(ciclo => <option key={ciclo.id} value={ciclo.id}>{formatCicloEscolar(ciclo)}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Esta selección solo cambia la ficha del docente; el ciclo global permanece igual.</p>
          </div>
          <button type="button" onClick={cerrar} disabled={guardando} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X size={20}/></button>
        </div>
        <div className="space-y-7 overflow-y-auto p-5 sm:p-6">
          {cargando ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600"/></div> : !cicloSeleccionadoId ? <p className="py-8 text-center text-sm text-slate-500">Selecciona un ciclo para configurar la disponibilidad.</p> : errorCarga ? <p className="py-8 text-center text-sm text-red-600">No se pudo cargar este ciclo. Ciérralo e inténtalo de nuevo.</p> : <>
            <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-slate-900 dark:text-white">Horas disponibles</h3><p className="text-xs text-slate-500 dark:text-slate-400">Cada botón indica la hora de inicio: 20:00 corresponde a 20:00–21:00. Las celdas azules están disponibles.</p></div>
              </div>
              <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="min-w-[12rem] flex-1"><label htmlFor="ciclo-origen-docente" className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">Copiar configuración desde</label>
                  <select id="ciclo-origen-docente" value={origenId} onChange={event => setOrigenId(event.target.value)} disabled={!configuracionesOrigen.length} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                    <option value="">{configuracionesOrigen.length ? 'Selecciona el ciclo de origen...' : 'No hay otros ciclos configurados'}</option>
                    {ciclosOrdenados.filter(ciclo => configuracionesOrigen.some(config => config.ciclo_id === ciclo.id)).map(ciclo => <option key={ciclo.id} value={ciclo.id}>{formatCicloEscolar(ciclo)}</option>)}
                  </select>
                </div>
                <button type="button" onClick={copiarOtroCiclo} disabled={!origenId} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><Copy size={14}/> Copiar</button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">{[
                { texto: 'Matutino L–V', dias: [1,2,3,4,5] as DiaHorario[], inicio: 7, fin: 13 },
                { texto: 'Vespertino L–V', dias: [1,2,3,4,5] as DiaHorario[], inicio: 16, fin: 21 },
                { texto: 'Mixto sábado', dias: [6] as DiaHorario[], inicio: 7, fin: 15 },
              ].map(p => <button key={p.texto} type="button" onClick={() => aplicarTurno(p.dias, p.inicio, p.fin)} className="rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300">+ {p.texto}</button>)}
                <button type="button" onClick={() => setHoras(new Set())} className="rounded-full px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Limpiar</button></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{DIAS_HORARIO.map(dia => <div key={dia} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><h4 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{NOMBRES_DIAS[dia]}</h4><div className="grid grid-cols-4 gap-1.5">{Array.from({length:14},(_,i) => i+7).map(hora => <button key={hora} type="button" aria-label={`${NOMBRES_DIAS[dia]}, ${String(hora).padStart(2,'0')}:00 a ${String(hora + 1).padStart(2,'0')}:00`} aria-pressed={horas.has(claveHora(dia,hora))} onClick={() => alternarHora(dia,hora)} className={`rounded-md px-1 py-1.5 text-xs font-semibold transition-colors ${horas.has(claveHora(dia,hora)) ? 'bg-[#1456f0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>{String(hora).padStart(2,'0')}:00</button>)}</div></div>)}</div>
            </section>
            <section className="grid gap-5 lg:grid-cols-2"><div><h3 className="mb-1 font-bold text-slate-900 dark:text-white">Licenciaturas y planes donde imparte clase</h3><p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Cada plan identifica su carrera; puedes elegir varios.</p><div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">{planes.map(plan => <label key={plan.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={planIds.includes(plan.id)} onChange={() => alternar(planIds,plan.id,setPlanIds)} /><span><strong className="block">{plan.carrera?.nombre || 'Carrera sin definir'}</strong><span className="text-xs text-slate-500">{plan.nombre}</span></span></label>)}</div></div>
              <SelectorAsignaturasPreferidas planes={planes} planIds={planIds} asignaturas={asignaturas} asignaturaIds={asignaturaIds} onAlternar={id => alternar(asignaturaIds, id, setAsignaturaIds)} /></section>
            <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">Grupos restringidos</h3><p className="mb-3 text-xs text-slate-500 dark:text-slate-400">El generador no asignará este docente a los grupos marcados.</p><div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700">{grupos.map(grupo => <label key={grupo.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={grupoIds.includes(grupo.id)} onChange={() => alternar(grupoIds,grupo.id,setGrupoIds)} />{grupo.codigo_grupo} · {grupo.turno}</label>)}</div></section>
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700"><button type="button" onClick={cerrar} disabled={guardando} className="rounded-lg px-4 py-2 text-sm text-slate-600 disabled:opacity-50 dark:text-slate-300">Cancelar</button><button type="button" onClick={() => void guardar()} disabled={!cicloSeleccionadoId || cargando || guardando || errorCarga} className="rounded-lg bg-[#1456f0] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar configuración'}</button></div>
      </div>
      <ModalConfirmacion isOpen={confirmacion !== null} title={confirmacion ? textosConfirmacion[confirmacion.tipo].titulo : ''} message={confirmacion ? textosConfirmacion[confirmacion.tipo].mensaje : ''} confirmText={confirmacion ? textosConfirmacion[confirmacion.tipo].confirmar : 'Continuar'} cancelText="Seguir editando" type={confirmacion?.tipo === 'cerrar' ? 'danger' : 'warning'} onConfirm={confirmarCambio} onCancel={() => setConfirmacion(null)} />
    </div>
  );
}
