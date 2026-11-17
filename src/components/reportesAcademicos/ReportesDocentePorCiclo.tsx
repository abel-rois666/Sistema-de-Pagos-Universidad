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
  Layers,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  User,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
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
import FormularioReporteAcademico from './FormularioReporteAcademico';
import ImpresionActaHechos from './ImpresionActaHechos';
import '../docencia/docencia.css';
import './reportesAcademicos.css';

export interface ReportesDocentePorCicloProps {
  key?: string;
  docenteId: string;
  nombre: string;
  claveDocente?: string | null;
  soloLectura?: boolean;
  onVolver: () => void;
  onActividad: (cambios: boolean, ocupado: boolean) => void;
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

export default function ReportesDocentePorCiclo({
  docenteId,
  nombre,
  claveDocente = null,
  soloLectura = false,
  onVolver,
  onActividad,
}: ReportesDocentePorCicloProps) {
  const { ciclos, currentUser, appConfig } = useAppStore();
  const puedeEditar = !soloLectura;

  const filtrosFijos = useMemo(() => ({ docenteId }), [docenteId]);

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
    moduloClave: 'reportes_docente',
    ciclos,
    usuarioId: currentUser?.id,
    filtrosFijos,
    cargarCatalogosFormulario: puedeEditar,
    permitirTodosLosCiclos: true,
  });

  const [modo, setModo] = useState<'LISTADO' | 'FORMULARIO'>('LISTADO');
  const [claveForm, setClaveForm] = useState(0);
  const [folioEdicion, setFolioEdicion] = useState<string | null>(null);
  const [todosLosCiclos, setTodosLosCiclos] = useState(false);
  const [cambiosSinGuardar, setCambiosSinGuardar] = useState(false);
  const [ocupadoCaptura, setOcupadoCaptura] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState<(() => void) | null>(null);

  const [busquedaInput, setBusquedaInput] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [estatusFiltro, setEstatusFiltro] = useState<'' | EstatusReporteAcademico>('');

  const [reporteParaImprimir, setReporteParaImprimir] = useState<ReporteAcademicoDetalle | null>(null);
  const [cambioEstatusObjetivo, setCambioEstatusObjetivo] = useState<ReporteAcademicoDetalle | null>(null);
  const [cambiandoEstatus, setCambiandoEstatus] = useState(false);

  const checkTodosCiclosId = useId();
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
        estatus: estatusFiltro || null,
        busqueda: busquedaInput.trim() || null,
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [busquedaInput, fechaDesde, fechaHasta, estatusFiltro, setFiltrosAdicionales]);

  const reportesDelDocente = useMemo(
    () => reportes.filter(r => r.docentes.some(d => d.docenteId === docenteId)),
    [reportes, docenteId]
  );

  const manejarEstadoCaptura = useCallback(
    (hayCambios: boolean, estaGuardando: boolean) => {
      setCambiosSinGuardar(hayCambios);
      setOcupadoCaptura(estaGuardando);
      onActividad(hayCambios, estaGuardando);
    },
    [onActividad]
  );

  useEffect(() => {
    return () => {
      onActividad(false, false);
    };
  }, [onActividad]);

  const solicitarAccion = (accion: () => void) => {
    if (ocupadoCaptura) return;
    if (modo === 'FORMULARIO' && cambiosSinGuardar) {
      setAccionPendiente(() => accion);
      return;
    }
    accion();
  };

  const cicloNombrePorId = (idCiclo: string) => {
    const c = ciclos.find(item => item.id === idCiclo);
    return c ? formatCicloEscolar(c) : idCiclo;
  };

  const crearIncidenteDocente = () => {
    if (!puedeEditar) return;
    const cicloDestino = cicloId && cicloId !== 'TODOS' ? cicloId : cicloSugeridoId;
    setFolioEdicion(null);
    iniciarNuevoReporte(cicloDestino);
    actualizarBorrador(prev => ({
      ...prev,
      cicloId: cicloDestino || prev.cicloId,
      flujoRegistro: 'ALUMNO_DOCENTE',
      tipoReporte: 'INCIDENTE',
      docentes: [
        {
          docenteId,
          nombreCompleto: nombre || 'Docente',
          claveDocente: claveDocente || null,
        },
      ],
    }));
    setClaveForm(v => v + 1);
    setCambiosSinGuardar(false);
    onActividad(false, false);
    setModo('FORMULARIO');
  };

  const abrirEdicion = (r: ReporteAcademicoDetalle) => {
    if (!puedeEditar) return;
    setFolioEdicion(r.folio);
    cargarReporteParaEdicion(r);
    setClaveForm(v => v + 1);
    setCambiosSinGuardar(false);
    onActividad(false, false);
    setModo('FORMULARIO');
  };

  const limpiarFiltros = () => {
    setBusquedaInput('');
    setFechaDesde('');
    setFechaHasta('');
    setEstatusFiltro('');
    setTodosLosCiclos(false);
  };

  const confirmarCambioEstatus = async () => {
    if (!cambioEstatusObjetivo || !puedeEditar) return;
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

  return (
    <div className="docencia-vista">
      <div className="docencia-barra">
        <button
          type="button"
          className="personal-boton"
          disabled={ocupadoCaptura}
          onClick={onVolver}
        >
          ← Volver a Docencia
        </button>
        <h3>Reportes e incidentes</h3>
      </div>

      <div className="ic ra-modulo ra-embebido ra-solo-tarjetas">
        {modo === 'LISTADO' ? (
          <div className="space-y-4">
            <div className="docencia-barra !my-0">
              <SelectorCicloModulo
                ciclos={ciclos}
                cicloId={cicloId === 'TODOS' ? '' : cicloId}
                onChange={nuevoId =>
                  solicitarAccion(() => {
                    setTodosLosCiclos(!nuevoId);
                    setCicloId(nuevoId || 'TODOS');
                  })
                }
                disabled={ocupadoCaptura}
                label="Ciclo escolar"
                ayuda="Sugerido automáticamente por fecha actual; activa «Todos los ciclos» abajo para consultar el historial docente completo."
              />

              {puedeEditar && (
                <button
                  type="button"
                  className="ra-btn ra-btn-primario"
                  disabled={ocupadoCaptura}
                  onClick={crearIncidenteDocente}
                >
                  <FilePlus2 size={15} aria-hidden="true" />
                  Registrar incidente con este docente
                </button>
              )}
            </div>

            <section className="ra-panel" aria-label="Filtros de incidentes del docente">
              <div className="ra-filtros-grid">
                <div className="ra-filtro-fecha">
                  <CampoConAyuda
                    etiqueta="Fecha desde"
                    ayuda="Filtra incidentes a partir de esta fecha."
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
                    ayuda="Filtra incidentes hasta esta fecha."
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
                    ayuda="Estado de atención del incidente."
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
                    etiqueta="Buscar folio, alumno, grupo o descripción"
                    ayuda="Localiza incidentes por folio, involucrados o descripción de hechos."
                  >
                    <div className="ra-busqueda-input-wrap">
                      <Search size={16} aria-hidden="true" />
                      <input
                        id={inputBusquedaId}
                        type="search"
                        className="ra-control"
                        value={busquedaInput}
                        onChange={e => setBusquedaInput(e.target.value)}
                        placeholder="Folio, involucrado o descripción…"
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
                  Todos los ciclos
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="ra-btn" onClick={limpiarFiltros} disabled={cargando}>
                    <RotateCcw size={15} aria-hidden="true" />
                    Limpiar
                  </button>
                  <button
                    type="button"
                    className="ra-btn"
                    onClick={() => void reintentarConsulta()}
                    disabled={cargando}
                  >
                    <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} aria-hidden="true" />
                    {cargando ? 'Consultando…' : 'Actualizar consulta'}
                  </button>
                </div>
              </div>
            </section>

            {errorCarga && (
              <EstadoError mensaje={errorCarga} onReintentar={() => void reintentarConsulta()} />
            )}

            {cargando && reportesDelDocente.length === 0 && !errorCarga && (
              <div className="ra-panel py-8 text-center" role="status" aria-live="polite">
                <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-[var(--ra-acento-texto)]" aria-hidden="true" />
                <p className="m-0 font-semibold">Consultando incidentes del docente…</p>
              </div>
            )}

            {!cargando && !errorCarga && reportesDelDocente.length === 0 && (
              <div className="ra-panel py-8 text-center">
                <ClipboardList size={28} className="mx-auto mb-3 text-[var(--ra-secundario)]" aria-hidden="true" />
                <h4 className="m-0 font-display text-base font-bold">
                  Sin incidentes registrados con este docente en el filtro actual
                </h4>
                <p className="mx-auto mt-2 max-w-md text-xs text-[var(--ra-secundario)]">
                  Aquí se muestran los incidentes donde participa el docente de manera individual o junto con grupos, alumnos u otros docentes.
                </p>
                {puedeEditar && (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" className="ra-btn ra-btn-primario" onClick={crearIncidenteDocente}>
                      <FilePlus2 size={15} aria-hidden="true" />
                      Registrar incidente con este docente
                    </button>
                  </div>
                )}
              </div>
            )}

            {reportesDelDocente.length > 0 && (
              <section className="ra-panel" aria-label="Listado de incidentes del docente">
                <div className="ra-tarjetas-movil">
                  {reportesDelDocente.map(r => {
                    const driveValido = r.enlaceDrive && esEnlaceDriveValido(r.enlaceDrive);
                    const otrosDocentes = r.docentes.filter(d => d.docenteId !== docenteId);

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
                            {r.estatus === 'RESUELTO' ? (
                              <CheckCircle2 size={12} aria-hidden="true" />
                            ) : (
                              <AlertCircle size={12} aria-hidden="true" />
                            )}
                            {r.estatus === 'RESUELTO' ? 'Resuelto' : 'En proceso'}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={claseBadgeTipo(r.tipoReporte)}>
                            {ETIQUETA_TIPO[r.tipoReporte]}
                          </span>
                          {r.tieneActaHechos && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ra-acento-texto)]">
                              <FileText size={12} aria-hidden="true" />
                              Con Acta
                            </span>
                          )}
                          {driveValido && r.enlaceDrive && (
                            <a
                              href={r.enlaceDrive}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ra-acento-texto)] underline"
                            >
                              <FolderOpen size={12} aria-hidden="true" />
                              Drive
                              <ExternalLink size={11} aria-hidden="true" />
                            </a>
                          )}
                        </div>

                        {(r.grupos.length > 0 || r.alumnos.length > 0 || otrosDocentes.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.grupos.map(g => (
                              <span
                                key={`g-${g.grupoId}`}
                                className={`ra-badge ${
                                  g.alcanceAlumnos === 'TODO_EL_GRUPO'
                                    ? 'ra-badge-rol-grupo-completo'
                                    : 'ra-badge-rol-grupo-parcial'
                                }`}
                              >
                                <Layers size={11} aria-hidden="true" />
                                {g.codigoGrupoSnapshot || g.grupoId}
                              </span>
                            ))}
                            {r.alumnos.map(a => (
                              <span key={`a-${a.alumnoId}`} className="ra-badge ra-badge-rol-alumno">
                                <User size={11} aria-hidden="true" />
                                {a.nombreSnapshot || a.alumnoId}
                              </span>
                            ))}
                            {otrosDocentes.map(d => (
                              <span key={`d-${d.docenteId}`} className="ra-badge ra-badge-rol-docente">
                                <Users size={11} aria-hidden="true" />
                                Par: {d.nombreDocenteSnapshot || 'Docente'}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="mt-2 mb-0 text-xs text-[var(--ra-texto)]">{r.descripcion}</p>

                        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--ra-borde)] pt-3">
                          {puedeEditar && (
                            <button
                              type="button"
                              className="ra-btn ra-btn-compacto flex-1"
                              onClick={() => abrirEdicion(r)}
                            >
                              <Edit3 size={13} aria-hidden="true" />
                              Consultar / Editar
                            </button>
                          )}
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
                          {puedeEditar && (
                            <button
                              type="button"
                              className="ra-btn ra-btn-compacto w-full"
                              onClick={() => setCambioEstatusObjetivo(r)}
                            >
                              {r.estatus === 'RESUELTO' ? 'Reabrir (En proceso)' : 'Marcar Resuelto'}
                            </button>
                          )}
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
            key={`ficha-docente-form-${docenteId}-${claveForm}`}
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
            onVolverListado={() => {
              setCambiosSinGuardar(false);
              onActividad(false, false);
              setModo('LISTADO');
            }}
            onNuevoReporte={crearIncidenteDocente}
            onRecargarUltimaVersion={() => void recargarUltimaVersion()}
            onEstadoCapturaChange={manejarEstadoCaptura}
          />
        )}
      </div>

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

      <ModalConfirmacion
        isOpen={Boolean(accionPendiente)}
        title="Hay cambios sin guardar"
        message="Puedes continuar editando o descartar la captura antes de cambiar la consulta."
        confirmText="Descartar y continuar"
        cancelText="Continuar editando"
        onCancel={() => setAccionPendiente(null)}
        onConfirm={() => {
          const ejecutar = accionPendiente;
          setAccionPendiente(null);
          setCambiosSinGuardar(false);
          onActividad(false, false);
          ejecutar?.();
        }}
      />
    </div>
  );
}

