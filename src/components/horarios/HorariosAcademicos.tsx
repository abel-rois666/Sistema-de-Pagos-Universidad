import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Download, FileSpreadsheet, FileText, Loader2, RefreshCw, Save, WandSparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { formatCicloEscolar } from '../../utils/formatUtils';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import PanelCargasHorario from './PanelCargasHorario';
import CuadriculaHorario from './CuadriculaHorario';
import SelectorVistaHorario from './SelectorVistaHorario';
import RepartoHorasMixto from './RepartoHorasMixto';
import PanelPropuestasHorario from './PanelPropuestasHorario';
import EditorHorarioBorrador from './EditorHorarioBorrador';
import PanelEdicionAsignacion from './PanelEdicionAsignacion';
import PoliticaHorarioPanel, { type ResumenPoliticaHorario } from './PoliticaHorarioPanel';
import GuiaDesbloqueoHorario from './GuiaDesbloqueoHorario';
import AsistenteIAHorario from './AsistenteIAHorario';
import PanelBorradoresHorario from './PanelBorradoresHorario';
import { crearContenidoBorrador, firmaContenidoBorrador, recuperarContenidoBorrador } from '../../horarios/borradores';
import { eliminarBorradorHorario, guardarBorradorHorario, listarBorradoresHorario,
  type BorradorHorarioGuardado } from '../../horarios/borradoresService';
import type { AccionDesbloqueo } from '../../horarios/orientacionHorario';
import type { EscenarioAsesoriaHorario, EstadoAsesoriaHorario } from '../../horarios/asesoriaIA';
import { docentesElegibles, validarEntradas, validarSesiones } from '../../horarios/motor';
import type { ResultadoAsignacionAutomatica, DetalleAsignacionAutomatica } from '../../horarios/asignacionAutomatica';
import type { ResultadoOptimizacionHorario } from '../../horarios/optimizacionHorario';
import type { PropuestaHorario } from '../../horarios/evaluacionHorario';
import { useBusquedaHorario } from '../../hooks/useBusquedaHorario';
import { seccionesCuadriculaHorario } from '../../horarios/cuadricula';
import { ordenarGruposHorario } from '../../horarios/ordenGruposHorario';
import { aplicarHorasPresencialesMasivas } from '../../horarios/horasMasivas';
import { revisarAjusteManual } from '../../horarios/ajusteManual';
import { incumplimientosEstrictos, type PoliticaHorario } from '../../horarios/politicaHorario';
import { esMateriaComplementaria, prepararBorradorHorario, seleccionCompletaHorario } from '../../horarios/seleccion';
import { crearDocxHorario, crearPdfHorario, type VistaHorario } from '../../horarios/exportar';
import { cargarDatosHorario, guardarUbicacionGrupo, publicarHorario, type DatosHorario } from '../../horarios/service';
import { incidenciaSuave, type CargaHorario, type ConfiguracionHorario, type EntradaHorario, type GrupoHorario, type IncidenciaHorario, type SesionHorario } from '../../horarios/types';
import { agruparVacantes, esVacante, siguienteVacante, vacantesDeLicenciatura } from '../../horarios/vacantes';
import { probarCambioDocente, repararAsignacionLocal, type CambioLocalHorario } from '../../horarios/edicionLocal';

const descargar = (archivo: Blob, nombre: string) => {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a'); enlace.href = url; enlace.download = nombre; enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const snapshotBorrador = (entrada: EntradaHorario, seleccionados: string[]) => JSON.stringify([
  { ...entrada, grupos: entrada.grupos.map(({ aula: _aula, sede: _sede, ...grupo }) => grupo) },
  [...seleccionados].sort(),
]);

export default function HorariosAcademicos() {
  const cicloGlobalId = useAppStore(state => state.activeCicloId);
  const ciclos = useAppStore(state => state.ciclos);
  const [cicloId, setCicloId] = useState(cicloGlobalId);
  const cicloInicializado = useRef(Boolean(cicloGlobalId));
  const solicitudCarga = useRef(0);
  const [cicloPendiente, setCicloPendiente] = useState<string | null>(null);
  const [confirmarActualizacion, setConfirmarActualizacion] = useState(false);
  const [snapshotCargado, setSnapshotCargado] = useState('');
  const [snapshotCargasFijas, setSnapshotCargasFijas] = useState('');
  const [snapshotCargasIncluidas, setSnapshotCargasIncluidas] = useState('');
  const [datos, setDatos] = useState<DatosHorario | null>(null);
  const [entrada, setEntrada] = useState<EntradaHorario | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [cargasIncluidas, setCargasIncluidas] = useState<Set<string>>(new Set());
  const [omitirComplementarias, setOmitirComplementarias] = useState(false);
  const complementariasPrevias = useRef<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false);
  const [error, setError] = useState('');
  const [sesiones, setSesiones] = useState<SesionHorario[]>([]);
  const [sesionesOriginales, setSesionesOriginales] = useState<SesionHorario[]>([]);
  const [entradaOriginal, setEntradaOriginal] = useState<EntradaHorario | null>(null);
  const [estadosAnteriores, setEstadosAnteriores] = useState<{ entrada: EntradaHorario; sesiones: SesionHorario[]; cargasFijas: Set<string>; vista: VistaHorario }[]>([]);
  const [estadosSiguientes, setEstadosSiguientes] = useState<{ entrada: EntradaHorario; sesiones: SesionHorario[]; cargasFijas: Set<string>; vista: VistaHorario }[]>([]);
  const [cargaEnEdicion, setCargaEnEdicion] = useState<string | null>(null);
  const [cambioLocalPendiente, setCambioLocalPendiente] = useState<CambioLocalHorario | null>(null);
  const [asignacionPendiente, setAsignacionPendiente] = useState<{ cargaId: string; docenteId: string; motivo: string } | null>(null);
  const [ajusteActivo, setAjusteActivo] = useState(false);
  const [confirmarDescarteAjuste, setConfirmarDescarteAjuste] = useState(false);
  const [motivoDescarteAjuste, setMotivoDescarteAjuste] = useState('Esta acción descartará los ajustes manuales del horario.');
  const accionTrasConfirmar = useRef<(() => void) | null>(null);
  const [generado, setGenerado] = useState(false);
  const [vistaPublicada, setVistaPublicada] = useState(false);
  const [incidencias, setIncidencias] = useState<IncidenciaHorario[]>([]);
  const [vista, setVista] = useState<VistaHorario>({ tipo: 'grupos' });
  const [ubicacionesEditadas, setUbicacionesEditadas] = useState<Record<string, { aula: string; sede: string }>>({});
  const [modo, setModo] = useState<'manual' | 'automatico'>('manual');
  const [politica, setPolitica] = useState<PoliticaHorario>('flexible');
  const [comparacionPoliticas, setComparacionPoliticas] = useState<Partial<Record<PoliticaHorario, ResumenPoliticaHorario>>>({});
  const entradaComparacion = useRef<EntradaHorario | null>(null);
  const [permitirNoPreferidas, setPermitirNoPreferidas] = useState(false);
  const [permitirVacantes, setPermitirVacantes] = useState(false);
  const [cargasFijas, setCargasFijas] = useState<Set<string>>(new Set());
  const [cargasFijasOriginales, setCargasFijasOriginales] = useState<Set<string>>(new Set());
  const [detalleAutomatico, setDetalleAutomatico] = useState<Record<string, DetalleAsignacionAutomatica>>({});
  const { buscar: buscarHorario, cancelar: cancelarBusqueda, buscando: generandoAutomatico, avance } = useBusquedaHorario();
  const [propuestas, setPropuestas] = useState<PropuestaHorario[]>([]);
  const [propuestaSeleccionada, setPropuestaSeleccionada] = useState(0);
  const [resumenBusqueda, setResumenBusqueda] = useState({ exhaustiva: false, soluciones: 0 });
  const [busquedaAmpliadaUsada, setBusquedaAmpliadaUsada] = useState(false);
  const [modoHorasMixto, setModoHorasMixto] = useState<'individual' | 'iguales'>('individual');
  const [horasComunes, setHorasComunes] = useState('1');
  const [borradoresGuardados, setBorradoresGuardados] = useState<BorradorHorarioGuardado[]>([]);
  const [borradorActivoId, setBorradorActivoId] = useState<string | null>(null);
  const [nombreBorradorActivo, setNombreBorradorActivo] = useState('');
  const [firmaBorradorGuardado, setFirmaBorradorGuardado] = useState('');
  const [ocupadoBorradores, setOcupadoBorradores] = useState(false);
  const [errorBorradores, setErrorBorradores] = useState('');
  const [abrirBorradorPendiente, setAbrirBorradorPendiente] = useState<BorradorHorarioGuardado | null>(null);
  const [eliminarBorradorPendiente, setEliminarBorradorPendiente] = useState<BorradorHorarioGuardado | null>(null);
  const [confirmarAbrirPublicada, setConfirmarAbrirPublicada] = useState(false);

  const limpiarPropuestas = () => { setPropuestas([]); setPropuestaSeleccionada(0);
    setResumenBusqueda({ exhaustiva: false, soluciones: 0 }); };

  const ciclosOrdenados = useMemo(() => [...ciclos].sort((a, b) =>
    b.nombre.localeCompare(a.nombre, 'es', { numeric: true })
    || formatCicloEscolar(a).localeCompare(formatCicloEscolar(b), 'es')), [ciclos]);

  useEffect(() => {
    if (!cicloInicializado.current && cicloGlobalId) {
      cicloInicializado.current = true;
      setCicloId(cicloGlobalId);
    }
  }, [cicloGlobalId]);

  const cargar = async () => {
    if (!cicloId) return;
    const solicitud = ++solicitudCarga.current;
    setCargando(true); setError('');
    setDatos(null); setEntrada(null); setSesiones([]); setIncidencias([]);
    setSesionesOriginales([]); setEntradaOriginal(null); setEstadosAnteriores([]); setEstadosSiguientes([]); setAjusteActivo(false);
    setCargaEnEdicion(null); setCambioLocalPendiente(null); setAsignacionPendiente(null);
    limpiarPropuestas();
    setBusquedaAmpliadaUsada(false);
    setComparacionPoliticas({}); entradaComparacion.current = null;
    setSeleccionados([]); setUbicacionesEditadas({}); setSnapshotCargado('');
    setSnapshotCargasFijas('');
    setSnapshotCargasIncluidas(''); setCargasIncluidas(new Set());
    setOmitirComplementarias(false); complementariasPrevias.current = new Set();
    setVistaPublicada(false); setGenerado(false);
    setModoHorasMixto('individual'); setHorasComunes('1');
    setModo('manual'); setPolitica('flexible'); setPermitirVacantes(false); setPermitirNoPreferidas(false);
    setDetalleAutomatico({}); setCargasFijas(new Set()); setCargasFijasOriginales(new Set());
    setBorradoresGuardados([]); setBorradorActivoId(null); setNombreBorradorActivo('');
    setFirmaBorradorGuardado(''); setErrorBorradores('');
    try {
      const resultado = await cargarDatosHorario(cicloId);
      if (solicitud !== solicitudCarga.current) return;
      setDatos(resultado); setEntrada(resultado.entrada);
      setSeleccionados(resultado.entrada.grupos.map(g => g.id));
      const incluidas = resultado.entrada.cargas.map(carga => carga.id);
      setCargasIncluidas(new Set(incluidas)); setSnapshotCargasIncluidas(JSON.stringify(incluidas.sort()));
      setSnapshotCargado(snapshotBorrador(resultado.entrada, resultado.entrada.grupos.map(g => g.id)));
      setSesiones([]); setIncidencias([]); setVistaPublicada(false); setGenerado(false);
      setVista({ tipo: 'grupos' });
      const fijas = resultado.entrada.cargas.filter(carga => !!carga.docenteId).map(carga => carga.id);
      setCargasFijas(new Set(fijas)); setSnapshotCargasFijas(JSON.stringify(fijas.sort()));
      setUbicacionesEditadas(Object.fromEntries(resultado.entrada.grupos.map(g => [g.id, { aula: g.aula || '', sede: g.sede || '' }])));
      try {
        const disponibles = await listarBorradoresHorario(cicloId);
        if (solicitud === solicitudCarga.current) setBorradoresGuardados(disponibles);
      } catch (e) { if (solicitud === solicitudCarga.current)
        setErrorBorradores(e instanceof Error ? e.message : 'No se pudieron consultar los borradores.'); }
    } catch (e) { if (solicitud === solicitudCarga.current) { setDatos(null); setEntrada(null); setError(e instanceof Error ? e.message : String(e)); } }
    finally { if (solicitud === solicitudCarga.current) setCargando(false); }
  };
  useEffect(() => {
    if (cicloId) void cargar();
    else { setDatos(null); setEntrada(null); setCargando(false); setError(''); }
  }, [cicloId]);

  const gruposSeleccionados = useMemo(() => new Set(seleccionados), [seleccionados]);
  const borrador = useMemo(() => entrada
    ? prepararBorradorHorario(entrada, gruposSeleccionados, cargasIncluidas) : null,
  [entrada, gruposSeleccionados, cargasIncluidas]);
  const grupos = useMemo(() => ordenarGruposHorario(borrador?.grupos || []), [borrador]);
  const gruposDelCiclo = useMemo(() => ordenarGruposHorario(entrada?.grupos || []), [entrada]);
  const cargas = borrador?.cargas || [];
  const cantidadVacantes = cargas.filter(carga => esVacante(carga.docenteId)).length;
  const horarioAjustado = generado && (JSON.stringify(sesiones) !== JSON.stringify(sesionesOriginales)
    || JSON.stringify(entrada?.cargas.map(c => [c.id, c.docenteId]))
      !== JSON.stringify(entradaOriginal?.cargas.map(c => [c.id, c.docenteId])));
  const cargasVisibles = useMemo(() => entrada?.cargas.filter(carga => gruposSeleccionados.has(carga.grupoId)) || [],
    [entrada, gruposSeleccionados]);
  const seleccionCompleta = !!entrada && seleccionCompletaHorario(entrada, gruposSeleccionados, cargasIncluidas);
  const entradaVista = vistaPublicada ? datos?.publicado?.entrada : borrador;
  const seccionesVista = useMemo(() => entradaVista && datos
    ? seccionesCuadriculaHorario(entradaVista, sesiones, datos.ciclo.nombre, vista) : [],
  [entradaVista, sesiones, datos, vista]);
  const cantidadMixtas = cargas.filter(carga => grupos.some(grupo => grupo.id === carga.grupoId && grupo.turno === 'MIXTO')).length;
  const preflight = useMemo(() => borrador ? validarEntradas(borrador) : [], [borrador]);
  const bloqueosGeneracion = modo === 'automatico'
    ? preflight.filter(incidencia => !['SIN_DOCENTE', 'DOCENTE_NO_ELEGIBLE', 'MAX_TRES_MATERIAS', 'CUPO_DOCENTE_EXCEDIDO'].includes(incidencia.codigo))
    : preflight;
  const ubicacionEditada = (g: GrupoHorario) => {
    const editada = ubicacionesEditadas[g.id];
    return editada && (editada.aula.trim() !== (g.aula || '').trim() || editada.sede.trim() !== (g.sede || '').trim());
  };
  const ubicacionesPendientes = grupos.some(ubicacionEditada);
  const ubicacionesSinGuardar = entrada?.grupos.some(ubicacionEditada) || false;
  const contenidoBorradorActual = useMemo(() => entrada && datos && !vistaPublicada
    ? crearContenidoBorrador(datos.entrada, entrada, {
      gruposSeleccionados: seleccionados, cargasIncluidas: [...cargasIncluidas],
      ubicacionesEditadas, sesiones: generado ? sesiones : [], modo, politica,
      permitirVacantes, permitirNoPreferidas, cargasFijas: [...cargasFijas], omitirComplementarias,
    }) : null, [entrada, datos, vistaPublicada, seleccionados, cargasIncluidas, ubicacionesEditadas,
    generado, sesiones, modo, politica, permitirVacantes, permitirNoPreferidas, cargasFijas, omitirComplementarias]);
  const firmaBorradorActual = useMemo(() => contenidoBorradorActual
    ? firmaContenidoBorrador(contenidoBorradorActual) : '', [contenidoBorradorActual]);
  const borradorSinGuardarPrevio = !!entrada && (
    snapshotBorrador(entrada, seleccionados) !== snapshotCargado
    || JSON.stringify([...cargasFijas].sort()) !== snapshotCargasFijas
    || JSON.stringify([...cargasIncluidas].sort()) !== snapshotCargasIncluidas
    || modo !== 'manual' || politica !== 'flexible' || permitirVacantes || permitirNoPreferidas
    || omitirComplementarias
    || ubicacionesSinGuardar || (!vistaPublicada && (sesiones.length > 0 || incidencias.length > 0 || propuestas.length > 0))
  );
  const borradorSinGuardar = !vistaPublicada && (borradorActivoId
    ? firmaBorradorActual !== firmaBorradorGuardado : borradorSinGuardarPrevio);
  const limpiarEdicionManual = () => {
    setAjusteActivo(false); setSesionesOriginales([]); setEntradaOriginal(null);
    setEstadosAnteriores([]); setEstadosSiguientes([]); setCargaEnEdicion(null);
    setCambioLocalPendiente(null); setAsignacionPendiente(null);
  };
  const antesDeDescartarAjuste = (accion: () => void, motivo?: string) => {
    if (!horarioAjustado) { accion(); return; }
    accionTrasConfirmar.current = accion;
    setMotivoDescarteAjuste(motivo || 'Esta acción descartará los ajustes manuales del horario.');
    setConfirmarDescarteAjuste(true);
  };
  const invalidarHorario = (conservarComparacion = false) => {
    setSesiones([]); setIncidencias([]); setVistaPublicada(false); setGenerado(false);
    limpiarPropuestas(); limpiarEdicionManual();
    setBusquedaAmpliadaUsada(false);
    if (!conservarComparacion) { setComparacionPoliticas({}); entradaComparacion.current = null; }
  };
  const aplicarCiclo = (nuevoId: string) => {
    solicitudCarga.current += 1;
    cicloInicializado.current = true;
    setDatos(null); setEntrada(null); setSesiones([]); setIncidencias([]);
    limpiarEdicionManual();
    limpiarPropuestas();
    setBusquedaAmpliadaUsada(false);
    setComparacionPoliticas({}); entradaComparacion.current = null;
    setSeleccionados([]); setUbicacionesEditadas({}); setSnapshotCargado('');
    setSnapshotCargasFijas(''); setCargasFijas(new Set()); setCargasFijasOriginales(new Set()); setDetalleAutomatico({});
    setSnapshotCargasIncluidas(''); setCargasIncluidas(new Set());
    setOmitirComplementarias(false); complementariasPrevias.current = new Set();
    setModo('manual'); setPolitica('flexible'); setPermitirVacantes(false); setPermitirNoPreferidas(false);
    setVistaPublicada(false); setGenerado(false); setError('');
    setBorradoresGuardados([]); setBorradorActivoId(null); setNombreBorradorActivo('');
    setFirmaBorradorGuardado(''); setErrorBorradores('');
    setCicloId(nuevoId);
  };
  const cambiarCiclo = (nuevoId: string) => {
    if (nuevoId === cicloId || cargando || guardando || guardandoUbicacion || exportando || generandoAutomatico || ocupadoBorradores) return;
    if (borradorSinGuardar) setCicloPendiente(nuevoId);
    else aplicarCiclo(nuevoId);
  };
  const actualizar = () => {
    if (cargando || guardando || guardandoUbicacion || exportando || generandoAutomatico || ocupadoBorradores || !cicloId) return;
    if (borradorSinGuardar) setConfirmarActualizacion(true);
    else void cargar();
  };
  const cambiarCargaDirecto = (id: string, cambio: Partial<CargaHorario>) => {
    setEntrada(prev => prev && ({ ...prev, cargas: prev.cargas.map(c => c.id === id ? { ...c, ...cambio } : c) }));
    invalidarHorario();
    setDetalleAutomatico(prev => { const siguiente = { ...prev }; delete siguiente[id]; return siguiente; });
  };
  const cambiarCarga = (id: string, cambio: Partial<CargaHorario>) => {
    if (generandoAutomatico) return;
    antesDeDescartarAjuste(() => cambiarCargaDirecto(id, cambio));
  };
  const seleccionarDocente = (cargaId: string, docenteId: string | null) => {
    if (generandoAutomatico) return;
    if (generado && !vistaPublicada && borrador && docenteId) {
      const resultado = probarCambioDocente(borrador, sesiones, cargaId, docenteId, politica);
      if (typeof resultado === 'string') {
        setCambioLocalPendiente(null);
        setAsignacionPendiente({ cargaId, docenteId, motivo: resultado });
      }
      else { setAsignacionPendiente(null); setCambioLocalPendiente(resultado); }
      setCargaEnEdicion(cargaId);
      window.setTimeout(() => document.getElementById('edicion-asignacion-horario')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      return;
    }
    antesDeDescartarAjuste(() => {
      cambiarCargaDirecto(cargaId, { docenteId });
      setCargasFijas(actual => {
        const siguiente = new Set(actual);
        if (docenteId) siguiente.add(cargaId); else siguiente.delete(cargaId);
        return siguiente;
      });
    });
  };
  const editarCarga = (cargaId: string) => {
    if (!generado || vistaPublicada) return;
    setCargaEnEdicion(cargaId); setCambioLocalPendiente(null); setAsignacionPendiente(null);
    window.setTimeout(() => document.getElementById('edicion-asignacion-horario')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };
  const reservarVacante = (cargaId: string) => {
    const carga = entrada?.cargas.find(item => item.id === cargaId);
    const grupo = entrada?.grupos.find(item => item.id === carga?.grupoId);
    if (!entrada || !grupo || !carga) return;
    const disponibles = [...vacantesDeLicenciatura(entrada, grupo), siguienteVacante(entrada, grupo)];
    const compatible = generado && borrador ? disponibles.find(id =>
      typeof probarCambioDocente(borrador, sesiones, cargaId, id, politica) !== 'string') : disponibles[0];
    seleccionarDocente(cargaId, compatible || disponibles.at(-1)!);
  };
  const alternarFijacion = (cargaId: string) => {
    if (generandoAutomatico) return;
    antesDeDescartarAjuste(() => {
      invalidarHorario();
      setCargasFijas(actual => {
        const siguiente = new Set(actual);
        if (siguiente.has(cargaId)) siguiente.delete(cargaId); else siguiente.add(cargaId);
        return siguiente;
      });
    });
  };
  const alternarMateria = (cargaId: string) => {
    if (generandoAutomatico) return;
    antesDeDescartarAjuste(() => {
      setCargasIncluidas(actual => {
        const siguiente = new Set(actual);
        if (siguiente.has(cargaId)) siguiente.delete(cargaId); else siguiente.add(cargaId);
        return siguiente;
      });
      invalidarHorario(); setDetalleAutomatico({});
    });
  };
  const cambiarOmisionComplementarias = (omitir: boolean) => {
    if (!entrada || generandoAutomatico) return;
    antesDeDescartarAjuste(() => {
      const ids = new Set(entrada.cargas.filter(esMateriaComplementaria).map(carga => carga.id));
      if (omitir) {
        complementariasPrevias.current = new Set([...cargasIncluidas].filter(id => ids.has(id)));
        setCargasIncluidas(actual => new Set([...actual].filter(id => !ids.has(id))));
      } else {
        const restaurar = complementariasPrevias.current;
        setCargasIncluidas(actual => new Set([...actual, ...restaurar]));
        complementariasPrevias.current = new Set();
      }
      setOmitirComplementarias(omitir);
      invalidarHorario(); setDetalleAutomatico({});
    });
  };
  const cambiarGrupos = (ids: string[]) => {
    if (generandoAutomatico) return;
    if (ids.length === seleccionados.length && ids.every(id => seleccionados.includes(id))) return;
    antesDeDescartarAjuste(() => {
      setSeleccionados(ids); invalidarHorario(); setDetalleAutomatico({});
    });
  };
  const aplicarHorasComunes = () => {
    if (!entrada || generandoAutomatico) return;
    antesDeDescartarAjuste(() => {
      try {
        const resultado = aplicarHorasPresencialesMasivas(entrada,
          horasComunes.trim() === '' ? NaN : Number(horasComunes), gruposSeleccionados, cargasIncluidas);
        setEntrada(resultado.entrada);
        invalidarHorario(); setDetalleAutomatico({});
        toast.success(`Se aplicaron ${horasComunes} horas presenciales a ${resultado.cantidad} materias Mixtas.`);
      } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo aplicar el reparto.'); }
    });
  };
  const cambiarGrupo = (id: string, cambio: Partial<GrupoHorario>) => {
    if (generandoAutomatico) return;
    setEntrada(prev => prev && ({ ...prev, grupos: prev.grupos.map(g => g.id === id ? { ...g, ...cambio } : g) }));
    invalidarHorario();
  };
  const cambiarPreferencia = (campo: keyof ConfiguracionHorario, valor: number) => {
    antesDeDescartarAjuste(() => {
      setEntrada(prev => prev && ({ ...prev, configuracion: { ...prev.configuracion, [campo]: valor } }));
      invalidarHorario();
    });
  };
  const contextoIncidencia = (incidencia: IncidenciaHorario) => [
    incidencia.docenteId && !esVacante(incidencia.docenteId) && `Docente: ${entrada?.docentes.find(d => d.id === incidencia.docenteId)?.nombre || incidencia.docenteId}`,
    incidencia.grupoId && `Grupo: ${entrada?.grupos.find(g => g.id === incidencia.grupoId)?.codigo || incidencia.grupoId}`,
    incidencia.cargaId && `Materia: ${entrada?.cargas.find(c => c.id === incidencia.cargaId)?.asignatura || incidencia.cargaId}`,
  ].filter(Boolean).join(' · ');
  const aplicarPropuesta = (propuesta: PropuestaHorario, indice: number,
    baseEntrada = entrada!, fijas = cargasFijas) => {
    const agrupada = agruparVacantes(propuesta.entrada, propuesta.sesiones);
    const asignadas = new Map(agrupada.entrada.cargas.map(carga => [carga.id, carga]));
    const siguiente = { ...baseEntrada, cargas: baseEntrada.cargas.map(carga => asignadas.get(carga.id) || carga) };
    setEntrada(siguiente); setEntradaOriginal(siguiente);
    setDetalleAutomatico(Object.fromEntries(propuesta.detalle.map(detalle => [detalle.cargaId, detalle])));
    setSesiones(agrupada.sesiones);
    setIncidencias(revisarAjusteManual(agrupada.entrada, agrupada.sesiones));
    setSesionesOriginales(agrupada.sesiones);
    setCargasFijasOriginales(new Set(fijas));
    setEstadosAnteriores([]); setEstadosSiguientes([]);
    setAjusteActivo(false); setCargaEnEdicion(null); setCambioLocalPendiente(null); setAsignacionPendiente(null);
    setVistaPublicada(false); setGenerado(true); setPropuestaSeleccionada(indice);
    setVista(actual => actual.tipo === 'docentes' ? { tipo: 'docentes' } : actual);
  };
  const cambiarSesionesManual = (siguientes: SesionHorario[]) => {
    if (!borrador || !generado || vistaPublicada || guardando || exportando || guardandoUbicacion) return;
    setCargaEnEdicion(null); setCambioLocalPendiente(null); setAsignacionPendiente(null);
    setSesiones(siguientes);
    setEstadosAnteriores(actual => [...actual, { entrada: entrada!, sesiones, cargasFijas, vista }].slice(-30));
    setEstadosSiguientes([]);
    setIncidencias(revisarAjusteManual(borrador, siguientes));
  };
  const aplicarCambioLocal = () => {
    if (!cambioLocalPendiente || !entrada || !generado || vistaPublicada) return;
    const porId = new Map<string, CargaHorario>(cambioLocalPendiente.entrada.cargas.map(carga => [carga.id, carga]));
    const siguiente = { ...entrada, cargas: entrada.cargas.map(carga => porId.get(carga.id) || carga) };
    const docenteAnterior = entrada.cargas.find(c => c.id === cargaEnEdicion)?.docenteId;
    const docenteNuevo = porId.get(cargaEnEdicion!)?.docenteId;
    setEstadosAnteriores(actual => [...actual, { entrada, sesiones, cargasFijas, vista }].slice(-30));
    setEstadosSiguientes([]);
    setEntrada(siguiente); setSesiones(cambioLocalPendiente.sesiones);
    if (docenteAnterior && docenteNuevo) setVista(actual => actual.tipo === 'docentes' && actual.ids
      ? { ...actual, ids: [...new Set(actual.ids.map(id => id === docenteAnterior ? docenteNuevo : id))] }
      : actual);
    setIncidencias(cambioLocalPendiente.incidencias);
    setCargasFijas(actual => new Set([...actual, cargaEnEdicion!]));
    setDetalleAutomatico(actual => { const nuevo = { ...actual }; delete nuevo[cargaEnEdicion!]; return nuevo; });
    setCambioLocalPendiente(null); setAsignacionPendiente(null); setCargaEnEdicion(null);
    toast.success('Cambio aplicado al borrador. Puedes deshacerlo desde la mesa de ajustes.');
  };
  const repararCarga = (alcance: 'materia' | 'grupo') => {
    if (!borrador || !cargaEnEdicion || !generado || vistaPublicada) return;
    const docenteId = asignacionPendiente?.docenteId
      || cambioLocalPendiente?.entrada.cargas.find(c => c.id === cargaEnEdicion)?.docenteId
      || borrador.cargas.find(c => c.id === cargaEnEdicion)?.docenteId;
    if (!docenteId) return;
    const resultado = repararAsignacionLocal(borrador, sesiones, cargaEnEdicion, docenteId, politica, alcance);
    if (typeof resultado === 'string') {
      setCambioLocalPendiente(null); setAsignacionPendiente({ cargaId: cargaEnEdicion, docenteId, motivo: resultado });
    } else { setAsignacionPendiente(null); setCambioLocalPendiente(resultado); }
  };
  const deshacerAjuste = () => {
    if (!estadosAnteriores.length) return;
    setCargaEnEdicion(null); setCambioLocalPendiente(null); setAsignacionPendiente(null);
    const anterior = estadosAnteriores.at(-1)!;
    setEstadosAnteriores(actual => actual.slice(0, -1));
    setEstadosSiguientes(actual => [...actual, { entrada: entrada!, sesiones, cargasFijas, vista }]);
    setEntrada(anterior.entrada); setSesiones(anterior.sesiones); setCargasFijas(anterior.cargasFijas); setVista(anterior.vista);
    const parcial = prepararBorradorHorario(anterior.entrada, gruposSeleccionados, cargasIncluidas);
    setIncidencias(revisarAjusteManual(parcial, anterior.sesiones));
  };
  const rehacerAjuste = () => {
    if (!estadosSiguientes.length) return;
    setCargaEnEdicion(null); setCambioLocalPendiente(null); setAsignacionPendiente(null);
    const siguiente = estadosSiguientes.at(-1)!;
    setEstadosSiguientes(actual => actual.slice(0, -1));
    setEstadosAnteriores(actual => [...actual, { entrada: entrada!, sesiones, cargasFijas, vista }].slice(-30));
    setEntrada(siguiente.entrada); setSesiones(siguiente.sesiones); setCargasFijas(siguiente.cargasFijas); setVista(siguiente.vista);
    const parcial = prepararBorradorHorario(siguiente.entrada, gruposSeleccionados, cargasIncluidas);
    setIncidencias(revisarAjusteManual(parcial, siguiente.sesiones));
  };
  const restaurarPropuesta = () => antesDeDescartarAjuste(() => {
    if (!entradaOriginal) return;
    const parcial = prepararBorradorHorario(entradaOriginal, gruposSeleccionados, cargasIncluidas);
    setEntrada(entradaOriginal); setSesiones(sesionesOriginales);
    setCargasFijas(new Set(cargasFijasOriginales));
    setVista(actual => ({ tipo: actual.tipo }));
    setIncidencias(revisarAjusteManual(parcial, sesionesOriginales));
    setEstadosAnteriores([]); setEstadosSiguientes([]);
    setCargaEnEdicion(null); setCambioLocalPendiente(null); setAsignacionPendiente(null);
    toast.success('Se restauró la propuesta original.');
  }, 'Se perderán los movimientos y divisiones manuales de esta propuesta.');
  const elegirPropuesta = (indice: number) => {
    if (indice === propuestaSeleccionada) return;
    antesDeDescartarAjuste(() => aplicarPropuesta(propuestas[indice], indice),
      'Cambiar de propuesta descartará los movimientos y divisiones manuales del horario actual.');
  };
  const adoptarAsesoria = ({ escenario, resultado }: { escenario: EscenarioAsesoriaHorario;
    resultado: ResultadoOptimizacionHorario | ResultadoAsignacionAutomatica }) => {
    const mejor = resultado.propuestas[0];
    if (!mejor || !borrador || vistaPublicada || guardando || generandoAutomatico) return;
    const conflictos = validarSesiones(mejor.sesiones, mejor.entrada).filter(i => !incidenciaSuave(i));
    if (conflictos.length || (politica === 'estricto' && incumplimientosEstrictos(mejor.incidencias).length))
      return toast.error('El ensayo ya no cumple las restricciones actuales. Vuelve a generar.');
    antesDeDescartarAjuste(() => {
      const entradaEscenario = { ...entrada!, configuracion: escenario.entrada.configuracion };
      setPermitirVacantes(escenario.permitirVacantes);
      setPermitirNoPreferidas(escenario.permitirNoPreferidas);
      setCargasFijas(new Set(escenario.cargasFijas));
      setBusquedaAmpliadaUsada(escenario.busquedaAmpliada);
      entradaComparacion.current = escenario.entrada;
      setPropuestas(resultado.propuestas);
      setResumenBusqueda({ exhaustiva: resultado.busquedaExhaustiva,
        soluciones: resultado.solucionesEvaluadas });
      setComparacionPoliticas({ [politica]: { metricas: mejor.metricas,
        exhaustiva: resultado.busquedaExhaustiva, soluciones: resultado.solucionesEvaluadas } });
      aplicarPropuesta(mejor, 0, entradaEscenario, new Set(escenario.cargasFijas));
      toast.success('Se aplicó el escenario comprobado al borrador. Revisa el resultado antes de publicar.');
    }, 'Usar este escenario reemplazará el horario actual y descartará sus ajustes manuales.');
  };
  const generar = async (busquedaAmpliada = false) => {
    if (!borrador || !grupos.length || generandoAutomatico) return toast.error('Selecciona al menos un grupo.');
    if (ubicacionesPendientes) return toast.error('Guarda las sedes y aulas editadas antes de generar.');
    const anterior = { propuestas, propuestaSeleccionada, resumenBusqueda, sesiones,
      incidencias, generado, vistaPublicada, busquedaAmpliadaUsada };
    setBusquedaAmpliadaUsada(busquedaAmpliada);
    limpiarPropuestas();
    setVistaPublicada(false); setGenerado(false); setSesiones([]); setIncidencias([]);
    try {
      if (!entradaComparacion.current) entradaComparacion.current = borrador;
      const resultado: ResultadoOptimizacionHorario | ResultadoAsignacionAutomatica = await buscarHorario({
        modo, politica, entrada: entradaComparacion.current, permitirNoPreferidas, permitirVacantes,
        cargasFijas: [...cargasFijas], busquedaAmpliada,
      });
      setPropuestas(resultado.propuestas);
      setComparacionPoliticas(actual => ({ ...actual, [politica]: {
        metricas: resultado.propuestas[0]?.metricas || null,
        exhaustiva: resultado.busquedaExhaustiva, soluciones: resultado.solucionesEvaluadas,
      } }));
      setResumenBusqueda({ exhaustiva: resultado.busquedaExhaustiva, soluciones: resultado.solucionesEvaluadas });
      setVista({ tipo: 'grupos' });
      if (resultado.propuestas.length) {
        aplicarPropuesta(resultado.propuestas[0], 0);
        toast.success(`${resultado.propuestas.length} propuesta(s) para revisar; ${resultado.solucionesEvaluadas} horario(s) evaluados.`);
      } else {
        limpiarEdicionManual();
        if ('entrada' in resultado) {
          const asignadas = new Map(resultado.entrada.cargas.map(carga => [carga.id, carga]));
          setEntrada(prev => prev && ({ ...prev, cargas: prev.cargas.map(carga => asignadas.get(carga.id) || carga) }));
          setDetalleAutomatico(Object.fromEntries(resultado.detalle.map(detalle => [detalle.cargaId, detalle])));
        }
        setIncidencias(resultado.incidencias);
        toast.error(resultado.incidencias.some(i => i.codigo === 'BUSQUEDA_AGOTADA')
          ? 'Se agotó la búsqueda sin una propuesta completa. Revisa las incidencias.'
          : politica === 'estricto'
            ? 'No se encontró un horario que cumpla los límites diarios estrictos. Revisa las incidencias.'
            : 'No se encontró un horario completo con las restricciones actuales.');
      }
    } catch (error) {
      setPropuestas(anterior.propuestas); setPropuestaSeleccionada(anterior.propuestaSeleccionada);
      setResumenBusqueda(anterior.resumenBusqueda); setSesiones(anterior.sesiones);
      setIncidencias(anterior.incidencias); setGenerado(anterior.generado);
      setVistaPublicada(anterior.vistaPublicada);
      setBusquedaAmpliadaUsada(anterior.busquedaAmpliadaUsada);
      if (error instanceof Error && error.message === 'BUSQUEDA_CANCELADA') toast('Búsqueda cancelada; se conservó el horario anterior.');
      else toast.error(error instanceof Error ? error.message : 'No se pudo buscar el horario.');
    }
  };
  const publicar = async () => {
    if (!borrador || !datos || !cicloId || !generado || vistaPublicada || generandoAutomatico) return;
    if (ubicacionesPendientes) return toast.error('Guarda las sedes y aulas editadas antes de publicar.');
    if (cantidadVacantes) return toast.error('Asigna un docente activo a todas las vacantes antes de publicar.');
    if (!entrada || !seleccionCompleta) return toast.error('La publicación requiere todos los grupos y materias no complementarias del ciclo. Puedes exportar esta selección como borrador parcial.');
    const errores = validarSesiones(sesiones, borrador).filter(i => !incidenciaSuave(i));
    if (errores.length) { setIncidencias(errores); return toast.error('La revisión final encontró conflictos.'); }
    if (politica === 'estricto') {
      const incumplimientos = incumplimientosEstrictos(revisarAjusteManual(borrador, sesiones));
      if (incumplimientos.length) {
        setIncidencias(incumplimientos);
        return toast.error('El horario incumple los límites diarios del modo estricto.');
      }
    }
    if (!datos.ciclo.fecha_inicio || !datos.ciclo.fecha_termino) return toast.error('Define las fechas exactas del ciclo antes de publicar.');
    setGuardando(true);
    try {
      await publicarHorario(cicloId, borrador, sesiones);
      toast.success('Horario publicado y docentes actualizados en una operación.');
      await cargar();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo publicar el horario.'); }
    finally { setGuardando(false); }
  };
  const exportar = async (formato: 'pdf' | 'docx' | 'xlsx') => {
    if (!entradaVista || !datos || (!generado && !vistaPublicada)) return toast.error('Genera o abre un horario antes de exportar.');
    if (!seccionesVista.length) return toast.error('Selecciona al menos un horario para exportar.');
    if (formato === 'xlsx' && vista.tipo !== 'docentes') return toast.error('Excel está disponible en la vista de docentes y vacantes.');
    setExportando(true);
    try {
      const variante = horarioAjustado ? '-ajustado' : propuestas.length > 1
        ? `-${propuestaSeleccionada === 0 ? 'recomendada' : 'alternativa'}` : '';
      const nombre = `horario-${datos.ciclo.nombre.replace(/[^a-z0-9-]+/gi, '-')}-${vista.tipo}${variante}${vista.ids ? '-seleccionados' : '-todos'}`;
      if (formato === 'pdf') crearPdfHorario(entradaVista, sesiones, datos.ciclo.nombre, vista).save(`${nombre}.pdf`);
      else if (formato === 'docx') descargar(await crearDocxHorario(entradaVista, sesiones, datos.ciclo.nombre, vista), `${nombre}.docx`);
      else {
        const { crearXlsxHorario } = await import('../../horarios/exportarXlsx');
        descargar(await crearXlsxHorario(entradaVista, sesiones, datos.ciclo.nombre, vista), `${nombre}.xlsx`);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo exportar el horario.'); }
    finally { setExportando(false); }
  };
  const guardarUbicacion = async (grupo: GrupoHorario) => {
    if (guardandoUbicacion || generandoAutomatico) return;
    const ubicacion = ubicacionesEditadas[grupo.id];
    if (!ubicacion) return;
    setGuardandoUbicacion(true);
    try {
      await guardarUbicacionGrupo(grupo.id, ubicacion.aula, ubicacion.sede);
      cambiarGrupo(grupo.id, { aula: ubicacion.aula || null, sede: ubicacion.sede || null });
      toast.success(`Ubicación de ${grupo.codigo} guardada.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se guardó la ubicación.'); }
    finally { setGuardandoUbicacion(false); }
  };
  const mostrarPublicada = () => {
    if (!datos?.publicado) return;
    limpiarEdicionManual(); limpiarPropuestas();
    setComparacionPoliticas({}); entradaComparacion.current = null;
    setSesiones(datos.publicado.sesiones); setVistaPublicada(true); setGenerado(false);
    setIncidencias([]); setVista({ tipo: 'grupos' });
  };
  const abrirPublicada = () => {
    if (borradorSinGuardar) setConfirmarAbrirPublicada(true);
    else mostrarPublicada();
  };
  const cambiarModo = (nuevoModo: 'manual' | 'automatico') => {
    if (nuevoModo === modo) return;
    antesDeDescartarAjuste(() => { setModo(nuevoModo); invalidarHorario(); });
  };
  const cambiarPolitica = (nuevaPolitica: PoliticaHorario) => {
    if (nuevaPolitica === politica) return;
    antesDeDescartarAjuste(() => {
      const originales = new Map(entradaComparacion.current?.cargas.map(carga => [carga.id, carga]) || []);
      if (originales.size) setEntrada(actual => actual && ({ ...actual,
        cargas: actual.cargas.map(carga => originales.get(carga.id) || carga),
      }));
      setPolitica(nuevaPolitica); invalidarHorario(true);
    },
      'Cambiar la política descartará el horario actual y sus ajustes manuales. Puedes volver a generarlo.');
  };
  const guardarBorrador = async (nombre: string, nuevo: boolean) => {
    if (!cicloId || !contenidoBorradorActual || ocupadoBorradores || generandoAutomatico) return;
    setOcupadoBorradores(true); setErrorBorradores('');
    try {
      const id = nuevo ? undefined : borradorActivoId || undefined;
      const version = borradoresGuardados.find(item => item.id === id)?.actualizado_en;
      const guardado = await guardarBorradorHorario(cicloId, nombre, contenidoBorradorActual, id, version);
      setBorradoresGuardados(actual => [guardado, ...actual.filter(item => item.id !== guardado.id)]);
      setBorradorActivoId(guardado.id); setNombreBorradorActivo(guardado.nombre);
      setFirmaBorradorGuardado(firmaBorradorActual);
      toast.success(nuevo || !id ? 'Borrador guardado.' : 'Borrador actualizado.');
    } catch (e) { const mensaje = e instanceof Error ? e.message : 'No se pudo guardar el borrador.';
      setErrorBorradores(mensaje); toast.error(mensaje); }
    finally { setOcupadoBorradores(false); }
  };
  const actualizarBorradores = async () => {
    if (!cicloId || ocupadoBorradores) return;
    setOcupadoBorradores(true); setErrorBorradores('');
    try { setBorradoresGuardados(await listarBorradoresHorario(cicloId)); }
    catch (e) { setErrorBorradores(e instanceof Error ? e.message : 'No se pudo actualizar la lista.'); }
    finally { setOcupadoBorradores(false); }
  };
  const abrirBorrador = (guardado: BorradorHorarioGuardado) => {
    if (!datos || guardado.ciclo_id !== cicloId) return;
    try {
      const recuperado = recuperarContenidoBorrador(datos.entrada, guardado.contenido);
      const agrupado = agruparVacantes(recuperado.entrada, recuperado.sesiones);
      const incluido = new Set(guardado.contenido.cargasIncluidas);
      const seleccion = new Set(guardado.contenido.gruposSeleccionados);
      const entradaParcial = prepararBorradorHorario(agrupado.entrada, seleccion, incluido);
      const errores = agrupado.sesiones.length
        ? validarSesiones(agrupado.sesiones, entradaParcial).filter(i => !incidenciaSuave(i)) : [];
      const sesionesRecuperadas = errores.length ? [] : agrupado.sesiones;
      setEntrada(agrupado.entrada); setSeleccionados(guardado.contenido.gruposSeleccionados);
      setCargasIncluidas(incluido); setUbicacionesEditadas(guardado.contenido.ubicacionesEditadas);
      setModo(guardado.contenido.modo); setPolitica(guardado.contenido.politica);
      setPermitirVacantes(guardado.contenido.permitirVacantes);
      setPermitirNoPreferidas(guardado.contenido.permitirNoPreferidas);
      setCargasFijas(new Set(guardado.contenido.cargasFijas));
      setCargasFijasOriginales(new Set(guardado.contenido.cargasFijas));
      setOmitirComplementarias(guardado.contenido.omitirComplementarias);
      setSesiones(sesionesRecuperadas); setSesionesOriginales(sesionesRecuperadas);
      setEntradaOriginal(agrupado.entrada);
      setGenerado(sesionesRecuperadas.length > 0); setVistaPublicada(false);
      setIncidencias(sesionesRecuperadas.length ? revisarAjusteManual(entradaParcial, sesionesRecuperadas) : []);
      setPropuestas([]); setPropuestaSeleccionada(0); setDetalleAutomatico({});
      setResumenBusqueda({ exhaustiva: false, soluciones: 0 });
      setEstadosAnteriores([]); setEstadosSiguientes([]); setAjusteActivo(false);
      setCargaEnEdicion(null); setCambioLocalPendiente(null); setAsignacionPendiente(null);
      setComparacionPoliticas({}); entradaComparacion.current = null;
      setVista({ tipo: 'grupos' }); setBorradorActivoId(guardado.id);
      setNombreBorradorActivo(guardado.nombre);
      setFirmaBorradorGuardado(firmaContenidoBorrador(guardado.contenido));
      if (recuperado.cambiado || errores.length) toast('Los datos académicos cambiaron o hay conflictos. Se recuperaron los ajustes; genera de nuevo antes de publicar.');
      else toast.success('Borrador recuperado.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo abrir el borrador.'); }
  };
  const borrarBorrador = async (guardado: BorradorHorarioGuardado) => {
    if (!cicloId || ocupadoBorradores) return;
    setOcupadoBorradores(true);
    try {
      await eliminarBorradorHorario(cicloId, guardado.id);
      setBorradoresGuardados(actual => actual.filter(item => item.id !== guardado.id));
      if (borradorActivoId === guardado.id) {
        setBorradorActivoId(null); setNombreBorradorActivo(''); setFirmaBorradorGuardado('');
      }
      toast.success('Borrador eliminado. El horario abierto permanece en pantalla.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo eliminar el borrador.'); }
    finally { setOcupadoBorradores(false); }
  };
  const orientarDesbloqueo = (accion: AccionDesbloqueo, cargaId?: string, incidenciaCodigo?: string) => {
    if (generandoAutomatico || guardando) return;
    if (accion === 'ampliar_busqueda') { void generar(true); return; }
    if (accion === 'liberar_docente' && cargaId) { alternarFijacion(cargaId); return; }
    if (accion === 'revisar_cargas' || accion === 'revisar_limites') {
      const campo = incidenciaCodigo === 'JORNADA_CORTA_GRUPO' ? 'minHorasGrupo'
        : incidenciaCodigo === 'JORNADA_CORTA_DOCENTE' ? 'minHorasDocente'
          : incidenciaCodigo === 'HUECO_GRUPO' ? 'maxHuecoGrupo'
            : incidenciaCodigo === 'HUECO_DOCENTE' ? 'maxHuecoDocente' : null;
      const destino = accion === 'revisar_limites' && campo
        ? document.getElementById(`horarios-${campo}`) : document.getElementById(accion === 'revisar_cargas'
          ? 'materias-docentes-horario' : 'limites-diarios-horario');
      destino?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (destino instanceof HTMLInputElement) destino.focus({ preventScroll: true });
      return;
    }
    if (accion === 'permitir_vacantes' || accion === 'permitir_no_preferidas') {
      const originales = new Map(entradaComparacion.current?.cargas.map(carga => [carga.id, carga]) || []);
      if (originales.size) setEntrada(actual => actual && ({ ...actual,
        cargas: actual.cargas.map(carga => originales.get(carga.id) || carga),
      }));
      if (accion === 'permitir_vacantes') setPermitirVacantes(true);
      else setPermitirNoPreferidas(true);
      invalidarHorario();
      toast.success('Opción activada. Vuelve a buscar para evaluar el horario.');
    }
  };

  const mostrarGuiaDesbloqueo = politica === 'estricto' && !generado && !vistaPublicada
    && (bloqueosGeneracion.length > 0 || incidencias.length > 0);
  const estadoAsesoria: EstadoAsesoriaHorario = {
    modo, politica, permitirVacantes, permitirNoPreferidas, cargasFijas, busquedaAmpliadaUsada,
    busquedaExhaustiva: resumenBusqueda.exhaustiva, generado,
    metricas: generado ? propuestas[propuestaSeleccionada]?.metricas || null : null,
  };
  const firmaAsesoria = JSON.stringify([cicloId, modo, politica, permitirVacantes,
    permitirNoPreferidas, [...cargasFijas].sort(), busquedaAmpliadaUsada, borrador,
    incidencias, sesiones, generado, resumenBusqueda, propuestas[propuestaSeleccionada]?.firma]);

  return <main className="min-h-full bg-[#f6f8fc] px-3 py-6 text-slate-900 sm:px-6 lg:px-10 dark:bg-[#090e19] dark:text-slate-100">
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7 dark:border-blue-950 dark:bg-[#162030]">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#1456f0] dark:text-blue-400">Coordinación Académica</span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: 'var(--font-display)' }}>Generador de horarios</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Configura la carga presencial, revisa la disponibilidad y genera horarios por grupo y docente para el ciclo seleccionado.</p>
          {datos && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"><CalendarDays size={14}/>{datos.ciclo.nombre} · {datos.ciclo.tipo_periodo || 'Periodo sin tipo'}</p>}</div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-64"><div><label htmlFor="horarios-ciclo" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">Ciclo para generar horarios</label><select id="horarios-ciclo" value={cicloId || ''} onChange={event => cambiarCiclo(event.target.value)} disabled={cargando || guardando || guardandoUbicacion || exportando || generandoAutomatico || ocupadoBorradores} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-[#1456f0] focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white"><option value="">Selecciona un ciclo...</option>{ciclosOrdenados.map(ciclo => <option key={ciclo.id} value={ciclo.id}>{formatCicloEscolar(ciclo)}</option>)}</select><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Esta elección no cambia el ciclo de la barra superior.</p></div><button onClick={actualizar} disabled={!cicloId || cargando || guardando || guardandoUbicacion || exportando || generandoAutomatico || ocupadoBorradores} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><RefreshCw size={16}/> Actualizar datos</button></div></div>
      </header>
      {!cicloId && <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">Selecciona un ciclo escolar aquí para consultar sus grupos y generar horarios.</div>}
      {cargando && <div className="flex items-center gap-2 rounded-xl bg-white p-5 text-sm dark:bg-[#1c2228]"><Loader2 className="animate-spin" size={18}/> Cargando datos académicos…</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><b>No se pudo cargar el módulo.</b> {error}<p className="mt-2 text-xs">Si faltan columnas o tablas de horarios, revisa la migración SQL preparada en el repositorio.</p></div>}
      {entrada && datos && <>
        <PanelBorradoresHorario borradores={borradoresGuardados} activoId={borradorActivoId}
          activoNombre={nombreBorradorActivo} bloqueado={guardando || exportando || guardandoUbicacion || generandoAutomatico}
          ocupado={ocupadoBorradores} error={errorBorradores} puedeGuardar={!vistaPublicada}
          onGuardar={(nombre, nuevo) => void guardarBorrador(nombre, nuevo)}
          onAbrir={guardado => { if (borradorSinGuardar) setAbrirBorradorPendiente(guardado); else abrirBorrador(guardado); }}
          onEliminar={setEliminarBorradorPendiente} onActualizar={() => void actualizarBorradores()}/>
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#182c4e] p-5 text-white"><p className="text-xs uppercase tracking-wider text-blue-200">Grupos incluidos</p><p className="mt-1 text-3xl font-bold">{grupos.length}<span className="text-base font-normal text-blue-200"> / {entrada.grupos.length}</span></p></div><div className="rounded-xl bg-[#1456f0] p-5 text-white"><p className="text-xs uppercase tracking-wider text-blue-100">Materias incluidas</p><p className="mt-1 text-3xl font-bold">{cargas.length}</p></div><div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]"><p className="text-xs uppercase tracking-wider text-slate-500">Horario publicado</p><p className="mt-1 text-xl font-bold">{datos.publicado ? `Versión ${datos.publicado.version}` : 'Aún no hay'}</p>{datos.publicado && <button disabled={generandoAutomatico || guardando || exportando} onClick={abrirPublicada} className="mt-2 text-xs font-semibold text-blue-700 underline dark:text-blue-300">Ver versión publicada</button>}</div></div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">1. Incluye u omite grupos</h2><p className="text-sm text-slate-500 dark:text-slate-400">Desmarca los grupos que no quieras en este borrador. Omitirlos no cambia sus registros. Para publicar se requieren todos los grupos y materias.</p></div><div className="flex gap-2 text-xs"><button disabled={generandoAutomatico} onClick={() => cambiarGrupos(entrada.grupos.map(g => g.id))} className="rounded-lg border px-3 py-1.5 dark:border-slate-600">Incluir todos</button><button disabled={generandoAutomatico} onClick={() => cambiarGrupos([])} className="rounded-lg border px-3 py-1.5 dark:border-slate-600">Omitir todos</button></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{gruposDelCiclo.map(g => { const u = ubicacionesEditadas[g.id] || {aula:'',sede:''}; return <div key={g.id} className={`rounded-xl border p-3 ${seleccionados.includes(g.id) ? 'border-blue-400 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700'}`}><label className="flex cursor-pointer items-center gap-2 font-semibold"><input type="checkbox" checked={seleccionados.includes(g.id)} disabled={generandoAutomatico} onChange={() => cambiarGrupos(seleccionados.includes(g.id) ? seleccionados.filter(id => id !== g.id) : [...seleccionados, g.id])} />{g.codigo}<span className="ml-auto text-xs font-normal text-slate-500 dark:text-slate-400">{seleccionados.includes(g.id) ? 'Incluido' : 'Omitido'}</span></label><p className="ml-5 text-xs text-slate-500">{g.turno} · {entrada.cargas.filter(c => c.grupoId === g.id && cargasIncluidas.has(c.id)).length} de {entrada.cargas.filter(c => c.grupoId === g.id).length} materias incluidas</p><div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-1.5"><input aria-label={`Sede ${g.codigo}`} placeholder="Sede opcional" value={u.sede} disabled={generandoAutomatico || !seleccionados.includes(g.id)} onChange={e => setUbicacionesEditadas(prev => ({...prev,[g.id]:{...u,sede:e.target.value}}))} className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"/><input aria-label={`Aula ${g.codigo}`} placeholder="Aula opcional" value={u.aula} disabled={generandoAutomatico || !seleccionados.includes(g.id)} onChange={e => setUbicacionesEditadas(prev => ({...prev,[g.id]:{...u,aula:e.target.value}}))} className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"/><button disabled={generandoAutomatico || guardandoUbicacion || !seleccionados.includes(g.id)} onClick={() => antesDeDescartarAjuste(() => void guardarUbicacion(g), 'Guardar la ubicación descartará los ajustes manuales del horario actual.')} title="Guardar sede y aula" aria-label={`Guardar ubicación de ${g.codigo}`} className="rounded-md bg-blue-100 p-1.5 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Save size={14}/></button></div></div>; })}</div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]">
          <h2 className="text-lg font-bold">Modo de generación</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ambos modos preparan un borrador revisable antes de publicarlo.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Modo de generación del horario">
            <label className={`cursor-pointer rounded-xl border p-4 ${modo === 'manual' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-300 dark:border-slate-600'}`}>
              <span className="flex items-center gap-2 font-semibold"><input type="radio" name="modo-horario" value="manual" checked={modo === 'manual'} disabled={generandoAutomatico} onChange={() => cambiarModo('manual')}/> Manual</span>
              <span className="mt-1 block pl-6 text-sm text-slate-600 dark:text-slate-300">Eliges docentes; el sistema acomoda las horas y valida conflictos.</span>
            </label>
            <label className={`cursor-pointer rounded-xl border p-4 ${modo === 'automatico' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-300 dark:border-slate-600'}`}>
              <span className="flex items-center gap-2 font-semibold"><input type="radio" name="modo-horario" value="automatico" checked={modo === 'automatico'} disabled={generandoAutomatico} onChange={() => cambiarModo('automatico')}/> Automático</span>
              <span className="mt-1 block pl-6 text-sm text-slate-600 dark:text-slate-300">Propone docentes y horas según disponibilidad y restricciones.</span>
            </label>
          </div>
          {modo === 'automatico' && <label className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
            <input type="checkbox" className="mt-1" checked={permitirNoPreferidas} disabled={generandoAutomatico}
              onChange={evento => antesDeDescartarAjuste(() => { setPermitirNoPreferidas(evento.target.checked); invalidarHorario(); })}/>
            <span><strong>Permitir materias no preferidas</strong><span className="block text-slate-600 dark:text-slate-300">Si se activa, considera docentes habilitados para el plan aunque no hayan elegido la materia como preferida. Siempre respeta su disponibilidad y grupos restringidos.</span></span>
          </label>}
          {modo === 'automatico' && <label className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
            <input type="checkbox" className="mt-1" checked={permitirVacantes} disabled={generandoAutomatico}
              onChange={evento => antesDeDescartarAjuste(() => { setPermitirVacantes(evento.target.checked); invalidarHorario(); })}/>
            <span><strong>Reservar vacantes cuando falte docente</strong><span className="block text-slate-600 dark:text-slate-300">Primero intenta asignar docentes elegibles. Si no puede ubicar una materia, reserva sus horas como VACANTE en el borrador. Podrás verlo y exportarlo, pero no publicarlo hasta asignar docente.</span></span>
          </label>}
        </section>
        <PoliticaHorarioPanel politica={politica} resultados={comparacionPoliticas}
          deshabilitado={generandoAutomatico || guardando || exportando} onCambiar={cambiarPolitica}/>
        <RepartoHorasMixto cantidad={cantidadMixtas} modo={modoHorasMixto} horas={horasComunes}
          deshabilitado={generandoAutomatico} onModo={setModoHorasMixto} onHoras={setHorasComunes}
          onAplicar={aplicarHorasComunes}/>
        <div id="materias-docentes-horario"><PanelCargasHorario entrada={entrada} grupos={grupos} cargas={cargasVisibles}
          cargasIncluidas={cargasIncluidas} omitirComplementarias={omitirComplementarias}
          onOmitirComplementarias={cambiarOmisionComplementarias} modo={modo}
          cargasFijas={cargasFijas} detalleAutomatico={detalleAutomatico} deshabilitado={generandoAutomatico}
          bloquearHorasIndividuales={modoHorasMixto === 'iguales'}
          onCambiarCarga={cambiarCarga} onSeleccionarDocente={seleccionarDocente}
          onReservarVacante={reservarVacante} onEditarCarga={editarCarga} puedeEditarBorrador={generado && !vistaPublicada}
          onAlternarFijacion={alternarFijacion} onAlternarMateria={alternarMateria}/></div>
        <section id="limites-diarios-horario" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="text-lg font-bold">3. Genera y revisa</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Cada hora dura 60 minutos; un bloque puede reunir varias horas. No hay receso obligatorio y se favorecen las jornadas de los grupos.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                ['maxHuecoGrupo', 'Hueco máx. grupo'], ['maxHuecoDocente', 'Hueco máx. docente'],
                ['minHorasGrupo', 'Mín. diario grupo'], ['minHorasDocente', 'Mín. diario docente'],
              ] as const).map(([campo, etiqueta]) => <label key={campo} className="text-xs font-medium">{etiqueta}
                <input id={`horarios-${campo}`} type="number" min={campo.startsWith('minHoras') ? 1 : 0} max="8" value={entrada.configuracion[campo] ?? 2}
                  disabled={generandoAutomatico} onChange={e => cambiarPreferencia(campo, Number(e.target.value))}
                  className="mt-1 block w-24 rounded-md border px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800"/>
              </label>)}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{politica === 'flexible'
            ? 'En Flexible, los mínimos y huecos son preferencias por día; se informan sin impedir publicar.'
            : 'En Estricto, los mínimos y huecos son límites obligatorios por día. Las vacantes solo se consideran si activas esa opción y no pueden publicarse.'}</p>
          {ubicacionesPendientes && <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Guarda las ubicaciones editadas antes de generar.</p>}
          {bloqueosGeneracion.length > 0 && !mostrarGuiaDesbloqueo && <div role="alert" className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <b>Datos por resolver ({bloqueosGeneracion.length})</b>
            {bloqueosGeneracion.slice(0, 12).map((incidencia, indice) => <p key={`${incidencia.codigo}-${indice}`}>• {incidencia.mensaje}</p>)}
            {bloqueosGeneracion.length > 12 && <p>…y {bloqueosGeneracion.length - 12} más.</p>}
          </div>}
          {modo === 'automatico' && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Las materias sin docente y las asignaciones liberadas se resuelven durante la búsqueda. Se conserva la mejor propuesta completa encontrada.</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => antesDeDescartarAjuste(() => void generar(), 'Volver a generar descartará los movimientos y divisiones manuales del horario actual.')}
              disabled={!grupos.length || bloqueosGeneracion.length > 0 || ubicacionesPendientes || generandoAutomatico || guardando}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1456f0] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {generandoAutomatico ? <Loader2 size={17} className="animate-spin"/> : <WandSparkles size={17}/>}
              {generandoAutomatico ? 'Comparando horarios…' : modo === 'automatico' ? 'Buscar mejor horario automático' : 'Buscar mejor horario manual'}
            </button>
            {generandoAutomatico && <button type="button" onClick={cancelarBusqueda}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"><X size={16}/> Cancelar búsqueda</button>}
            {generado && !vistaPublicada && <button onClick={() => void publicar()}
              disabled={guardando || generandoAutomatico || !seleccionCompleta || cantidadVacantes > 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
              <CheckCircle2 size={17}/>{guardando ? 'Publicando…' : 'Publicar horario'}
            </button>}
          </div>
          {generandoAutomatico && <p role="status" className="mt-2 text-sm text-blue-700 dark:text-blue-300">Horarios completos revisados: {avance.soluciones.toLocaleString('es-MX')}. Puedes cancelar y ajustar las restricciones.</p>}
          {!seleccionCompleta && <p className="mt-2 text-xs text-slate-500">Puedes generar y exportar este borrador parcial. Publicar exige incluir todos los grupos activos y sus materias no complementarias.</p>}
          {cantidadVacantes > 0 && <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-300">{cantidadVacantes} materia(s) con vacante. El borrador y sus exportaciones muestran los espacios reservados; asigna docentes activos y vuelve a generar para publicar.</p>}
          {mostrarGuiaDesbloqueo && <GuiaDesbloqueoHorario
              entrada={borrador!} incidencias={[...bloqueosGeneracion, ...incidencias]}
              modo={modo} permitirVacantes={permitirVacantes} permitirNoPreferidas={permitirNoPreferidas}
              cargasFijas={cargasFijas} busquedaAmpliadaUsada={busquedaAmpliadaUsada}
              bloqueado={generandoAutomatico || guardando || exportando} onAccion={orientarDesbloqueo}/>}
          <PanelPropuestasHorario propuestas={propuestas} seleccionada={propuestaSeleccionada}
            busquedaExhaustiva={resumenBusqueda.exhaustiva} solucionesEvaluadas={resumenBusqueda.soluciones}
            ajustado={horarioAjustado} deshabilitado={guardando || exportando || generandoAutomatico}
            onSeleccionar={elegirPropuesta}/>
          {incidencias.length > 0 && !mostrarGuiaDesbloqueo && <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700"><b>Resultado de la revisión ({incidencias.length})</b>
            {incidencias.map((i,n) => <div key={`${i.codigo}-${n}`} className={`rounded-lg px-3 py-2 ${incidenciaSuave(i)
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
              : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'}`}>
              {contextoIncidencia(i) && <p className="font-bold">{contextoIncidencia(i)}</p>}
              <p>{i.mensaje}</p>
            </div>)}
          </div>}
        </section>
        {!vistaPublicada && !horarioAjustado && !bloqueosGeneracion.length
          && (generado || incidencias.length > 0) && <div key={firmaAsesoria}><AsistenteIAHorario
            entrada={entradaComparacion.current || borrador!} incidencias={incidencias}
            estado={estadoAsesoria} deshabilitado={generandoAutomatico || guardando || exportando || ubicacionesPendientes}
            onAdoptar={adoptarAsesoria}/></div>}
        {generado && !vistaPublicada && cargaEnEdicion && <PanelEdicionAsignacion entrada={borrador!}
          sesiones={sesiones}
          cargaId={cargaEnEdicion}
          docenteId={asignacionPendiente?.docenteId || cambioLocalPendiente?.entrada.cargas.find(c => c.id === cargaEnEdicion)?.docenteId || ''}
          motivo={asignacionPendiente?.motivo || ''} propuesta={cambioLocalPendiente}
          bloqueado={guardando || exportando || guardandoUbicacion || generandoAutomatico || ubicacionesPendientes}
          onSeleccionar={id => seleccionarDocente(cargaEnEdicion, id)} onReparar={repararCarga}
          onAplicar={aplicarCambioLocal} onCerrar={() => {
            setCargaEnEdicion(null); setCambioLocalPendiente(null); setAsignacionPendiente(null);
          }}/>}
        {(generado || vistaPublicada) && <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold">Vista previa y descargas</h2>
              {horarioAjustado && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">Horario ajustado manualmente</p>}
              <p className="text-sm text-slate-500 dark:text-slate-400">Cuadrícula por día y hora con materias y docentes. Las horas asíncronas aparecen aparte.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={exportando || !seccionesVista.length} onClick={() => void exportar('pdf')}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300"><Download size={15}/> PDF</button>
              <button disabled={exportando || !seccionesVista.length} onClick={() => void exportar('docx')}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300"><FileText size={15}/> Word</button>
              {vista.tipo === 'docentes' && <button disabled={exportando || !seccionesVista.length} onClick={() => void exportar('xlsx')}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300"><FileSpreadsheet size={15}/> Excel (.xlsx)</button>}
            </div>
          </div>
          <SelectorVistaHorario entrada={entradaVista!} sesiones={sesiones} vista={vista} onCambiar={setVista}/>
          {generado && !vistaPublicada && <div className="mt-5"><EditorHorarioBorrador entrada={borrador!} sesiones={sesiones} politica={politica}
            vista={vista} onEditarCarga={editarCarga}
            activo={ajusteActivo} ajustado={horarioAjustado}
            bloqueado={guardando || exportando || guardandoUbicacion || ubicacionesPendientes}
            puedeDeshacer={estadosAnteriores.length > 0} puedeRehacer={estadosSiguientes.length > 0}
            onActivar={() => setAjusteActivo(true)} onDesactivar={() => setAjusteActivo(false)}
            onCambiar={cambiarSesionesManual} onDeshacer={deshacerAjuste} onRehacer={rehacerAjuste}
            onRestaurar={restaurarPropuesta}/></div>}
          {!ajusteActivo || vistaPublicada ? <div className="mt-5"><CuadriculaHorario secciones={seccionesVista} tipo={vista.tipo}/></div> : null}
        </section>}
      </>}
    </div>
    <ModalConfirmacion isOpen={cicloPendiente !== null} title="Cambiar ciclo del generador" message="Se descartará el borrador de horario y los cambios sin guardar del ciclo actual." confirmText="Cambiar ciclo" cancelText="Conservar borrador" onConfirm={() => { if (cicloPendiente !== null) aplicarCiclo(cicloPendiente); setCicloPendiente(null); }} onCancel={() => setCicloPendiente(null)} />
    <ModalConfirmacion isOpen={confirmarActualizacion} title="Actualizar datos del ciclo" message="Se descartará el borrador de horario y los cambios sin guardar antes de volver a cargar los datos." confirmText="Actualizar datos" cancelText="Conservar borrador" onConfirm={() => { setConfirmarActualizacion(false); void cargar(); }} onCancel={() => setConfirmarActualizacion(false)} />
    <ModalConfirmacion isOpen={confirmarDescarteAjuste} title="Descartar ajustes manuales"
      message={motivoDescarteAjuste} confirmText="Descartar y continuar" cancelText="Conservar ajuste"
      onConfirm={() => { setConfirmarDescarteAjuste(false); const accion = accionTrasConfirmar.current;
        accionTrasConfirmar.current = null; accion?.(); }}
      onCancel={() => { setConfirmarDescarteAjuste(false); accionTrasConfirmar.current = null; }}/>
    <ModalConfirmacion isOpen={abrirBorradorPendiente !== null} title="Abrir otro borrador"
      message="Se reemplazará el trabajo actual que no has guardado."
      confirmText="Abrir borrador" cancelText="Conservar trabajo"
      onConfirm={() => { if (abrirBorradorPendiente) abrirBorrador(abrirBorradorPendiente); setAbrirBorradorPendiente(null); }}
      onCancel={() => setAbrirBorradorPendiente(null)}/>
    <ModalConfirmacion isOpen={eliminarBorradorPendiente !== null} title="Eliminar borrador"
      message={`Se eliminará «${eliminarBorradorPendiente?.nombre || ''}» de este ciclo. Esta acción no afecta la versión publicada.`}
      confirmText="Eliminar borrador" cancelText="Cancelar"
      onConfirm={() => { if (eliminarBorradorPendiente) void borrarBorrador(eliminarBorradorPendiente); setEliminarBorradorPendiente(null); }}
      onCancel={() => setEliminarBorradorPendiente(null)}/>
    <ModalConfirmacion isOpen={confirmarAbrirPublicada} title="Abrir versión publicada"
      message="Se descartarán los ajustes actuales que no has guardado como borrador."
      confirmText="Abrir versión" cancelText="Conservar borrador"
      onConfirm={() => { setConfirmarAbrirPublicada(false); mostrarPublicada(); }}
      onCancel={() => setConfirmarAbrirPublicada(false)}/>
  </main>;
}
