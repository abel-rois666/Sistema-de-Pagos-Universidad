import type { CicloEscolar } from '../types';
import { fechaFinancieraHoy, fechaVencimientoCivil } from '../finanzas/vencimientos';
import type {
  AlcanceGrupoReporte,
  AlumnoReporteSeleccion,
  BorradorActaHechos,
  BorradorReporteAcademico,
  DocenteReporteSeleccion,
  EstatusReporteAcademico,
  FiltrosReportesAcademicos,
  FirmanteActaHechos,
  FlujoRegistroReporte,
  GrupoReporteSeleccion,
  InvolucradoActaHechos,
  ReporteAcademicoDetalle,
  ResultadoValidacionReporte,
  ResumenFirmantesActa,
  ResumenInvolucradosActa,
  TestigoActaHechos,
  TipoReporteAcademico,
} from './types';

export const INSTITUCION_ACTA_POR_DEFECTO = 'Centro Universitario Oriente de México';
export const TITULO_ACTA_POR_DEFECTO = 'Acta de Hechos';
export const MIN_CARACTERES_RELATORIA_ACTA = 20;

const HORA_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** Fecha civil actual en Ciudad de México (YYYY-MM-DD). */
export function fechaHoyReporteAcademico(instante = new Date()): string {
  return fechaFinancieraHoy(instante);
}

/** Orden numérico descendente estándar del sistema para ciclos escolares. */
export function ordenarCiclosEstandar(ciclos: readonly CicloEscolar[]): CicloEscolar[] {
  return [...ciclos].sort(
    (a, b) =>
      b.nombre.localeCompare(a.nombre, 'es-MX', { numeric: true }) ||
      (a.tipo_periodo || '').localeCompare(b.tipo_periodo || '', 'es-MX') ||
      a.id.localeCompare(b.id)
  );
}

/**
 * Sugiere el ciclo escolar inicial para el módulo de Reportes Académicos:
 * 1. Si `cicloGuardadoId` existe en `ciclos`, lo respeta.
 * 2. Si no, filtra los ciclos cuyo rango `[fecha_inicio, fecha_termino]` sea válido y contenga a `fechaHoyIso`.
 * 3. Si hay un único ciclo coincidente, devuelve su `id`.
 * 4. Si hay varios coincidentes, prioriza `activo = true` y, en empate, el primero según el orden numérico descendente estándar.
 * 5. Si ningún ciclo cubre `fechaHoyIso`, usa el ciclo `activo` institucional (o el más reciente en orden estándar).
 */
export function sugerirCicloPorFechaActual(
  ciclos: readonly CicloEscolar[],
  fechaHoyIso: string,
  cicloGuardadoId?: string | null
): string {
  if (!ciclos.length) return '';

  const guardadoLimpio = (cicloGuardadoId || '').trim();
  if (guardadoLimpio && ciclos.some(c => c.id === guardadoLimpio)) {
    return guardadoLimpio;
  }

  const hoy = fechaVencimientoCivil(fechaHoyIso) ?? fechaFinancieraHoy();
  const ordenados = ordenarCiclosEstandar(ciclos);

  const enRango = ordenados.filter(ciclo => {
    const inicio = fechaVencimientoCivil(ciclo.fecha_inicio);
    const termino = fechaVencimientoCivil(ciclo.fecha_termino);
    if (!inicio || !termino || inicio > termino) return false;
    return inicio <= hoy && hoy <= termino;
  });

  if (enRango.length === 1) {
    return enRango[0].id;
  }

  if (enRango.length > 1) {
    const activosEnRango = enRango.filter(c => c.activo);
    return (activosEnRango[0] ?? enRango[0]).id;
  }

  const activosInstitucionales = ordenados.filter(c => c.activo);
  if (activosInstitucionales.length > 0) {
    return activosInstitucionales[0].id;
  }

  return ordenados[0]?.id ?? '';
}

/** Valida que un enlace corresponda a Google Drive o Google Docs sobre HTTPS. */
export function esEnlaceDriveValido(enlace?: string | null): boolean {
  const texto = (enlace || '').trim();
  if (!texto || /\s/.test(texto)) return false;
  try {
    const url = new URL(texto);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return (
      host === 'drive.google.com' ||
      host === 'docs.google.com' ||
      host.endsWith('.drive.google.com') ||
      host.endsWith('.docs.google.com')
    );
  } catch {
    return false;
  }
}

/** Normaliza una hora HH:MM o HH:MM:SS a HH:MM:SS para comparación lexicográfica segura. */
export function normalizarHoraActa(hora?: string | null): string | null {
  const texto = (hora || '').trim();
  const match = texto.match(HORA_24H_REGEX);
  if (!match) return null;
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
}

/** Crea un borrador vacío de Acta de Hechos con los valores institucionales por defecto. */
export function crearBorradorActaInicial(fechaBase = fechaFinancieraHoy()): BorradorActaHechos {
  return {
    nombreInstitucion: INSTITUCION_ACTA_POR_DEFECTO,
    tituloDocumento: TITULO_ACTA_POR_DEFECTO,
    lugar: '',
    fechaLevantamiento: fechaBase,
    horaInicio: '09:00',
    horaConclusion: '09:30',
    empleadoLevantaId: '',
    empleadoLevantaNombre: '',
    empleadoLevantaCargo: '',
    testigos: [],
    relatoriaHechos: '',
    pruebasAnexos: null,
  };
}

/** Crea un borrador inicial de Reporte Académico. */
export function crearBorradorReporteInicial(cicloId = '', fechaBase = fechaFinancieraHoy()): BorradorReporteAcademico {
  return {
    id: null,
    revision: 1,
    cicloId,
    flujoRegistro: 'ALUMNO_DOCENTE',
    tipoReporte: 'INASISTENCIAS',
    fechaReporte: fechaBase,
    descripcion: '',
    estatus: 'EN_PROCESO',
    tieneActaHechos: false,
    enlaceDrive: null,
    notasEvidencia: null,
    alumnos: [],
    grupos: [],
    docentes: [],
    acta: null,
  };
}

/**
 * Elimina cualquier alumno individual vinculado a un grupo cuyo alcance sea 'TODO_EL_GRUPO'
 * para garantizar que el reporte grupal completo nunca contamine la ficha individual del alumno.
 */
export function limpiarAlumnosDeGruposCompletos(
  alumnos: readonly AlumnoReporteSeleccion[],
  grupos: readonly GrupoReporteSeleccion[]
): AlumnoReporteSeleccion[] {
  const gruposCompletosIds = new Set(
    grupos
      .filter(g => (g.alcanceAlumnos || 'TODO_EL_GRUPO') === 'TODO_EL_GRUPO')
      .map(g => (g.grupoId || '').trim())
      .filter(Boolean)
  );

  const vistos = new Set<string>();
  const resultado: AlumnoReporteSeleccion[] = [];

  for (const alumno of alumnos) {
    const alumnoId = (alumno.alumnoId || '').trim();
    const grupoId = (alumno.grupoId || '').trim() || null;
    if (!alumnoId || vistos.has(alumnoId)) continue;
    if (grupoId && gruposCompletosIds.has(grupoId)) continue;
    vistos.add(alumnoId);
    resultado.push({
      ...alumno,
      alumnoId,
      grupoId,
      matricula: alumno.matricula?.trim() || null,
      nombreCompleto: alumno.nombreCompleto?.trim() || '',
      carrera: alumno.carrera?.trim() || null,
      grado: alumno.grado?.trim() || null,
    });
  }

  return resultado;
}

/** Valida el borrador de un reporte académico y devuelve el borrador normalizado junto con los errores. */
export function validarBorradorReporteAcademico(borrador: BorradorReporteAcademico): ResultadoValidacionReporte {
  const errores: string[] = [];
  const erroresCampos: Record<string, string> = {};
  const registrarError = (campo: string, mensaje: string) => {
    errores.push(mensaje);
    if (!erroresCampos[campo]) {
      erroresCampos[campo] = mensaje;
    }
  };

  const cicloId = (borrador.cicloId ?? borrador.ciclo_id ?? '').trim();
  const flujoRegistro = ((borrador.flujoRegistro ?? borrador.flujo_registro ?? '').trim() ||
    'ALUMNO_DOCENTE') as BorradorReporteAcademico['flujoRegistro'];
  const tipoReporte = ((borrador.tipoReporte ?? borrador.tipo_reporte ?? '').trim() ||
    'INASISTENCIAS') as BorradorReporteAcademico['tipoReporte'];
  const fechaReporteRaw = (borrador.fechaReporte ?? borrador.fecha_reporte ?? '').trim();
  const fechaReporteValida = fechaVencimientoCivil(fechaReporteRaw);
  const descripcion = (borrador.descripcion ?? '').trim();
  const estatus = ((borrador.estatus ?? 'EN_PROCESO').trim() || 'EN_PROCESO') as BorradorReporteAcademico['estatus'];
  const tieneActaHechos = Boolean(borrador.tieneActaHechos ?? borrador.tiene_acta_hechos ?? false);
  const enlaceDriveTexto = (borrador.enlaceDrive ?? borrador.enlace_drive ?? '').trim();
  const enlaceDrive = enlaceDriveTexto.length > 0 ? enlaceDriveTexto : null;
  const notasEvidenciaTexto = (borrador.notasEvidencia ?? borrador.notas_evidencia ?? '').trim();
  const notasEvidencia = notasEvidenciaTexto.length > 0 ? notasEvidenciaTexto : null;

  // Normalizar grupos sin duplicados
  const gruposVistos = new Set<string>();
  const gruposNormalizados: GrupoReporteSeleccion[] = [];
  for (const g of Array.isArray(borrador.grupos) ? borrador.grupos : []) {
    const grupoId = (g?.grupoId || '').trim();
    if (!grupoId || gruposVistos.has(grupoId)) continue;
    gruposVistos.add(grupoId);
    const alcanceAlumnos = g.alcanceAlumnos === 'PARCIAL' ? 'PARCIAL' : 'TODO_EL_GRUPO';
    gruposNormalizados.push({
      ...g,
      grupoId,
      alcanceAlumnos,
      codigoGrupo: g.codigoGrupo?.trim() || '',
      carrera: g.carrera?.trim() || null,
      grado: g.grado?.trim() || null,
      turno: g.turno?.trim() || null,
    });
  }

  // Normalizar docentes sin duplicados
  const docentesVistos = new Set<string>();
  const docentesNormalizados: DocenteReporteSeleccion[] = [];
  for (const d of Array.isArray(borrador.docentes) ? borrador.docentes : []) {
    const docenteId = (d?.docenteId || '').trim();
    if (!docenteId || docentesVistos.has(docenteId)) continue;
    docentesVistos.add(docenteId);
    docentesNormalizados.push({
      ...d,
      docenteId,
      nombreCompleto: d.nombreCompleto?.trim() || '',
      claveDocente: d.claveDocente?.trim() || null,
    });
  }

  // Limpiar alumnos pertenecientes a grupos con alcance TODO_EL_GRUPO
  const alumnosNormalizados = limpiarAlumnosDeGruposCompletos(
    Array.isArray(borrador.alumnos) ? borrador.alumnos : [],
    gruposNormalizados
  );

  if (!cicloId) {
    registrarError('cicloId', 'Selecciona el ciclo escolar del reporte.');
  }

  if (flujoRegistro !== 'ALUMNO_DOCENTE' && flujoRegistro !== 'GRUPO') {
    registrarError('flujoRegistro', 'El flujo de registro debe ser ALUMNO_DOCENTE o GRUPO.');
  }

  if (
    tipoReporte !== 'INASISTENCIAS' &&
    tipoReporte !== 'PROBLEMA_RENDIMIENTO' &&
    tipoReporte !== 'INCIDENTE'
  ) {
    registrarError('tipoReporte', 'Selecciona un tipo de reporte válido.');
  }

  if (!fechaReporteValida) {
    registrarError('fechaReporte', 'Indica una fecha de reporte válida (YYYY-MM-DD).');
  }

  if (!descripcion) {
    registrarError('descripcion', 'Escribe la descripción del reporte académico.');
  }

  if (estatus !== 'EN_PROCESO' && estatus !== 'RESUELTO') {
    registrarError('estatus', 'El estatus del reporte debe ser EN_PROCESO o RESUELTO.');
  }

  // Regla: flujo GRUPO exige tipo INCIDENTE
  if (flujoRegistro === 'GRUPO' && tipoReporte !== 'INCIDENTE') {
    registrarError('tipoReporte', 'Los reportes registrados por grupo deben ser exclusivamente de tipo INCIDENTE.');
  }

  // Regla: INASISTENCIAS y PROBLEMA_RENDIMIENTO solo admiten alumnos individuales
  if (tipoReporte === 'INASISTENCIAS' || tipoReporte === 'PROBLEMA_RENDIMIENTO') {
    if (alumnosNormalizados.length === 0) {
      registrarError('alumnos', 'Selecciona al menos un alumno para este tipo de reporte.');
    }
    if (gruposNormalizados.length > 0) {
      registrarError('grupos', 'Las inasistencias y problemas de rendimiento no admiten grupos.');
    }
    if (docentesNormalizados.length > 0) {
      registrarError('docentes', 'Las inasistencias y problemas de rendimiento no admiten docentes.');
    }
    if (tieneActaHechos) {
      registrarError('tieneActaHechos', 'El Acta de Hechos solo puede habilitarse en reportes de tipo INCIDENTE.');
    }
    if (enlaceDrive) {
      registrarError('enlaceDrive', 'El enlace a Google Drive solo está permitido en reportes de tipo INCIDENTE.');
    }
  }

  // Regla: INCIDENTE requiere al menos un participante y valida alcance de grupos
  if (tipoReporte === 'INCIDENTE') {
    if (flujoRegistro === 'GRUPO') {
      if (gruposNormalizados.length === 0) {
        registrarError('grupos', 'Selecciona al menos un grupo para el reporte grupal.');
      }
      const gruposParcialesIds = new Set(
        gruposNormalizados.filter(g => g.alcanceAlumnos === 'PARCIAL').map(g => g.grupoId)
      );
      for (const g of gruposNormalizados) {
        if (g.alcanceAlumnos === 'PARCIAL') {
          const tieneAlumnosDelGrupo = alumnosNormalizados.some(a => a.grupoId === g.grupoId);
          if (!tieneAlumnosDelGrupo) {
            registrarError(
              'alumnos',
              `Selecciona al menos un alumno para el grupo ${g.codigoGrupo || g.grupoId} con alcance parcial.`
            );
          }
        }
      }
      for (const a of alumnosNormalizados) {
        if (!a.grupoId || !gruposParcialesIds.has(a.grupoId)) {
          registrarError(
            'alumnos',
            'En un reporte grupal solo deben incluirse alumnos pertenecientes a grupos con alcance parcial.'
          );
          break;
        }
      }
    } else {
      if (gruposNormalizados.length > 0) {
        registrarError('grupos', 'En el flujo individual (Alumno / Docente) no se deben incluir grupos.');
      }
      if (alumnosNormalizados.length === 0 && docentesNormalizados.length === 0) {
        registrarError('participantes', 'Selecciona al menos un alumno o un docente involucrado en el incidente.');
      }
    }
  }

  // Validación de enlace Drive (si tiene texto)
  if (enlaceDrive && !esEnlaceDriveValido(enlaceDrive)) {
    registrarError(
      'enlaceDrive',
      'El enlace de evidencia debe ser una URL HTTPS válida de drive.google.com o docs.google.com.'
    );
  }

  // Validación de Acta de Hechos
  let actaNormalizada: BorradorActaHechos | null = null;
  if (tieneActaHechos) {
    const acta = borrador.acta;
    if (!acta) {
      registrarError('acta', 'Completa los datos obligatorios del Acta de Hechos.');
    } else {
      const nombreInstitucion =
        acta.nombreInstitucion === undefined
          ? INSTITUCION_ACTA_POR_DEFECTO
          : acta.nombreInstitucion.trim();
      const tituloDocumento = (acta.tituloDocumento ?? TITULO_ACTA_POR_DEFECTO).trim() || TITULO_ACTA_POR_DEFECTO;
      const lugar = (acta.lugar ?? '').trim();
      const fechaLevantamientoRaw = (acta.fechaLevantamiento ?? '').trim();
      const fechaLevantamientoValida = fechaVencimientoCivil(fechaLevantamientoRaw);
      const horaInicio = (acta.horaInicio ?? '').trim();
      const horaConclusion = (acta.horaConclusion ?? '').trim();
      const horaInicioNorm = normalizarHoraActa(horaInicio);
      const horaConclusionNorm = normalizarHoraActa(horaConclusion);
      const empleadoLevantaId = (acta.empleadoLevantaId ?? '').trim();
      const empleadoLevantaNombre = (acta.empleadoLevantaNombre ?? '').trim();
      const empleadoLevantaCargo = (acta.empleadoLevantaCargo ?? '').trim();
      const relatoriaHechos = (acta.relatoriaHechos ?? '').trim();
      const pruebasAnexos = (acta.pruebasAnexos ?? '').trim() || null;

      if (!nombreInstitucion) {
        registrarError('acta.nombreInstitucion', 'Indica el nombre de la institución para el Acta de Hechos.');
      }
      if (!lugar) {
        registrarError('acta.lugar', 'Indica el lugar donde se levanta el Acta de Hechos.');
      }
      if (!fechaLevantamientoValida) {
        registrarError('acta.fechaLevantamiento', 'Indica una fecha de levantamiento válida (YYYY-MM-DD).');
      }
      if (!horaInicioNorm) {
        registrarError('acta.horaInicio', 'Indica una hora de inicio válida en formato HH:MM.');
      }
      if (!horaConclusionNorm) {
        registrarError('acta.horaConclusion', 'Indica una hora de conclusión válida en formato HH:MM.');
      }
      if (horaInicioNorm && horaConclusionNorm && horaConclusionNorm < horaInicioNorm) {
        registrarError(
          'acta.horaConclusion',
          'La hora de conclusión del acta debe ser posterior o igual a la hora de inicio.'
        );
      }
      if (!empleadoLevantaId) {
        registrarError('acta.empleadoLevantaId', 'Selecciona al personal administrativo que levanta el acta.');
      }
      if (relatoriaHechos.length < MIN_CARACTERES_RELATORIA_ACTA) {
        registrarError(
          'acta.relatoriaHechos',
          `La relatoría de hechos debe contener al menos ${MIN_CARACTERES_RELATORIA_ACTA} caracteres objetivos.`
        );
      }

      const testigosNormalizados: TestigoActaHechos[] = [];
      for (const [idx, t] of (Array.isArray(acta.testigos) ? acta.testigos : []).entries()) {
        const tipo = t?.tipo === 'PERSONAL' ? 'PERSONAL' : t?.tipo === 'EXTERNO' ? 'EXTERNO' : null;
        const personaId = (t?.personaId || '').trim() || undefined;
        const nombreCompleto = (t?.nombreCompleto || '').trim();
        const cargoIdentificacion = (t?.cargoIdentificacion || '').trim();

        if (!tipo) {
          registrarError(`acta.testigos.${idx}`, `El testigo #${idx + 1} tiene un tipo inválido.`);
          continue;
        }
        if (tipo === 'PERSONAL' && !personaId) {
          registrarError(`acta.testigos.${idx}`, `Selecciona la persona del catálogo para el testigo #${idx + 1}.`);
        }
        if (!nombreCompleto || !cargoIdentificacion) {
          registrarError(
            `acta.testigos.${idx}`,
            `Completa el nombre y cargo o identificación del testigo #${idx + 1}.`
          );
        }
        testigosNormalizados.push({
          tipo,
          ...(tipo === 'PERSONAL' && personaId ? { personaId } : {}),
          nombreCompleto,
          cargoIdentificacion,
        });
      }

      actaNormalizada = {
        nombreInstitucion: nombreInstitucion || INSTITUCION_ACTA_POR_DEFECTO,
        tituloDocumento,
        lugar,
        fechaLevantamiento: fechaLevantamientoValida ?? fechaLevantamientoRaw,
        horaInicio,
        horaConclusion,
        empleadoLevantaId,
        empleadoLevantaNombre,
        empleadoLevantaCargo,
        testigos: testigosNormalizados,
        relatoriaHechos,
        pruebasAnexos,
      };
    }
  }

  const borradorNormalizado: BorradorReporteAcademico = {
    id: borrador.id ?? null,
    revision: borrador.revision ?? 1,
    cicloId,
    flujoRegistro,
    tipoReporte,
    fechaReporte: fechaReporteValida ?? fechaReporteRaw,
    descripcion,
    estatus,
    tieneActaHechos,
    enlaceDrive,
    notasEvidencia,
    alumnos: alumnosNormalizados,
    grupos: gruposNormalizados,
    docentes: docentesNormalizados,
    acta: tieneActaHechos ? actaNormalizada : null,
  };

  return {
    valido: errores.length === 0,
    errores,
    erroresCampos,
    borradorNormalizado,
  };
}

function formatearGradoTexto(grado?: string | null): string {
  const limpio = (grado || '').trim();
  if (!limpio) return 'Grado no especificado';
  return /grado/i.test(limpio) ? limpio : `${limpio}° grado`;
}

/**
 * Construye la estructura formal de involucrados para el cuerpo del Acta de Hechos:
 * - Grupos con alcance 'TODO_EL_GRUPO' se mencionan de forma institucional sin listar alumnos individuales.
 * - Grupos con alcance 'PARCIAL' o flujo individual listan a cada alumno con su nombre completo, matrícula y carrera.
 * - Docentes se listan con su nombre completo y clave docente.
 */
export function construirInvolucradosParaActa(borrador: BorradorReporteAcademico): ResumenInvolucradosActa {
  const grupos = Array.isArray(borrador.grupos) ? borrador.grupos : [];
  const alumnos = limpiarAlumnosDeGruposCompletos(
    Array.isArray(borrador.alumnos) ? borrador.alumnos : [],
    grupos
  );
  const docentes = Array.isArray(borrador.docentes) ? borrador.docentes : [];

  const gruposCompletos: InvolucradoActaHechos[] = grupos
    .filter(g => (g.alcanceAlumnos || 'TODO_EL_GRUPO') === 'TODO_EL_GRUPO')
    .map(g => {
      const codigo = (g.codigoGrupo || '').trim() || g.grupoId;
      const carrera = (g.carrera || '').trim() || 'Carrera no especificada';
      const grado = formatearGradoTexto(g.grado);
      const turno = (g.turno || '').trim() || 'Turno no especificado';
      const etiquetaFormal = `Alumnos integrantes del grupo ${codigo} de la carrera ${carrera}, ${grado} — Turno ${turno}`;
      return {
        categoria: 'GRUPO_COMPLETO',
        referenciaId: g.grupoId,
        grupoId: g.grupoId,
        etiquetaFormal,
        nombre: `Grupo ${codigo}`,
        identificadorSecundario: codigo,
        carrera: g.carrera ?? null,
        grado: g.grado ?? null,
        turno: g.turno ?? null,
      };
    });

  const alumnosIndividuales: InvolucradoActaHechos[] = alumnos.map(a => {
    const nombre = (a.nombreCompleto || '').trim() || 'Alumno sin nombre';
    const matricula = (a.matricula || '').trim() || 'S/M';
    const carrera = (a.carrera || '').trim() || 'Carrera no especificada';
    const etiquetaFormal = `Alumno(a) ${nombre} (Matrícula: ${matricula}) — Carrera: ${carrera}`;
    return {
      categoria: 'ALUMNO_INDIVIDUAL',
      referenciaId: a.alumnoId,
      grupoId: a.grupoId ?? null,
      etiquetaFormal,
      nombre,
      identificadorSecundario: matricula,
      carrera: a.carrera ?? null,
      grado: a.grado ?? null,
      turno: null,
    };
  });

  const docentesInvolucrados: InvolucradoActaHechos[] = docentes.map(d => {
    const nombre = (d.nombreCompleto || '').trim() || 'Docente sin nombre';
    const clave = (d.claveDocente || '').trim() || 'S/C';
    const etiquetaFormal = `Docente ${nombre} (Clave: ${clave})`;
    return {
      categoria: 'DOCENTE',
      referenciaId: d.docenteId,
      grupoId: null,
      etiquetaFormal,
      nombre,
      identificadorSecundario: clave,
      carrera: null,
      grado: null,
      turno: null,
    };
  });

  const todos = [...gruposCompletos, ...alumnosIndividuales, ...docentesInvolucrados];
  return {
    gruposCompletos,
    alumnosIndividuales,
    docentes: docentesInvolucrados,
    todos,
    mencionesTexto: todos.map(item => item.etiquetaFormal),
  };
}

/**
 * Construye la estructura formal de firmantes para el pie del Acta de Hechos:
 * - Quien levanta el acta (personal administrativo con nombre y cargo).
 * - Involucrados individuales (alumnos seleccionados en flujo individual o alcance 'PARCIAL', nunca de 'TODO_EL_GRUPO', más docentes).
 * - Testigos de asistencia (tanto seleccionados de personal activo como externos capturados manualmente).
 */
export function construirFirmantesActa(borrador: BorradorReporteAcademico): ResumenFirmantesActa {
  const involucradosResumen = construirInvolucradosParaActa(borrador);
  const acta = borrador.acta;

  let quienLevanta: FirmanteActaHechos | null = null;
  if (acta && (acta.empleadoLevantaId || acta.empleadoLevantaNombre)) {
    const nombre = (acta.empleadoLevantaNombre || '').trim() || 'Personal administrativo';
    const cargo = (acta.empleadoLevantaCargo || '').trim() || 'Administración Escolar';
    quienLevanta = {
      rolFirmante: 'LEVANTA_ACTA',
      referenciaId: (acta.empleadoLevantaId || '').trim() || undefined,
      nombreCompleto: nombre,
      cargoIdentificacion: cargo,
      etiquetaPieFirma: `${nombre} — ${cargo}`,
    };
  }

  const firmantesAlumnos: FirmanteActaHechos[] = involucradosResumen.alumnosIndividuales.map(a => {
    const detalleCargo = `Alumno(a) · Matrícula ${a.identificadorSecundario || 'S/M'}${
      a.carrera ? ` · ${a.carrera}` : ''
    }`;
    return {
      rolFirmante: 'ALUMNO_INVOLUCRADO',
      referenciaId: a.referenciaId,
      nombreCompleto: a.nombre,
      cargoIdentificacion: detalleCargo,
      etiquetaPieFirma: `${a.nombre} — ${detalleCargo}`,
    };
  });

  const firmantesDocentes: FirmanteActaHechos[] = involucradosResumen.docentes.map(d => {
    const detalleCargo = `Docente · Clave ${d.identificadorSecundario || 'S/C'}`;
    return {
      rolFirmante: 'DOCENTE_INVOLUCRADO',
      referenciaId: d.referenciaId,
      nombreCompleto: d.nombre,
      cargoIdentificacion: detalleCargo,
      etiquetaPieFirma: `${d.nombre} — ${detalleCargo}`,
    };
  });

  const testigos: FirmanteActaHechos[] = (Array.isArray(acta?.testigos) ? acta!.testigos : []).map(t => {
    const nombre = (t.nombreCompleto || '').trim();
    const cargo = (t.cargoIdentificacion || '').trim();
    const tipoTestigo = t.tipo === 'PERSONAL' ? 'PERSONAL' : 'EXTERNO';
    return {
      rolFirmante: 'TESTIGO_ASISTENCIA',
      referenciaId: t.personaId?.trim() || undefined,
      tipoTestigo,
      nombreCompleto: nombre,
      cargoIdentificacion: cargo,
      etiquetaPieFirma: `${nombre} — ${cargo}`,
    };
  });

  const involucrados = [...firmantesAlumnos, ...firmantesDocentes];
  const todos = [...(quienLevanta ? [quienLevanta] : []), ...involucrados, ...testigos];

  return {
    quienLevanta,
    involucrados,
    testigos,
    todos,
  };
}

export class ErrorReporteAcademico extends Error {
  readonly codigo?: string;
  readonly esConflictoRevision: boolean;
  readonly faltaMigracion: boolean;

  constructor(
    mensaje: string,
    opciones: { codigo?: string; esConflictoRevision?: boolean; faltaMigracion?: boolean } = {}
  ) {
    super(mensaje);
    this.name = 'ErrorReporteAcademico';
    this.codigo = opciones.codigo;
    this.esConflictoRevision = Boolean(opciones.esConflictoRevision);
    this.faltaMigracion = Boolean(opciones.faltaMigracion);
  }
}

export function normalizarErrorReporteAcademico(error: unknown): ErrorReporteAcademico {
  if (error instanceof ErrorReporteAcademico) return error;
  const errObj = (error ?? {}) as { code?: string; message?: string };
  const codigo = String(errObj.code || '');
  const mensajeOriginal = String(errObj.message || error || 'Error desconocido al procesar reportes académicos.');

  if (['PGRST202', '42883', '42P01'].includes(codigo)) {
    return new ErrorReporteAcademico(
      'Falta instalar la migración de Reportes Académicos (20261114100000_reportes_academicos.sql) en Supabase.',
      { codigo, faltaMigracion: true }
    );
  }

  if (
    codigo === '40001' ||
    /modificado por otra persona|actualiza antes de guardar|revisi[oó]n/i.test(mensajeOriginal)
  ) {
    return new ErrorReporteAcademico(
      'El reporte fue modificado por otro usuario mientras lo editabas. Tu captura sigue en pantalla; revisa los cambios antes de volver a guardar.',
      { codigo: codigo || '40001', esConflictoRevision: true }
    );
  }

  if (codigo === '55P03') {
    return new ErrorReporteAcademico(
      'Otro usuario está guardando cambios sobre este reporte en este instante. Intenta nuevamente en unos segundos.',
      { codigo }
    );
  }

  return new ErrorReporteAcademico(mensajeOriginal, { codigo: codigo || undefined });
}

export function esRegistroActivo(registro: { activo?: boolean | null; estatus?: string | null }): boolean {
  if (typeof registro.activo === 'boolean') {
    return registro.activo;
  }
  const estatus = (registro.estatus ?? 'activo').toString().trim().toLowerCase();
  return estatus === 'activo';
}

export function mapearActaDesdeSql(raw: Record<string, unknown> | null | undefined): BorradorActaHechos | null {
  if (!raw || typeof raw !== 'object') return null;
  const testigosRaw = Array.isArray(raw.testigos_json)
    ? raw.testigos_json
    : Array.isArray(raw.testigos)
      ? raw.testigos
      : [];

  const testigos: TestigoActaHechos[] = testigosRaw
    .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
    .map(t => ({
      tipo: t.tipo === 'PERSONAL' ? 'PERSONAL' : 'EXTERNO',
      ...(typeof t.persona_id === 'string' && t.persona_id.trim()
        ? { personaId: t.persona_id.trim() }
        : typeof t.personaId === 'string' && t.personaId.trim()
          ? { personaId: t.personaId.trim() }
          : {}),
      nombreCompleto: String(t.nombre_completo ?? t.nombreCompleto ?? '').trim(),
      cargoIdentificacion: String(t.cargo_identificacion ?? t.cargoIdentificacion ?? '').trim(),
    }));

  const horaTexto = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s.length >= 5 ? s.slice(0, 5) : s;
  };

  return {
    nombreInstitucion: String(raw.nombre_institucion ?? raw.nombreInstitucion ?? INSTITUCION_ACTA_POR_DEFECTO).trim(),
    tituloDocumento: String(raw.titulo_documento ?? raw.tituloDocumento ?? TITULO_ACTA_POR_DEFECTO).trim(),
    lugar: String(raw.lugar ?? '').trim(),
    fechaLevantamiento: String(raw.fecha_levantamiento ?? raw.fechaLevantamiento ?? '').trim(),
    horaInicio: horaTexto(raw.hora_inicio ?? raw.horaInicio),
    horaConclusion: horaTexto(raw.hora_conclusion ?? raw.horaConclusion),
    empleadoLevantaId: String(raw.empleado_levanta_id ?? raw.empleadoLevantaId ?? '').trim(),
    empleadoLevantaNombre: String(raw.empleado_levanta_nombre ?? raw.empleadoLevantaNombre ?? '').trim(),
    empleadoLevantaCargo: String(raw.empleado_levanta_cargo ?? raw.empleadoLevantaCargo ?? '').trim(),
    testigos,
    relatoriaHechos: String(raw.relatoria_hechos ?? raw.relatoriaHechos ?? '').trim(),
    pruebasAnexos:
      raw.pruebas_anexos != null || raw.pruebasAnexos != null
        ? String(raw.pruebas_anexos ?? raw.pruebasAnexos).trim() || null
        : null,
  };
}

export function mapearReporteDesdeSql(raw: Record<string, unknown>): ReporteAcademicoDetalle {
  const alumnosRaw = Array.isArray(raw.alumnos) ? raw.alumnos : [];
  const gruposRaw = Array.isArray(raw.grupos) ? raw.grupos : [];
  const docentesRaw = Array.isArray(raw.docentes) ? raw.docentes : [];

  return {
    id: String(raw.id ?? ''),
    folio: String(raw.folio ?? ''),
    cicloId: String(raw.ciclo_id ?? raw.cicloId ?? ''),
    cicloNombre: raw.ciclo_nombre != null ? String(raw.ciclo_nombre) : null,
    cicloTipoPeriodo: raw.ciclo_tipo_periodo != null ? String(raw.ciclo_tipo_periodo) : null,
    flujoRegistro: (String(raw.flujo_registro ?? raw.flujoRegistro ?? 'ALUMNO_DOCENTE') as FlujoRegistroReporte),
    tipoReporte: (String(raw.tipo_reporte ?? raw.tipoReporte ?? 'INASISTENCIAS') as TipoReporteAcademico),
    fechaReporte: String(raw.fecha_reporte ?? raw.fechaReporte ?? ''),
    descripcion: String(raw.descripcion ?? ''),
    estatus: (String(raw.estatus ?? 'EN_PROCESO') as EstatusReporteAcademico),
    tieneActaHechos: Boolean(raw.tiene_acta_hechos ?? raw.tieneActaHechos ?? false),
    enlaceDrive: raw.enlace_drive != null ? String(raw.enlace_drive) : null,
    notasEvidencia: raw.notas_evidencia != null ? String(raw.notas_evidencia) : null,
    revision: Number(raw.revision ?? 1),
    creadoPor: raw.creado_por != null ? String(raw.creado_por) : null,
    actualizadoPor: raw.actualizado_por != null ? String(raw.actualizado_por) : null,
    createdAt: raw.created_at != null ? String(raw.created_at) : undefined,
    updatedAt: raw.updated_at != null ? String(raw.updated_at) : undefined,
    alumnos: alumnosRaw
      .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
      .map(a => ({
        alumnoId: String(a.alumno_id ?? a.alumnoId ?? ''),
        grupoId: a.grupo_id != null ? String(a.grupo_id) : null,
        matriculaSnapshot: a.matricula_snapshot != null ? String(a.matricula_snapshot) : null,
        nombreSnapshot: a.nombre_snapshot != null ? String(a.nombre_snapshot) : null,
        carreraSnapshot: a.carrera_snapshot != null ? String(a.carrera_snapshot) : null,
        gradoSnapshot: a.grado_snapshot != null ? String(a.grado_snapshot) : null,
      })),
    grupos: gruposRaw
      .filter((g): g is Record<string, unknown> => Boolean(g && typeof g === 'object'))
      .map(g => ({
        grupoId: String(g.grupo_id ?? g.grupoId ?? ''),
        alcanceAlumnos: (g.alcance_alumnos === 'PARCIAL' ? 'PARCIAL' : 'TODO_EL_GRUPO') as AlcanceGrupoReporte,
        codigoGrupoSnapshot: g.codigo_grupo_snapshot != null ? String(g.codigo_grupo_snapshot) : null,
        carreraSnapshot: g.carrera_snapshot != null ? String(g.carrera_snapshot) : null,
        gradoSnapshot: g.grado_snapshot != null ? String(g.grado_snapshot) : null,
        turnoSnapshot: g.turno_snapshot != null ? String(g.turno_snapshot) : null,
      })),
    docentes: docentesRaw
      .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === 'object'))
      .map(d => ({
        docenteId: String(d.docente_id ?? d.docenteId ?? ''),
        nombreDocenteSnapshot: d.nombre_docente_snapshot != null ? String(d.nombre_docente_snapshot) : null,
        claveDocenteSnapshot: d.clave_docente_snapshot != null ? String(d.clave_docente_snapshot) : null,
      })),
    acta: mapearActaDesdeSql(raw.acta as Record<string, unknown> | null | undefined),
  };
}

export function convertirReporteABorrador(reporte: ReporteAcademicoDetalle): BorradorReporteAcademico {
  return {
    id: reporte.id,
    revision: reporte.revision,
    cicloId: reporte.cicloId,
    flujoRegistro: reporte.flujoRegistro,
    tipoReporte: reporte.tipoReporte,
    fechaReporte: reporte.fechaReporte,
    descripcion: reporte.descripcion,
    estatus: reporte.estatus,
    tieneActaHechos: reporte.tieneActaHechos,
    enlaceDrive: reporte.enlaceDrive,
    notasEvidencia: reporte.notasEvidencia,
    alumnos: reporte.alumnos.map(a => ({
      alumnoId: a.alumnoId,
      grupoId: a.grupoId,
      matricula: a.matriculaSnapshot,
      nombreCompleto: a.nombreSnapshot ?? '',
      carrera: a.carreraSnapshot,
      grado: a.gradoSnapshot,
    })),
    grupos: reporte.grupos.map(g => ({
      grupoId: g.grupoId,
      alcanceAlumnos: g.alcanceAlumnos,
      codigoGrupo: g.codigoGrupoSnapshot ?? '',
      carrera: g.carreraSnapshot,
      grado: g.gradoSnapshot,
      turno: g.turnoSnapshot,
    })),
    docentes: reporte.docentes.map(d => ({
      docenteId: d.docenteId,
      nombreCompleto: d.nombreDocenteSnapshot ?? '',
      claveDocente: d.claveDocenteSnapshot,
    })),
    acta: reporte.acta ? { ...reporte.acta, testigos: [...reporte.acta.testigos] } : null,
  };
}

export function construirPayloadGuardarReporte(borrador: BorradorReporteAcademico): Record<string, unknown> {
  const validacion = validarBorradorReporteAcademico(borrador);
  if (!validacion.valido) {
    throw new ErrorReporteAcademico(validacion.errores[0] || 'Revisa los datos del reporte antes de guardar.');
  }
  const b = validacion.borradorNormalizado;
  return {
    ...(b.id ? { id: b.id, revision: b.revision ?? 1 } : {}),
    ciclo_id: b.cicloId,
    flujo_registro: b.flujoRegistro,
    tipo_reporte: b.tipoReporte,
    fecha_reporte: b.fechaReporte,
    descripcion: b.descripcion,
    estatus: b.estatus,
    tiene_acta_hechos: b.tieneActaHechos,
    enlace_drive: b.enlaceDrive,
    notas_evidencia: b.notasEvidencia,
    alumnos: b.alumnos.map(a => ({
      alumno_id: a.alumnoId,
      ...(a.grupoId ? { grupo_id: a.grupoId } : {}),
    })),
    grupos: b.grupos.map(g => ({
      grupo_id: g.grupoId,
      alcance_alumnos: g.alcanceAlumnos,
    })),
    docentes: b.docentes.map(d => ({
      docente_id: d.docenteId,
    })),
    acta:
      b.tieneActaHechos && b.acta
        ? {
            nombre_institucion: b.acta.nombreInstitucion,
            titulo_documento: b.acta.tituloDocumento,
            lugar: b.acta.lugar,
            fecha_levantamiento: b.acta.fechaLevantamiento,
            hora_inicio: b.acta.horaInicio,
            hora_conclusion: b.acta.horaConclusion,
            empleado_levanta_id: b.acta.empleadoLevantaId,
            empleado_levanta_cargo: b.acta.empleadoLevantaCargo,
            testigos: b.acta.testigos.map(t => ({
              tipo: t.tipo,
              ...(t.tipo === 'PERSONAL' && t.personaId ? { persona_id: t.personaId } : {}),
              nombre_completo: t.nombreCompleto,
              cargo_identificacion: t.cargoIdentificacion,
            })),
            relatoria_hechos: b.acta.relatoriaHechos,
            pruebas_anexos: b.acta.pruebasAnexos ?? null,
          }
        : null,
  };
}

export function construirPayloadFiltrosReportes(filtros: FiltrosReportesAcademicos = {}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (filtros.cicloId && filtros.cicloId !== 'TODOS') payload.ciclo_id = filtros.cicloId.trim();
  if (filtros.fechaDesde?.trim()) payload.fecha_desde = filtros.fechaDesde.trim();
  if (filtros.fechaHasta?.trim()) payload.fecha_hasta = filtros.fechaHasta.trim();
  if (filtros.carrera != null) payload.carrera = filtros.carrera;
  if (filtros.tipoReporte != null) payload.tipo_reporte = filtros.tipoReporte;
  if (filtros.estatus != null) payload.estatus = filtros.estatus;
  if (filtros.busqueda?.trim()) payload.busqueda = filtros.busqueda.trim();
  if (filtros.alumnoId?.trim()) payload.alumno_id = filtros.alumnoId.trim();
  if (filtros.grupoId?.trim()) payload.grupo_id = filtros.grupoId.trim();
  if (filtros.docenteId?.trim()) payload.docente_id = filtros.docenteId.trim();
  return payload;
}
