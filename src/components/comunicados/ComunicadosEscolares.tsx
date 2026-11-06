import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, CheckCircle2, CloudUpload, Copy, ExternalLink, FileCheck2,
  RefreshCw, Search, Send, ShieldOff, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { useCicloModulo } from '../../hooks/useCicloModulo';
import { listarAlumnosSinGrupoComunicados, revisarComunicadosDelCiclo, type FilaComunicado } from '../../comunicados/consulta';
import { documentosCoincidenConCiclos, PLANTILLA_MENSAJE_PREDETERMINADA,
  PLANTILLA_NUEVO_INGRESO_PREDETERMINADA, PLANTILLA_INGLES_PREDETERMINADA,
  renderizarPlantillaMensaje, renderizarAvisoIngles,
  type PlantillasComunicado, type SeleccionDocumento } from '../../comunicados/preparacion';
import { ciclosBoletaElegibles, sugerirCicloBoletaId } from '../../comunicados/ciclos';
import { eliminarEmisionAnterior, estadoDrive, guardarPlantillaMensaje, habilitarEnlace,
  iniciarConexionDrive, marcarEnviado, prepararEmision, revocarEnlace, subirDocumento,
  type EmisionComunicado } from '../../comunicados/driveService';
import { generarDocumentosAlumno } from '../../comunicados/generarDocumentos';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import ModalMensajeComunicado from './ModalMensajeComunicado';
import PlantillaMensajeComunicado from './PlantillaMensajeComunicado';
import { esPlanPagoTitulacion } from '../../utils/cicloPlanPago';
import ResumenInscripcionesCiclo from '../inscripciones/ResumenInscripcionesCiclo';

function EtiquetaDocumento({ titulo, seleccion, pendiente = false, opcional = false }: {
  titulo: string; seleccion: SeleccionDocumento<unknown>; pendiente?: boolean; opcional?: boolean;
}) {
  const listo = seleccion.estado === 'LISTO' && !pendiente;
  const omitido = seleccion.estado === 'NO_APLICA' || (opcional && seleccion.estado === 'FALTANTE');
  const texto = pendiente ? 'Calificaciones pendientes' : seleccion.estado === 'LISTO' ? 'Disponible'
    : seleccion.estado === 'NO_APLICA' ? 'No aplica · nuevo ingreso' : omitido ? 'No se incluirá'
    : seleccion.estado === 'AMBIGUO' ? 'Revisar coincidencia' : 'Faltante';
  return <div className={`flex min-w-0 items-start justify-between gap-3 rounded-xl border px-3 py-2.5 ${omitido
    ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40' : listo
    ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20'
    : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20'}`}>
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{titulo}</p>
      <p className={`mt-0.5 text-[11px] ${omitido ? 'text-slate-500 dark:text-slate-400' : listo ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-amber-700 dark:text-amber-300'}`}>{texto}</p>
      {seleccion.estado !== 'LISTO' &&
        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{seleccion.motivo}</p>}
    </div>
    {listo ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
      : !omitido && <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />}
  </div>;
}

const completa = (fila: FilaComunicado) => (fila.boleta.estado === 'NO_APLICA'
  || (fila.boleta.estado === 'LISTO' && fila.boleta.valor.calificacionesPendientes === 0))
  && fila.calendario.estado === 'LISTO' && fila.horario.estado === 'LISTO'
  && fila.pagos.estado !== 'AMBIGUO';

export default function ComunicadosEscolares() {
  const navigate = useNavigate();
  const ciclos = useAppStore(estado => estado.ciclos);
  const cicloGlobal = useAppStore(estado => estado.activeCicloId);
  const planesPago = useAppStore(estado => estado.plans);
  const usuario = useAppStore(estado => estado.currentUser);
  const [cicloId, setCicloId] = useCicloModulo('comunicados', ciclos, cicloGlobal, usuario?.id);
  const [seleccionBoleta, setSeleccionBoleta] = useState<{ cicloEntregaId: string; cicloBoletaId: string } | null>(null);
  const ciclo = ciclos.find(item => item.id === cicloId) || null;
  const anteriores = useMemo(() => ciclosBoletaElegibles(ciclos, ciclo), [ciclos, ciclo]);
  const boletaGuardadaId = useMemo(() => {
    if (!usuario?.id || !cicloId) return '';
    try { return localStorage.getItem(`comunicados-boleta:${usuario.id}:${cicloId}`) || ''; }
    catch { return ''; }
  }, [usuario?.id, cicloId]);
  const boletaPreferidaId = seleccionBoleta?.cicloEntregaId === cicloId
    ? seleccionBoleta.cicloBoletaId : boletaGuardadaId;
  const cicloBoletaId = anteriores.some(item => item.id === boletaPreferidaId)
    ? boletaPreferidaId : sugerirCicloBoletaId(ciclos, ciclo);
  const cicloBoleta = anteriores.find(item => item.id === cicloBoletaId) || null;
  useEffect(() => {
    if (!usuario?.id || !seleccionBoleta?.cicloBoletaId) return;
    try { localStorage.setItem(`comunicados-boleta:${usuario.id}:${seleccionBoleta.cicloEntregaId}`,
      seleccionBoleta.cicloBoletaId); } catch { /* Preferencia local opcional. */ }
  }, [seleccionBoleta, usuario?.id]);
  const [filas, setFilas] = useState<FilaComunicado[]>([]);
  const [sinGrupo, setSinGrupo] = useState<Awaited<ReturnType<typeof listarAlumnosSinGrupoComunicados>>>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [revision, setRevision] = useState(0);
  const [firmantes, setFirmantes] = useState<{ id: string; nombre: string }[]>([]);
  const [firmanteId, setFirmanteId] = useState('');
  const [conexion, setConexion] = useState<{ correo: string; carpetaRaizId: string } | null>(null);
  const [emisiones, setEmisiones] = useState<EmisionComunicado[]>([]);
  const [plantilla, setPlantilla] = useState<PlantillasComunicado>({
    contenido: PLANTILLA_MENSAJE_PREDETERMINADA,
    contenido_nuevo_ingreso: PLANTILLA_NUEVO_INGRESO_PREDETERMINADA,
    contenido_ingles: PLANTILLA_INGLES_PREDETERMINADA,
  });
  const [funcionActualizada, setFuncionActualizada] = useState(true);
  const [mensajeAbierto, setMensajeAbierto] = useState<{ nombre: string; texto: string; enlace: string;
    avisoIngles: string; inglesRegistrado: boolean; materiasIngles: string[] } | null>(null);
  const [errorDrive, setErrorDrive] = useState('');
  const [trabajando, setTrabajando] = useState('');
  const [lote, setLote] = useState<{ actual: number; total: number } | null>(null);
  const [erroresLote, setErroresLote] = useState<string[]>([]);
  const detenerLote = useRef(false);
  const [confirmacion, setConfirmacion] = useState<{
    tipo: 'enlace' | 'revocar' | 'eliminar'; emision: EmisionComunicado; nombre: string;
  } | null>(null);
  useEffect(() => {
    void supabase.from('empleados').select('id,nombres,apellido_paterno,apellido_materno')
      .eq('estatus', 'activo').eq('firmante_boletas', true).order('apellido_paterno')
      .then(({ data, error }) => {
        if (error) { toast.error('No se pudieron consultar los firmantes de boletas.'); return; }
        setFirmantes((data || []).map(item => ({ id: item.id,
          nombre: [item.apellido_paterno, item.apellido_materno, item.nombres].filter(Boolean).join(' ') })));
      });
  }, []);
  useEffect(() => {
    let vigente = true;
    if (!cicloId) { setEmisiones([]); return; }
    void estadoDrive(cicloId).then(datos => {
      if (!vigente) return;
      setConexion(datos.conexion); setEmisiones(datos.emisiones);
      if (typeof datos.plantilla === 'string') {
        setPlantilla(actual => ({ ...actual, contenido: datos.plantilla as string }));
        setFuncionActualizada(false);
        setErrorDrive('La función comunicados-drive aún debe actualizarse para nuevo ingreso y el aviso de Inglés.');
      } else { setPlantilla(datos.plantilla); setFuncionActualizada(true); setErrorDrive(''); }
    }).catch(error => { if (vigente) { setConexion(null); setEmisiones([]);
      setErrorDrive(error instanceof Error ? error.message : 'No se pudo consultar Drive.'); } });
    return () => { vigente = false; };
  }, [cicloId, revision]);
  useEffect(() => {
    let vigente = true;
    if (!cicloId) { setFilas([]); return; }
    setCargando(true);
    void revisarComunicadosDelCiclo(cicloId, cicloBoleta?.id || null, ciclos)
      .then(datos => { if (vigente) setFilas(datos); })
      .catch(error => { if (vigente) { setFilas([]); toast.error(error instanceof Error ? error.message
        : 'No se pudo revisar la información del ciclo.'); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [cicloId, cicloBoleta?.id, ciclos, revision]);
  useEffect(() => {
    let vigente = true;
    if (!ciclo || cargando) { setSinGrupo([]); return; }
    void listarAlumnosSinGrupoComunicados(ciclo, filas.map(fila => fila.alumno.id))
      .then(datos => { if (vigente) setSinGrupo(datos); })
      .catch(() => { if (vigente) setSinGrupo([]); });
    return () => { vigente = false; };
  }, [ciclo, cargando, filas]);
  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es-MX');
    return !termino ? filas : filas.filter(fila =>
      [fila.alumno.nombre_completo, fila.alumno.matricula || '']
        .some(valor => valor.toLocaleLowerCase('es-MX').includes(termino)));
  }, [filas, busqueda]);
  const preparados = filas.filter(completa).length;
  const listosVisibles = visibles.filter(fila => fila.alumno.estatus?.trim().toUpperCase() === 'ACTIVO' && completa(fila));
  const conCalendarioPagos = listosVisibles.filter(fila => fila.pagos.estado === 'LISTO').length;
  const sinCalendarioPagos = listosVisibles.length - conCalendarioPagos;
  const ultimaEmision = (alumnoId: string) => emisiones.find(emision => emision.alumno_id === alumnoId);
  const actualizar = () => setRevision(valor => valor + 1);
  const ejecutar = async (clave: string, operacion: () => Promise<void>, mensaje: string) => {
    setTrabajando(clave);
    try { await operacion(); toast.success(mensaje); actualizar(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'La operación no pudo completarse.'); actualizar(); }
    finally { setTrabajando(''); }
  };
  const conectar = () => void ejecutar('conectar', async () => {
    const url = await iniciarConexionDrive();
    window.location.assign(url);
  }, 'Redirigiendo a Google.');
  const preparar = (fila: FilaComunicado) => void ejecutar(fila.alumno.id, async () => {
    if (!conexion) throw new Error('Conecta la cuenta operativa de Drive.');
    if (!completa(fila)) throw new Error('Resuelve los datos pendientes antes de preparar el comunicado.');
    if (!ciclo || (fila.boleta.estado !== 'NO_APLICA' && !cicloBoleta))
      throw new Error('Elige el ciclo en curso y el de la boleta.');
    const documentos = await generarDocumentosAlumno(fila, ciclo, cicloBoleta, ciclos, firmanteId);
    const emision = await prepararEmision(fila.alumno.id, ciclo.id,
      fila.boleta.estado === 'NO_APLICA' ? null : cicloBoleta?.id || null,
      documentos.map(documento => documento.tipo));
    for (const documento of documentos) await subirDocumento(emision.id, documento);
  }, 'Documentos guardados en la carpeta privada del alumno.');
  const prepararVisibles = async () => {
    if (!conexion || !ciclo || cargando) return;
    const pendientes = visibles.filter(fila => fila.alumno.estatus?.trim().toUpperCase() === 'ACTIVO'
      && completa(fila) && (fila.boleta.estado === 'NO_APLICA' || Boolean(cicloBoleta && firmanteId)) &&
      (!ultimaEmision(fila.alumno.id) || ultimaEmision(fila.alumno.id)?.estado === 'BORRADOR'));
    if (!pendientes.length) return toast('No hay alumnos visibles pendientes de preparación.');
    detenerLote.current = false;
    setErroresLote([]);
    setTrabajando('lote');
    setLote({ actual: 0, total: pendientes.length });
    const errores: string[] = [];
    for (const [indice, fila] of pendientes.entries()) {
      if (detenerLote.current) break;
      setLote({ actual: indice + 1, total: pendientes.length });
      try {
        const documentos = await generarDocumentosAlumno(fila, ciclo, cicloBoleta, ciclos, firmanteId);
        const emision = await prepararEmision(fila.alumno.id, ciclo.id,
          fila.boleta.estado === 'NO_APLICA' ? null : cicloBoleta?.id || null,
          documentos.map(documento => documento.tipo));
        for (const documento of documentos) await subirDocumento(emision.id, documento);
      } catch (error) {
        errores.push(`${fila.alumno.nombre_completo}: ${error instanceof Error ? error.message : 'falló la preparación.'}`);
      }
    }
    setTrabajando(''); setLote(null); setErroresLote(errores); actualizar();
    toast(errores.length ? `${errores.length} alumno(s) requieren reintento; sus borradores se conservaron.`
      : detenerLote.current ? 'Preparación detenida. Los avances se conservaron.'
        : 'Se prepararon las carpetas privadas de los alumnos visibles.');
  };
  const confirmar = () => {
    const actual = confirmacion;
    setConfirmacion(null);
    if (!actual) return;
    void ejecutar(actual.emision.id, async () => {
      if (actual.tipo === 'enlace') await habilitarEnlace(actual.emision.id);
      else if (actual.tipo === 'revocar') await revocarEnlace(actual.emision.id);
      else await eliminarEmisionAnterior(actual.emision.id);
    }, actual.tipo === 'enlace' ? 'Enlace individual habilitado.' : actual.tipo === 'revocar'
      ? 'Acceso mediante enlace revocado.' : 'Emisión anterior enviada a la papelera.');
  };
  const abrirMensaje = (fila: FilaComunicado, emision: EmisionComunicado) => {
    if (!emision.enlace) return;
    const cicloDeEmision = ciclos.find(item => item.id === emision.ciclo_id);
    const boletaDeEmision = ciclos.find(item => item.id === emision.ciclo_boleta_id);
    if (!cicloDeEmision || (!emision.boleta_no_aplica && !boletaDeEmision)) {
      toast.error('Esta emisión no tiene los ciclos requeridos. Prepara una nueva antes de copiar el mensaje.');
      return;
    }
    const datos = {
        nombre: fila.alumno.nombre_completo, matricula: fila.alumno.matricula || '',
        ciclo: cicloDeEmision.nombre, ciclo_boleta: boletaDeEmision?.nombre || '',
        enlace: emision.enlace,
    };
    setMensajeAbierto({ nombre: fila.alumno.nombre_completo, enlace: emision.enlace,
      texto: renderizarPlantillaMensaje(emision.boleta_no_aplica
        ? plantilla.contenido_nuevo_ingreso : plantilla.contenido, datos),
      avisoIngles: renderizarAvisoIngles(plantilla.contenido_ingles, datos, fila.materiasIngles),
      inglesRegistrado: fila.materiasIngles.length > 0, materiasIngles: fila.materiasIngles });
  };
  const guardarPlantilla = async (nueva: PlantillasComunicado) => {
    if (!funcionActualizada) throw new Error('Actualiza la función comunicados-drive antes de guardar las plantillas.');
    setPlantilla(await guardarPlantillaMensaje(nueva));
  };

  return <div className="mx-auto max-w-7xl space-y-6 pb-12 text-slate-900 dark:text-slate-100">
    <ResumenInscripcionesCiclo cicloId={cicloId}/>
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-[#1c2228]">
      <div className="flex flex-col gap-5 bg-gradient-to-r from-[#163959] to-[#1b4c72] px-6 py-7 text-white md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Control Escolar · preparación</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Comunicados personalizados</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sky-100">Revisa los documentos de cada alumno antes de preparar su entrega en Drive y su mensaje individual de Telegram.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
          <CloudUpload size={22} className="text-sky-200" />
          <div><p className="text-xs font-semibold">Conexión institucional de Drive</p>
            <p className="text-xs text-sky-200">{conexion?.correo || 'Pendiente de configuración'}</p></div>
        </div>
      </div>
      <div className="grid gap-4 px-6 py-5 md:grid-cols-2 md:items-end lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto] md:px-8">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Ciclo en curso · entrega
          <select value={cicloId} disabled={Boolean(trabajando)} onChange={evento => { setCicloId(evento.target.value); setBusqueda(''); }}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
            <option value="">Selecciona un ciclo</option>
            {[...ciclos].sort((a, b) => b.nombre.localeCompare(a.nombre, 'es', { numeric: true }))
              .map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.tipo_periodo || 'Tipo sin definir'}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Ciclo anterior · boleta
          <select value={cicloBoletaId} disabled={!ciclo || Boolean(trabajando)}
            onChange={evento => setSeleccionBoleta({ cicloEntregaId: cicloId, cicloBoletaId: evento.target.value })}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
            <option value="">Selecciona el ciclo de la boleta</option>
            {anteriores.map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.tipo_periodo}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Buscar alumno
          <span className="relative mt-2 block"><Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input value={busqueda} disabled={Boolean(trabajando)} onChange={evento => setBusqueda(evento.target.value)} placeholder="Nombre o matrícula"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </span>
        </label>
        <button type="button" onClick={actualizar} disabled={!cicloId || cargando || Boolean(trabajando)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
          <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} /> Revisar datos
        </button>
      </div>
      {ciclo && <p className="px-6 pb-5 text-xs text-slate-500 dark:text-slate-400 md:px-8">
        Boleta: {cicloBoleta?.nombre || 'elige un ciclo anterior'} para alumnos con historial; nuevo ingreso no la recibe.
        Calendario, horario y pagos: {ciclo.nombre}.
      </p>}
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { etiqueta: 'Alumnos en grupos', valor: filas.length, icono: <CalendarDays size={18}/> },
        { etiqueta: 'Sin bloqueos de datos', valor: preparados, icono: <FileCheck2 size={18}/> },
        { etiqueta: 'Requieren atención', valor: filas.length - preparados, icono: <AlertCircle size={18}/> },
      ].map(item => <div key={item.etiqueta} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-[#1c2228]">
        <span className="rounded-lg bg-sky-50 p-2.5 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">{item.icono}</span>
        <div><p className="text-2xl font-bold tabular-nums">{item.valor}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{item.etiqueta}</p></div>
      </div>)}
    </div>

    <div className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 md:grid-cols-[1fr_auto] md:items-center">
      <div><p className="font-semibold">Entrega individual mediante Drive</p>
        <p className="mt-1 text-xs">Los PDF se preparan en privado. Revisa cada carpeta antes de habilitar su enlace; quien reciba el enlace podrá reenviarlo.</p>
        {errorDrive && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{errorDrive}</p>}
      </div>
      {usuario?.rol === 'ADMINISTRADOR' && <button type="button" onClick={conectar} disabled={Boolean(trabajando)}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1456f0] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
        <CloudUpload size={16} /> {conexion ? 'Renovar conexión' : 'Conectar cuenta operativa'}
      </button>}
    </div>
    <PlantillaMensajeComunicado plantilla={plantilla} guardar={guardarPlantilla}
      deshabilitado={Boolean(trabajando) || !funcionActualizada} />
    <label className="block max-w-md text-xs font-semibold text-slate-600 dark:text-slate-300">Firmante de boletas · requerido solo para alumnos con boleta
      <select value={firmanteId} disabled={Boolean(trabajando)} onChange={evento => setFirmanteId(evento.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
        <option value="">Selecciona un firmante con firma registrada</option>
        {firmantes.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
      </select>
    </label>
    {conexion && <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void prepararVisibles()} disabled={Boolean(trabajando) || cargando || !cicloId}
        className="rounded-lg border border-blue-600 px-4 py-2.5 text-xs font-bold text-blue-700 disabled:opacity-50 dark:text-blue-300">
        Preparar visibles en privado
      </button>
      {lote && <><span className="text-xs text-slate-600 dark:text-slate-300">Alumno {lote.actual} de {lote.total}</span>
        <button type="button" onClick={() => { detenerLote.current = true; }}
          className="text-xs font-semibold text-amber-700 dark:text-amber-300">Detener después del actual</button></>}
      <p className="text-xs text-slate-500 dark:text-slate-400">Solo alumnos activos visibles sin emisión lista. Ningún enlace se habilita en lote.</p>
    </div>}
    <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-[#1c2228] dark:text-slate-200">
      Entre los {listosVisibles.length} alumnos listos visibles: {conCalendarioPagos} con calendario de pagos y {sinCalendarioPagos} sin calendario de pagos. Los planes ausentes o incompletos se omiten del paquete individual.
    </p>
    {sinGrupo.length > 0 && <details className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <summary className="cursor-pointer font-semibold">{sinGrupo.length} alumnos con estatus institucional activo sin grupo en {ciclo?.nombre}; su inscripción se revisa por separado</summary>
      <p className="mt-2 text-xs">Esta lista localiza candidatos; no confirma matrícula. Revisa Inscripciones por ciclo. La preparación del paquete con horario requiere la asignación del grupo.</p>
      <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-xs">
        {sinGrupo.map(alumno => <li key={alumno.id}>{alumno.nombre_completo} · {alumno.matricula || 'sin matrícula'}</li>)}
      </ul>
    </details>}
    {erroresLote.length > 0 && <details className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <summary className="cursor-pointer font-bold">Revisar {erroresLote.length} fallos de preparación</summary>
      <ul className="mt-3 max-h-48 space-y-1 overflow-auto">{erroresLote.map((mensaje, indice) => <li key={indice}>{mensaje}</li>)}</ul>
    </details>}
    <section className="space-y-3" aria-label="Revisión por alumno">
      <div className="flex items-end justify-between gap-3"><div>
        <h2 className="text-lg font-bold">Documentos por alumno</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{ciclo
          ? `Entrega ${ciclo.nombre} · Boleta ${cicloBoleta?.nombre || 'sin ciclo seleccionado'}`
          : 'Elige un ciclo para comenzar.'}</p>
      </div><p className="text-xs text-slate-500 dark:text-slate-400">{visibles.length} resultado(s)</p></div>
      {!cargando && cicloId && !visibles.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#1c2228]">
        No hay alumnos de grupos que coincidan con la búsqueda en este ciclo.
      </div>}
      {cargando && <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-[#1c2228]">Revisando alumnos, calendarios, horarios y pagos…</div>}
      {!cargando && visibles.map(fila => {
        const planHomonimo = planesPago.find(plan => plan.alumno_id === fila.alumno.id
          && plan.ciclo_id !== cicloId && !esPlanPagoTitulacion(plan.tipo_plan)
          && ciclos.some(item => item.id === plan.ciclo_id && item.nombre === ciclo?.nombre));
        const emision = ultimaEmision(fila.alumno.id);
        const anteriores = emisiones.filter(item => item.alumno_id === fila.alumno.id && item.id !== emision?.id);
        const documentos = new Set(emision?.comunicados_documentos?.map(item => item.tipo) || []);
        const documentosVigentes = Boolean(emision
          && (emision.boleta_no_aplica ? fila.boleta.estado === 'NO_APLICA' : fila.boleta.estado === 'LISTO')
          && documentosCoincidenConCiclos(emision, cicloId, cicloBoleta?.id || null));
        return <article key={fila.alumno.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#1c2228] sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-bold">{fila.alumno.nombre_completo}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Matrícula {fila.alumno.matricula || 'sin registrar'} · {fila.grupos.map(grupo => grupo.codigo).join(', ')} · Grado personal {fila.alumno.grado_actual || 'sin definir'} · Estatus {fila.alumno.estatus || 'sin registrar'}</p>
            {fila.materiasIngles.length > 0 && <p className="mt-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
              Inglés del ciclo: {fila.materiasIngles.join(', ')} · aviso disponible en el mensaje
            </p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${completa(fila)
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>
            {completa(fila) ? 'Datos localizados' : 'Requiere revisión'}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <EtiquetaDocumento titulo={`Boleta · ${fila.boleta.estado === 'NO_APLICA' ? 'nuevo ingreso' : cicloBoleta?.nombre || 'sin ciclo'}`} seleccion={fila.boleta}
            pendiente={fila.boleta.estado === 'LISTO' && fila.boleta.valor.calificacionesPendientes > 0} />
          <EtiquetaDocumento titulo="Calendario académico" seleccion={fila.calendario} />
          <EtiquetaDocumento titulo="Horario publicado" seleccion={fila.horario} />
          <EtiquetaDocumento titulo="Calendario de pagos" seleccion={fila.pagos} opcional />
        </div>
        {usuario?.rol === 'ADMINISTRADOR' && planHomonimo
          && fila.pagos.estado === 'FALTANTE' && fila.pagos.motivo?.includes('otro')
          && <button type="button" onClick={() => {
            navigate('/plan-pagos', { state: { alumnoId: fila.alumno.id, initialPlanId: planHomonimo.id,
              fromComunicados: true } });
          }} className="mt-3 rounded-lg border border-amber-400 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30">
            Revisar asociación en Planes de Pago
          </button>}
        {conexion && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
          <span className="mr-auto text-xs text-slate-500 dark:text-slate-400">
            {emision ? `Emisión ${emision.numero} (${ciclos.find(item => item.id === emision.ciclo_id)?.nombre || 'ciclo sin nombre'}) · ${emision.estado} · Boleta ${emision.boleta_no_aplica ? 'no aplica' : ciclos.find(item => item.id === emision.ciclo_boleta_id)?.nombre || 'sin ciclo registrado'} · ${[...documentos].join(', ') || 'sin archivos'}`
              : 'Sin carpeta preparada'}
            {emision?.estado === 'BORRADOR' && documentos.size > 0 && !documentosVigentes
              && <span className="mt-1 block font-semibold text-amber-700 dark:text-amber-300">
                Este borrador conserva sus archivos, pero debes volver a prepararlos para verificar el ciclo de cada PDF.
              </span>}
          </span>
          {completa(fila) && (fila.boleta.estado === 'NO_APLICA' || cicloBoleta)
            && <button type="button" onClick={() => preparar(fila)}
              disabled={Boolean(trabajando) || cargando || (fila.boleta.estado !== 'NO_APLICA' && !firmanteId)
                || fila.cicloEntregaId !== cicloId || (fila.boleta.estado !== 'NO_APLICA' && fila.cicloBoletaId !== cicloBoleta?.id)}
              className="rounded-lg bg-[#1456f0] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {trabajando === fila.alumno.id ? 'Preparando…' : emision?.estado === 'BORRADOR'
                ? 'Reintentar carga' : emision ? 'Nueva emisión' : 'Preparar documentos'}
            </button>}
          {emision?.estado === 'BORRADOR' && documentosVigentes
            && <button type="button" onClick={() => setConfirmacion({ tipo: 'enlace', emision, nombre: fila.alumno.nombre_completo })}
              disabled={Boolean(trabajando)} className="rounded-lg border border-amber-500 px-3 py-2 text-xs font-bold text-amber-700 disabled:opacity-50 dark:text-amber-300">
              Habilitar enlace
            </button>}
          {emision?.enlace && <>
            <a href={emision.enlace} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600"><ExternalLink size={14}/> Revisar carpeta</a>
            <button type="button" onClick={() => abrirMensaje(fila, emision)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600"><Copy size={14}/> Personalizar y copiar</button>
            {emision.estado === 'LISTO' && <button type="button" onClick={() => void ejecutar(emision.id,
              () => marcarEnviado(emision.id), 'Envío manual registrado.')}
              disabled={Boolean(trabajando)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50 dark:text-emerald-300"><Send size={14}/> Marcar enviado</button>}
            <button type="button" onClick={() => setConfirmacion({ tipo: 'revocar', emision, nombre: fila.alumno.nombre_completo })}
              disabled={Boolean(trabajando)} className="inline-flex items-center gap-1 rounded-lg border border-red-400 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50 dark:text-red-300"><ShieldOff size={14}/> Revocar</button>
          </>}
        </div>}
        {anteriores.length > 0 && <details className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">Emisiones anteriores ({anteriores.length})</summary>
          <div className="mt-2 space-y-2">{anteriores.map(anterior => <div key={anterior.id}
            className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
            <span className="mr-auto">Emisión {anterior.numero} ({ciclos.find(item => item.id === anterior.ciclo_id)?.nombre || 'ciclo sin nombre'}) · {anterior.estado}</span>
            {anterior.enlace && <>
              <a href={anterior.enlace} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 dark:text-blue-300">Abrir enlace</a>
              <button type="button" onClick={() => setConfirmacion({ tipo: 'revocar', emision: anterior, nombre: fila.alumno.nombre_completo })}
                className="font-semibold text-red-600 dark:text-red-300">Revocar</button>
            </>}
            <button type="button" onClick={() => setConfirmacion({ tipo: 'eliminar', emision: anterior, nombre: fila.alumno.nombre_completo })}
              disabled={Boolean(trabajando)} className="inline-flex items-center gap-1 font-semibold text-red-600 disabled:opacity-50 dark:text-red-300">
              <Trash2 size={13}/>Eliminar emisión
            </button>
          </div>)}</div>
        </details>}
      </article>})}
    </section>
    <ModalConfirmacion isOpen={Boolean(confirmacion)}
      title={confirmacion?.tipo === 'enlace' ? 'Habilitar enlace individual'
        : confirmacion?.tipo === 'eliminar' ? 'Eliminar emisión anterior' : 'Revocar acceso'}
      message={confirmacion?.tipo === 'enlace'
        ? <>La carpeta de {confirmacion?.nombre} podrá abrirse con el enlace, incluso por quien lo reciba reenviado. Comprueba antes sus PDF y el destinatario de Telegram.</>
        : confirmacion?.tipo === 'eliminar'
          ? <>La emisión {confirmacion?.emision.numero} ({ciclos.find(item => item.id === confirmacion?.emision.ciclo_id)?.nombre || 'ciclo sin nombre'}) de {confirmacion?.nombre} se enviará a la papelera de Drive. Su enlace dejará de funcionar y el registro quedará en auditoría. Esta acción no afecta la emisión vigente.</>
          : <>El enlace de {confirmacion?.nombre} dejará de abrir la carpeta. Los archivos permanecerán en Drive.</>}
      type={confirmacion?.tipo === 'enlace' ? 'warning' : 'danger'}
      confirmText={confirmacion?.tipo === 'enlace' ? 'Habilitar enlace'
        : confirmacion?.tipo === 'eliminar' ? 'Enviar a papelera' : 'Revocar acceso'}
      onConfirm={confirmar} onCancel={() => setConfirmacion(null)} />
    {mensajeAbierto && <ModalMensajeComunicado nombre={mensajeAbierto.nombre}
      textoInicial={mensajeAbierto.texto} enlace={mensajeAbierto.enlace}
      avisoIngles={mensajeAbierto.avisoIngles} inglesRegistrado={mensajeAbierto.inglesRegistrado}
      materiasIngles={mensajeAbierto.materiasIngles}
      cerrar={() => setMensajeAbierto(null)} />}
  </div>;
}
