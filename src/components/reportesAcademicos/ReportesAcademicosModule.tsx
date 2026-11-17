import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderOpen,
  Layers,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  User,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';
import { useAppStore } from '../../store/useAppStore';
import { formatCicloEscolar } from '../../utils/formatUtils';
import { useReportesAcademicos } from '../../hooks/useReportesAcademicos';
import {
  convertirReporteABorrador,
  esEnlaceDriveValido,
} from '../../reportesAcademicos/dominio';
import type {
  AlumnoReporteSeleccion,
  BorradorReporteAcademico,
  DocenteReporteSeleccion,
  EstatusReporteAcademico,
  GrupoReporteSeleccion,
  ReporteAcademicoDetalle,
  TipoReporteAcademico,
} from '../../reportesAcademicos/types';
import {
  normalizarErrorReporteAcademico,
  reportesAcademicosService,
} from '../../services/reportesAcademicosService';
import { CampoConAyuda } from '../ui/AyudaContextual';
import EstadoError from '../ui/EstadoError';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorCicloModulo from '../ui/SelectorCicloModulo';
import FormularioReporteAcademico from './FormularioReporteAcademico';
import ImpresionActaHechos from './ImpresionActaHechos';
import './reportesAcademicos.css';

type SeccionModulo = 'CONSULTA' | 'FORMULARIO';

const TAMANO_PAGINA = 20;

const ETIQUETA_TIPO: Record<TipoReporteAcademico, string> = {
  INASISTENCIAS: 'Inasistencias',
  PROBLEMA_RENDIMIENTO: 'Problema de rendimiento',
  INCIDENTE: 'Incidente',
};

function claseBadgeTipo(tipo: TipoReporteAcademico): string {
  switch (tipo) {
    case 'INASISTENCIAS':
      return 'ra-badge ra-badge-tipo-inasistencias';
    case 'PROBLEMA_RENDIMIENTO':
      return 'ra-badge ra-badge-tipo-rendimiento';
    case 'INCIDENTE':
      return 'ra-badge ra-badge-tipo-incidente';
  }
}

function formatearFechaCorta(fechaIso?: string | null): string {
  const texto = (fechaIso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto || '—';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
}

function obtenerCarrerasDeReporte(r: ReporteAcademicoDetalle): string {
  const conjunto = new Set<string>();
  for (const a of r.alumnos) {
    if (a.carreraSnapshot?.trim()) conjunto.add(a.carreraSnapshot.trim());
  }
  for (const g of r.grupos) {
    if (g.carreraSnapshot?.trim()) conjunto.add(g.carreraSnapshot.trim());
  }
  if (conjunto.size === 0) return '—';
  return Array.from(conjunto)
    .sort((a, b) => a.localeCompare(b, 'es-MX'))
    .join(', ');
}

interface EstadoRutaReportesAcademicos {
  cicloId?: string;
  alumnoPreseleccionado?: AlumnoReporteSeleccion;
  grupoPreseleccionado?: GrupoReporteSeleccion;
  docentePreseleccionado?: DocenteReporteSeleccion;
  abrirFormulario?: boolean;
}

export default function ReportesAcademicosModule() {
  const { ciclos, carreras, catalogos, currentUser, appConfig } = useAppStore();
  const location = useLocation();
  const estadoRuta = (location.state ?? null) as EstadoRutaReportesAcademicos | null;
  const estadoAplicadoRef = useRef<string>('');

  const {
    cicloId,
    setCicloId,
    cicloSugeridoId,
    filtros,
    setFiltrosAdicionales,
    reportes,
    cargando,
    errorCarga,
    listaVacia,
    reintentarConsulta,
    catalogos: catalogosForm,
    borrador,
    validacionActual,
    iniciarNuevoReporte,
    cargarReporteParaEdicion,
    actualizarBorrador,
    cambiarAlcanceGrupo,
    guardarBorrador,
    guardando,
    errorGuardado,
    conflictoRevision,
  } = useReportesAcademicos({
    ciclos,
    usuarioId: currentUser?.id,
    cargarCatalogosFormulario: true,
    permitirTodosLosCiclos: true,
  });

  const [seccion, setSeccion] = useState<SeccionModulo>('CONSULTA');
  const [folioEdicion, setFolioEdicion] = useState<string | null>(null);
  const solicitarSalidaFormulario = useProteccionCaptura(false, false);

  // Controles de filtro locales con debounce en búsqueda textual
  const [busquedaInput, setBusquedaInput] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [carreraFiltro, setCarreraFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'' | TipoReporteAcademico>('');
  const [estatusFiltro, setEstatusFiltro] = useState<'' | EstatusReporteAcademico>('');
  const [todosLosCiclos, setTodosLosCiclos] = useState(false);
  const [pagina, setPagina] = useState(0);

  // Modales auxiliares
  const [reporteParaImprimir, setReporteParaImprimir] = useState<ReporteAcademicoDetalle | null>(null);
  const [cambioEstatusObjetivo, setCambioEstatusObjetivo] = useState<ReporteAcademicoDetalle | null>(null);
  const [cambiandoEstatus, setCambiandoEstatus] = useState(false);

  const checkTodosCiclosId = useId();
  const selectCarreraId = useId();
  const selectTipoFiltroId = useId();
  const selectEstatusFiltroId = useId();
  const inputBusquedaId = useId();

  // Aplicar estado opcional recibido por navegación (p. ej. ciclo o preselección inicial)
  useEffect(() => {
    if (!estadoRuta) return;
    const clave = JSON.stringify({ key: location.key, estadoRuta });
    if (estadoAplicadoRef.current === clave) return;
    estadoAplicadoRef.current = clave;

    const cicloDestino = estadoRuta.cicloId && estadoRuta.cicloId !== 'TODOS'
      ? estadoRuta.cicloId
      : cicloId !== 'TODOS'
        ? cicloId
        : cicloSugeridoId;

    if (estadoRuta.cicloId && estadoRuta.cicloId !== 'TODOS') {
      setTodosLosCiclos(false);
      setCicloId(estadoRuta.cicloId);
    }

    if (
      estadoRuta.abrirFormulario ||
      estadoRuta.alumnoPreseleccionado ||
      estadoRuta.grupoPreseleccionado ||
      estadoRuta.docentePreseleccionado
    ) {
      setFolioEdicion(null);
      iniciarNuevoReporte(cicloDestino);
      actualizarBorrador(prev => {
        const esGrupo = Boolean(estadoRuta.grupoPreseleccionado);
        return {
          ...prev,
          cicloId: cicloDestino || prev.cicloId,
          flujoRegistro: esGrupo ? 'GRUPO' : 'ALUMNO_DOCENTE',
          tipoReporte: esGrupo || estadoRuta.docentePreseleccionado ? 'INCIDENTE' : prev.tipoReporte,
          alumnos: estadoRuta.alumnoPreseleccionado ? [estadoRuta.alumnoPreseleccionado] : prev.alumnos,
          grupos: estadoRuta.grupoPreseleccionado ? [estadoRuta.grupoPreseleccionado] : prev.grupos,
          docentes: estadoRuta.docentePreseleccionado ? [estadoRuta.docentePreseleccionado] : prev.docentes,
        };
      });
      setSeccion('FORMULARIO');
    }
  }, [estadoRuta, location.key, cicloId, cicloSugeridoId, setCicloId, iniciarNuevoReporte, actualizarBorrador]);

  // Aplicar ciclo efectivo en filtros según casilla "Todos los ciclos"
  useEffect(() => {
    if (todosLosCiclos) {
      if (cicloId !== 'TODOS') {
        setCicloId('TODOS');
      }
    } else if (cicloId === 'TODOS') {
      setCicloId(cicloSugeridoId || ciclos[0]?.id || '');
    }
  }, [todosLosCiclos, cicloId, cicloSugeridoId, ciclos, setCicloId]);

  // Debounce en la barra de búsqueda y sincronización con los filtros del hook
  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltrosAdicionales({
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        carrera: carreraFiltro || null,
        tipoReporte: tipoFiltro || null,
        estatus: estatusFiltro || null,
        busqueda: busquedaInput.trim() || null,
      });
      setPagina(0);
    }, 220);
    return () => clearTimeout(timer);
  }, [busquedaInput, fechaDesde, fechaHasta, carreraFiltro, tipoFiltro, estatusFiltro, setFiltrosAdicionales]);

  // Catálogo único y alfabético A–Z de carreras
  const opcionesCarreras = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of carreras) {
      if (c.nombre?.trim()) mapa.set(c.nombre.trim().toUpperCase(), c.nombre.trim());
    }
    for (const l of catalogos.licenciaturas || []) {
      if (l?.trim() && !mapa.has(l.trim().toUpperCase())) mapa.set(l.trim().toUpperCase(), l.trim());
    }
    for (const r of reportes) {
      for (const a of r.alumnos) {
        if (a.carreraSnapshot?.trim() && !mapa.has(a.carreraSnapshot.trim().toUpperCase())) {
          mapa.set(a.carreraSnapshot.trim().toUpperCase(), a.carreraSnapshot.trim());
        }
      }
      for (const g of r.grupos) {
        if (g.carreraSnapshot?.trim() && !mapa.has(g.carreraSnapshot.trim().toUpperCase())) {
          mapa.set(g.carreraSnapshot.trim().toUpperCase(), g.carreraSnapshot.trim());
        }
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'es-MX'));
  }, [carreras, catalogos.licenciaturas, reportes]);

  // Paginación del conjunto filtrado
  const totalPaginas = Math.max(1, Math.ceil(reportes.length / TAMANO_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const reportesPaginados = useMemo(
    () => reportes.slice(paginaActual * TAMANO_PAGINA, (paginaActual + 1) * TAMANO_PAGINA),
    [reportes, paginaActual]
  );

  // Resumen numérico del conjunto filtrado
  const resumen = useMemo(() => {
    let enProceso = 0;
    let resueltos = 0;
    let conActa = 0;
    for (const r of reportes) {
      if (r.estatus === 'RESUELTO') resueltos++;
      else enProceso++;
      if (r.tieneActaHechos) conActa++;
    }
    return {
      total: reportes.length,
      enProceso,
      resueltos,
      conActa,
    };
  }, [reportes]);

  const cicloNombrePorId = (idCiclo: string) => {
    const c = ciclos.find(item => item.id === idCiclo);
    return c ? formatCicloEscolar(c) : idCiclo;
  };

  const abrirNuevoFormulario = () => {
    setFolioEdicion(null);
    iniciarNuevoReporte(cicloId !== 'TODOS' ? cicloId : cicloSugeridoId);
    setSeccion('FORMULARIO');
  };

  const abrirEdicionReporte = (reporte: ReporteAcademicoDetalle) => {
    setFolioEdicion(reporte.folio);
    cargarReporteParaEdicion(reporte);
    setSeccion('FORMULARIO');
  };

  const limpiarFiltros = () => {
    setBusquedaInput('');
    setFechaDesde('');
    setFechaHasta('');
    setCarreraFiltro('');
    setTipoFiltro('');
    setEstatusFiltro('');
    setTodosLosCiclos(false);
    setPagina(0);
  };

  const confirmarCambioEstatus = async () => {
    if (!cambioEstatusObjetivo) return;
    const siguienteEstatus: EstatusReporteAcademico =
      cambioEstatusObjetivo.estatus === 'RESUELTO' ? 'EN_PROCESO' : 'RESUELTO';
    const borradorActualizado: BorradorReporteAcademico = {
      ...convertirReporteABorrador(cambioEstatusObjetivo),
      estatus: siguienteEstatus,
    };
    setCambiandoEstatus(true);
    try {
      const resultado = await reportesAcademicosService.guardarReporte(borradorActualizado);
      toast.success(
        `Reporte ${resultado.folio} actualizado a ${
          siguienteEstatus === 'RESUELTO' ? 'Resuelto' : 'En proceso'
        }.`
      );
      setCambioEstatusObjetivo(null);
      await reintentarConsulta();
    } catch (err) {
      const normalizado = normalizarErrorReporteAcademico(err);
      toast.error(normalizado.message);
      if (normalizado.esConflictoRevision) {
        await reintentarConsulta();
      }
      throw normalizado;
    } finally {
      setCambiandoEstatus(false);
    }
  };

  const recargarUltimaVersionFormulario = async () => {
    if (!borrador.id) return;
    try {
      const res = await reportesAcademicosService.consultarReportes({
        ...filtros,
        cicloId: borrador.cicloId,
      });
      const vigente = res.reportes.find(item => item.id === borrador.id);
      if (!vigente) {
        toast.error('No se localizó el reporte en la consulta vigente.');
        return;
      }
      cargarReporteParaEdicion(vigente);
      setFolioEdicion(vigente.folio);
      toast.success(`Se cargó la versión vigente (v${vigente.revision}).`);
    } catch (err) {
      toast.error(normalizarErrorReporteAcademico(err).message);
    }
  };

  const renderInsigniasInvolucrados = (r: ReporteAcademicoDetalle) => {
    const gruposCompletos = r.grupos.filter(g => g.alcanceAlumnos === 'TODO_EL_GRUPO');
    const gruposParciales = r.grupos.filter(g => g.alcanceAlumnos === 'PARCIAL');

    return (
      <div className="flex flex-col gap-1.5">
        {gruposCompletos.map(g => (
          <div key={`gc-${g.grupoId}`} className="flex flex-wrap items-center gap-1.5">
            <span className="ra-badge ra-badge-rol-grupo-completo">
              <Layers size={12} aria-hidden="true" />
              Grupo completo
            </span>
            <span className="text-xs font-semibold">
              {g.codigoGrupoSnapshot || g.grupoId}
              {g.turnoSnapshot ? ` (${g.turnoSnapshot})` : ''}
            </span>
          </div>
        ))}

        {gruposParciales.map(g => (
          <div key={`gp-${g.grupoId}`} className="flex flex-wrap items-center gap-1.5">
            <span className="ra-badge ra-badge-rol-grupo-parcial">
              <Users size={12} aria-hidden="true" />
              Grupo parcial
            </span>
            <span className="text-xs font-semibold">{g.codigoGrupoSnapshot || g.grupoId}</span>
          </div>
        ))}

        {r.alumnos.map(a => (
          <div key={`al-${a.alumnoId}`} className="flex flex-wrap items-center gap-1.5">
            <span className="ra-badge ra-badge-rol-alumno">
              <User size={12} aria-hidden="true" />
              Alumno
            </span>
            <span className="text-xs">
              <strong>{a.nombreSnapshot || 'Sin nombre'}</strong>
              {a.matriculaSnapshot ? ` (${a.matriculaSnapshot})` : ''}
            </span>
          </div>
        ))}

        {r.docentes.map(d => (
          <div key={`doc-${d.docenteId}`} className="flex flex-wrap items-center gap-1.5">
            <span className="ra-badge ra-badge-rol-docente">
              <User size={12} aria-hidden="true" />
              Docente
            </span>
            <span className="text-xs">
              <strong>{d.nombreDocenteSnapshot || 'Docente'}</strong>
              {d.claveDocenteSnapshot ? ` (${d.claveDocenteSnapshot})` : ''}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="ic ra-modulo">
      {/* Cabecera principal */}
      <header className="ra-cabecera">
        <div className="ra-cabecera-identidad">
          <p className="ra-eyebrow">Control Escolar · Seguimiento Académico</p>
          <h1 className="ra-titulo">Reportes Académicos</h1>
          <p className="ra-subtitulo">
            Registro y consulta de inasistencias, problemas de rendimiento, incidentes y Actas de Hechos oficiales.
          </p>
        </div>

        <div className="ra-cabecera-controles">
          <SelectorCicloModulo
            ciclos={ciclos}
            cicloId={cicloId === 'TODOS' ? '' : cicloId}
            onChange={nuevoId => {
              setTodosLosCiclos(!nuevoId);
              setCicloId(nuevoId || 'TODOS');
              setPagina(0);
            }}
            label="Ciclo escolar de trabajo"
            ayuda="Sugerido automáticamente según la fecha actual en Ciudad de México y las fechas de inicio y término del ciclo."
          />

          <nav className="ra-nav-secciones" aria-label="Secciones de Reportes Académicos">
            <button
              type="button"
              className={`ra-tab-btn ${seccion === 'CONSULTA' ? 'es-activa' : ''}`}
              aria-current={seccion === 'CONSULTA' ? 'page' : undefined}
              onClick={() => {
                if (seccion === 'FORMULARIO') {
                  solicitarSalidaFormulario(() => setSeccion('CONSULTA'));
                } else {
                  setSeccion('CONSULTA');
                }
              }}
            >
              <ClipboardList size={16} aria-hidden="true" />
              Consulta y edición
            </button>
            <button
              type="button"
              className={`ra-tab-btn ${seccion === 'FORMULARIO' ? 'es-activa' : ''}`}
              aria-current={seccion === 'FORMULARIO' ? 'page' : undefined}
              onClick={() => {
                if (seccion !== 'FORMULARIO') abrirNuevoFormulario();
              }}
            >
              <FilePlus2 size={16} aria-hidden="true" />
              Creación / Registro
            </button>
          </nav>
        </div>
      </header>

      {/* Sección 1: Consulta y edición de reportes elaborados */}
      {seccion === 'CONSULTA' && (
        <>
          {/* Barra de filtros alineada */}
          <section className="ra-panel" aria-label="Filtros de reportes académicos">
            <div className="ra-filtros-grid">
              <div className="ra-filtro-fecha">
                <CampoConAyuda
                  etiqueta="Fecha desde"
                  ayuda="Filtra reportes cuya fecha de ocurrencia sea igual o posterior."
                >
                  <input
                    type="date"
                    className="ra-control"
                    value={fechaDesde}
                    onChange={e => setFechaDesde(e.target.value)}
                  />
                </CampoConAyuda>
              </div>

              <div className="ra-filtro-fecha">
                <CampoConAyuda
                  etiqueta="Fecha hasta"
                  ayuda="Filtra reportes cuya fecha de ocurrencia sea igual o anterior."
                >
                  <input
                    type="date"
                    className="ra-control"
                    value={fechaHasta}
                    onChange={e => setFechaHasta(e.target.value)}
                  />
                </CampoConAyuda>
              </div>

              <div className="ra-filtro-select">
                <CampoConAyuda
                  etiqueta="Carrera"
                  ayuda="Ordenadas alfabéticamente A–Z según los alumnos o grupos involucrados."
                >
                  <select
                    id={selectCarreraId}
                    className="ra-control"
                    value={carreraFiltro}
                    onChange={e => setCarreraFiltro(e.target.value)}
                  >
                    <option value="">Todas las carreras</option>
                    {opcionesCarreras.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </CampoConAyuda>
              </div>

              <div className="ra-filtro-select">
                <CampoConAyuda
                  etiqueta="Tipo de reporte"
                  ayuda="Filtra entre Inasistencias, Problema de Rendimiento Académico o Incidente."
                >
                  <select
                    id={selectTipoFiltroId}
                    className="ra-control"
                    value={tipoFiltro}
                    onChange={e => setTipoFiltro(e.target.value as '' | TipoReporteAcademico)}
                  >
                    <option value="">Todos los tipos</option>
                    <option value="INASISTENCIAS">Inasistencias</option>
                    <option value="PROBLEMA_RENDIMIENTO">Problema de rendimiento</option>
                    <option value="INCIDENTE">Incidente</option>
                  </select>
                </CampoConAyuda>
              </div>

              <div className="ra-filtro-select">
                <CampoConAyuda
                  etiqueta="Estatus"
                  ayuda="Estado de seguimiento del reporte académico."
                >
                  <select
                    id={selectEstatusFiltroId}
                    className="ra-control"
                    value={estatusFiltro}
                    onChange={e => setEstatusFiltro(e.target.value as '' | EstatusReporteAcademico)}
                  >
                    <option value="">Todos los estatus</option>
                    <option value="EN_PROCESO">En proceso</option>
                    <option value="RESUELTO">Resuelto</option>
                  </select>
                </CampoConAyuda>
              </div>

              <div className="ra-filtro-busqueda">
                <CampoConAyuda
                  etiqueta="Buscar alumno, docente, grupo o folio"
                  ayuda="Busca por nombre o matrícula del alumno, nombre del docente, código de grupo o folio del reporte."
                >
                  <div className="ra-busqueda-input-wrap">
                    <Search size={16} aria-hidden="true" />
                    <input
                      id={inputBusquedaId}
                      type="search"
                      className="ra-control"
                      value={busquedaInput}
                      onChange={e => setBusquedaInput(e.target.value)}
                      placeholder="Nombre, matrícula, grupo o folio…"
                    />
                  </div>
                </CampoConAyuda>
              </div>
            </div>

            <div className="ra-filtros-pie">
              <div className="flex flex-wrap items-center gap-4">
                <label
                  htmlFor={checkTodosCiclosId}
                  className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ra-texto)]"
                >
                  <input
                    id={checkTodosCiclosId}
                    type="checkbox"
                    className="h-4 w-4 accent-[#1456f0]"
                    checked={todosLosCiclos}
                    onChange={e => setTodosLosCiclos(e.target.checked)}
                  />
                  Consultar en todos los ciclos escolares
                </label>

                <span className="text-xs text-[var(--ra-secundario)]">
                  Contexto activo:{' '}
                  <strong>
                    {todosLosCiclos || cicloId === 'TODOS'
                      ? 'Todos los ciclos'
                      : cicloNombrePorId(cicloId)}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="ra-btn"
                  onClick={limpiarFiltros}
                  disabled={cargando}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  className="ra-btn"
                  onClick={() => void reintentarConsulta()}
                  disabled={cargando}
                >
                  <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} aria-hidden="true" />
                  {cargando ? 'Consultando…' : 'Actualizar'}
                </button>
                <button
                  type="button"
                  className="ra-btn ra-btn-primario"
                  onClick={abrirNuevoFormulario}
                >
                  <FilePlus2 size={16} aria-hidden="true" />
                  Nuevo reporte
                </button>
              </div>
            </div>
          </section>

          {/* Resumen de población filtrada */}
          <section className="ra-resumen-grid" aria-label="Resumen de reportes filtrados">
            <div className="ra-resumen-card">
              <strong className="ra-resumen-valor">{resumen.total}</strong>
              <span className="ra-resumen-etiqueta">Reportes encontrados</span>
            </div>
            <div className="ra-resumen-card">
              <strong className="ra-resumen-valor">{resumen.enProceso}</strong>
              <span className="ra-resumen-etiqueta">En proceso</span>
            </div>
            <div className="ra-resumen-card">
              <strong className="ra-resumen-valor">{resumen.resueltos}</strong>
              <span className="ra-resumen-etiqueta">Resueltos</span>
            </div>
            <div className="ra-resumen-card">
              <strong className="ra-resumen-valor">{resumen.conActa}</strong>
              <span className="ra-resumen-etiqueta">Con Acta de Hechos</span>
            </div>
          </section>

          {/* Estado de error o listado */}
          {errorCarga && (
            <div className="mb-4">
              <EstadoError mensaje={errorCarga} onReintentar={() => void reintentarConsulta()} />
            </div>
          )}

          {cargando && reportes.length === 0 && !errorCarga && (
            <div className="ra-panel py-12 text-center" role="status" aria-live="polite">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-[var(--ra-acento-texto)]" aria-hidden="true" />
              <p className="m-0 font-semibold">Consultando reportes académicos…</p>
            </div>
          )}

          {listaVacia && (
            <div className="ra-panel py-12 text-center">
              <ClipboardList size={32} className="mx-auto mb-3 text-[var(--ra-secundario)]" aria-hidden="true" />
              <h2 className="m-0 font-display text-lg font-bold">
                No hay reportes académicos para los filtros seleccionados
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ra-secundario)]">
                Ajusta el rango de fechas, la carrera o la búsqueda, o registra un nuevo reporte académico en este ciclo escolar.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" className="ra-btn" onClick={limpiarFiltros}>
                  Restablecer filtros
                </button>
                <button
                  type="button"
                  className="ra-btn ra-btn-primario"
                  onClick={abrirNuevoFormulario}
                >
                  <FilePlus2 size={16} aria-hidden="true" />
                  Registrar primer reporte
                </button>
              </div>
            </div>
          )}

          {reportes.length > 0 && (
            <section className="ra-panel" aria-label="Listado de reportes académicos">
              {/* Vista Tabla en Escritorio (>= 900 px) */}
              <div className="ra-tabla-scroll">
                <table className="ra-tabla">
                  <thead>
                    <tr>
                      <th>Folio / Ciclo</th>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Involucrados</th>
                      <th>Carrera</th>
                      <th>Estatus</th>
                      <th>Acta / Drive</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportesPaginados.map(r => {
                      const driveValido = r.enlaceDrive && esEnlaceDriveValido(r.enlaceDrive);
                      return (
                        <tr key={r.id}>
                          <td>
                            <div className="font-bold text-[var(--ra-texto)]">{r.folio}</div>
                            <div className="text-xs text-[var(--ra-secundario)]">
                              {r.cicloNombre
                                ? `${r.cicloNombre}${r.cicloTipoPeriodo ? ` · ${r.cicloTipoPeriodo}` : ''}`
                                : cicloNombrePorId(r.cicloId)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap font-medium">
                            {formatearFechaCorta(r.fechaReporte)}
                          </td>
                          <td>
                            <span className={claseBadgeTipo(r.tipoReporte)}>
                              {ETIQUETA_TIPO[r.tipoReporte]}
                            </span>
                          </td>
                          <td>{renderInsigniasInvolucrados(r)}</td>
                          <td className="max-w-[200px] text-xs">{obtenerCarrerasDeReporte(r)}</td>
                          <td>
                            <span
                              className={`ra-badge ${
                                r.estatus === 'RESUELTO'
                                  ? 'ra-badge-resuelto'
                                  : 'ra-badge-en-proceso'
                              }`}
                            >
                              {r.estatus === 'RESUELTO' ? (
                                <CheckCircle2 size={12} aria-hidden="true" />
                              ) : (
                                <AlertCircle size={12} aria-hidden="true" />
                              )}
                              {r.estatus === 'RESUELTO' ? 'Resuelto' : 'En proceso'}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-col gap-1.5 text-xs">
                              {r.tieneActaHechos ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-[var(--ra-acento-texto)]">
                                  <FileText size={14} aria-hidden="true" />
                                  Con Acta de Hechos
                                </span>
                              ) : (
                                <span className="text-[var(--ra-secundario)]">Sin acta</span>
                              )}

                              {driveValido && r.enlaceDrive && (
                                <a
                                  href={r.enlaceDrive}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-semibold text-[var(--ra-acento-texto)] underline"
                                >
                                  <FolderOpen size={14} aria-hidden="true" />
                                  Drive
                                  <ExternalLink size={11} aria-hidden="true" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                className="ra-btn ra-btn-compacto"
                                onClick={() => abrirEdicionReporte(r)}
                              >
                                <Edit3 size={13} aria-hidden="true" />
                                Consultar / Editar
                              </button>

                              {(r.tieneActaHechos || r.tipoReporte === 'INCIDENTE') && (
                                <button
                                  type="button"
                                  className="ra-btn ra-btn-compacto"
                                  onClick={() => setReporteParaImprimir(r)}
                                >
                                  <Printer size={13} aria-hidden="true" />
                                  Imprimir / PDF
                                </button>
                              )}

                              <button
                                type="button"
                                className="ra-btn ra-btn-compacto"
                                onClick={() => setCambioEstatusObjetivo(r)}
                              >
                                {r.estatus === 'RESUELTO'
                                  ? 'Reabrir (En proceso)'
                                  : 'Marcar Resuelto'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Vista Tarjetas en Móvil / Tableta (< 900 px) */}
              <div className="ra-tarjetas-movil">
                {reportesPaginados.map(r => {
                  const driveValido = r.enlaceDrive && esEnlaceDriveValido(r.enlaceDrive);
                  return (
                    <article key={r.id} className="ra-tarjeta-movil">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-base">{r.folio}</div>
                          <div className="text-xs text-[var(--ra-secundario)]">
                            {formatearFechaCorta(r.fechaReporte)} ·{' '}
                            {r.cicloNombre || cicloNombrePorId(r.cicloId)}
                          </div>
                        </div>
                        <span
                          className={`ra-badge ${
                            r.estatus === 'RESUELTO'
                              ? 'ra-badge-resuelto'
                              : 'ra-badge-en-proceso'
                          }`}
                        >
                          {r.estatus === 'RESUELTO' ? (
                            <CheckCircle2 size={12} aria-hidden="true" />
                          ) : (
                            <AlertCircle size={12} aria-hidden="true" />
                          )}
                          {r.estatus === 'RESUELTO' ? 'Resuelto' : 'En proceso'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={claseBadgeTipo(r.tipoReporte)}>
                          {ETIQUETA_TIPO[r.tipoReporte]}
                        </span>
                        {r.tieneActaHechos && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ra-acento-texto)]">
                            <FileText size={13} aria-hidden="true" />
                            Acta de Hechos
                          </span>
                        )}
                        {driveValido && r.enlaceDrive && (
                          <a
                            href={r.enlaceDrive}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ra-acento-texto)] underline"
                          >
                            <FolderOpen size={13} aria-hidden="true" />
                            Drive
                            <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        )}
                      </div>

                      <div className="mt-3">{renderInsigniasInvolucrados(r)}</div>

                      <div className="mt-2 text-xs text-[var(--ra-secundario)]">
                        <strong>Carrera:</strong> {obtenerCarrerasDeReporte(r)}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--ra-borde)] pt-3">
                        <button
                          type="button"
                          className="ra-btn ra-btn-compacto flex-1"
                          onClick={() => abrirEdicionReporte(r)}
                        >
                          <Edit3 size={13} aria-hidden="true" />
                          Consultar / Editar
                        </button>
                        {(r.tieneActaHechos || r.tipoReporte === 'INCIDENTE') && (
                          <button
                            type="button"
                            className="ra-btn ra-btn-compacto flex-1"
                            onClick={() => setReporteParaImprimir(r)}
                          >
                            <Printer size={13} aria-hidden="true" />
                            Imprimir / PDF
                          </button>
                        )}
                        <button
                          type="button"
                          className="ra-btn ra-btn-compacto w-full"
                          onClick={() => setCambioEstatusObjetivo(r)}
                        >
                          {r.estatus === 'RESUELTO' ? 'Reabrir (En proceso)' : 'Marcar Resuelto'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Paginación */}
              <div className="ra-paginacion">
                <span className="text-xs font-medium text-[var(--ra-secundario)]">
                  Mostrando {paginaActual * TAMANO_PAGINA + 1}–
                  {Math.min((paginaActual + 1) * TAMANO_PAGINA, reportes.length)} de{' '}
                  {reportes.length} reportes
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="ra-btn ra-btn-compacto"
                    disabled={paginaActual === 0}
                    onClick={() => setPagina(p => Math.max(0, p - 1))}
                  >
                    Anterior
                  </button>
                  <span className="text-xs font-semibold">
                    Página {paginaActual + 1} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    className="ra-btn ra-btn-compacto"
                    disabled={paginaActual >= totalPaginas - 1}
                    onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Sección 2: Creación y Edición */}
      {seccion === 'FORMULARIO' && (
        <FormularioReporteAcademico
          ciclos={ciclos}
          borrador={borrador}
          validacionActual={validacionActual}
          folioEdicion={folioEdicion}
          appConfig={appConfig}
          alumnosCatalogo={catalogosForm.alumnos}
          docentesActivos={catalogosForm.docentesActivos}
          gruposCiclo={catalogosForm.gruposCiclo}
          administrativosActivos={catalogosForm.administrativosActivos}
          personalTestigosActivo={catalogosForm.personalTestigosActivo}
          cargandoCatalogos={catalogosForm.cargandoCatalogos}
          errorCatalogos={catalogosForm.errorCatalogos}
          guardando={guardando}
          errorGuardado={errorGuardado}
          conflictoRevision={conflictoRevision}
          onReintentarCatalogos={() => void catalogosForm.reintentarCatalogos()}
          onActualizarBorrador={actualizarBorrador}
          onCambiarAlcanceGrupo={cambiarAlcanceGrupo}
          onGuardar={async () => {
            const res = await guardarBorrador();
            if (res) setFolioEdicion(res.folio);
            return res;
          }}
          onVolverListado={() => setSeccion('CONSULTA')}
          onNuevoReporte={abrirNuevoFormulario}
          onRecargarUltimaVersion={() => void recargarUltimaVersionFormulario()}
        />
      )}

      {/* Modal de Impresión / PDF del Acta de Hechos */}
      {reporteParaImprimir && (
        <ImpresionActaHechos
          borrador={convertirReporteABorrador(reporteParaImprimir)}
          folio={reporteParaImprimir.folio}
          cicloNombre={
            reporteParaImprimir.cicloNombre
              ? `${reporteParaImprimir.cicloNombre}${
                  reporteParaImprimir.cicloTipoPeriodo
                    ? ` · ${reporteParaImprimir.cicloTipoPeriodo}`
                    : ''
                }`
              : cicloNombrePorId(reporteParaImprimir.cicloId)
          }
          appConfig={appConfig}
          onCerrar={() => setReporteParaImprimir(null)}
        />
      )}

      {/* Modal de Confirmación para Cambio de Estatus */}
      <ModalConfirmacion
        isOpen={Boolean(cambioEstatusObjetivo)}
        title={
          cambioEstatusObjetivo?.estatus === 'RESUELTO'
            ? `¿Reabrir reporte ${cambioEstatusObjetivo?.folio || ''}?`
            : `¿Marcar reporte ${cambioEstatusObjetivo?.folio || ''} como Resuelto?`
        }
        message={
          cambioEstatusObjetivo?.estatus === 'RESUELTO'
            ? 'El reporte volverá al estatus «En proceso» y quedará registrado en la bitácora.'
            : 'El reporte se marcará como «Resuelto» conservando todos sus datos, involucrados, evidencia y Acta de Hechos.'
        }
        type="info"
        confirmText={
          cambioEstatusObjetivo?.estatus === 'RESUELTO' ? 'Pasar a En proceso' : 'Marcar Resuelto'
        }
        busy={cambiandoEstatus}
        onCancel={() => setCambioEstatusObjetivo(null)}
        onConfirm={confirmarCambioEstatus}
      />
    </div>
  );
}
