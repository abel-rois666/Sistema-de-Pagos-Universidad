import { type FormEvent, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';
import type { AppConfig, CicloEscolar } from '../../types';
import { formatCicloEscolar } from '../../utils/formatUtils';
import type {
  AlcanceGrupoReporte as AlcanceGrupo,
  BorradorReporteAcademico as BorradorReporte,
  FlujoRegistroReporte as FlujoRegistro,
  OpcionAlumnoReporte as OpcionAlumno,
  OpcionDocenteReporte as OpcionDocente,
  OpcionGrupoReporte as OpcionGrupo,
  OpcionPersonalReporte as OpcionPersonal,
  ResultadoValidacionReporte as ResultadoValidacion,
  TipoReporteAcademico as TipoReporte,
} from '../../reportesAcademicos/types';
import type { EstadoConflictoRevisionReporte as ConflictoEstado } from '../../hooks/useReportesAcademicos';
import type { ResultadoGuardarReporte as ResultadoGuardado } from '../../services/reportesAcademicosService';
import DrivePicker from '../DrivePicker';
import { CampoConAyuda } from '../ui/AyudaContextual';
import DatoInformativo from '../ui/DatoInformativo';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import SelectorCicloModulo from '../ui/SelectorCicloModulo';
import EditorActaHechos from './EditorActaHechos';

export interface FormularioReporteAcademicoProps {
  key?: string;
  ciclos: readonly CicloEscolar[];
  borrador: BorradorReporte;
  validacionActual: ResultadoValidacion;
  folioEdicion?: string | null;
  appConfig?: AppConfig | null;
  alumnosCatalogo: readonly OpcionAlumno[];
  docentesActivos: readonly OpcionDocente[];
  gruposCiclo: readonly OpcionGrupo[];
  administrativosActivos: readonly OpcionPersonal[];
  personalTestigosActivo: readonly OpcionPersonal[];
  cargandoCatalogos: boolean;
  errorCatalogos: string | null;
  guardando: boolean;
  errorGuardado: string | null;
  conflictoRevision: ConflictoEstado | null;
  onReintentarCatalogos: () => void;
  onActualizarBorrador: (
    actualizador: Partial<BorradorReporte> | ((prev: BorradorReporte) => BorradorReporte)
  ) => void;
  onCambiarAlcanceGrupo: (grupoId: string, alcanceAlumnos: AlcanceGrupo) => void;
  onGuardar: () => Promise<ResultadoGuardado | null>;
  onVolverListado: () => void;
  onNuevoReporte: () => void;
  onRecargarUltimaVersion?: () => void;
  onEstadoCapturaChange?: (hayCambios: boolean, guardando: boolean) => void;
}

export default function FormularioReporteAcademico({
  ciclos,
  borrador,
  validacionActual,
  folioEdicion,
  appConfig,
  alumnosCatalogo,
  docentesActivos,
  gruposCiclo,
  administrativosActivos,
  personalTestigosActivo,
  cargandoCatalogos,
  errorCatalogos,
  guardando,
  errorGuardado,
  conflictoRevision,
  onReintentarCatalogos,
  onActualizarBorrador,
  onCambiarAlcanceGrupo,
  onGuardar,
  onVolverListado,
  onNuevoReporte,
  onRecargarUltimaVersion,
  onEstadoCapturaChange,
}: FormularioReporteAcademicoProps) {
  const selectTipoId = useId();
  const selectAlumnoId = useId();
  const selectDocenteId = useId();
  const selectGrupoId = useId();
  const inputFechaId = useId();
  const selectEstatusId = useId();

  const [alumnoPendienteId, setAlumnoPendienteId] = useState('');
  const [docentePendienteId, setDocentePendienteId] = useState('');
  const [grupoPendienteId, setGrupoPendienteId] = useState('');
  const [alumnosGrupoPendiente, setAlumnosGrupoPendiente] = useState<Record<string, string>>({});
  const [mostrarErrores, setMostrarErrores] = useState(false);

  const [confirmacionPendiente, setConfirmacionPendiente] = useState<{
    titulo: string;
    mensaje: string;
    confirmText: string;
    type?: 'danger' | 'warning' | 'info';
    accion: () => void;
  } | null>(null);

  // Seguimiento de cambios sin guardar para ProteccionCaptura
  const serializarBorrador = (b: BorradorReporte) =>
    JSON.stringify({
      id: b.id ?? null,
      cicloId: b.cicloId,
      flujoRegistro: b.flujoRegistro,
      tipoReporte: b.tipoReporte,
      fechaReporte: b.fechaReporte,
      descripcion: b.descripcion,
      estatus: b.estatus,
      tieneActaHechos: b.tieneActaHechos,
      enlaceDrive: b.enlaceDrive ?? null,
      notasEvidencia: b.notasEvidencia ?? null,
      alumnos: b.alumnos.map(a => ({ alumnoId: a.alumnoId, grupoId: a.grupoId ?? null })),
      grupos: b.grupos.map(g => ({ grupoId: g.grupoId, alcanceAlumnos: g.alcanceAlumnos })),
      docentes: b.docentes.map(d => d.docenteId),
      acta: b.acta,
    });

  const claveIdentidad = `${borrador.id ?? 'nuevo'}::${borrador.revision ?? 1}`;
  const [snapshotBase, setSnapshotBase] = useState<{ clave: string; json: string }>(() => ({
    clave: claveIdentidad,
    json: serializarBorrador(borrador),
  }));

  useEffect(() => {
    if (snapshotBase.clave !== claveIdentidad) {
      setSnapshotBase({
        clave: claveIdentidad,
        json: serializarBorrador(borrador),
      });
      setMostrarErrores(false);
    }
  }, [claveIdentidad, snapshotBase.clave, borrador]);

  const hayCambiosSinGuardar = useMemo(() => {
    if (snapshotBase.clave !== claveIdentidad) return false;
    return serializarBorrador(borrador) !== snapshotBase.json;
  }, [borrador, claveIdentidad, snapshotBase]);

  const solicitarSalida = useProteccionCaptura(hayCambiosSinGuardar, guardando);

  useEffect(() => {
    onEstadoCapturaChange?.(hayCambiosSinGuardar, guardando);
    return () => {
      onEstadoCapturaChange?.(false, false);
    };
  }, [hayCambiosSinGuardar, guardando, onEstadoCapturaChange]);

  const esEdicion = Boolean(borrador.id);
  const cicloActual = useMemo(
    () => ciclos.find(c => c.id === borrador.cicloId) ?? null,
    [ciclos, borrador.cicloId]
  );

  // Catálogos ordenados alfabéticamente A–Z para selectores
  const opcionesAlumnos = useMemo(
    () =>
      [...alumnosCatalogo]
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX'))
        .map(a => ({
          value: a.id,
          label: `${a.nombreCompleto}${a.matricula ? ` · Mat. ${a.matricula}` : ''}${
            a.carrera ? ` · ${a.carrera}` : ''
          }${a.estatus ? ` [${a.estatus}]` : ''}`,
        })),
    [alumnosCatalogo]
  );

  const opcionesDocentes = useMemo(
    () =>
      [...docentesActivos]
        .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX'))
        .map(d => ({
          value: d.id,
          label: `${d.nombreCompleto}${d.claveDocente ? ` (${d.claveDocente})` : ''}`,
        })),
    [docentesActivos]
  );

  const opcionesGrupos = useMemo(
    () =>
      [...gruposCiclo]
        .sort((a, b) => a.codigoGrupo.localeCompare(b.codigoGrupo, 'es-MX', { numeric: true }))
        .map(g => ({
          value: g.id,
          label: `${g.codigoGrupo}${g.carrera ? ` · ${g.carrera}` : ''}${
            g.grado ? ` · ${g.grado}°` : ''
          }${g.turno ? ` · ${g.turno}` : ''} (${g.alumnosInscritos.length} alumnos)`,
        })),
    [gruposCiclo]
  );

  const mapaGrupos = useMemo(() => new Map(gruposCiclo.map(g => [g.id, g])), [gruposCiclo]);

  const erroresCampos = mostrarErrores ? validacionActual.erroresCampos : {};

  // Acciones de cambio de flujo y tipo con protección si hay captura incompatible
  const cambiarFlujo = (nuevoFlujo: FlujoRegistro) => {
    if (nuevoFlujo === borrador.flujoRegistro) return;

    if (nuevoFlujo === 'GRUPO' && borrador.alumnos.length > 0) {
      setConfirmacionPendiente({
        titulo: 'Cambiar a registro Por Grupo',
        mensaje:
          'Al cambiar al flujo Por Grupo, los alumnos seleccionados de forma individual se limpiarán porque en el reporte grupal se eligen desde cada grupo parcial. Se conservará el ciclo, la descripción, tus docentes y el Acta de Hechos.',
        confirmText: 'Cambiar a Por Grupo',
        type: 'warning',
        accion: () => {
          onActualizarBorrador(prev => ({
            ...prev,
            flujoRegistro: 'GRUPO',
            tipoReporte: 'INCIDENTE',
            alumnos: [],
          }));
          setAlumnoPendienteId('');
        },
      });
      return;
    }

    if (nuevoFlujo === 'ALUMNO_DOCENTE' && borrador.grupos.length > 0) {
      setConfirmacionPendiente({
        titulo: 'Cambiar a registro Por Alumno / Docente',
        mensaje:
          'Al cambiar al flujo Por Alumno / Docente se retirarán los grupos seleccionados y los alumnos asociados únicamente por alcance grupal. Se conservarán los docentes, la descripción y el acta.',
        confirmText: 'Cambiar a Por Alumno / Docente',
        type: 'warning',
        accion: () => {
          onActualizarBorrador(prev => ({
            ...prev,
            flujoRegistro: 'ALUMNO_DOCENTE',
            grupos: [],
            alumnos: [],
          }));
          setGrupoPendienteId('');
        },
      });
      return;
    }

    onActualizarBorrador(prev => ({
      ...prev,
      flujoRegistro: nuevoFlujo,
      tipoReporte: nuevoFlujo === 'GRUPO' ? 'INCIDENTE' : prev.tipoReporte,
    }));
  };

  const cambiarTipoReporte = (nuevoTipo: TipoReporte) => {
    if (nuevoTipo === borrador.tipoReporte) return;
    const perderaDatos =
      (nuevoTipo === 'INASISTENCIAS' || nuevoTipo === 'PROBLEMA_RENDIMIENTO') &&
      (borrador.docentes.length > 0 ||
        borrador.tieneActaHechos ||
        Boolean(borrador.enlaceDrive) ||
        borrador.grupos.length > 0);

    if (perderaDatos) {
      setConfirmacionPendiente({
        titulo: 'Cambiar tipo de reporte',
        mensaje:
          'Los reportes de Inasistencias y Problema de Rendimiento Académico aplican únicamente a alumnos individuales y no incluyen docentes, enlace a Drive ni Acta de Hechos. ¿Deseas continuar y limpiar esos apartados?',
        confirmText: 'Cambiar tipo',
        type: 'warning',
        accion: () => {
          onActualizarBorrador({ tipoReporte: nuevoTipo });
        },
      });
      return;
    }

    onActualizarBorrador({ tipoReporte: nuevoTipo });
  };

  const agregarAlumnoIndividual = (alumnoId: string) => {
    if (!alumnoId) return;
    const encontrado = alumnosCatalogo.find(a => a.id === alumnoId);
    if (!encontrado) return;
    if (borrador.alumnos.some(a => a.alumnoId === encontrado.id)) {
      toast('Este alumno ya fue agregado al reporte.');
      return;
    }
    onActualizarBorrador(prev => ({
      ...prev,
      alumnos: [
        ...prev.alumnos,
        {
          alumnoId: encontrado.id,
          grupoId: null,
          matricula: encontrado.matricula,
          nombreCompleto: encontrado.nombreCompleto,
          carrera: encontrado.carrera,
          grado: encontrado.grado,
        },
      ],
    }));
    setAlumnoPendienteId('');
  };

  const quitarAlumno = (alumnoId: string) => {
    onActualizarBorrador(prev => ({
      ...prev,
      alumnos: prev.alumnos.filter(a => a.alumnoId !== alumnoId),
    }));
  };

  const agregarDocente = (docenteId: string) => {
    if (!docenteId) return;
    const encontrado = docentesActivos.find(d => d.id === docenteId);
    if (!encontrado) return;
    if (borrador.docentes.some(d => d.docenteId === encontrado.id)) {
      toast('Este docente ya fue agregado al reporte.');
      return;
    }
    onActualizarBorrador(prev => ({
      ...prev,
      docentes: [
        ...prev.docentes,
        {
          docenteId: encontrado.id,
          nombreCompleto: encontrado.nombreCompleto,
          claveDocente: encontrado.claveDocente,
        },
      ],
    }));
    setDocentePendienteId('');
  };

  const quitarDocente = (docenteId: string) => {
    onActualizarBorrador(prev => ({
      ...prev,
      docentes: prev.docentes.filter(d => d.docenteId !== docenteId),
    }));
  };

  const agregarGrupo = (grupoId: string) => {
    if (!grupoId) return;
    const encontrado = mapaGrupos.get(grupoId);
    if (!encontrado) return;
    if (borrador.grupos.some(g => g.grupoId === encontrado.id)) {
      toast('Este grupo ya fue agregado al reporte.');
      return;
    }
    onActualizarBorrador(prev => ({
      ...prev,
      grupos: [
        ...prev.grupos,
        {
          grupoId: encontrado.id,
          alcanceAlumnos: 'TODO_EL_GRUPO',
          codigoGrupo: encontrado.codigoGrupo,
          carrera: encontrado.carrera,
          grado: encontrado.grado,
          turno: encontrado.turno,
        },
      ],
    }));
    setGrupoPendienteId('');
  };

  const quitarGrupo = (grupoId: string) => {
    onActualizarBorrador(prev => ({
      ...prev,
      grupos: prev.grupos.filter(g => g.grupoId !== grupoId),
      alumnos: prev.alumnos.filter(a => a.grupoId !== grupoId),
    }));
  };

  const agregarAlumnoDeGrupoParcial = (grupoId: string, alumnoId: string) => {
    if (!alumnoId) return;
    const grupo = mapaGrupos.get(grupoId);
    const alumno = grupo?.alumnosInscritos.find(a => a.id === alumnoId);
    if (!alumno) return;

    if (borrador.alumnos.some(a => a.alumnoId === alumno.id)) {
      toast('Este alumno ya está seleccionado en el reporte.');
      return;
    }

    onActualizarBorrador(prev => ({
      ...prev,
      alumnos: [
        ...prev.alumnos,
        {
          alumnoId: alumno.id,
          grupoId,
          matricula: alumno.matricula,
          nombreCompleto: alumno.nombreCompleto,
          carrera: alumno.carrera,
          grado: alumno.grado,
        },
      ],
    }));
    setAlumnosGrupoPendiente(prev => ({ ...prev, [grupoId]: '' }));
  };

  const manejarGuardar = async (e: FormEvent) => {
    e.preventDefault();
    setMostrarErrores(true);
    if (!validacionActual.valido) {
      toast.error(validacionActual.errores[0] || 'Revisa los campos señalados antes de guardar.');
      return;
    }

    const res = await onGuardar();
    if (res) {
      setMostrarErrores(false);
      toast.success(
        res.accion === 'CREAR'
          ? `Reporte registrado con folio ${res.folio}.`
          : `Reporte ${res.folio} actualizado correctamente.`
      );
    }
  };

  return (
    <form onSubmit={e => void manejarGuardar(e)} noValidate className="space-y-5">
      {/* Barra superior del formulario */}
      <div className="ra-panel flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="ra-btn"
            onClick={() => solicitarSalida(onVolverListado)}
            disabled={guardando}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Volver al listado
          </button>
          <div>
            <h2 className="m-0 font-display text-lg font-bold">
              {esEdicion
                ? `Editando reporte ${folioEdicion || ''}`
                : 'Nuevo reporte académico'}
            </h2>
            <p className="m-0 text-xs text-[var(--ra-secundario)]">
              {esEdicion
                ? `Revisión actual: v${borrador.revision ?? 1}. Los cambios actualizarán el historial auditado.`
                : 'El folio consecutivo se asignará automáticamente al guardar según el ciclo escolar.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ra-btn"
            disabled={guardando}
            onClick={() => solicitarSalida(onNuevoReporte)}
          >
            <Plus size={16} aria-hidden="true" />
            Nuevo / Limpiar
          </button>
          <button
            type="submit"
            className="ra-btn ra-btn-primario"
            disabled={guardando}
          >
            <Save size={16} aria-hidden="true" />
            {guardando
              ? 'Guardando…'
              : esEdicion
                ? 'Guardar cambios'
                : 'Registrar reporte'}
          </button>
        </div>
      </div>

      {/* Aviso de conflicto de revisión optimista o errores de red/catálogo */}
      {conflictoRevision && (
        <div className="ra-alerta ra-alerta-conflicto" role="alert">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <strong className="block">Conflicto de edición concurrente detectado</strong>
            <p className="mt-1 mb-0">{conflictoRevision.mensaje}</p>
            {onRecargarUltimaVersion && (
              <button
                type="button"
                className="ra-btn ra-btn-compacto mt-2"
                onClick={() =>
                  setConfirmacionPendiente({
                    titulo: 'Recargar versión más reciente',
                    mensaje:
                      'Se cargarán los datos actualizados desde el servidor y se descartarán los cambios no guardados que realizaste en esta pantalla.',
                    confirmText: 'Recargar versión vigente',
                    type: 'warning',
                    accion: onRecargarUltimaVersion,
                  })
                }
              >
                <RefreshCw size={14} aria-hidden="true" />
                Recargar datos vigentes del servidor
              </button>
            )}
          </div>
        </div>
      )}

      {errorGuardado && !conflictoRevision && (
        <div className="ra-alerta ra-alerta-error" role="alert">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <strong className="block">No se pudo guardar el reporte</strong>
            <p className="mt-1 mb-0">{errorGuardado}</p>
          </div>
        </div>
      )}

      {errorCatalogos && (
        <div className="ra-alerta ra-alerta-error" role="alert">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
            <span>Error al cargar catálogos de selección: {errorCatalogos}</span>
            <button
              type="button"
              className="ra-btn ra-btn-compacto"
              onClick={onReintentarCatalogos}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Reintentar catálogos
            </button>
          </div>
        </div>
      )}

      {/* Bloque 1: Flujo de registro, Ciclo y Tipo */}
      <section className="ra-panel">
        <h3 className="ra-panel-titulo">1. Flujo de trabajo, ciclo y tipo de reporte</h3>

        <div className="mb-4">
          <CampoConAyuda
            etiqueta="Flujo de registro"
            ayuda="Elige «Por Alumno / Docente» para inasistencias, rendimiento académico o incidentes individuales; elige «Por Grupo» para incidentes grupales completos o parciales."
          >
            <div className="ra-flujo-selector" role="group" aria-label="Flujo de registro">
              <button
                type="button"
                className={`ra-flujo-btn ${
                  borrador.flujoRegistro === 'ALUMNO_DOCENTE' ? 'es-activo' : ''
                }`}
                aria-pressed={borrador.flujoRegistro === 'ALUMNO_DOCENTE'}
                disabled={guardando}
                onClick={() => cambiarFlujo('ALUMNO_DOCENTE')}
              >
                <User size={16} aria-hidden="true" />
                Por Alumno / Docente
              </button>
              <button
                type="button"
                className={`ra-flujo-btn ${borrador.flujoRegistro === 'GRUPO' ? 'es-activo' : ''}`}
                aria-pressed={borrador.flujoRegistro === 'GRUPO'}
                disabled={guardando}
                onClick={() => cambiarFlujo('GRUPO')}
              >
                <Users size={16} aria-hidden="true" />
                Por Grupo
              </button>
            </div>
          </CampoConAyuda>
        </div>

        <div className="ra-form-grid">
          <div>
            {esEdicion ? (
              <DatoInformativo
                etiqueta="Ciclo escolar del reporte"
                ayuda="El ciclo de un reporte registrado no puede modificarse porque determina su folio consecutivo."
                valor={
                  <span className="text-sm font-bold">
                    {cicloActual ? formatCicloEscolar(cicloActual) : borrador.cicloId}
                  </span>
                }
              />
            ) : (
              <SelectorCicloModulo
                ciclos={ciclos}
                cicloId={borrador.cicloId}
                onChange={nuevoCicloId =>
                  onActualizarBorrador(prev => ({
                    ...prev,
                    cicloId: nuevoCicloId,
                    // Si cambia de ciclo, limpiamos grupos que pudieran ser de otro ciclo
                    grupos: [],
                    alumnos:
                      prev.flujoRegistro === 'GRUPO' ? [] : prev.alumnos,
                  }))
                }
                label="Ciclo escolar del reporte"
                ayuda="Sugerido automáticamente según la fecha actual y las fechas configuradas del ciclo. Distingue periodicidad y conserva el UUID exacto."
                disabled={guardando}
                className="!max-w-none"
              />
            )}
            {erroresCampos.cicloId && (
              <p className="ra-error-campo" role="alert">
                {erroresCampos.cicloId}
              </p>
            )}
          </div>

          <div>
            {borrador.flujoRegistro === 'GRUPO' ? (
              <DatoInformativo
                etiqueta="Tipo de reporte"
                ayuda="Los reportes registrados por grupo siempre corresponden a Incidentes."
                valor={
                  <span className="ra-badge ra-badge-tipo-incidente">
                    Incidente (fijo en flujo Por Grupo)
                  </span>
                }
              />
            ) : (
              <CampoConAyuda
                etiqueta="Tipo de reporte"
                ayuda="Inasistencias y Problema de Rendimiento aplican exclusivamente a alumnos; Incidente habilita alumnos, docentes, evidencia en Drive y Acta de Hechos."
              >
                <select
                  id={selectTipoId}
                  className={`ra-control ${erroresCampos.tipoReporte ? 'con-error' : ''}`}
                  value={borrador.tipoReporte}
                  disabled={guardando}
                  onChange={e => cambiarTipoReporte(e.target.value as TipoReporte)}
                >
                  <option value="INASISTENCIAS">Inasistencias</option>
                  <option value="PROBLEMA_RENDIMIENTO">Problema de Rendimiento Académico</option>
                  <option value="INCIDENTE">Incidente</option>
                </select>
                {erroresCampos.tipoReporte && (
                  <p className="ra-error-campo" role="alert">
                    {erroresCampos.tipoReporte}
                  </p>
                )}
              </CampoConAyuda>
            )}
          </div>

          <CampoConAyuda
            etiqueta="Fecha del reporte"
            ayuda="Fecha en que ocurrió o se documenta la situación reportada."
          >
            <input
              id={inputFechaId}
              type="date"
              className={`ra-control ${erroresCampos.fechaReporte ? 'con-error' : ''}`}
              value={borrador.fechaReporte}
              disabled={guardando}
              onChange={e => onActualizarBorrador({ fechaReporte: e.target.value })}
            />
            {erroresCampos.fechaReporte && (
              <p className="ra-error-campo" role="alert">
                {erroresCampos.fechaReporte}
              </p>
            )}
          </CampoConAyuda>
        </div>
      </section>

      {/* Bloque 2: Participantes */}
      <section className="ra-panel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="ra-panel-titulo m-0">2. Personas o grupos involucrados</h3>
          {cargandoCatalogos && (
            <span className="text-xs font-medium text-[var(--ra-secundario)]">
              Cargando catálogos…
            </span>
          )}
        </div>

        {/* Flujo ALUMNO_DOCENTE */}
        {borrador.flujoRegistro === 'ALUMNO_DOCENTE' && (
          <div className="space-y-5">
            {/* Buscador de alumnos */}
            <div className="ra-panel-suave">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <CampoConAyuda
                    etiqueta="Seleccionar alumno(s) (todos los estatus en orden A–Z)"
                    ayuda="Incluye alumnos activos, bajas, egresados o cualquier estatus histórico para seguimiento académico completo."
                  >
                    <SelectorBusqueda
                      id={selectAlumnoId}
                      value={alumnoPendienteId}
                      opciones={[
                        { value: '', label: 'Buscar alumno por nombre o matrícula…' },
                        ...opcionesAlumnos,
                      ]}
                      onChange={val => {
                        setAlumnoPendienteId(val);
                        if (val) agregarAlumnoIndividual(val);
                      }}
                      etiqueta="Buscador de alumnos"
                      placeholder="Buscar alumno por nombre o matrícula…"
                      disabled={guardando}
                    />
                  </CampoConAyuda>
                </div>
              </div>

              {borrador.alumnos.length > 0 ? (
                <div className="ra-chip-lista">
                  {borrador.alumnos.map(a => (
                    <span key={a.alumnoId} className="ra-chip">
                      <GraduationCap size={15} className="text-[var(--ra-acento-texto)]" aria-hidden="true" />
                      <span>
                        <strong>{a.nombreCompleto || 'Alumno'}</strong>
                        {a.matricula ? ` · ${a.matricula}` : ''}
                        {a.carrera ? ` · ${a.carrera}` : ''}
                      </span>
                      <button
                        type="button"
                        className="ra-chip-quitar"
                        aria-label={`Quitar alumno ${a.nombreCompleto || a.alumnoId}`}
                        onClick={() => quitarAlumno(a.alumnoId)}
                        disabled={guardando}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="ra-ayuda-nota mt-2 mb-0">
                  Ningún alumno seleccionado todavía. Elige uno o varios desde el buscador.
                </p>
              )}
              {(erroresCampos.alumnos || erroresCampos.participantes) && (
                <p className="ra-error-campo" role="alert">
                  {erroresCampos.alumnos || erroresCampos.participantes}
                </p>
              )}
            </div>

            {/* Buscador de docentes (solo cuando tipo === INCIDENTE) */}
            {borrador.tipoReporte === 'INCIDENTE' && (
              <div className="ra-panel-suave">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1">
                    <CampoConAyuda
                      etiqueta="Seleccionar docente(s) involucrado(s) (opcional si hay alumno; solo activos)"
                      ayuda="Muestra únicamente docentes activos ordenados alfabéticamente."
                    >
                      <SelectorBusqueda
                        id={selectDocenteId}
                        value={docentePendienteId}
                        opciones={[
                          { value: '', label: 'Buscar docente activo…' },
                          ...opcionesDocentes,
                        ]}
                        onChange={val => {
                          setDocentePendienteId(val);
                          if (val) agregarDocente(val);
                        }}
                        etiqueta="Buscador de docentes activos"
                        placeholder="Buscar docente activo…"
                        disabled={guardando}
                      />
                    </CampoConAyuda>
                  </div>
                </div>

                {borrador.docentes.length > 0 ? (
                  <div className="ra-chip-lista">
                    {borrador.docentes.map(d => (
                      <span key={d.docenteId} className="ra-chip">
                        <User size={15} className="text-[var(--ra-acento-texto)]" aria-hidden="true" />
                        <span>
                          <strong>{d.nombreCompleto}</strong>
                          {d.claveDocente ? ` · ${d.claveDocente}` : ''}
                        </span>
                        <button
                          type="button"
                          className="ra-chip-quitar"
                          aria-label={`Quitar docente ${d.nombreCompleto || d.docenteId}`}
                          onClick={() => quitarDocente(d.docenteId)}
                          disabled={guardando}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="ra-ayuda-nota mt-2 mb-0">
                    No has añadido docentes. En incidentes individuales puedes seleccionar alumnos, docentes o ambos.
                  </p>
                )}

                <div className="mt-3 border-t border-[var(--ra-borde)] pt-3 text-xs text-[var(--ra-secundario)]">
                  <span>¿El incidente requiere vincular uno o varios grupos del ciclo? </span>
                  <button
                    type="button"
                    className="font-bold text-[var(--ra-acento-texto)] underline cursor-pointer bg-transparent border-0 p-0"
                    onClick={() => cambiarFlujo('GRUPO')}
                  >
                    Cambiar a flujo Por Grupo conservando mis datos
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Flujo GRUPO */}
        {borrador.flujoRegistro === 'GRUPO' && (
          <div className="space-y-5">
            <div className="ra-panel-suave">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[260px] flex-1">
                  <CampoConAyuda
                    etiqueta="Seleccionar grupo(s) del ciclo escolar elegido"
                    ayuda="Muestra únicamente los grupos pertenecientes al ciclo escolar del reporte."
                  >
                    <SelectorBusqueda
                      id={selectGrupoId}
                      value={grupoPendienteId}
                      opciones={[
                        {
                          value: '',
                          label: borrador.cicloId
                            ? opcionesGrupos.length > 0
                              ? 'Buscar grupo por código o carrera…'
                              : 'No hay grupos registrados en este ciclo'
                            : 'Primero elige un ciclo escolar',
                        },
                        ...opcionesGrupos,
                      ]}
                      onChange={val => {
                        setGrupoPendienteId(val);
                        if (val) agregarGrupo(val);
                      }}
                      etiqueta="Buscador de grupos del ciclo"
                      placeholder="Buscar grupo por código o carrera…"
                      disabled={guardando || !borrador.cicloId}
                    />
                  </CampoConAyuda>
                </div>
              </div>

              {erroresCampos.grupos && (
                <p className="ra-error-campo" role="alert">
                  {erroresCampos.grupos}
                </p>
              )}

              {borrador.grupos.length === 0 ? (
                <p className="ra-ayuda-nota mt-3 mb-0">
                  Agrega al menos un grupo del ciclo para indicar si el incidente aplica a todo el grupo o a alumnos específicos.
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {borrador.grupos.map(g => {
                    const grupoInfo = mapaGrupos.get(g.grupoId);
                    const inscritos = grupoInfo?.alumnosInscritos ?? [];
                    const alumnosElegidosDelGrupo = borrador.alumnos.filter(
                      a => a.grupoId === g.grupoId
                    );
                    const opcionesInscritos = inscritos
                      .filter(ins => !borrador.alumnos.some(sel => sel.alumnoId === ins.id))
                      .map(ins => ({
                        value: ins.id,
                        label: `${ins.nombreCompleto}${ins.matricula ? ` · Mat. ${ins.matricula}` : ''}`,
                      }));

                    return (
                      <div
                        key={g.grupoId}
                        className="rounded-xl border border-[var(--ra-borde)] bg-[var(--ra-superficie)] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Layers size={16} className="text-[var(--ra-acento-texto)]" aria-hidden="true" />
                              <strong className="text-base">Grupo {g.codigoGrupo || g.grupoId}</strong>
                              <span
                                className={`ra-badge ${
                                  g.alcanceAlumnos === 'TODO_EL_GRUPO'
                                    ? 'ra-badge-rol-grupo-completo'
                                    : 'ra-badge-rol-grupo-parcial'
                                }`}
                              >
                                {g.alcanceAlumnos === 'TODO_EL_GRUPO'
                                  ? 'Todo el grupo'
                                  : 'Solo una parte del grupo'}
                              </span>
                            </div>
                            <p className="mt-1 mb-0 text-xs text-[var(--ra-secundario)]">
                              {[g.carrera, g.grado ? `${g.grado}°` : null, g.turno]
                                .filter(Boolean)
                                .join(' · ') || 'Sin detalles de carrera/turno'}
                            </p>
                          </div>

                          <button
                            type="button"
                            className="ra-btn ra-btn-compacto ra-btn-peligro"
                            onClick={() => quitarGrupo(g.grupoId)}
                            disabled={guardando}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Quitar grupo
                          </button>
                        </div>

                        {/* Alcance: Todo el grupo vs Solo una parte */}
                        <div className="mt-3 flex flex-wrap gap-3">
                          <label
                            className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                              g.alcanceAlumnos === 'TODO_EL_GRUPO'
                                ? 'border-[var(--ra-acento)] bg-[var(--ra-info-fondo)] text-[var(--ra-info-texto)]'
                                : 'border-[var(--ra-borde)] bg-[var(--ra-superficie-suave)]'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`alcance-${g.grupoId}`}
                              checked={g.alcanceAlumnos === 'TODO_EL_GRUPO'}
                              disabled={guardando}
                              onChange={() => onCambiarAlcanceGrupo(g.grupoId, 'TODO_EL_GRUPO')}
                            />
                            Todo el grupo
                          </label>

                          <label
                            className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                              g.alcanceAlumnos === 'PARCIAL'
                                ? 'border-[var(--ra-acento)] bg-[var(--ra-info-fondo)] text-[var(--ra-info-texto)]'
                                : 'border-[var(--ra-borde)] bg-[var(--ra-superficie-suave)]'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`alcance-${g.grupoId}`}
                              checked={g.alcanceAlumnos === 'PARCIAL'}
                              disabled={guardando}
                              onChange={() => onCambiarAlcanceGrupo(g.grupoId, 'PARCIAL')}
                            />
                            Solo una parte del grupo
                          </label>
                        </div>

                        {g.alcanceAlumnos === 'TODO_EL_GRUPO' ? (
                          <p className="ra-ayuda-nota mt-2 mb-0">
                            Se mencionará únicamente al grupo en el Acta de Hechos y el reporte aparecerá solo en Grupos y en Consulta general (no se vincula a fichas individuales).
                          </p>
                        ) : (
                          <div className="mt-3 border-t border-[var(--ra-borde)] pt-3">
                            <CampoConAyuda
                              etiqueta={`Seleccionar alumnos del grupo ${g.codigoGrupo || ''} involucrados`}
                              ayuda="Estos alumnos sí quedarán vinculados en sus fichas individuales y listados como firmantes del Acta de Hechos."
                            >
                              <SelectorBusqueda
                                id={`grupo-parcial-${g.grupoId}`}
                                value={alumnosGrupoPendiente[g.grupoId] ?? ''}
                                opciones={[
                                  {
                                    value: '',
                                    label:
                                      inscritos.length > 0
                                        ? 'Elegir alumno inscrito en este grupo…'
                                        : 'Este grupo aún no tiene alumnos inscritos',
                                  },
                                  ...opcionesInscritos,
                                ]}
                                onChange={val => {
                                  setAlumnosGrupoPendiente(prev => ({ ...prev, [g.grupoId]: val }));
                                  if (val) agregarAlumnoDeGrupoParcial(g.grupoId, val);
                                }}
                                etiqueta={`Alumnos inscritos en grupo ${g.codigoGrupo || g.grupoId}`}
                                placeholder="Elegir alumno inscrito en este grupo…"
                                disabled={guardando || inscritos.length === 0}
                              />
                            </CampoConAyuda>

                            {alumnosElegidosDelGrupo.length > 0 ? (
                              <div className="ra-chip-lista">
                                {alumnosElegidosDelGrupo.map(a => (
                                  <span key={a.alumnoId} className="ra-chip">
                                    <span>
                                      <strong>{a.nombreCompleto || 'Alumno'}</strong>
                                      {a.matricula ? ` · ${a.matricula}` : ''}
                                    </span>
                                    <button
                                      type="button"
                                      className="ra-chip-quitar"
                                      aria-label={`Quitar alumno ${a.nombreCompleto || a.alumnoId}`}
                                      onClick={() => quitarAlumno(a.alumnoId)}
                                      disabled={guardando}
                                    >
                                      <Trash2 size={14} aria-hidden="true" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="ra-ayuda-nota mt-2 mb-0 text-[var(--ra-ambar-texto)] font-medium">
                                Selecciona al menos un alumno integrante de este grupo parcial.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {erroresCampos.alumnos && (
                <p className="ra-error-campo mt-2" role="alert">
                  {erroresCampos.alumnos}
                </p>
              )}
            </div>

            {/* Docentes opcionales también en flujo grupal */}
            <div className="ra-panel-suave">
              <CampoConAyuda
                etiqueta="Docente(s) activo(s) involucrado(s) en el incidente grupal (Opcional)"
                ayuda="Si hubo un docente presente o involucrado junto con el grupo, añádelo aquí."
              >
                <SelectorBusqueda
                  id={`${selectDocenteId}-grupo`}
                  value={docentePendienteId}
                  opciones={[
                    { value: '', label: 'Buscar docente activo (opcional)…' },
                    ...opcionesDocentes,
                  ]}
                  onChange={val => {
                    setDocentePendienteId(val);
                    if (val) agregarDocente(val);
                  }}
                  etiqueta="Buscador de docentes activos en flujo grupal"
                  placeholder="Buscar docente activo (opcional)…"
                  disabled={guardando}
                />
              </CampoConAyuda>

              {borrador.docentes.length > 0 && (
                <div className="ra-chip-lista">
                  {borrador.docentes.map(d => (
                    <span key={d.docenteId} className="ra-chip">
                      <User size={15} className="text-[var(--ra-acento-texto)]" aria-hidden="true" />
                      <span>
                        <strong>{d.nombreCompleto}</strong>
                        {d.claveDocente ? ` · ${d.claveDocente}` : ''}
                      </span>
                      <button
                        type="button"
                        className="ra-chip-quitar"
                        aria-label={`Quitar docente ${d.nombreCompleto || d.docenteId}`}
                        onClick={() => quitarDocente(d.docenteId)}
                        disabled={guardando}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Bloque 3: Detalle del reporte y evidencia Drive */}
      <section className="ra-panel">
        <h3 className="ra-panel-titulo">3. Descripción, estatus y evidencia</h3>

        <div className="ra-form-grid-2">
          <CampoConAyuda
            etiqueta="Estatus de seguimiento"
            ayuda="Indica si el reporte sigue abierto (En proceso) o ya fue atendido/cerrado (Resuelto)."
          >
            <select
              id={selectEstatusId}
              className="ra-control"
              value={borrador.estatus}
              disabled={guardando}
              onChange={e =>
                onActualizarBorrador({ estatus: e.target.value as 'EN_PROCESO' | 'RESUELTO' })
              }
            >
              <option value="EN_PROCESO">En proceso</option>
              <option value="RESUELTO">Resuelto</option>
            </select>
          </CampoConAyuda>

          <div className="flex items-end">
            <div
              className={`ra-badge ${
                borrador.estatus === 'RESUELTO' ? 'ra-badge-resuelto' : 'ra-badge-en-proceso'
              }`}
            >
              {borrador.estatus === 'RESUELTO' ? (
                <CheckCircle2 size={14} aria-hidden="true" />
              ) : (
                <AlertTriangle size={14} aria-hidden="true" />
              )}
              {borrador.estatus === 'RESUELTO' ? 'Estatus: Resuelto' : 'Estatus: En proceso'}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <CampoConAyuda
            etiqueta="Descripción detallada de la situación"
            ayuda="Describe claramente el motivo del reporte, fechas relevantes o acuerdos de seguimiento."
          >
            <textarea
              className={`ra-textarea min-h-[110px] ${
                erroresCampos.descripcion ? 'con-error' : ''
              }`}
              value={borrador.descripcion}
              disabled={guardando}
              onChange={e => onActualizarBorrador({ descripcion: e.target.value })}
              placeholder="Escribe el detalle de la situación reportada..."
            />
          </CampoConAyuda>
          {erroresCampos.descripcion && (
            <p className="ra-error-campo" role="alert">
              {erroresCampos.descripcion}
            </p>
          )}
        </div>

        {/* Evidencia Google Drive solo en INCIDENTE (selector de carpeta/archivo compartido) */}
        {borrador.tipoReporte === 'INCIDENTE' && (
          <div className="mt-5 space-y-4 border-t border-[var(--ra-borde)] pt-1">
            <DrivePicker
              label="Evidencia digital (Carpeta o archivo de Google Drive)"
              value={borrador.enlaceDrive || null}
              onSelect={url => onActualizarBorrador({ enlaceDrive: url || null })}
              disabled={guardando}
              isEditing={!guardando}
            />

            {borrador.enlaceDrive && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="ra-btn text-xs"
                  onClick={() => onActualizarBorrador({ enlaceDrive: null })}
                  disabled={guardando}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Quitar vínculo de Drive
                </button>
              </div>
            )}

            {erroresCampos.enlaceDrive && (
              <p className="ra-error-campo" role="alert">
                {erroresCampos.enlaceDrive}
              </p>
            )}

            <div className="ra-panel-suave">
              <CampoConAyuda
                etiqueta="Notas sobre la evidencia (opcional)"
                ayuda="Ej. «Acta escaneada con firmas autógrafas el 14/11/2026»."
              >
                <input
                  type="text"
                  className="ra-control"
                  value={borrador.notasEvidencia ?? ''}
                  disabled={guardando}
                  onChange={e => onActualizarBorrador({ notasEvidencia: e.target.value })}
                  placeholder="Descripción breve de los documentos en Drive..."
                />
              </CampoConAyuda>
            </div>
          </div>
        )}

        {/* Editor de Acta de Hechos (deseleccionado y oculto por defecto; solo INCIDENTE) */}
        <EditorActaHechos
          borrador={borrador}
          folio={folioEdicion}
          cicloNombre={cicloActual ? formatCicloEscolar(cicloActual) : undefined}
          appConfig={appConfig}
          administrativosActivos={administrativosActivos}
          personalTestigosActivo={personalTestigosActivo}
          erroresCampos={erroresCampos}
          disabled={guardando}
          onActualizarBorrador={onActualizarBorrador}
        />
      </section>

      {/* Pie del formulario */}
      <div className="flex flex-wrap items-center justify-end gap-3 pb-4">
        <button
          type="button"
          className="ra-btn"
          disabled={guardando}
          onClick={() => solicitarSalida(onVolverListado)}
        >
          Cancelar y volver
        </button>
        <button type="submit" className="ra-btn ra-btn-primario" disabled={guardando}>
          <Save size={16} aria-hidden="true" />
          {guardando
            ? 'Guardando…'
            : esEdicion
              ? 'Guardar cambios del reporte'
              : 'Registrar reporte académico'}
        </button>
      </div>

      <ModalConfirmacion
        isOpen={Boolean(confirmacionPendiente)}
        title={confirmacionPendiente?.titulo || ''}
        message={confirmacionPendiente?.mensaje || ''}
        confirmText={confirmacionPendiente?.confirmText || 'Confirmar'}
        type={confirmacionPendiente?.type || 'warning'}
        onCancel={() => setConfirmacionPendiente(null)}
        onConfirm={() => {
          const fn = confirmacionPendiente?.accion;
          setConfirmacionPendiente(null);
          fn?.();
        }}
      />
    </form>
  );
}
