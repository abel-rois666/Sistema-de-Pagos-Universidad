import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Check, ChevronLeft, ChevronRight, Loader2, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { formatCicloEscolar, formatGrado } from '../../utils/formatUtils';
import { asignaturasDelGrado, coincideAlumnoGrupo, ordenarAsignaturasGrupo, periodosDelPlan } from '../../utils/nuevoGrupoUtils';
import type { AlumnoNuevoGrupo, AsignaturaNuevoGrupo } from '../../utils/nuevoGrupoUtils';
import { cargarAlumnosNuevoGrupo, cargarAsignaturasNuevoGrupo, cargarPlanesNuevoGrupo, crearGrupoCompleto } from '../../services/gruposCreacionService';
import type { PlanNuevoGrupo } from '../../services/gruposCreacionService';
import ModalConfirmacion from '../ui/ModalConfirmacion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGrupoCreated?: (grupoId: string, cicloId: string) => void;
}

type Paso = 1 | 2 | 3;
type Turno = 'Matutino' | 'Vespertino' | 'Mixto';
type ConfirmacionPendiente =
  | { tipo: 'cerrar' }
  | { tipo: 'plan'; valor: string }
  | { tipo: 'turno'; valor: Turno }
  | { tipo: 'grado'; valor: number };
const campo = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1456f0] focus:ring-2 focus:ring-[#1456f0]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const etiqueta = 'mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200';

const textosConfirmacion: Record<ConfirmacionPendiente['tipo'], { titulo: string; mensaje: string; confirmar: string }> = {
  cerrar: { titulo: 'Descartar borrador', mensaje: 'El grupo aún no se ha guardado. Se perderán los datos capturados.', confirmar: 'Descartar borrador' },
  plan: { titulo: 'Cambiar plan de estudios', mensaje: 'Se borrarán el grado, las materias y los alumnos seleccionados para este borrador.', confirmar: 'Cambiar plan' },
  turno: { titulo: 'Cambiar turno', mensaje: 'Se descartará la selección actual de alumnos y se calcularán nuevas sugerencias.', confirmar: 'Cambiar turno' },
  grado: { titulo: 'Cambiar grado', mensaje: 'Se reemplazarán las materias seleccionadas y se volverán a calcular los alumnos sugeridos. Este aviso se mostrará una sola vez durante el alta del grupo.', confirmar: 'Cambiar grado' },
};

export default function ModalCrearGrupo({ isOpen, onClose, onGrupoCreated }: Props) {
  const ciclos = useAppStore(state => state.ciclos);
  const [paso, setPaso] = useState<Paso>(1);
  const [borradorId, setBorradorId] = useState(() => crypto.randomUUID());
  const [codigo, setCodigo] = useState('');
  const [cicloId, setCicloId] = useState('');
  const [planId, setPlanId] = useState('');
  const [turno, setTurno] = useState<Turno>('Matutino');
  const [estatus, setEstatus] = useState<'activo' | 'inactivo'>('activo');
  const [grado, setGrado] = useState<number | null>(null);
  const [asignaturaIds, setAsignaturaIds] = useState<Set<string>>(new Set());
  const [alumnoIds, setAlumnoIds] = useState<Set<string>>(new Set());
  const [planes, setPlanes] = useState<PlanNuevoGrupo[]>([]);
  const [asignaturas, setAsignaturas] = useState<AsignaturaNuevoGrupo[]>([]);
  const [alumnos, setAlumnos] = useState<AlumnoNuevoGrupo[]>([]);
  const [cargandoPlanes, setCargandoPlanes] = useState(false);
  const [cargandoAsignaturas, setCargandoAsignaturas] = useState(false);
  const [cargandoAlumnos, setCargandoAlumnos] = useState(false);
  const [errorAsignaturas, setErrorAsignaturas] = useState(false);
  const [errorAlumnos, setErrorAlumnos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [alumnosInicializadosPara, setAlumnosInicializadosPara] = useState('');
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);
  const [gradoAdvertido, setGradoAdvertido] = useState(false);

  const plan = planes.find(item => item.id === planId);
  const periodos = useMemo(() => periodosDelPlan(asignaturas), [asignaturas]);
  const asignaturasOrdenadas = useMemo(() => ordenarAsignaturasGrupo(asignaturas.filter(item => item.activo !== false), grado || 0), [asignaturas, grado]);
  const carrera = plan?.carrera?.nombre || '';
  const alumnosSugeridos = useMemo(() => alumnos.filter(alumno => grado !== null && coincideAlumnoGrupo(alumno, carrera, grado, turno)), [alumnos, carrera, grado, turno]);
  const idsSugeridos = useMemo(() => new Set(alumnosSugeridos.map(alumno => alumno.id)), [alumnosSugeridos]);
  const alumnosVisibles = useMemo(() => {
    const buscar = busquedaAlumno.trim().toLocaleLowerCase('es');
    return alumnos.filter(alumno => {
      const esCarrera = !carrera || alumno.licenciatura?.toLocaleLowerCase('es').includes(carrera.toLocaleLowerCase('es'));
      if (!esCarrera && !alumnoIds.has(alumno.id)) return false;
      if (buscar) return alumno.nombre_completo.toLocaleLowerCase('es').includes(buscar) || alumno.matricula?.toLocaleLowerCase('es').includes(buscar);
      return alumnoIds.has(alumno.id) || idsSugeridos.has(alumno.id);
    });
  }, [alumnos, alumnoIds, idsSugeridos, busquedaAlumno, carrera]);

  useEffect(() => {
    if (!isOpen) return;
    let vigente = true;
    setBorradorId(crypto.randomUUID());
    setPaso(1);
    setCodigo(''); setCicloId(''); setPlanId(''); setTurno('Matutino'); setEstatus('activo');
    setGrado(null); setAsignaturaIds(new Set()); setAlumnoIds(new Set());
    setPlanes([]); setAsignaturas([]); setAlumnos([]); setBusquedaAlumno(''); setAlumnosInicializadosPara('');
    setConfirmacion(null); setGradoAdvertido(false);
    setCargandoAsignaturas(false); setCargandoAlumnos(false); setErrorAsignaturas(false); setErrorAlumnos(false);
    setCargandoPlanes(true);
    void cargarPlanesNuevoGrupo().then(datos => { if (vigente) setPlanes(datos); }).catch(error => {
      if (vigente) toast.error(`No se pudieron cargar los planes: ${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => { if (vigente) setCargandoPlanes(false); });
    return () => { vigente = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !planId) { setAsignaturas([]); return; }
    let vigente = true;
    setCargandoAsignaturas(true);
    setErrorAsignaturas(false);
    void cargarAsignaturasNuevoGrupo(planId).then(datos => { if (vigente) setAsignaturas(datos); }).catch(error => {
      if (vigente) { setErrorAsignaturas(true); toast.error(`No se pudieron cargar las materias: ${error instanceof Error ? error.message : String(error)}`); }
    }).finally(() => { if (vigente) setCargandoAsignaturas(false); });
    return () => { vigente = false; };
  }, [isOpen, planId]);

  const cerrar = () => {
    if (guardando) return;
    if (codigo.trim() || cicloId || planId || paso > 1) setConfirmacion({ tipo: 'cerrar' });
    else onClose();
  };

  const aplicarPlan = (nuevoId: string) => {
    setPlanId(nuevoId); setGrado(null); setAsignaturaIds(new Set()); setAlumnoIds(new Set()); setAlumnosInicializadosPara('');
  };
  const cambiarPlan = (nuevoId: string) => {
    if (nuevoId === planId) return;
    if (grado !== null || alumnoIds.size) setConfirmacion({ tipo: 'plan', valor: nuevoId });
    else aplicarPlan(nuevoId);
  };

  const aplicarTurno = (nuevoTurno: Turno) => {
    setTurno(nuevoTurno); setAlumnoIds(new Set()); setAlumnosInicializadosPara('');
  };
  const cambiarTurno = (nuevoTurno: Turno) => {
    if (nuevoTurno === turno) return;
    if (alumnoIds.size) setConfirmacion({ tipo: 'turno', valor: nuevoTurno });
    else aplicarTurno(nuevoTurno);
  };

  const aplicarGrado = (nuevoGrado: number) => {
    setGrado(nuevoGrado);
    setAsignaturaIds(new Set(asignaturasDelGrado(asignaturas, nuevoGrado)));
    setAlumnoIds(new Set()); setAlumnosInicializadosPara('');
  };
  const cambiarGrado = (nuevoGrado: number) => {
    if (nuevoGrado === grado) return;
    if (grado !== null && (asignaturaIds.size || alumnoIds.size) && !gradoAdvertido) setConfirmacion({ tipo: 'grado', valor: nuevoGrado });
    else aplicarGrado(nuevoGrado);
  };

  const confirmarCambio = () => {
    if (!confirmacion || guardando) return;
    switch (confirmacion.tipo) {
      case 'cerrar': onClose(); break;
      case 'plan': aplicarPlan(confirmacion.valor); break;
      case 'turno': aplicarTurno(confirmacion.valor); break;
      case 'grado': aplicarGrado(confirmacion.valor); setGradoAdvertido(true); break;
    }
    setConfirmacion(null);
  };

  const irAMaterias = () => {
    if (!codigo.trim() || !cicloId || !planId || !turno) return toast.error('Completa código, ciclo, plan y turno.');
    if (cargandoAsignaturas || errorAsignaturas) return toast.error('Espera a que se carguen las materias del plan.');
    if (!periodos.length) return toast.error('Este plan no tiene materias con un grado válido. Configura su retícula primero.');
    setPaso(2);
  };

  const irAAlumnos = async () => {
    if (grado === null || !periodos.includes(grado)) return toast.error('Selecciona un grado disponible en este plan.');
    if (!asignaturaIds.size) return toast.error('Selecciona al menos una materia.');
    setPaso(3);
    const claveSeleccion = `${planId}|${grado}|${turno}`;
    if (alumnosInicializadosPara === claveSeleccion) return;
    setCargandoAlumnos(true);
    setErrorAlumnos(false);
    try {
      const datos = alumnos.length ? alumnos : await cargarAlumnosNuevoGrupo();
      setAlumnos(datos);
      setAlumnoIds(new Set(datos.filter(alumno => coincideAlumnoGrupo(alumno, carrera, grado, turno)).map(alumno => alumno.id)));
      setAlumnosInicializadosPara(claveSeleccion);
    } catch (error) {
      setErrorAlumnos(true);
      toast.error(`No se pudieron cargar los alumnos: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setCargandoAlumnos(false); }
  };

  const guardar = async () => {
    if (guardando || grado === null || !asignaturaIds.size || cargandoAlumnos || !alumnosInicializadosPara) return;
    setGuardando(true);
    try {
      const id = await crearGrupoCompleto({
        id: borradorId, codigo, cicloId, planId, grado, turno, estatus,
        asignaturaIds: [...asignaturaIds], alumnoIds: [...alumnoIds],
      });
      toast.success('Grupo, materias y alumnos guardados correctamente.');
      onGrupoCreated?.(id, cicloId);
      onClose();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      toast.error(mensaje.includes('crear_grupo_completo') ? 'No se pudo guardar. Comprueba que la migración de creación de grupos esté aplicada.' : `No se guardó el grupo: ${mensaje}`);
    } finally { setGuardando(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Crear grupo">
      <div className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1c2228]">
        <header className="border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-widest text-[#1456f0] dark:text-blue-400">Alta de grupo</p><h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Nuevo Grupo</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Los datos se guardan juntos al terminar los tres pasos.</p></div>
            <button type="button" onClick={cerrar} disabled={guardando} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X size={20}/></button>
          </div>
          <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Progreso de creación">
            {(['Datos del grupo', 'Grado y materias', 'Alumnos'] as const).map((nombre, indice) => <li key={nombre} className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold sm:text-sm ${paso === indice + 1 ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : paso > indice + 1 ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`} aria-current={paso === indice + 1 ? 'step' : undefined}>{indice + 1}. {nombre}</li>)}
          </ol>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {paso === 1 && <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="grupo-codigo" className={etiqueta}>Código del grupo *</label><input id="grupo-codigo" value={codigo} onChange={event => setCodigo(event.target.value)} maxLength={80} placeholder="Ej. PED-1A" className={campo}/></div>
            <div><label htmlFor="grupo-ciclo" className={etiqueta}>Ciclo escolar *</label><select id="grupo-ciclo" value={cicloId} onChange={event => setCicloId(event.target.value)} className={campo}><option value="">Selecciona un ciclo...</option>{[...ciclos].sort((a,b) => b.nombre.localeCompare(a.nombre, 'es', {numeric:true}) || formatCicloEscolar(a).localeCompare(formatCicloEscolar(b), 'es')).map(ciclo => <option key={ciclo.id} value={ciclo.id}>{formatCicloEscolar(ciclo)}</option>)}</select></div>
            <div><label htmlFor="grupo-plan" className={etiqueta}>Plan de estudios *</label><select id="grupo-plan" value={planId} onChange={event => cambiarPlan(event.target.value)} disabled={cargandoPlanes} className={campo}><option value="">{cargandoPlanes ? 'Cargando planes...' : 'Selecciona un plan...'}</option>{planes.map(item => <option key={item.id} value={item.id}>{item.carrera?.nombre || 'Carrera sin definir'} · {item.nombre}</option>)}</select></div>
            <div><label htmlFor="grupo-turno" className={etiqueta}>Turno *</label><select id="grupo-turno" value={turno} onChange={event => cambiarTurno(event.target.value as Turno)} className={campo}><option value="Matutino">Matutino · L–V 07:00–13:00</option><option value="Vespertino">Vespertino · L–V 16:00–21:00</option><option value="Mixto">Mixto · sábado 07:00–15:00</option></select><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">El turno determina qué alumnos se sugieren y la ventana del generador de horarios.</p></div>
            <div><label htmlFor="grupo-estatus" className={etiqueta}>Estatus</label><select id="grupo-estatus" value={estatus} onChange={event => setEstatus(event.target.value as 'activo' | 'inactivo')} className={campo}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
          </div>}

          {paso === 2 && <div className="space-y-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30"><div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200"><BookOpen size={18}/> Materias del plan</div><p className="mt-1 text-sm text-blue-800 dark:text-blue-300">Elige un grado existente. Sus materias se marcarán automáticamente; puedes ajustar la selección.</p></div>
            <div className="flex flex-wrap items-end justify-between gap-3"><div className="w-full max-w-xs"><label htmlFor="grupo-grado" className={etiqueta}>Grado / bloque *</label><select id="grupo-grado" value={grado ?? ''} onChange={event => cambiarGrado(Number(event.target.value))} className={campo}><option value="" disabled>Selecciona un grado...</option>{periodos.map(numero => <option key={numero} value={numero}>{formatGrado(numero)} · {asignaturasDelGrado(asignaturas, numero).length} materias</option>)}</select></div><span className="text-sm font-semibold text-[#1456f0] dark:text-blue-400">{asignaturaIds.size} materias elegidas</span></div>
            {cargandoAsignaturas ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600"/></div> : <div className="grid gap-3 md:grid-cols-2">{asignaturasOrdenadas.map(asignatura => <label key={asignatura.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${asignaturaIds.has(asignatura.id) ? 'border-blue-400 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/30' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}><input type="checkbox" checked={asignaturaIds.has(asignatura.id)} onChange={() => setAsignaturaIds(actual => { const siguiente = new Set(actual); if (siguiente.has(asignatura.id)) siguiente.delete(asignatura.id); else siguiente.add(asignatura.id); return siguiente; })} className="mt-1 accent-[#1456f0]"/><span className="min-w-0"><strong className="block text-sm text-slate-900 dark:text-white">{asignatura.nombre}</strong><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{asignatura.clave_legado} · Grado {asignatura.numero_periodo ?? 'sin definir'}</span></span></label>)}</div>}
          </div>}

          {paso === 3 && <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30"><div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200"><Users size={18}/> Alumnos del grupo</div><p className="mt-1 text-sm text-blue-800 dark:text-blue-300">Se sugieren alumnos activos de {carrera || 'la carrera'} con grado {formatGrado(grado)} y turno {turno}. Puedes guardar el grupo sin alumnos.</p></div>
            <div className="flex flex-wrap items-center justify-between gap-3"><input type="search" value={busquedaAlumno} onChange={event => setBusquedaAlumno(event.target.value)} placeholder="Buscar por nombre o matrícula..." aria-label="Buscar alumno" className={`${campo} max-w-md`}/><span className="text-sm font-semibold text-[#1456f0] dark:text-blue-400">{alumnoIds.size} alumnos seleccionados</span></div>
            {cargandoAlumnos ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600"/></div> : errorAlumnos ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">No se pudieron cargar los alumnos. <button type="button" onClick={() => void irAAlumnos()} className="font-semibold underline">Reintentar</button></div> : <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">{alumnosVisibles.length ? alumnosVisibles.slice(0, 100).map(alumno => { const sugerido = grado !== null && coincideAlumnoGrupo(alumno, carrera, grado, turno); return <label key={alumno.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800"><input type="checkbox" checked={alumnoIds.has(alumno.id)} onChange={() => setAlumnoIds(actual => { const siguiente = new Set(actual); if (siguiente.has(alumno.id)) siguiente.delete(alumno.id); else siguiente.add(alumno.id); return siguiente; })} className="mt-1 accent-[#1456f0]"/><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-900 dark:text-white">{alumno.nombre_completo}</strong><span className="text-xs text-slate-500 dark:text-slate-400">{alumno.matricula || 'Sin matrícula'} · Grado {formatGrado(alumno.grado_actual)} · {alumno.turno || 'Sin turno'}</span></span>{!sugerido && alumnoIds.has(alumno.id) && <AlertTriangle size={16} className="shrink-0 text-amber-500" aria-label="Revisar grado o turno"/>}</label>; }) : <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{busquedaAlumno ? 'No hay coincidencias. Prueba otra búsqueda.' : 'No hay alumnos sugeridos; puedes buscar y seleccionar alumnos activos.'}</p>}{alumnosVisibles.length > 100 && <p className="p-2 text-xs text-slate-500">Se muestran 100 resultados. Busca por nombre o matrícula para encontrar más.</p>}</div>}
            <p className="text-xs text-slate-500 dark:text-slate-400">Al guardar, cada alumno elegido se vincula a las {asignaturaIds.size} materias seleccionadas. Los docentes se asignan después.</p>
          </div>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-7"><button type="button" onClick={cerrar} disabled={guardando} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button><div className="flex items-center gap-2">{paso > 1 && <button type="button" onClick={() => setPaso(paso === 3 ? 2 : 1)} disabled={guardando} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"><ChevronLeft size={16}/> Atrás</button>}{paso === 1 ? <button type="button" onClick={irAMaterias} disabled={cargandoPlanes || cargandoAsignaturas} className="inline-flex items-center gap-1 rounded-lg bg-[#1456f0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Materias <ChevronRight size={16}/></button> : paso === 2 ? <button type="button" onClick={() => void irAAlumnos()} disabled={cargandoAsignaturas} className="inline-flex items-center gap-1 rounded-lg bg-[#1456f0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Alumnos <ChevronRight size={16}/></button> : <button type="button" onClick={() => void guardar()} disabled={guardando || cargandoAlumnos || !alumnosInicializadosPara} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{guardando ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} Guardar grupo</button>}</div></footer>
      </div>
      <ModalConfirmacion isOpen={confirmacion !== null} title={confirmacion ? textosConfirmacion[confirmacion.tipo].titulo : ''} message={confirmacion ? textosConfirmacion[confirmacion.tipo].mensaje : ''} confirmText={confirmacion ? textosConfirmacion[confirmacion.tipo].confirmar : 'Continuar'} cancelText={confirmacion?.tipo === 'cerrar' ? 'Seguir editando' : 'Conservar selección'} type={confirmacion?.tipo === 'cerrar' ? 'danger' : 'warning'} onConfirm={confirmarCambio} onCancel={() => setConfirmacion(null)} />
    </div>
  );
}
