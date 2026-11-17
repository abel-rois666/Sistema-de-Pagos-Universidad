export type FlujoRegistroReporte = 'ALUMNO_DOCENTE' | 'GRUPO';

export type TipoReporteAcademico = 'INASISTENCIAS' | 'PROBLEMA_RENDIMIENTO' | 'INCIDENTE';

export type EstatusReporteAcademico = 'EN_PROCESO' | 'RESUELTO';

export type AlcanceGrupoReporte = 'TODO_EL_GRUPO' | 'PARCIAL';

export type TipoTestigoActa = 'PERSONAL' | 'EXTERNO';

export interface TestigoActaHechos {
  tipo: TipoTestigoActa;
  personaId?: string;
  nombreCompleto: string;
  cargoIdentificacion: string;
}

export interface BorradorActaHechos {
  nombreInstitucion: string;
  tituloDocumento: string;
  lugar: string;
  fechaLevantamiento: string;
  horaInicio: string;
  horaConclusion: string;
  empleadoLevantaId: string;
  empleadoLevantaNombre: string;
  empleadoLevantaCargo: string;
  testigos: TestigoActaHechos[];
  relatoriaHechos: string;
  pruebasAnexos?: string | null;
}

export interface AlumnoReporteSeleccion {
  alumnoId: string;
  grupoId?: string | null;
  matricula?: string | null;
  nombreCompleto?: string;
  carrera?: string | null;
  grado?: string | null;
}

export interface GrupoReporteSeleccion {
  grupoId: string;
  alcanceAlumnos: AlcanceGrupoReporte;
  codigoGrupo?: string;
  carrera?: string | null;
  grado?: string | null;
  turno?: string | null;
}

export interface DocenteReporteSeleccion {
  docenteId: string;
  nombreCompleto?: string;
  claveDocente?: string | null;
}

export interface BorradorReporteAcademico {
  id?: string | null;
  revision?: number;
  cicloId: string;
  flujoRegistro: FlujoRegistroReporte;
  tipoReporte: TipoReporteAcademico;
  fechaReporte: string;
  descripcion: string;
  estatus: EstatusReporteAcademico;
  tieneActaHechos: boolean;
  enlaceDrive?: string | null;
  notasEvidencia?: string | null;
  alumnos: AlumnoReporteSeleccion[];
  grupos: GrupoReporteSeleccion[];
  docentes: DocenteReporteSeleccion[];
  acta?: BorradorActaHechos | null;
  // Alias opcionales en snake_case para interoperabilidad con payloads SQL
  ciclo_id?: string;
  flujo_registro?: FlujoRegistroReporte;
  tipo_reporte?: TipoReporteAcademico;
  fecha_reporte?: string;
  tiene_acta_hechos?: boolean;
  enlace_drive?: string | null;
  notas_evidencia?: string | null;
}

export interface ReporteAcademicoAlumnoDetalle {
  alumnoId: string;
  grupoId: string | null;
  matriculaSnapshot: string | null;
  nombreSnapshot: string | null;
  carreraSnapshot: string | null;
  gradoSnapshot: string | null;
}

export interface ReporteAcademicoGrupoDetalle {
  grupoId: string;
  alcanceAlumnos: AlcanceGrupoReporte;
  codigoGrupoSnapshot: string | null;
  carreraSnapshot: string | null;
  gradoSnapshot: string | null;
  turnoSnapshot: string | null;
}

export interface ReporteAcademicoDocenteDetalle {
  docenteId: string;
  nombreDocenteSnapshot: string | null;
  claveDocenteSnapshot: string | null;
}

export interface ReporteAcademicoDetalle {
  id: string;
  folio: string;
  cicloId: string;
  cicloNombre?: string | null;
  cicloTipoPeriodo?: string | null;
  flujoRegistro: FlujoRegistroReporte;
  tipoReporte: TipoReporteAcademico;
  fechaReporte: string;
  descripcion: string;
  estatus: EstatusReporteAcademico;
  tieneActaHechos: boolean;
  enlaceDrive: string | null;
  notasEvidencia: string | null;
  revision: number;
  creadoPor?: string | null;
  actualizadoPor?: string | null;
  createdAt?: string;
  updatedAt?: string;
  alumnos: ReporteAcademicoAlumnoDetalle[];
  grupos: ReporteAcademicoGrupoDetalle[];
  docentes: ReporteAcademicoDocenteDetalle[];
  acta: BorradorActaHechos | null;
}

export interface FiltrosReportesAcademicos {
  cicloId?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  carrera?: string | string[] | null;
  tipoReporte?: TipoReporteAcademico | TipoReporteAcademico[] | string | string[] | null;
  estatus?: EstatusReporteAcademico | EstatusReporteAcademico[] | string | string[] | null;
  busqueda?: string | null;
  alumnoId?: string | null;
  grupoId?: string | null;
  docenteId?: string | null;
}

export interface InvolucradoActaHechos {
  categoria: 'GRUPO_COMPLETO' | 'ALUMNO_INDIVIDUAL' | 'DOCENTE';
  referenciaId: string;
  grupoId?: string | null;
  etiquetaFormal: string;
  nombre: string;
  identificadorSecundario?: string | null;
  carrera?: string | null;
  grado?: string | null;
  turno?: string | null;
}

export interface ResumenInvolucradosActa {
  gruposCompletos: InvolucradoActaHechos[];
  alumnosIndividuales: InvolucradoActaHechos[];
  docentes: InvolucradoActaHechos[];
  todos: InvolucradoActaHechos[];
  mencionesTexto: string[];
}

export interface FirmanteActaHechos {
  rolFirmante: 'LEVANTA_ACTA' | 'ALUMNO_INVOLUCRADO' | 'DOCENTE_INVOLUCRADO' | 'TESTIGO_ASISTENCIA';
  referenciaId?: string;
  tipoTestigo?: TipoTestigoActa;
  nombreCompleto: string;
  cargoIdentificacion: string;
  etiquetaPieFirma: string;
}

export interface ResumenFirmantesActa {
  quienLevanta: FirmanteActaHechos | null;
  involucrados: FirmanteActaHechos[];
  testigos: FirmanteActaHechos[];
  todos: FirmanteActaHechos[];
}

export interface ResultadoValidacionReporte {
  valido: boolean;
  errores: string[];
  erroresCampos: Record<string, string>;
  borradorNormalizado: BorradorReporteAcademico;
}

export interface OpcionAlumnoReporte {
  id: string;
  matricula: string | null;
  nombreCompleto: string;
  carrera: string | null;
  grado: string | null;
  turno: string | null;
  estatus: string | null;
}

export interface OpcionDocenteReporte {
  id: string;
  personaId?: string | null;
  claveDocente: string;
  nombreCompleto: string;
  activo: boolean;
}

export interface OpcionGrupoReporte {
  id: string;
  cicloId: string;
  planId: string;
  codigoGrupo: string;
  carrera: string | null;
  grado: string | null;
  turno: string | null;
  esMultigrado: boolean;
  alumnosInscritos: OpcionAlumnoReporte[];
}

export interface OpcionPersonalReporte {
  id: string;
  personaId?: string | null;
  origen: 'EMPLEADO' | 'DOCENTE';
  nombreCompleto: string;
  cargoIdentificacion: string;
  activo: boolean;
}

