import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CicloEscolar } from '../types';
import { useCicloModulo } from './useCicloModulo';
import {
  crearBorradorActaInicial,
  crearBorradorReporteInicial,
  fechaHoyReporteAcademico,
  limpiarAlumnosDeGruposCompletos,
  sugerirCicloPorFechaActual,
  validarBorradorReporteAcademico,
} from '../reportesAcademicos/dominio';
import type {
  AlcanceGrupoReporte,
  BorradorReporteAcademico,
  FiltrosReportesAcademicos,
  OpcionAlumnoReporte,
  OpcionDocenteReporte,
  OpcionGrupoReporte,
  OpcionPersonalReporte,
  ReporteAcademicoDetalle,
} from '../reportesAcademicos/types';
import {
  convertirReporteABorrador,
  normalizarErrorReporteAcademico,
  reportesAcademicosService,
  type ResultadoGuardarReporte,
} from '../services/reportesAcademicosService';

export interface OpcionesUseReportesAcademicos {
  moduloClave?: string;
  ciclos: readonly CicloEscolar[];
  usuarioId?: string;
  filtrosFijos?: Partial<FiltrosReportesAcademicos>;
  cargarCatalogosFormulario?: boolean;
  permitirTodosLosCiclos?: boolean;
  servicio?: typeof reportesAcademicosService;
}

export interface EstadoConflictoRevisionReporte {
  mensaje: string;
  detectadoEn: string;
}

export function useReportesAcademicos(opciones: OpcionesUseReportesAcademicos) {
  const {
    moduloClave = 'reportes_academicos',
    ciclos,
    usuarioId,
    filtrosFijos,
    cargarCatalogosFormulario = true,
    permitirTodosLosCiclos = false,
    servicio = reportesAcademicosService,
  } = opciones;

  const fechaHoy = useMemo(() => fechaHoyReporteAcademico(), []);
  const cicloSugeridoId = useMemo(
    () => sugerirCicloPorFechaActual(ciclos, fechaHoy, null),
    [ciclos, fechaHoy]
  );

  const [cicloId, setCicloId] = useCicloModulo(moduloClave, ciclos, cicloSugeridoId, usuarioId, {
    todos: permitirTodosLosCiclos,
  });

  const [filtrosAdicionales, setFiltrosAdicionales] = useState<Omit<FiltrosReportesAcademicos, 'cicloId'>>({});
  const [reportes, setReportes] = useState<ReporteAcademicoDetalle[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Catálogos auxiliares del formulario
  const [alumnosCatalogo, setAlumnosCatalogo] = useState<OpcionAlumnoReporte[]>([]);
  const [docentesActivos, setDocentesActivos] = useState<OpcionDocenteReporte[]>([]);
  const [gruposCiclo, setGruposCiclo] = useState<OpcionGrupoReporte[]>([]);
  const [administrativosActivos, setAdministrativosActivos] = useState<OpcionPersonalReporte[]>([]);
  const [personalTestigosActivo, setPersonalTestigosActivo] = useState<OpcionPersonalReporte[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [errorCatalogos, setErrorCatalogos] = useState<string | null>(null);

  // Estado del formulario / borrador y guardado
  const [borrador, setBorrador] = useState<BorradorReporteAcademico>(() =>
    crearBorradorReporteInicial(cicloId !== 'TODOS' ? cicloId : cicloSugeridoId, fechaHoy)
  );
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [conflictoRevision, setConflictoRevision] = useState<EstadoConflictoRevisionReporte | null>(null);

  const abortConsultaRef = useRef<AbortController | null>(null);

  const filtrosEfectivos = useMemo<FiltrosReportesAcademicos>(
    () => ({
      ...filtrosAdicionales,
      ...filtrosFijos,
      cicloId: filtrosFijos?.cicloId !== undefined ? filtrosFijos.cicloId : cicloId,
    }),
    [filtrosAdicionales, filtrosFijos, cicloId]
  );

  const consultar = useCallback(async () => {
    abortConsultaRef.current?.abort();
    const controller = new AbortController();
    abortConsultaRef.current = controller;

    setCargando(true);
    setErrorCarga(null);
    try {
      const respuesta = await servicio.consultarReportes(filtrosEfectivos, controller.signal);
      if (controller.signal.aborted) return;
      setReportes(respuesta.reportes);
      setTotal(respuesta.total);
    } catch (err) {
      if (controller.signal.aborted) return;
      const normalizado = normalizarErrorReporteAcademico(err);
      setErrorCarga(normalizado.message);
    } finally {
      if (!controller.signal.aborted) {
        setCargando(false);
      }
    }
  }, [servicio, filtrosEfectivos]);

  useEffect(() => {
    void consultar();
    return () => {
      abortConsultaRef.current?.abort();
    };
  }, [consultar]);

  const cargarCatalogosBase = useCallback(async () => {
    if (!cargarCatalogosFormulario) return;
    setCargandoCatalogos(true);
    setErrorCatalogos(null);
    try {
      const [alumnos, docentes, personalActa] = await Promise.all([
        servicio.buscarAlumnos(),
        servicio.listarDocentesActivos(),
        servicio.listarPersonalParaActa(),
      ]);
      setAlumnosCatalogo(alumnos);
      setDocentesActivos(docentes);
      setAdministrativosActivos(personalActa.administrativosActivos);
      setPersonalTestigosActivo(personalActa.personalTestigosActivo);
    } catch (err) {
      const normalizado = normalizarErrorReporteAcademico(err);
      setErrorCatalogos(normalizado.message);
    } finally {
      setCargandoCatalogos(false);
    }
  }, [cargarCatalogosFormulario, servicio]);

  const cargarGruposDelCiclo = useCallback(
    async (idCicloObjetivo: string) => {
      if (!cargarCatalogosFormulario || !idCicloObjetivo || idCicloObjetivo === 'TODOS') {
        setGruposCiclo([]);
        return;
      }
      try {
        const grupos = await servicio.listarGruposPorCiclo(idCicloObjetivo);
        setGruposCiclo(grupos);
      } catch (err) {
        const normalizado = normalizarErrorReporteAcademico(err);
        setErrorCatalogos(normalizado.message);
      }
    },
    [cargarCatalogosFormulario, servicio]
  );

  useEffect(() => {
    void cargarCatalogosBase();
  }, [cargarCatalogosBase]);

  useEffect(() => {
    const cicloFormulario = borrador.cicloId || (cicloId !== 'TODOS' ? cicloId : cicloSugeridoId);
    if (cicloFormulario) {
      void cargarGruposDelCiclo(cicloFormulario);
    }
  }, [borrador.cicloId, cicloId, cicloSugeridoId, cargarGruposDelCiclo]);

  const iniciarNuevoReporte = useCallback(
    (cicloInicialId?: string) => {
      const idDestino =
        cicloInicialId ?? (cicloId && cicloId !== 'TODOS' ? cicloId : cicloSugeridoId);
      setBorrador(crearBorradorReporteInicial(idDestino, fechaHoyReporteAcademico()));
      setErrorGuardado(null);
      setConflictoRevision(null);
    },
    [cicloId, cicloSugeridoId]
  );

  const cargarReporteParaEdicion = useCallback((reporte: ReporteAcademicoDetalle) => {
    setBorrador(convertirReporteABorrador(reporte));
    setErrorGuardado(null);
    setConflictoRevision(null);
  }, []);

  const actualizarBorrador = useCallback(
    (actualizador: Partial<BorradorReporteAcademico> | ((prev: BorradorReporteAcademico) => BorradorReporteAcademico)) => {
      setBorrador(prev => {
        const siguiente =
          typeof actualizador === 'function' ? actualizador(prev) : { ...prev, ...actualizador };

        // Si el flujo cambia a GRUPO, el tipo se fuerza a INCIDENTE
        const tipoAjustado =
          siguiente.flujoRegistro === 'GRUPO' ? 'INCIDENTE' : siguiente.tipoReporte;

        // Si el tipo es INASISTENCIAS o PROBLEMA_RENDIMIENTO, desactivar grupos, docentes, acta y enlace Drive
        const esSoloAlumno =
          tipoAjustado === 'INASISTENCIAS' || tipoAjustado === 'PROBLEMA_RENDIMIENTO';

        const gruposAjustados = esSoloAlumno ? [] : siguiente.grupos;
        const docentesAjustados = esSoloAlumno ? [] : siguiente.docentes;
        const tieneActaAjustada = esSoloAlumno ? false : siguiente.tieneActaHechos;
        const enlaceAjustado = esSoloAlumno ? null : siguiente.enlaceDrive;

        // Asegurar que ningún alumno pertenezca a un grupo con alcance TODO_EL_GRUPO
        const alumnosAjustados = limpiarAlumnosDeGruposCompletos(siguiente.alumnos, gruposAjustados);

        const actaAjustada = tieneActaAjustada
          ? siguiente.acta ?? crearBorradorActaInicial(siguiente.fechaReporte || fechaHoyReporteAcademico())
          : null;

        return {
          ...siguiente,
          tipoReporte: tipoAjustado,
          grupos: gruposAjustados,
          docentes: docentesAjustados,
          alumnos: alumnosAjustados,
          tieneActaHechos: tieneActaAjustada,
          enlaceDrive: enlaceAjustado,
          acta: actaAjustada,
        };
      });
    },
    []
  );

  const cambiarAlcanceGrupo = useCallback((grupoId: string, alcanceAlumnos: AlcanceGrupoReporte) => {
    setBorrador(prev => {
      const grupos = prev.grupos.map(g =>
        g.grupoId === grupoId ? { ...g, alcanceAlumnos } : g
      );
      const alumnos = limpiarAlumnosDeGruposCompletos(prev.alumnos, grupos);
      return { ...prev, grupos, alumnos };
    });
  }, []);

  const guardarBorrador = useCallback(async (): Promise<ResultadoGuardarReporte | null> => {
    setErrorGuardado(null);
    setConflictoRevision(null);

    const validacion = validarBorradorReporteAcademico(borrador);
    if (!validacion.valido) {
      setErrorGuardado(validacion.errores[0] || 'Revisa los campos obligatorios del reporte.');
      return null;
    }

    setGuardando(true);
    try {
      const resultado = await servicio.guardarReporte(validacion.borradorNormalizado);
      // Actualizar borrador con la nueva revisión e ID devueltos por el servidor
      setBorrador(convertirReporteABorrador(resultado.reporte));
      await consultar();
      return resultado;
    } catch (err) {
      const normalizado = normalizarErrorReporteAcademico(err);
      setErrorGuardado(normalizado.message);
      if (normalizado.esConflictoRevision) {
        // Conservamos intacto el borrador en pantalla para que el usuario no pierda su captura
        setConflictoRevision({
          mensaje: normalizado.message,
          detectadoEn: new Date().toISOString(),
        });
      }
      return null;
    } finally {
      setGuardando(false);
    }
  }, [borrador, servicio, consultar]);

  const validacionActual = useMemo(() => validarBorradorReporteAcademico(borrador), [borrador]);
  const listaVacia = !cargando && !errorCarga && reportes.length === 0;

  return {
    cicloId,
    setCicloId,
    cicloSugeridoId,
    filtros: filtrosEfectivos,
    setFiltrosAdicionales,
    reportes,
    total,
    cargando,
    errorCarga,
    listaVacia,
    reintentarConsulta: consultar,
    catalogos: {
      alumnos: alumnosCatalogo,
      docentesActivos,
      gruposCiclo,
      administrativosActivos,
      personalTestigosActivo,
      cargandoCatalogos,
      errorCatalogos,
      reintentarCatalogos: cargarCatalogosBase,
      recargarGruposDelCiclo: cargarGruposDelCiclo,
    },
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
    limpiarConflictoRevision: () => setConflictoRevision(null),
  };
}

