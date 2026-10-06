import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Download, FileText, Loader2, RefreshCw, Save, WandSparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { docentesElegibles, generarHorario, validarEntradas, validarSesiones } from '../../horarios/motor';
import { crearDocxHorario, crearPdfHorario, type VistaHorario } from '../../horarios/exportar';
import { cargarDatosHorario, guardarUbicacionGrupo, publicarHorario, type DatosHorario } from '../../horarios/service';
import { horaTexto, NOMBRES_DIAS, type CargaHorario, type EntradaHorario, type GrupoHorario, type IncidenciaHorario, type SesionHorario } from '../../horarios/types';

const descargar = (archivo: Blob, nombre: string) => {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a'); enlace.href = url; enlace.download = nombre; enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const incidenciaSuave = (i: IncidenciaHorario) => i.codigo.startsWith('HUECO_');

export default function HorariosAcademicos() {
  const cicloId = useAppStore(state => state.activeCicloId);
  const [datos, setDatos] = useState<DatosHorario | null>(null);
  const [entrada, setEntrada] = useState<EntradaHorario | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState('');
  const [sesiones, setSesiones] = useState<SesionHorario[]>([]);
  const [generado, setGenerado] = useState(false);
  const [vistaPublicada, setVistaPublicada] = useState(false);
  const [incidencias, setIncidencias] = useState<IncidenciaHorario[]>([]);
  const [vista, setVista] = useState<VistaHorario>({ tipo: 'grupos' });
  const [ubicacionesEditadas, setUbicacionesEditadas] = useState<Record<string, { aula: string; sede: string }>>({});

  const cargar = async () => {
    if (!cicloId) return;
    setCargando(true); setError('');
    try {
      const resultado = await cargarDatosHorario(cicloId);
      setDatos(resultado); setEntrada(resultado.entrada);
      setSeleccionados(resultado.entrada.grupos.map(g => g.id));
      setSesiones([]); setIncidencias([]); setVistaPublicada(false); setGenerado(false);
      setUbicacionesEditadas(Object.fromEntries(resultado.entrada.grupos.map(g => [g.id, { aula: g.aula || '', sede: g.sede || '' }])));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCargando(false); }
  };
  useEffect(() => { void cargar(); }, [cicloId]);

  const grupos = useMemo(() => entrada?.grupos.filter(g => seleccionados.includes(g.id)) || [], [entrada, seleccionados]);
  const cargas = useMemo(() => entrada?.cargas.filter(c => seleccionados.includes(c.grupoId)) || [], [entrada, seleccionados]);
  const borrador = useMemo(() => entrada ? { ...entrada, grupos, cargas } : null, [entrada, grupos, cargas]);
  const entradaVista = vistaPublicada ? datos?.publicado?.entrada : borrador;
  const grupoPorId = useMemo(() => new Map((entradaVista?.grupos || []).map(g => [g.id, g])), [entradaVista]);
  const docentePorId = useMemo(() => new Map((entradaVista?.docentes || []).map(d => [d.id, d])), [entradaVista]);
  const cargaPorId = useMemo(() => new Map((entradaVista?.cargas || []).map(c => [c.id, c])), [entradaVista]);
  const preflight = useMemo(() => borrador ? validarEntradas(borrador) : [], [borrador]);
  const ubicacionesPendientes = grupos.some(g => {
    const editada = ubicacionesEditadas[g.id];
    return editada && (editada.aula.trim() !== (g.aula || '').trim() || editada.sede.trim() !== (g.sede || '').trim());
  });
  const sesionesVisibles = useMemo(() => sesiones.filter(s => vista.tipo === 'grupos' ? !vista.id || s.grupoId === vista.id : !vista.id || s.docenteId === vista.id)
    .sort((a, b) => a.dia - b.dia || a.inicio - b.inicio || a.grupoId.localeCompare(b.grupoId)), [sesiones, vista]);

  const cambiarCarga = (id: string, cambio: Partial<CargaHorario>) => {
    setEntrada(prev => prev && ({ ...prev, cargas: prev.cargas.map(c => c.id === id ? { ...c, ...cambio } : c) }));
    setSesiones([]); setIncidencias([]); setVistaPublicada(false); setGenerado(false);
  };
  const cambiarGrupo = (id: string, cambio: Partial<GrupoHorario>) => {
    setEntrada(prev => prev && ({ ...prev, grupos: prev.grupos.map(g => g.id === id ? { ...g, ...cambio } : g) }));
    setSesiones([]); setIncidencias([]); setVistaPublicada(false); setGenerado(false);
  };
  const generar = () => {
    if (!borrador || !grupos.length) return toast.error('Selecciona al menos un grupo.');
    if (ubicacionesPendientes) return toast.error('Guarda las sedes y aulas editadas antes de generar.');
    const resultado = generarHorario(borrador);
    setSesiones(resultado.sesiones); setIncidencias(resultado.incidencias); setVistaPublicada(false);
    setGenerado(!resultado.incidencias.some(i => !incidenciaSuave(i)));
    if (resultado.incidencias.some(i => !incidenciaSuave(i))) toast.error('El borrador tiene datos faltantes o conflictos. Revisa las incidencias.');
    else toast.success(`${resultado.sesiones.length} sesiones generadas. Revisa el borrador antes de publicar.`);
  };
  const publicar = async () => {
    if (!borrador || !datos || !cicloId || !generado || vistaPublicada) return;
    if (seleccionados.length !== entrada?.grupos.length) return toast.error('Selecciona todos los grupos activos del ciclo para publicar. Puedes exportar un borrador parcial.');
    const errores = validarSesiones(sesiones, borrador).filter(i => !incidenciaSuave(i));
    if (errores.length) { setIncidencias(errores); return toast.error('La revisión final encontró conflictos.'); }
    if (!datos.ciclo.fecha_inicio || !datos.ciclo.fecha_termino) return toast.error('Define las fechas exactas del ciclo antes de publicar.');
    setGuardando(true);
    try {
      await publicarHorario(cicloId, borrador, sesiones);
      toast.success('Horario publicado y docentes actualizados en una operación.');
      await cargar();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo publicar el horario.'); }
    finally { setGuardando(false); }
  };
  const exportar = async (formato: 'pdf' | 'docx') => {
    if (!entradaVista || !datos || (!generado && !vistaPublicada)) return toast.error('Genera o abre un horario antes de exportar.');
    setExportando(true);
    try {
      const nombre = `horario-${datos.ciclo.nombre.replace(/[^a-z0-9-]+/gi, '-')}-${vista.tipo}${vista.id ? '-individual' : ''}`;
      if (formato === 'pdf') crearPdfHorario(entradaVista, sesiones, datos.ciclo.nombre, vista).save(`${nombre}.pdf`);
      else descargar(await crearDocxHorario(entradaVista, sesiones, datos.ciclo.nombre, vista), `${nombre}.docx`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo exportar el horario.'); }
    finally { setExportando(false); }
  };
  const guardarUbicacion = async (grupo: GrupoHorario) => {
    const ubicacion = ubicacionesEditadas[grupo.id];
    if (!ubicacion) return;
    try {
      await guardarUbicacionGrupo(grupo.id, ubicacion.aula, ubicacion.sede);
      cambiarGrupo(grupo.id, { aula: ubicacion.aula || null, sede: ubicacion.sede || null });
      toast.success(`Ubicación de ${grupo.codigo} guardada.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se guardó la ubicación.'); }
  };

  if (!cicloId) return <div className="p-8 text-slate-600 dark:text-slate-300">Selecciona un ciclo escolar en la barra superior.</div>;
  return <main className="min-h-full bg-[#f6f8fc] px-3 py-6 text-slate-900 sm:px-6 lg:px-10 dark:bg-[#090e19] dark:text-slate-100">
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7 dark:border-blue-950 dark:bg-[#162030]">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#1456f0] dark:text-blue-400">Coordinación Académica</span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: 'var(--font-display)' }}>Generador de horarios</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Configura la carga presencial, revisa la disponibilidad y genera horarios por grupo y docente para el ciclo seleccionado.</p>
          {datos && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"><CalendarDays size={14}/>{datos.ciclo.nombre} · {datos.ciclo.tipo_periodo || 'Periodo sin tipo'}</p>}</div>
          <button onClick={() => void cargar()} disabled={cargando} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw size={16}/> Actualizar datos</button></div>
      </header>
      {cargando && <div className="flex items-center gap-2 rounded-xl bg-white p-5 text-sm dark:bg-[#1c2228]"><Loader2 className="animate-spin" size={18}/> Cargando datos académicos…</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><b>No se pudo cargar el módulo.</b> {error}<p className="mt-2 text-xs">Si faltan columnas o tablas de horarios, revisa la migración SQL preparada en el repositorio.</p></div>}
      {entrada && datos && <>
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#182c4e] p-5 text-white"><p className="text-xs uppercase tracking-wider text-blue-200">Grupos seleccionados</p><p className="mt-1 text-3xl font-bold">{grupos.length}<span className="text-base font-normal text-blue-200"> / {entrada.grupos.length}</span></p></div><div className="rounded-xl bg-[#1456f0] p-5 text-white"><p className="text-xs uppercase tracking-wider text-blue-100">Materias</p><p className="mt-1 text-3xl font-bold">{cargas.length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]"><p className="text-xs uppercase tracking-wider text-slate-500">Horario publicado</p><p className="mt-1 text-xl font-bold">{datos.publicado ? `Versión ${datos.publicado.version}` : 'Aún no hay'}</p>{datos.publicado && <button onClick={() => {setSesiones(datos.publicado!.sesiones);setVistaPublicada(true);setGenerado(false);setIncidencias([]);setVista({tipo:'grupos'});}} className="mt-2 text-xs font-semibold text-blue-700 underline dark:text-blue-300">Ver versión publicada</button>}</div></div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">1. Selecciona grupos</h2><p className="text-sm text-slate-500 dark:text-slate-400">La consulta usa el ID exacto del ciclo. Para publicar una versión completa selecciona todos los grupos activos.</p></div><div className="flex gap-2 text-xs"><button onClick={() => {setSeleccionados(entrada.grupos.map(g => g.id)); setSesiones([]);setGenerado(false);setVistaPublicada(false);}} className="rounded-lg border px-3 py-1.5 dark:border-slate-600">Todos</button><button onClick={() => {setSeleccionados([]); setSesiones([]);setGenerado(false);setVistaPublicada(false);}} className="rounded-lg border px-3 py-1.5 dark:border-slate-600">Ninguno</button></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{entrada.grupos.map(g => { const u = ubicacionesEditadas[g.id] || {aula:'',sede:''}; return <div key={g.id} className={`rounded-xl border p-3 ${seleccionados.includes(g.id) ? 'border-blue-400 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'}`}><label className="flex cursor-pointer items-center gap-2 font-semibold"><input type="checkbox" checked={seleccionados.includes(g.id)} onChange={() => {setSeleccionados(prev => prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev,g.id]); setSesiones([]);setGenerado(false);setVistaPublicada(false);}} />{g.codigo}</label><p className="ml-5 text-xs text-slate-500">{g.turno} · {entrada.cargas.filter(c => c.grupoId === g.id).length} materias</p><div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-1.5"><input aria-label={`Sede ${g.codigo}`} placeholder="Sede opcional" value={u.sede} onChange={e => setUbicacionesEditadas(prev => ({...prev,[g.id]:{...u,sede:e.target.value}}))} className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"/><input aria-label={`Aula ${g.codigo}`} placeholder="Aula opcional" value={u.aula} onChange={e => setUbicacionesEditadas(prev => ({...prev,[g.id]:{...u,aula:e.target.value}}))} className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"/><button onClick={() => void guardarUbicacion(g)} title="Guardar sede y aula" aria-label={`Guardar ubicación de ${g.codigo}`} className="rounded-md bg-blue-100 p-1.5 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Save size={14}/></button></div></div>; })}</div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]"><h2 className="text-lg font-bold">2. Revisa cargas y docentes</h2><p className="mb-4 text-sm text-slate-500 dark:text-slate-400">El docente existente permanece seleccionado. Si no cumple disponibilidad o restricciones, elige una alternativa antes de generar.</p>
          <div className="space-y-4">{grupos.map(g => <div key={g.id} className="rounded-xl border border-slate-200 dark:border-slate-700"><div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"><h3 className="font-bold">{g.codigo} · {g.turno}</h3><span className="text-xs text-slate-500 dark:text-slate-400">{cargas.filter(c => c.grupoId === g.id).reduce((n,c) => n+(c.horasPresenciales || 0),0)} h presenciales{g.turno === 'MIXTO' ? ' / 8 h disponibles' : ''}</span></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{cargas.filter(c => c.grupoId === g.id).map(c => {const elegibles = docentesElegibles(c,g,entrada.docentes,entrada.ocupacionesExternas).filter(d => d.id === c.docenteId || new Set(cargas.filter(otra => otra.grupoId === g.id && otra.id !== c.id && otra.docenteId === d.id).map(otra => otra.asignaturaId)).size < 3); const actual = docentePorId.get(c.docenteId || ''); const valido = !c.docenteId || elegibles.some(d => d.id === c.docenteId); return <div key={c.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(180px,1.5fr)_minmax(180px,1fr)_minmax(210px,1.2fr)] lg:items-center"><div><p className="font-semibold">{c.asignatura}</p><p className="text-xs text-slate-500">{c.horasTotales ?? 'Sin definir'} h por semana</p><label className="mt-2 block text-xs text-slate-500">Máximo por sesión <select value={c.maxBloque || 4} onChange={e => cambiarCarga(c.id,{maxBloque:Number(e.target.value) as 1 | 2 | 3 | 4})} className="ml-1 rounded-md border border-slate-300 bg-white px-1.5 py-1 dark:border-slate-600 dark:bg-slate-800"><option value="1">1 h</option><option value="2">2 h</option><option value="3">3 h</option><option value="4">4 h</option></select></label></div><div>{g.turno === 'MIXTO' ? <label className="block text-xs font-medium">Presenciales / asíncronas<div className="mt-1 flex items-center gap-2"><input type="number" min="0" max={c.horasTotales ?? 0} step="1" value={c.horasPresenciales ?? ''} onChange={e => { const valor = e.target.value === '' ? null : Number(e.target.value); cambiarCarga(c.id,{horasPresenciales:valor,horasAsincronas:valor === null || c.horasTotales === null ? null : c.horasTotales-valor}); }} className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"/><span className="text-sm text-slate-500">/ {c.horasAsincronas ?? '—'} h</span></div></label> : <p className="text-sm text-slate-500">{c.horasTotales ?? '—'} h presenciales</p>}</div><div><label className="block text-xs font-medium">Docente<select value={c.docenteId || ''} onChange={e => cambiarCarga(c.id,{docenteId:e.target.value || null})} className={`mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm dark:bg-slate-800 ${valido ? 'border-slate-300 dark:border-slate-600' : 'border-amber-500 text-amber-800 dark:text-amber-300'}`}><option value="">Elegir docente</option>{actual && !valido && <option value={actual.id}>{actual.nombre} · asignado con conflicto</option>}{elegibles.map(d => <option key={d.id} value={d.id}>{d.nombre}{d.asignaturasPreferidas.includes(c.asignaturaId) ? ' ★ preferido' : ''}</option>)}</select></label>{!valido && <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle size={12}/> Revisa disponibilidad, plan o grupo restringido.</p>}{!elegibles.length && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">No hay alternativas configuradas para este ciclo.</p>}</div></div>; })}{!cargas.some(c => c.grupoId === g.id) && <p className="p-4 text-sm text-slate-500">Este grupo no tiene asignaturas. Configúralas en Control Escolar → Grupos.</p>}</div></div>)}</div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-bold">3. Genera y revisa</h2><p className="text-sm text-slate-500 dark:text-slate-400">Cada bloque dura 60 minutos; no se reserva un receso. El hueco diario es una preferencia y se favorece al grupo.</p></div><div className="flex flex-wrap gap-3"><label className="text-xs">Hueco máximo grupo<input type="number" min="0" max="8" value={entrada.configuracion.maxHuecoGrupo} onChange={e => {setEntrada(prev => prev && ({...prev,configuracion:{...prev.configuracion,maxHuecoGrupo:Number(e.target.value)}}));setSesiones([]);setGenerado(false);setVistaPublicada(false);}} className="mt-1 block w-24 rounded-md border px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"/></label><label className="text-xs">Hueco máximo docente<input type="number" min="0" max="8" value={entrada.configuracion.maxHuecoDocente} onChange={e => {setEntrada(prev => prev && ({...prev,configuracion:{...prev.configuracion,maxHuecoDocente:Number(e.target.value)}}));setSesiones([]);setGenerado(false);setVistaPublicada(false);}} className="mt-1 block w-24 rounded-md border px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"/></label></div></div>
          {ubicacionesPendientes && <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Guarda las ubicaciones editadas antes de generar.</p>}{preflight.length > 0 && <div role="alert" className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><b>Datos por resolver ({preflight.length})</b>{preflight.slice(0,12).map((i,n) => <p key={`${i.codigo}-${n}`}>• {i.mensaje}</p>)}{preflight.length > 12 && <p>…y {preflight.length-12} más.</p>}</div>}
          <div className="mt-4 flex flex-wrap gap-3"><button onClick={generar} disabled={!grupos.length || preflight.length > 0 || ubicacionesPendientes} className="inline-flex items-center gap-2 rounded-lg bg-[#1456f0] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><WandSparkles size={17}/> Generar borrador</button>{generado && !vistaPublicada && <button onClick={() => void publicar()} disabled={guardando || seleccionados.length !== entrada.grupos.length} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={17}/>{guardando ? 'Publicando…' : 'Publicar horario'}</button>}</div>
          {seleccionados.length !== entrada.grupos.length && <p className="mt-2 text-xs text-slate-500">Puedes generar y exportar la selección. Publicar exige incluir todos los grupos activos del ciclo.</p>}
          {incidencias.length > 0 && <div className="mt-4 space-y-1 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700"><b>Resultado de la revisión</b>{incidencias.map((i,n) => <p key={`${i.codigo}-${n}`} className={incidenciaSuave(i) ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}>• {i.mensaje}</p>)}</div>}
        </section>
        {(generado || vistaPublicada) && <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Vista previa y descargas</h2><p className="text-sm text-slate-500 dark:text-slate-400">{sesiones.length} sesiones presenciales. Las horas asíncronas aparecen aparte en los documentos.</p></div><div className="flex flex-wrap gap-2"><button disabled={exportando} onClick={() => void exportar('pdf')} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:text-blue-300"><Download size={15}/> PDF</button><button disabled={exportando} onClick={() => void exportar('docx')} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:text-blue-300"><FileText size={15}/> Word</button></div></div>
          <div className="mt-4 flex flex-wrap gap-2"><select aria-label="Tipo de horario" value={vista.tipo} onChange={e => setVista({tipo:e.target.value as VistaHorario['tipo']})} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"><option value="grupos">Horarios por grupo</option><option value="docentes">Horarios por docente</option></select><select aria-label="Horario individual o masivo" value={vista.id || ''} onChange={e => setVista({tipo:vista.tipo,id:e.target.value || undefined})} className="min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"><option value="">Todos (masivo)</option>{vista.tipo === 'grupos' ? (entradaVista?.grupos || []).map(g => <option key={g.id} value={g.id}>{g.codigo}</option>) : (entradaVista?.docentes || []).filter(d => entradaVista?.cargas.some(c => c.docenteId === d.id)).map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</select></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{sesionesVisibles.map((s,n) => <div key={`${s.cargaId}-${s.dia}-${s.inicio}-${n}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex justify-between gap-2 text-xs font-bold text-[#1456f0] dark:text-blue-400"><span>{NOMBRES_DIAS[s.dia]}</span><span>{horaTexto(s.inicio)}–{horaTexto(s.fin)}</span></div><p className="mt-2 font-semibold">{cargaPorId.get(s.cargaId)?.asignatura || 'Asignatura'}</p><p className="text-xs text-slate-500 dark:text-slate-400">{grupoPorId.get(s.grupoId)?.codigo} · {docentePorId.get(s.docenteId)?.nombre}</p></div>)}</div>
        </section>}
      </>}
    </div>
  </main>;
}
