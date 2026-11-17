import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Grupo } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useReportesAcademicos } from '../../hooks/useReportesAcademicos';
import { formatCicloEscolar } from '../../utils/formatUtils';
import {
  convertirReporteABorrador,
  esEnlaceDriveValido,
} from '../../reportesAcademicos/dominio';
import type {
  BorradorReporteAcademico,
  EstatusReporteAcademico,
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
import FormularioReporteAcademico from './FormularioReporteAcademico';
import ImpresionActaHechos from './ImpresionActaHechos';
import './reportesAcademicos.css';

export interface PanelReportesGrupoProps {
  key?: string;
  grupo: Grupo;
  onCerrar: () => void;
}

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

export default function PanelReportesGrupo({ grupo, onCerrar }: PanelReportesGrupoProps) {
  const { ciclos, currentUser, appConfig } = useAppStore();
  const puedeGestionar = ['ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR'].includes(
    currentUser?.rol || ''
  );

  const panelRef = useRef<HTMLDivElement | null>(null);

  const filtrosFijos = useMemo(
    () => ({ cicloId: grupo.ciclo_id, grupoId: grupo.id }),
    [grupo.ciclo_id, grupo.id]
  );

  const {
    setCicloId,
    filtros,
    setFiltrosAdicionales,
    reportes,
    cargando,
    errorCarga,
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
    moduloClave: 'reportes_grupo',
    ciclos,
    usuarioId: currentUser?.id,
    filtrosFijos,
    cargarCatalogosFormulario: puedeGestionar,
  });

  const [modo, setModo] = useState<'LISTADO' | 'FORMULARIO'>('LISTADO');
  const [claveForm, setClaveForm] = useState(0);
  const [folioEdicion, setFolioEdicion] = useState<string | null>(null);
  const [hayCambiosForm, setHayCambiosForm] = useState(false);
  const [guardandoForm, setGuardandoForm] = useState(false);
  const [confirmarDescartarCerrar, setConfirmarDescartarCerrar] = useState(false);

  const [busquedaInput, setBusquedaInput] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [estatusFiltro, setEstatusFiltro] = useState<'' | EstatusReporteAcademico>('');

  const [reporteParaImprimir, setReporteParaImprimir] = useState<ReporteAcademicoDetalle | null>(null);
  const [cambioEstatusObjetivo, setCambioEstatusObjetivo] = useState<ReporteAcademicoDetalle | null>(null);
  const [cambiandoEstatus, setCambiandoEstatus] = useState(false);

  const selectEstatusId = useId();
  const inputBusquedaId = useId();

  useEffect(() => {
    setCicloId(grupo.ciclo_id);
  }, [grupo.ciclo_id, setCicloId]);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [grupo.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltrosAdicionales({
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        estatus: estatusFiltro || null,
        busqueda: busquedaInput.trim() || null,
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [busquedaInput, fechaDesde, fechaHasta, estatusFiltro, setFiltrosAdicionales]);

  const reportesDelGrupo = useMemo(
    () => reportes.filter(r => r.grupos.some(g => g.grupoId === grupo.id)),
    [reportes, grupo.id]
  );

  const manejarEstadoCaptura = useCallback((hayCambios: boolean, estaGuardando: boolean) => {
    setHayCambiosForm(hayCambios);
    setGuardandoForm(estaGuardando);
  }, []);

  const cicloNombreGrupo = useMemo(() => {
    const encontrado = ciclos.find(c => c.id === grupo.ciclo_id);
    if (encontrado) return formatCicloEscolar(encontrado);
    if (grupo.ciclo?.nombre) return grupo.ciclo.nombre;
    return grupo.ciclo_id;
  }, [ciclos, grupo.ciclo_id, grupo.ciclo]);

  const carreraGrupoNombre = useMemo(() => {
    const planConCarrera = grupo.plan as { nombre?: string; carrera?: { nombre?: string } } | undefined;
    return planConCarrera?.carrera?.nombre || planConCarrera?.nombre || null;
  }, [grupo.plan]);

  const registrarIncidenteGrupal = () => {
    setFolioEdicion(null);
    iniciarNuevoReporte(grupo.ciclo_id);
    actualizarBorrador(prev => ({
      ...prev,
      cicloId: grupo.ciclo_id,
      flujoRegistro: 'GRUPO',
      tipoReporte: 'INCIDENTE',
      grupos: [
        {
          grupoId: grupo.id,
          alcanceAlumnos: 'TODO_EL_GRUPO',
          codigoGrupo: grupo.codigo_grupo,
          carrera: carreraGrupoNombre,
          grado: grupo.grado != null ? String(grupo.grado) : null,
          turno: grupo.turno || null,
        },
      ],
      alumnos: [],
    }));
    setClaveForm(v => v + 1);
    setHayCambiosForm(false);
    setModo('FORMULARIO');
  };

  const abrirEdicion = (r: ReporteAcademicoDetalle) => {
    setFolioEdicion(r.folio);
    cargarReporteParaEdicion(r);
    setClaveForm(v => v + 1);
    setHayCambiosForm(false);
    setModo('FORMULARIO');
  };

  const limpiarFiltros = () => {
    setBusquedaInput('');
    setFechaDesde('');
    setFechaHasta('');
    setEstatusFiltro('');
  };

  const manejarCerrarPanel = () => {
    if (guardandoForm) {
      toast('Espera a que termine el guardado del reporte.');
      return;
    }
    if (modo === 'FORMULARIO' && hayCambiosForm) {
      setConfirmarDescartarCerrar(true);
      return;
    }
    onCerrar();
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
      const res = await reportesAcademicosService.guardarReporte(borradorActualizado);
      toast.success(
        `Reporte ${res.folio} actualizado a ${siguienteEstatus === 'RESUELTO' ? 'Resuelto' : 'En proceso'}.`
      );
      setCambioEstatusObjetivo(null);
      await reintentarConsulta();
    } catch (err) {
      const normalizado = normalizarErrorReporteAcademico(err);
      toast.error(normalizado.message);
      if (normalizado.esConflictoRevision) await reintentarConsulta();
      throw normalizado;
    } finally {
      setCambiandoEstatus(false);
    }
  };

  const recargarUltimaVersion = async () => {
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
      setClaveForm(v => v + 1);
      toast.success(`Se cargó la versión vigente (v${vigente.revision}).`);
    } catch (err) {
      toast.error(normalizarErrorReporteAcademico(err).message);
    }
  };

  const contarAlumnosParcialesEnGrupo = (r: ReporteAcademicoDetalle): number =>
    r.alumnos.filter(a => a.grupoId === grupo.id).length;

  const describirAlcanceGrupo = (r: ReporteAcademicoDetalle) => {
    const relGrupo = r.grupos.find(g => g.grupoId === grupo.id);
    if (!relGrupo) return null;
    if (relGrupo.alcanceAlumnos === 'TODO_EL_GRUPO') {
      return (
        <span className="ra-badge ra-badge-rol-grupo-completo">
          <Layers size={12} aria-hidden="true" />
          Todo el grupo
        </span>
      );
    }
    const cantidad = contarAlumnosParcialesEnGrupo(r);
    return (
      <span className="ra-badge ra-badge-rol-grupo-parcial">
        <Users size={12} aria-hidden="true" />
        Selección parcial ({cantidad} {cantidad === 1 ? 'alumno' : 'alumnos'})
      </span>
    );
  };

  if (!puedeGestionar) {
    return (
      <section ref={panelRef} className="ic ra-modulo ra-embebido" aria-label="Reportes del grupo">
        <div className="ra-panel flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-[var(--ra-secundario)]">
            Los reportes del grupo están disponibles para Administración, Coordinación Académica y Control Escolar.
          </p>
          <button type="button" className="ra-btn" onClick={onCerrar}>
            <X size={15} aria-hidden="true" />
            Cerrar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={panelRef}
      className="ic ra-modulo ra-embebido"
      aria-label={`Reportes del grupo ${grupo.codigo_grupo}`}
    >
      <div className="ra-panel space-y-4 border-2 border-[#1456f0]/25 dark:border-[#3b82f6]/35">
        <div className="ra-cabecera !mb-0 border-b border-[var(--ra-borde)] pb-4">
          <div className="ra-cabecera-identidad">
            <p className="ra-eyebrow">Control Escolar · Reportes del grupo</p>
            <h2 className="ra-titulo !text-xl">
              Grupo {grupo.codigo_grupo}
            </h2>
            <p className="ra-subtitulo">
              {cicloNombreGrupo}
              {carreraGrupoNombre ? ` · ${carreraGrupoNombre}` : ''}
              {grupo.turno ? ` · Turno ${grupo.turno}` : ''}
            </p>
          </div>

          <div className="ra-cabecera-controles">
            {modo === 'LISTADO' && (
              <button
                type="button"
                className="ra-btn ra-btn-primario"
                onClick={registrarIncidenteGrupal}
              >
                <FilePlus2 size={16} aria-hidden="true" />
                Registrar incidente grupal
              </button>
            )}
            <button type="button" className="ra-btn" onClick={manejarCerrarPanel}>
              <X size={16} aria-hidden="true" />
              Cerrar panel
            </button>
          </div>
        </div>

        {modo === 'LISTADO' ? (
          <div className="space-y-4">
            <div className="ra-filtros-grid">
              <div className="ra-filtro-fecha">
                <CampoConAyuda
                  etiqueta="Fecha desde"
                  ayuda="Filtra incidentes grupales a partir de esta fecha."
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
                  ayuda="Filtra incidentes grupales hasta esta fecha."
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
                  etiqueta="Estatus"
                  ayuda="Filtra por atención pendiente (En proceso) o concluida (Resuelto)."
                >
                  <select
                    id={selectEstatusId}
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
                  etiqueta="Buscar folio, alumno o descripción"
                  ayuda="Coincide con el folio, alumnos seleccionados en incidente parcial o descripción."
                >
                  <div className="ra-busqueda-input-wrap">
                    <Search size={16} aria-hidden="true" />
                    <input
                      id={inputBusquedaId}
                      type="search"
                      className="ra-control"
                      value={busquedaInput}
                      onChange={e => setBusquedaInput(e.target.value)}
                      placeholder="Folio, alumno o descripción…"
                    />
                  </div>
                </CampoConAyuda>
              </div>
            </div>

            <div className="ra-filtros-pie">
              <span className="text-xs text-[var(--ra-secundario)]">
                Mostrando incidentes de <strong>{grupo.codigo_grupo}</strong> ({reportesDelGrupo.length} encontrados)
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="ra-btn" onClick={limpiarFiltros} disabled={cargando}>
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
              </div>
            </div>

            {errorCarga && (
              <EstadoError mensaje={errorCarga} onReintentar={() => void reintentarConsulta()} />
            )}

            {cargando && reportesDelGrupo.length === 0 && !errorCarga && (
              <div className="py-8 text-center" role="status" aria-live="polite">
                <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-[var(--ra-acento-texto)]" aria-hidden="true" />
                <p className="m-0 font-semibold">Consultando incidentes del grupo…</p>
              </div>
            )}

            {!cargando && !errorCarga && reportesDelGrupo.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--ra-borde)] py-8 px-4 text-center">
                <ClipboardList size={28} className="mx-auto mb-3 text-[var(--ra-secundario)]" aria-hidden="true" />
                <h3 className="m-0 font-display text-base font-bold">
                  Sin incidentes registrados para este grupo
                </h3>
                <p className="mx-auto mt-2 max-w-md text-xs text-[var(--ra-secundario)]">
                  Registra un incidente grupal indicando si aplica a «Todo el grupo» o a una «Selección parcial» de alumnos.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button type="button" className="ra-btn ra-btn-primario" onClick={registrarIncidenteGrupal}>
                    <FilePlus2 size={15} aria-hidden="true" />
                    Registrar incidente grupal
                  </button>
                </div>
              </div>
            )}

            {reportesDelGrupo.length > 0 && (
              <>
                <div className="ra-tabla-scroll">
                  <table className="ra-tabla">
                    <thead>
                      <tr>
                        <th>Folio / Fecha</th>
                        <th>Tipo y alcance</th>
                        <th>Participantes / Resumen</th>
                        <th>Estatus</th>
                        <th>Acta / Drive</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportesDelGrupo.map(r => {
                        const driveValido = r.enlaceDrive && esEnlaceDriveValido(r.enlaceDrive);
                        const alumnosGrupo = r.alumnos.filter(a => a.grupoId === grupo.id);
                        return (
                          <tr key={r.id}>
                            <td>
                              <div className="font-bold">{r.folio}</div>
                              <div className="text-xs text-[var(--ra-secundario)]">
                                {formatearFechaCorta(r.fechaReporte)}
                              </div>
                            </td>
                            <td>
                              <div className="flex flex-col items-start gap-1.5">
                                <span className={claseBadgeTipo(r.tipoReporte)}>
                                  {ETIQUETA_TIPO[r.tipoReporte]}
                                </span>
                                {describirAlcanceGrupo(r)}
                              </div>
                            </td>
                            <td className="max-w-[300px] text-xs">
                              {alumnosGrupo.length > 0 && (
                                <div className="mb-1 flex flex-wrap gap-1">
                                  {alumnosGrupo.map(a => (
                                    <span key={a.alumnoId} className="ra-badge ra-badge-rol-alumno">
                                      <User size={11} aria-hidden="true" />
                                      {a.nombreSnapshot || a.alumnoId}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {r.docentes.length > 0 && (
                                <div className="mb-1 flex flex-wrap gap-1">
                                  {r.docentes.map(d => (
                                    <span key={d.docenteId} className="ra-badge ra-badge-rol-docente">
                                      <User size={11} aria-hidden="true" />
                                      {d.nombreDocenteSnapshot || 'Docente'}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="m-0 text-[var(--ra-texto)]">{r.descripcion}</p>
                            </td>
                            <td>
                              <span
                                className={`ra-badge ${
                                  r.estatus === 'RESUELTO' ? 'ra-badge-resuelto' : 'ra-badge-en-proceso'
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
                              <div className="flex flex-col gap-1 text-xs">
                                {r.tieneActaHechos ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--ra-acento-texto)]">
                                    <FileText size={13} aria-hidden="true" />
                                    Con Acta
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
                                    <FolderOpen size={13} aria-hidden="true" />
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
                                  onClick={() => abrirEdicion(r)}
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
                                  {r.estatus === 'RESUELTO' ? 'Reabrir' : 'Marcar Resuelto'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="ra-tarjetas-movil">
                  {reportesDelGrupo.map(r => {
                    const driveValido = r.enlaceDrive && esEnlaceDriveValido(r.enlaceDrive);
                    const alumnosGrupo = r.alumnos.filter(a => a.grupoId === grupo.id);
                    return (
                      <article key={r.id} className="ra-tarjeta-movil">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm">{r.folio}</div>
                            <div className="text-xs text-[var(--ra-secundario)]">
                              {formatearFechaCorta(r.fechaReporte)}
                            </div>
                          </div>
                          <span
                            className={`ra-badge ${
                              r.estatus === 'RESUELTO' ? 'ra-badge-resuelto' : 'ra-badge-en-proceso'
                            }`}
                          >
                            {r.estatus === 'RESUELTO' ? 'Resuelto' : 'En proceso'}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={claseBadgeTipo(r.tipoReporte)}>
                            {ETIQUETA_TIPO[r.tipoReporte]}
                          </span>
                          {describirAlcanceGrupo(r)}
                          {driveValido && r.enlaceDrive && (
                            <a
                              href={r.enlaceDrive}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ra-acento-texto)] underline"
                            >
                              <FolderOpen size={13} aria-hidden="true" />
                              Drive
                            </a>
                          )}
                        </div>

                        {alumnosGrupo.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {alumnosGrupo.map(a => (
                              <span key={a.alumnoId} className="ra-badge ra-badge-rol-alumno">
                                <User size={11} aria-hidden="true" />
                                {a.nombreSnapshot || a.alumnoId}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="mt-2 mb-0 text-xs text-[var(--ra-texto)]">{r.descripcion}</p>

                        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--ra-borde)] pt-3">
                          <button
                            type="button"
                            className="ra-btn ra-btn-compacto flex-1"
                            onClick={() => abrirEdicion(r)}
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
              </>
            )}
          </div>
        ) : (
          <FormularioReporteAcademico
            key={`panel-grupo-form-${grupo.id}-${claveForm}`}
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
            onVolverListado={() => setModo('LISTADO')}
            onNuevoReporte={registrarIncidenteGrupal}
            onRecargarUltimaVersion={() => void recargarUltimaVersion()}
            onEstadoCapturaChange={manejarEstadoCaptura}
          />
        )}
      </div>

      {reporteParaImprimir && (
        <ImpresionActaHechos
          borrador={convertirReporteABorrador(reporteParaImprimir)}
          folio={reporteParaImprimir.folio}
          cicloNombre={reporteParaImprimir.cicloNombre || cicloNombreGrupo}
          appConfig={appConfig}
          onCerrar={() => setReporteParaImprimir(null)}
        />
      )}

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
            : 'El reporte se marcará como «Resuelto» conservando su historial y Acta de Hechos.'
        }
        type="info"
        confirmText={cambioEstatusObjetivo?.estatus === 'RESUELTO' ? 'Pasar a En proceso' : 'Marcar Resuelto'}
        busy={cambiandoEstatus}
        onCancel={() => setCambioEstatusObjetivo(null)}
        onConfirm={confirmarCambioEstatus}
      />

      <ModalConfirmacion
        isOpen={confirmarDescartarCerrar}
        title="Hay cambios sin guardar en el reporte"
        message="Si cierras el panel del grupo ahora se perderán los cambios sin guardar."
        confirmText="Descartar y cerrar"
        cancelText="Continuar editando"
        onCancel={() => setConfirmarDescartarCerrar(false)}
        onConfirm={() => {
          setConfirmarDescartarCerrar(false);
          onCerrar();
        }}
      />
    </section>
  );
}

