import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Copy, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { leerTodasFilas } from '../../horarios/consultas';
import { DIAS_HORARIO, NOMBRES_DIAS, type DiaHorario, type VentanaHorario } from '../../horarios/types';

interface Props { docenteId: string; docenteNombre: string; cicloId: string; onClose: () => void }
interface PlanOpcion { id: string; nombre: string; carrera?: { nombre: string } | null }
interface AsignaturaOpcion { id: string; nombre: string; plan_id: string }
interface GrupoOpcion { id: string; codigo_grupo: string; turno: string }
interface ConfiguracionGuardada {
  disponibilidad: VentanaHorario[];
  plan_ids: string[];
  asignatura_ids_preferidas: string[];
  grupo_ids_restringidos: string[];
}

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
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [horas, setHoras] = useState<Set<string>>(new Set());
  const [planes, setPlanes] = useState<PlanOpcion[]>([]);
  const [asignaturas, setAsignaturas] = useState<AsignaturaOpcion[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([]);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [asignaturaIds, setAsignaturaIds] = useState<string[]>([]);
  const [grupoIds, setGrupoIds] = useState<string[]>([]);
  const [cicloNombre, setCicloNombre] = useState('');
  const visibles = useMemo(() => asignaturas.filter(asignatura => planIds.includes(asignatura.plan_id)), [asignaturas, planIds]);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      setCargando(true);
      try {
        const [config, planesData, asignaturasData, gruposData, cicloRes] = await Promise.all([
          supabase.from('docente_configuraciones_horario').select('disponibilidad,plan_ids,asignatura_ids_preferidas,grupo_ids_restringidos').eq('docente_id', docenteId).eq('ciclo_id', cicloId).maybeSingle(),
          leerTodasFilas<PlanOpcion>('planes_estudio', 'id,nombre,carrera:carreras(nombre)'),
          leerTodasFilas<AsignaturaOpcion>('asignaturas', 'id,nombre,plan_id', 'id', { campo: 'activo', valor: true }),
          leerTodasFilas<GrupoOpcion>('grupos', 'id,codigo_grupo,turno', 'id', { campo: 'ciclo_id', valor: cicloId }),
          supabase.from('ciclos_escolares').select('nombre,tipo_periodo').eq('id', cicloId).single(),
        ]);
        for (const resultado of [config, cicloRes]) if (resultado.error) throw resultado.error;
        if (!vigente) return;
        const guardada = config.data as ConfiguracionGuardada | null;
        setHoras(horasDeVentanas(guardada?.disponibilidad || []));
        setPlanIds(guardada?.plan_ids || []);
        setAsignaturaIds(guardada?.asignatura_ids_preferidas || []);
        setGrupoIds(guardada?.grupo_ids_restringidos || []);
        setPlanes(planesData.sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')));
        setAsignaturas(asignaturasData.sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')));
        setGrupos(gruposData.sort((a,b) => a.codigo_grupo.localeCompare(b.codigo_grupo, 'es')));
        setCicloNombre(`${cicloRes.data?.nombre || ''} · ${cicloRes.data?.tipo_periodo || ''}`);
      } catch (error) {
        toast.error(`No se pudo cargar la configuración: ${error instanceof Error ? error.message : String(error)}`);
      } finally { if (vigente) setCargando(false); }
    }
    void cargar();
    return () => { vigente = false; };
  }, [docenteId, cicloId]);

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

  const copiarAnterior = async () => {
    const { data, error } = await supabase.from('docente_configuraciones_horario')
      .select('ciclo_id,disponibilidad,plan_ids,asignatura_ids_preferidas')
      .eq('docente_id', docenteId).neq('ciclo_id', cicloId).order('actualizado_en', { ascending: false }).limit(1);
    if (error) return toast.error(error.message);
    if (!data?.length) return toast('No hay configuración de otro ciclo para copiar.');
    const anterior = data[0] as Pick<ConfiguracionGuardada, 'disponibilidad' | 'plan_ids' | 'asignatura_ids_preferidas'>;
    setHoras(horasDeVentanas(anterior.disponibilidad || []));
    setPlanIds(anterior.plan_ids || []);
    setAsignaturaIds(anterior.asignatura_ids_preferidas || []);
    setGrupoIds([]);
    toast('Disponibilidad y materias copiadas. Revisa los grupos restringidos antes de guardar.');
  };

  const guardar = async () => {
    if (!horas.size) return toast.error('Selecciona al menos una hora disponible.');
    if (!planIds.length) return toast.error('Selecciona al menos un plan de estudio.');
    setGuardando(true);
    const { error } = await supabase.from('docente_configuraciones_horario').upsert({
      docente_id: docenteId, ciclo_id: cicloId, disponibilidad: ventanasDeHoras(horas),
      plan_ids: planIds, asignatura_ids_preferidas: asignaturaIds.filter(id => visibles.some(a => a.id === id)),
      grupo_ids_restringidos: grupoIds, actualizado_en: new Date().toISOString(),
    }, { onConflict: 'docente_id,ciclo_id' });
    setGuardando(false);
    if (error) return toast.error(`No se guardó la configuración: ${error.message}`);
    toast.success('Configuración docente guardada para este ciclo.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Configuración horaria del docente">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1c2228]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-700">
          <div><div className="mb-1 flex items-center gap-2 text-blue-700 dark:text-blue-400"><CalendarClock size={20}/><span className="text-xs font-bold uppercase tracking-widest">Disponibilidad por ciclo</span></div>
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">{docenteNombre}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{cicloNombre}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20}/></button>
        </div>
        <div className="space-y-7 overflow-y-auto p-5 sm:p-6">
          {cargando ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600"/></div> : <>
            <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-slate-900 dark:text-white">Horas disponibles</h3><p className="text-xs text-slate-500 dark:text-slate-400">Pulsa cada hora de 07:00 a 21:00. Las celdas azules están disponibles.</p></div>
              <button type="button" onClick={() => void copiarAnterior()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><Copy size={14}/> Copiar otro ciclo</button></div>
              <div className="mb-3 flex flex-wrap gap-2 text-xs">{[
                { texto: 'Matutino L–V', dias: [1,2,3,4,5] as DiaHorario[], inicio: 7, fin: 13 },
                { texto: 'Vespertino L–V', dias: [1,2,3,4,5] as DiaHorario[], inicio: 16, fin: 21 },
                { texto: 'Mixto sábado', dias: [6] as DiaHorario[], inicio: 7, fin: 15 },
              ].map(p => <button key={p.texto} type="button" onClick={() => aplicarTurno(p.dias, p.inicio, p.fin)} className="rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300">+ {p.texto}</button>)}
                <button type="button" onClick={() => setHoras(new Set())} className="rounded-full px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Limpiar</button></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{DIAS_HORARIO.map(dia => <div key={dia} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><h4 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{NOMBRES_DIAS[dia]}</h4><div className="grid grid-cols-4 gap-1.5">{Array.from({length:14},(_,i) => i+7).map(hora => <button key={hora} type="button" aria-pressed={horas.has(claveHora(dia,hora))} onClick={() => alternarHora(dia,hora)} className={`rounded-md px-1 py-1.5 text-xs font-semibold transition-colors ${horas.has(claveHora(dia,hora)) ? 'bg-[#1456f0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>{String(hora).padStart(2,'0')}:00</button>)}</div></div>)}</div>
            </section>
            <section className="grid gap-5 lg:grid-cols-2"><div><h3 className="mb-1 font-bold text-slate-900 dark:text-white">Licenciaturas y planes donde imparte clase</h3><p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Cada plan identifica su carrera; puedes elegir varios.</p><div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">{planes.map(plan => <label key={plan.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={planIds.includes(plan.id)} onChange={() => alternar(planIds,plan.id,setPlanIds)} /><span><strong className="block">{plan.carrera?.nombre || 'Carrera sin definir'}</strong><span className="text-xs text-slate-500">{plan.nombre}</span></span></label>)}</div></div>
              <div><h3 className="mb-1 font-bold text-slate-900 dark:text-white">Asignaturas preferidas</h3><p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Ayudan a ordenar alternativas; no sustituyen la disponibilidad.</p><div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">{visibles.length ? visibles.map(asignatura => <label key={asignatura.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={asignaturaIds.includes(asignatura.id)} onChange={() => alternar(asignaturaIds,asignatura.id,setAsignaturaIds)} />{asignatura.nombre}</label>) : <p className="p-2 text-sm text-slate-500">Selecciona un plan primero.</p>}</div></div></section>
            <section><h3 className="mb-1 font-bold text-slate-900 dark:text-white">Grupos restringidos</h3><p className="mb-3 text-xs text-slate-500 dark:text-slate-400">El generador no asignará este docente a los grupos marcados.</p><div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700">{grupos.map(grupo => <label key={grupo.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={grupoIds.includes(grupo.id)} onChange={() => alternar(grupoIds,grupo.id,setGrupoIds)} />{grupo.codigo_grupo} · {grupo.turno}</label>)}</div></section>
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 dark:text-slate-300">Cancelar</button><button type="button" onClick={() => void guardar()} disabled={cargando || guardando} className="rounded-lg bg-[#1456f0] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{guardando ? 'Guardando…' : 'Guardar configuración'}</button></div>
      </div>
    </div>
  );
}
