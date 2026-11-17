import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderOpen,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Alumno } from '../../types';
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
import SelectorCicloModulo from '../ui/SelectorCicloModulo';
import FormularioReporteAcademico from '../reportesAcademicos/FormularioReporteAcademico';
import ImpresionActaHechos from '../reportesAcademicos/ImpresionActaHechos';
import '../reportesAcademicos/reportesAcademicos.css';

export interface TabReportesAlumnoProps {
  key?: string;
  alumno: Alumno;
  onCapturaChange?: (hayCambios: boolean) => void;
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

export default function TabReportesAlumno({ alumno, onCapturaChange }: TabReportesAlumnoProps) {
  const { ciclos, currentUser, appConfig } = useAppStore();
  const puedeGestionar = ['ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR'].includes(
    currentUser?.rol || ''
  );

  const filtrosFijos = useMemo(() => ({ alumnoId: alumno.id }), [alumno.id]);

  const {
    cicloId,
    setCicloId,
    cicloSugeridoId,
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
    moduloClave: 'reportes_alumno',
    ciclos,
    usuarioId: currentUser?.id,
    filtrosFijos,
    cargarCatalogosFormulario: puedeGestionar,
    permitirTodosLosCiclos: true,
  });

  const [modo, setModo] = useState<'LISTADO' | 'FORMULARIO'>('LISTADO');
  const [claveForm, setClaveForm] = useState(0);
  const [folioEdicion, setFolioEdicion] = useState<string | null>(null);
  const [todosLosCiclos, setTodosLosCiclos] = useState(false);

  const [busquedaInput, setBusquedaInput] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'' | TipoReporteAcademico>('');
  const [estatusFiltro, setEstatusFiltro] = useState<'' | EstatusReporteAcademico>('');

  const [reporteParaImprimir, setReporteParaImprimir] = useState<ReporteAcademicoDetalle | null>(null);
  const [cambioEstatusObjetivo, setCambioEstatusObjetivo] = useState<ReporteAcademicoDetalle | null>(null);
  const [cambiandoEstatus, setCambiandoEstatus] = useState(false);

  const checkTodosCiclosId = useId();
  const selectTipoId = useId();
  const selectEstatusId = useId();
  const inputBusquedaId = useId();

  useEffect(() => {
    if (todosLosCiclos) {
      if (cicloId !== 'TODOS') setCicloId('TODOS');
    } else if (cicloId === 'TODOS') {
      setCicloId(cicloSugeridoId || ciclos[0]?.id || '');
    }
  }, [todosLosCiclos, cicloId, cicloSugeridoId, ciclos, setCicloId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltrosAdicionales({
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        tipoReporte: tipoFiltro || null,
        estatus: estatusFiltro || null,
        busqueda: busquedaInput.trim() || null,
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [busquedaInput, fechaDesde, fechaHasta, tipoFiltro, estatusFiltro, setFiltrosAdicionales]);

  // Regla estricta: mostrar solo reportes individuales del alumno y grupales PARCIAL donde fue incluido.
  // Los reportes grupales marcados como TODO_EL_GRUPO no listan alumnos y nunca aparecen aquí.
  const reportesDelAlumno = useMemo(
    () => reportes.filter(r => r.alumnos.some(a => a.alumnoId === alumno.id)),
    [reportes, alumno.id]
  );

  const manejarEstadoCaptura = useCallback(
    (hayCambios: boolean, estaGuardando: boolean) => {
      onCapturaChange?.(hayCambios || estaGuardando);
    },
    [onCapturaChange]
  );

  useEffect(() => {
    return () => {
      onCapturaChange?.(false);
    };
  }, [onCapturaChange]);

  const cicloNombrePorId = (idCiclo: string) => {
    const c = ciclos.find(item => item.id === idCiclo);
    return c ? formatCicloEscolar(c) : idCiclo;
  };

  const crearNuevoParaAlumno = () => {
    const cicloDestino = cicloId && cicloId !== 'TODOS' ? cicloId : cicloSugeridoId;
    setFolioEdicion(null);
    iniciarNuevoReporte(cicloDestino);
    actualizarBorrador(prev => ({
      ...prev,
      cicloId: cicloDestino || prev.cicloId,
      flujoRegistro: 'ALUMNO_DOCENTE',
      alumnos: [
        {
          alumnoId: alumno.id,
          grupoId: null,
          matricula: alumno.matricula ?? null,
          nombreCompleto: alumno.nombre_completo,
          carrera: alumno.licenciatura,
          grado: alumno.grado_actual ? String(alumno.grado_actual) : null,
        },
      ],
    }));
    setClaveForm(v => v + 1);
    setModo('FORMULARIO');
  };

  const abrirEdicion = (r: ReporteAcademicoDetalle) => {
    setFolioEdicion(r.folio);
    cargarReporteParaEdicion(r);
    setClaveForm(v => v + 1);
    setModo('FORMULARIO');
  };

  const limpiarFiltros = () => {
    setBusquedaInput('');
    setFechaDesde('');
    setFechaHasta('');
    setTipoFiltro('');
    setEstatusFiltro('');
    setTodosLosCiclos(false);
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

  if (!puedeGestionar) {
    return (
      <div className="ic ra-modulo ra-embebido">
        <div className="ra-panel text-sm text-[var(--ra-secundario)]">
          Este apartado está disponible únicamente para Administración, Coordinación Académica y Control Escolar.
        </div>
      </div>
    );
  }

  return (
    <div className="ic ra-modulo ra-embebido">
      {modo === 'LISTADO' ? (
        <div className="space-y-4">
          <div className="ra-cabecera">
            <div className="ra-cabecera-identidad">
              <p className="ra-eyebrow">Seguimiento Académico del Alumno</p>
              <h2 className="ra-titulo !text-xl">Reportes e incidentes</h2>
              <p className="ra-subtitulo">
                Incluye reportes individuales y grupales parciales donde participa el alumno (excluye incidentes generales marcados como «Todo el grupo»).
              </p>
            </div>

            <div className="ra-cabecera-controles">
              <SelectorCicloModulo
                ciclos={ciclos}
                cicloId={cicloId === 'TODOS' ? '' : cicloId}
                onChange={nuevoId => {
                  setTodosLosCiclos(!nuevoId);
                  setCicloId(nuevoId || 'TODOS');
                }}
                label="Ciclo escolar"
                ayuda="Sugerido automáticamente por fecha actual; marca «Todos los ciclos» abajo para ver el histórico completo."
              />
              <button type="button" className="ra-btn ra-btn-primario" onClick={crearNuevoParaAlumno}>
                <FilePlus2 size={16} aria-hidden="true" />
                Nuevo reporte para este alumno
              </button>
            </div>
          </div>

          <section className="ra-panel" aria-label="Filtros de reportes del alumno">
            <div className="ra-filtros-grid">
              <div className="ra-filtro-fecha">
                <CampoConAyuda
                  etiqueta="Fecha desde"
                  ayuda="Filtra reportes desde esta fecha."
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
                  ayuda="Filtra reportes hasta esta fecha."
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
                  etiqueta="Tipo de reporte"
                  ayuda="Filtra por Inasistencias, Problema de rendimiento o Incidente."
                >
                  <select
                    id={selectTipoId}
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
                  ayuda="Estado de atención del reporte."
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
                  etiqueta="Buscar folio, grupo o descripción"
                  ayuda="Coincide con el folio, código de grupo o texto de la descripción."
                >
                  <div className="ra-busqueda-input-wrap">
                    <Search size={16} aria-hidden="true" />
                    <input
                      id={inputBusquedaId}
                      type="search"
                      className="ra-control"
                      value={busquedaInput}
                      onChange={e => setBusquedaInput(e.target.value)}
                      placeholder="Folio, grupo o descripción…"
                    />
                  </div>
                </CampoConAyuda>
              </div>
            </div>

            <div className="ra-filtros-pie">
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
          </section>

          {errorCarga && (
            <EstadoError mensaje={errorCarga} onReintentar={() => void reintentarConsulta()} />
          )}

          {cargando && reportesDelAlumno.length === 0 && !errorCarga && (
            <div className="ra-panel py-10 text-center" role="status" aria-live="polite">
              <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-[var(--ra-acento-texto)]" aria-hidden="true" />
              <p className="m-0 font-semibold">Consultando reportes del alumno…</p>
            </div>
          )}

          {!cargando && !errorCarga && reportesDelAlumno.length === 0 && (
            <div className="ra-panel py-10 text-center">
              <ClipboardList size={30} className="mx-auto mb-3 text-[var(--ra-secundario)]" aria-hidden="true" />
              <h3 className="m-0 font-display text-base font-bold">
                Sin reportes registrados para este alumno en el contexto actual
              </h3>
              <p className="mx-auto mt-2 max-w-md text-xs text-[var(--ra-secundario)]">
                Activa «Consultar en todos los ciclos escolares» o registra un nuevo seguimiento individual para este alumno.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" className="ra-btn ra-btn-primario" onClick={crearNuevoParaAlumno}>
                  <FilePlus2 size={15} aria-hidden="true" />
                  Nuevo reporte para este alumno
                </button>
              </div>
            </div>
          )}

          {reportesDelAlumno.length > 0 && (
            <section className="ra-panel" aria-label="Listado de reportes del alumno">
              <div className="ra-tabla-scroll">
                <table className="ra-tabla">
                  <thead>
                    <tr>
                      <th>Folio / Ciclo</th>
                      <th>Fecha</th>
                      <th>Tipo / Origen</th>
                      <th>Resumen</th>
                      <th>Estatus</th>
                      <th>Acta / Drive</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportesDelAlumno.map(r => {
                      const alumnoRel = r.alumnos.find(a => a.alumnoId === alumno.id);
                      const grupoOrigen = alumnoRel?.grupoId
                        ? r.grupos.find(g => g.grupoId === alumnoRel.grupoId)
                        : null;
                      const driveValido = r.enlaceDrive && esEnlaceDriveValido(r.enlaceDrive);

                      return (
                        <tr key={r.id}>
                          <td>
                            <div className="font-bold">{r.folio}</div>
                            <div className="text-xs text-[var(--ra-secundario)]">
                              {r.cicloNombre || cicloNombrePorId(r.cicloId)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap">{formatearFechaCorta(r.fechaReporte)}</td>
                          <td>
                            <div className="flex flex-col items-start gap-1">
                              <span className={claseBadgeTipo(r.tipoReporte)}>
                                {ETIQUETA_TIPO[r.tipoReporte]}
                              </span>
                              {r.flujoRegistro === 'GRUPO' && (
                                <span className="ra-badge ra-badge-rol-grupo-parcial">
                                  <Users size={11} aria-hidden="true" />
                                  Grupo parcial{grupoOrigen?.codigoGrupoSnapshot ? `: ${grupoOrigen.codigoGrupoSnapshot}` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="max-w-[280px] text-xs">{r.descripcion}</td>
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
                {reportesDelAlumno.map(r => {
                  const alumnoRel = r.alumnos.find(a => a.alumnoId === alumno.id);
                  const grupoOrigen = alumnoRel?.grupoId
                    ? r.grupos.find(g => g.grupoId === alumnoRel.grupoId)
                    : null;
                  const driveValido = r.enlaceDrive && esEnlaceDriveValido(r.enlaceDrive);

                  return (
                    <article key={r.id} className="ra-tarjeta-movil">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm">{r.folio}</div>
                          <div className="text-xs text-[var(--ra-secundario)]">
                            {formatearFechaCorta(r.fechaReporte)} · {r.cicloNombre || cicloNombrePorId(r.cicloId)}
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

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={claseBadgeTipo(r.tipoReporte)}>
                          {ETIQUETA_TIPO[r.tipoReporte]}
                        </span>
                        {r.flujoRegistro === 'GRUPO' && (
                          <span className="ra-badge ra-badge-rol-grupo-parcial">
                            Grupo parcial{grupoOrigen?.codigoGrupoSnapshot ? `: ${grupoOrigen.codigoGrupoSnapshot}` : ''}
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
                          </a>
                        )}
                      </div>

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
            </section>
          )}
        </div>
      ) : (
        <FormularioReporteAcademico
          key={`ficha-alumno-form-${claveForm}`}
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
          onNuevoReporte={crearNuevoParaAlumno}
          onRecargarUltimaVersion={() => void recargarUltimaVersion()}
          onEstadoCapturaChange={manejarEstadoCaptura}
        />
      )}

      {reporteParaImprimir && (
        <ImpresionActaHechos
          borrador={convertirReporteABorrador(reporteParaImprimir)}
          folio={reporteParaImprimir.folio}
          cicloNombre={reporteParaImprimir.cicloNombre || cicloNombrePorId(reporteParaImprimir.cicloId)}
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
    </div>
  );
}

