import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Download, Plus, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { calcularDiasEfectivos, type ModalidadCalendario, type TurnoCalendario } from '../../calendario/calculos';
import { actividadesCalendario } from '../../calendario/actividades';
import type { VariantePdfCalendario } from '../../calendario/exportarPdf';
import { eliminarEvento, guardarCalendario, guardarEvento, listarCalendarios, listarEventos,
  type CalendarioAcademico, type EventoAcademico, type EventoAcademicoFormulario } from '../../calendario/service';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import ModalEventoCalendario from './ModalEventoCalendario';
import VistaGeneralCalendario from './VistaGeneralCalendario';
import VistaMensualCalendario from './VistaMensualCalendario';

interface PlanOpcion { id: string; nombre: string; clave_legado: string; tipo_periodo: string; modalidad?: ModalidadCalendario; carreras?: { nombre: string } | null }
type FormCalendario = Omit<CalendarioAcademico, 'id'> & { id?: string };
const TURNOS: TurnoCalendario[] = ['MATUTINO', 'VESPERTINO', 'MIXTO'];
const MODALIDADES: ModalidadCalendario[] = ['ESCOLARIZADA', 'MIXTA', 'NO_ESCOLARIZADA', 'COMBINADA'];
const nuevoEvento = (fecha: string): EventoAcademicoFormulario => ({ nombre: '', tipo: 'OTRO', fecha_inicio: fecha,
  fecha_fin: fecha, color: '#2563eb', suspende_clases: false });
const estiloCampo = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white';

export default function CalendarioAcademico() {
  const ciclos = useAppStore(s => s.ciclos);
  const cicloGlobal = useAppStore(s => s.activeCicloId);
  const usuario = useAppStore(s => s.currentUser);
  const puedeEditar = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'COORDINADOR CONTROL ESCOLAR';
  const [cicloId, setCicloId] = useState(cicloGlobal || '');
  const [planes, setPlanes] = useState<PlanOpcion[]>([]);
  const [calendarios, setCalendarios] = useState<CalendarioAcademico[]>([]);
  const [calendarioId, setCalendarioId] = useState('');
  const [form, setForm] = useState<FormCalendario | null>(null);
  const [formOriginal, setFormOriginal] = useState('');
  const [eventos, setEventos] = useState<EventoAcademico[]>([]);
  const [eventosCargadosId, setEventosCargadosId] = useState('');
  const [evento, setEvento] = useState<EventoAcademicoFormulario | null>(null);
  const [eventoOriginal, setEventoOriginal] = useState('');
  const [vista, setVista] = useState<'general' | 'mensual'>('general');
  const [mes, setMes] = useState('');
  const [fechaElegida, setFechaElegida] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState<VariantePdfCalendario | null>(null);
  const [confirmacion, setConfirmacion] = useState<{ mensaje: string; ejecutar: () => void } | null>(null);

  const ciclo = ciclos.find(c => c.id === cicloId);
  const ciclosOrdenados = useMemo(() => [...ciclos].sort((a, b) =>
    b.nombre.localeCompare(a.nombre, 'es', { numeric: true })
    || (a.tipo_periodo || '').localeCompare(b.tipo_periodo || '', 'es')
    || a.id.localeCompare(b.id)), [ciclos]);
  useEffect(() => { if (!cicloId && cicloGlobal) setCicloId(cicloGlobal); }, [cicloId, cicloGlobal]);
  const cambiosPendientes = Boolean(form && JSON.stringify(form) !== formOriginal);
  const planesCompatibles = useMemo(() => planes.filter(plan =>
    plan.tipo_periodo?.toUpperCase() === form?.tipo_periodo &&
    (plan.modalidad || 'ESCOLARIZADA') === form?.modalidad), [planes, form?.tipo_periodo, form?.modalidad]);
  const cambiarSeguro = (accion: () => void) => {
    if (cambiosPendientes) setConfirmacion({ mensaje: 'Los cambios sin guardar del calendario se perderán.', ejecutar: accion });
    else accion();
  };
  const abrirEvento = (datos: EventoAcademicoFormulario) => {
    setEvento(datos);
    setEventoOriginal(JSON.stringify(datos));
  };
  const cancelarEvento = () => {
    if (guardando || !evento) return;
    const cerrar = () => { setEvento(null); setEventoOriginal(''); };
    if (JSON.stringify(evento) !== eventoOriginal) {
      setConfirmacion({ mensaje: 'Se perderán los cambios sin guardar del evento.', ejecutar: cerrar });
    } else cerrar();
  };
  const cargarCalendarios = async (id: string) => {
    setCargando(true);
    try { setCalendarios(await listarCalendarios(id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los calendarios.'); }
    finally { setCargando(false); }
  };
  useEffect(() => {
    void supabase.from('planes_estudio').select('id,nombre,clave_legado,tipo_periodo,modalidad,carreras(nombre)')
      .then(({ data, error }) => {
        if (error) toast.error(`No se pudieron cargar los planes: ${error.message}`);
        else setPlanes((data || []) as unknown as PlanOpcion[]);
      });
  }, []);
  useEffect(() => { if (cicloId) void cargarCalendarios(cicloId); }, [cicloId]);
  useEffect(() => {
    setEventosCargadosId('');
    if (!calendarioId) { setEventos([]); return; }
    let vigente = true;
    void listarEventos(calendarioId).then(lista => {
      if (vigente) { setEventos(lista); setEventosCargadosId(calendarioId); }
    }).catch(error => { if (vigente) toast.error(error.message); });
    return () => { vigente = false; };
  }, [calendarioId]);

  const activarCalendario = (seleccionado: CalendarioAcademico) => {
    setCalendarioId(seleccionado.id);
    const { ...datos } = seleccionado;
    setForm(datos);
    setFormOriginal(JSON.stringify(datos));
    setEvento(null);
    setEventoOriginal('');
    setVista('general');
    setMes(seleccionado.fecha_inicio.slice(0, 7));
    setFechaElegida(seleccionado.fecha_inicio);
  };
  const crearCalendario = () => {
    const datos: FormCalendario = { ciclo_id: cicloId, nombre: '', tipo_periodo: (ciclo?.tipo_periodo || 'CUATRIMESTRAL').toUpperCase(),
      modalidad: 'ESCOLARIZADA', fecha_inicio: ciclo?.fecha_inicio || '', fecha_fin: ciclo?.fecha_termino || '',
      turnos: ['MATUTINO', 'VESPERTINO'], plan_ids: [] };
    setForm(datos); setFormOriginal(JSON.stringify(datos)); setCalendarioId(''); setEvento(null); setEventoOriginal('');
    setFechaElegida(datos.fecha_inicio); setMes(datos.fecha_inicio.slice(0, 7));
  };
  const guardar = async () => {
    if (!puedeEditar) return;
    if (!form || !form.nombre.trim() || !form.fecha_inicio || !form.fecha_fin || form.fecha_inicio > form.fecha_fin ||
      !form.turnos.length || !form.plan_ids.length || form.plan_ids.some(id => !planesCompatibles.some(plan => plan.id === id))) {
      toast.error('Completa nombre, fechas válidas, turnos y al menos un plan compatible.'); return;
    }
    setGuardando(true);
    try {
      const id = await guardarCalendario(form);
      const lista = await listarCalendarios(cicloId);
      setCalendarios(lista);
      const actualizado = lista.find(item => item.id === id);
      if (actualizado) activarCalendario(actualizado);
      toast.success('Calendario guardado.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar el calendario.'); }
    finally { setGuardando(false); }
  };
  const guardarEventoActual = async () => {
    if (!puedeEditar) return;
    if (!evento || !calendarioId || !form) return;
    if (!evento.nombre.trim() || !evento.fecha_inicio || !evento.fecha_fin || evento.fecha_fin < evento.fecha_inicio) {
      toast.error('El evento requiere nombre y un rango de fechas válido.'); return;
    }
    setGuardando(true);
    try {
      await guardarEvento({ ...evento, calendario_id: calendarioId });
      setEventos(await listarEventos(calendarioId)); setEvento(null); setEventoOriginal(''); toast.success('Evento guardado.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar el evento.'); }
    finally { setGuardando(false); }
  };
  const confirmarEliminarEvento = (item: EventoAcademico) => setConfirmacion({
    mensaje: `Se eliminará el evento «${item.nombre}».`,
    ejecutar: () => { void eliminarEvento(item.id).then(() => listarEventos(calendarioId).then(setEventos))
      .catch(error => toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el evento.')); },
  });
  const exportarPdf = async (variante: VariantePdfCalendario) => {
    if (!calendarioId || cambiosPendientes || eventosCargadosId !== calendarioId) {
      toast.error('Guarda los cambios y espera a que terminen de cargar los eventos para exportar.'); return;
    }
    const guardado = calendarios.find(item => item.id === calendarioId);
    if (!guardado) { toast.error('No se encontró el calendario guardado.'); return; }
    setExportando(variante);
    try {
      const { crearPdfCalendario } = await import('../../calendario/exportarPdf');
      const pdf = crearPdfCalendario({ calendario: guardado, cicloNombre: ciclo?.nombre || '', eventos, planes }, variante);
      const nombre = guardado.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'calendario';
      pdf.save(`${nombre}-${variante === 'completo' ? 'meses-y-actividades' : 'actividades'}.pdf`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo generar el PDF.'); }
    finally { setExportando(null); }
  };
  const resumen = form && form.fecha_inicio && form.fecha_fin && form.fecha_inicio <= form.fecha_fin
    ? form.turnos.map(turno => ({ turno, ...calcularDiasEfectivos(form.fecha_inicio, form.fecha_fin, turno,
      form.modalidad, eventos.map(item => ({ fechaInicio: item.fecha_inicio, fechaFin: item.fecha_fin,
        tipo: item.tipo, suspendeClases: item.suspende_clases }))) })) : [];
  const desplazarMes = (paso: number) => {
    const [anio, numero] = mes.split('-').map(Number);
    setMes(new Date(Date.UTC(anio, numero - 1 + paso, 1)).toISOString().slice(0, 7));
  };

  return <div className="mx-auto max-w-[1500px] space-y-6 p-4 pb-12 sm:p-7 text-slate-900 dark:text-slate-100">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-[#1c2228]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><span className="text-xs font-bold uppercase tracking-[.18em] text-blue-600 dark:text-blue-400">Control Escolar</span>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold"><CalendarDays className="text-blue-600" /> Calendarios académicos</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Fechas lectivas, eventos y semanas efectivas por ciclo, modalidad, plan y turno.</p></div>
        <label className="min-w-52 text-sm font-semibold">Ciclo escolar
          <select className={`${estiloCampo} mt-1`} value={cicloId} onChange={e => cambiarSeguro(() => {
            setCicloId(e.target.value); setForm(null); setCalendarioId(''); setEvento(null); setEventoOriginal(''); setFormOriginal('');
          })}>{ciclosOrdenados.map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.tipo_periodo || 'Sin tipo'}</option>)}</select>
        </label>
      </div>
    </header>
    <div className="grid gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-[#1c2228]">
        <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Calendarios del ciclo</h2>
          <button type="button" onClick={() => cambiarSeguro(crearCalendario)} className="rounded-lg bg-blue-600 p-2 text-white" title="Nuevo calendario"><Plus size={18} /></button></div>
        <div className="mt-4 space-y-2">{calendarios.map(item => <button key={item.id} type="button"
          onClick={() => cambiarSeguro(() => activarCalendario(item))}
          className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${calendarioId === item.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 hover:border-blue-300 dark:border-slate-700'}`}>
          <span className="block font-semibold">{item.nombre}</span><span className="text-xs text-slate-500 dark:text-slate-400">{item.tipo_periodo} · {item.modalidad} · {item.turnos.join(', ')}</span>
        </button>)}{!cargando && !calendarios.length && <p className="py-8 text-center text-sm text-slate-500">Aún no hay calendarios para este ciclo.</p>}</div>
      </aside>
      {!form ? <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">Elige un calendario o crea uno para comenzar.</div>
        : <main className="space-y-6 min-w-0">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Datos del calendario</h2>
              {!calendarioId || cambiosPendientes ? <button type="button" disabled={guardando || !puedeEditar} onClick={() => void guardar()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} /> {calendarioId ? 'Guardar cambios' : 'Guardar calendario'}</button>
                : <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 size={16}/> Datos guardados</span>}</div>
            {calendarioId && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Los datos del calendario ya están almacenados. Los eventos se guardan por separado.</p>}
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-semibold md:col-span-2">Nombre<input className={`${estiloCampo} mt-1`} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. 2027-1 Cuatrimestral Matutino y Vespertino" /></label>
              <label className="text-sm font-semibold">Tipo de plan<select className={`${estiloCampo} mt-1`} value={form.tipo_periodo} onChange={e => setForm({ ...form, tipo_periodo: e.target.value, plan_ids: [] })}><option value="CUATRIMESTRAL">Cuatrimestral</option><option value="SEMESTRAL">Semestral</option></select></label>
              <label className="text-sm font-semibold">Modalidad<select className={`${estiloCampo} mt-1`} value={form.modalidad} onChange={e => setForm({ ...form, modalidad: e.target.value as ModalidadCalendario, plan_ids: [] })}>{MODALIDADES.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="text-sm font-semibold">Inicio de clases<input type="date" className={`${estiloCampo} mt-1`} value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} /></label>
              <label className="text-sm font-semibold">Último día de clases<input type="date" className={`${estiloCampo} mt-1`} value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} /></label>
              <fieldset className="md:col-span-2"><legend className="text-sm font-semibold">Turnos que comparten estas fechas</legend><div className="mt-2 flex flex-wrap gap-3">{TURNOS.map(turno => <label key={turno} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.turnos.includes(turno)} onChange={e => setForm({ ...form, turnos: e.target.checked ? [...form.turnos, turno] : form.turnos.filter(t => t !== turno) })} />{turno}</label>)}</div></fieldset>
            </div>
            <fieldset className="mt-5"><legend className="text-sm font-semibold">Planes asociados</legend><div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">{planesCompatibles.map(plan => <label key={plan.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={form.plan_ids.includes(plan.id)} onChange={e => setForm({ ...form, plan_ids: e.target.checked ? [...form.plan_ids, plan.id] : form.plan_ids.filter(id => id !== plan.id) })} />{plan.carreras?.nombre || plan.nombre} · {plan.clave_legado}</label>)}{!planesCompatibles.length && <p className="text-sm text-slate-500">No hay planes de este tipo y modalidad.</p>}</div></fieldset>
          </section>
          {calendarioId && <><section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Días y eventos</h2><p className="text-sm text-slate-500 dark:text-slate-400">Los exámenes ordinarios cuentan como clase. Recuperación y extraordinarios se excluyen siempre.</p></div>
              <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700" role="group" aria-label="Vista del calendario">
                <button type="button" aria-pressed={vista === 'general'} onClick={() => setVista('general')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === 'general' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}>Todos los meses</button>
                <button type="button" aria-pressed={vista === 'mensual'} onClick={() => setVista('mensual')} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === 'mensual' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-blue-600'}`}>Un mes</button>
              </div>{vista === 'mensual' && <div className="flex items-center gap-2"><button type="button" onClick={() => desplazarMes(-1)} aria-label="Mes anterior" className="rounded-lg border p-2 dark:border-slate-700"><ChevronLeft size={18}/></button><span className="min-w-24 text-center font-semibold capitalize">{mes}</span><button type="button" onClick={() => desplazarMes(1)} aria-label="Mes siguiente" className="rounded-lg border p-2 dark:border-slate-700"><ChevronRight size={18}/></button></div>}</div></div>
            <div className="mb-4 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-500">Descargar PDF</span>
              <button type="button" disabled={Boolean(exportando) || cambiosPendientes || eventosCargadosId !== calendarioId} onClick={() => void exportarPdf('completo')} className="inline-flex items-center gap-2 rounded-lg border border-blue-500 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/30"><Download size={15}/> Meses y actividades</button>
              <button type="button" disabled={Boolean(exportando) || cambiosPendientes || eventosCargadosId !== calendarioId} onClick={() => void exportarPdf('actividades')} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"><Download size={15}/> Solo actividades</button>
              {cambiosPendientes && <span className="text-xs text-amber-700 dark:text-amber-300">Guarda los cambios del calendario para exportar.</span>}
              {!cambiosPendientes && eventosCargadosId !== calendarioId && <span className="text-xs text-slate-500">Cargando eventos...</span>}
            </div>
            {vista === 'general' ? <VistaGeneralCalendario inicio={form.fecha_inicio} fin={form.fecha_fin} eventos={eventos} planes={planes} planIds={form.plan_ids} fechaSeleccionada={fechaElegida}
              onSeleccionarFecha={fecha => { setFechaElegida(fecha); if (puedeEditar) abrirEvento(nuevoEvento(fecha)); }} onEditarEvento={item => { if (puedeEditar) abrirEvento({ id: item.id, nombre: item.nombre, tipo: item.tipo, fecha_inicio: item.fecha_inicio, fecha_fin: item.fecha_fin, color: item.color, suspende_clases: item.suspende_clases }); }} onEliminarEvento={puedeEditar ? confirmarEliminarEvento : undefined}/>
              : mes && <VistaMensualCalendario mes={mes} fechaSeleccionada={fechaElegida} onSeleccionarFecha={fecha => { setFechaElegida(fecha); if (puedeEditar) abrirEvento(nuevoEvento(fecha)); }} eventos={actividadesCalendario(form.fecha_inicio, form.fecha_fin, eventos).map(item => ({ id: item.id, nombre: item.nombre, color: item.color, tipo: item.tipo, fechaInicio: item.fecha_inicio, fechaFin: item.fecha_fin, suspendeClases: item.suspende_clases }))} />}
            <div className="mt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Eventos registrados</h3><p className="text-xs text-slate-500">El inicio y término de clases se toman de las fechas del calendario y aparecen automáticamente en las actividades.</p></div>{puedeEditar && <button type="button" onClick={() => abrirEvento(nuevoEvento(fechaElegida || form.fecha_inicio))} className="rounded-lg border border-blue-500 px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">+ Añadir evento</button>}</div>
              {vista === 'mensual' && <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">{eventos.map(item => <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700" style={{ borderLeftWidth: 4, borderLeftColor: item.color }}><button type="button" className="min-w-0 flex-1 text-left" onClick={() => { if (puedeEditar) abrirEvento({ id: item.id, nombre: item.nombre, tipo: item.tipo, fecha_inicio: item.fecha_inicio, fecha_fin: item.fecha_fin, color: item.color, suspende_clases: item.suspende_clases }); }}><span className="block truncate font-semibold">{item.nombre}</span><span className="text-xs text-slate-500">{item.fecha_inicio} — {item.fecha_fin}</span></button>{puedeEditar && <button type="button" aria-label={`Eliminar ${item.nombre}`} className="text-red-600" onClick={() => confirmarEliminarEvento(item)}><Trash2 size={16}/></button>}</div>)}{!eventos.length && <p className="text-sm text-slate-500">Sin eventos todavía. Elige un día para agregar uno.</p>}</div>}
            </div>
          </section><section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]"><h2 className="text-lg font-bold">Tiempo efectivo estimado</h2><p className="mt-1 text-xs text-slate-500">Las semanas equivalentes son días efectivos ÷ días lectivos habituales del turno. Esta vista aún no calcula nómina.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{resumen.map(item => <div key={item.turno} className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30"><h3 className="font-bold">{item.turno}</h3><p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">{item.total} días</p><p className="text-xs text-slate-600 dark:text-slate-300">{item.presenciales} presenciales{item.sincronasEnLinea ? ` · ${item.sincronasEnLinea} síncronos en línea` : ''}</p><p className="mt-2 text-xs">{item.semanasConClase} semanas con clase · {item.semanasEquivalentes} equivalentes</p></div>)}</div></section></>}
        </main>}
    </div>
    <ModalEventoCalendario evento={evento} guardando={guardando} onChange={setEvento} onGuardar={() => void guardarEventoActual()} onCancelar={cancelarEvento}/>
    <ModalConfirmacion isOpen={Boolean(confirmacion)} title="Confirmar acción" message={confirmacion?.mensaje || ''} onCancel={() => setConfirmacion(null)} onConfirm={() => { const accion = confirmacion?.ejecutar; setConfirmacion(null); accion?.(); }}/>
  </div>;
}
