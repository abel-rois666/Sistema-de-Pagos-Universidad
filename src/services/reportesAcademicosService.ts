import { supabase, fetchAllSupabase } from '../lib/supabase';
import {
  construirPayloadFiltrosReportes,
  construirPayloadGuardarReporte,
  convertirReporteABorrador,
  ErrorReporteAcademico,
  esRegistroActivo,
  mapearActaDesdeSql,
  mapearReporteDesdeSql,
  normalizarErrorReporteAcademico,
} from '../reportesAcademicos/dominio';
import type {
  BorradorReporteAcademico,
  FiltrosReportesAcademicos,
  OpcionAlumnoReporte,
  OpcionDocenteReporte,
  OpcionGrupoReporte,
  OpcionPersonalReporte,
  ReporteAcademicoDetalle,
} from '../reportesAcademicos/types';

export {
  construirPayloadFiltrosReportes,
  construirPayloadGuardarReporte,
  convertirReporteABorrador,
  ErrorReporteAcademico,
  esRegistroActivo,
  mapearActaDesdeSql,
  mapearReporteDesdeSql,
  normalizarErrorReporteAcademico,
};

function normalizarTextoBusqueda(texto?: string | null): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface ResultadoGuardarReporte {
  id: string;
  folio: string;
  revision: number;
  accion: 'CREAR' | 'EDITAR' | 'CAMBIAR_ESTATUS';
  reporte: ReporteAcademicoDetalle;
}

export const reportesAcademicosService = {
  async consultarReportes(
    filtros: FiltrosReportesAcademicos = {},
    signal?: AbortSignal
  ): Promise<{ total: number; reportes: ReporteAcademicoDetalle[] }> {
    const p_filtros = construirPayloadFiltrosReportes(filtros);
    let query = supabase.rpc('consultar_reportes_academicos_v1', { p_filtros });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw normalizarErrorReporteAcademico(error);
    if (!data || typeof data !== 'object' || !Array.isArray(data.reportes)) {
      throw new ErrorReporteAcademico('El servidor no devolvió una respuesta válida al consultar reportes académicos.');
    }
    return {
      total: Number(data.total ?? data.reportes.length),
      reportes: data.reportes.map((r: Record<string, unknown>) => mapearReporteDesdeSql(r)),
    };
  },

  async guardarReporte(borrador: BorradorReporteAcademico): Promise<ResultadoGuardarReporte> {
    const p_payload = construirPayloadGuardarReporte(borrador);
    const { data, error } = await supabase.rpc('guardar_reporte_academico_v1', { p_payload });
    if (error) throw normalizarErrorReporteAcademico(error);
    if (!data || typeof data !== 'object' || !data.id || !data.reporte) {
      throw new ErrorReporteAcademico('No se recibió confirmación completa del reporte guardado.');
    }
    return {
      id: String(data.id),
      folio: String(data.folio ?? data.reporte.folio ?? ''),
      revision: Number(data.revision ?? data.reporte.revision ?? 1),
      accion: (data.accion ?? 'CREAR') as 'CREAR' | 'EDITAR' | 'CAMBIAR_ESTATUS',
      reporte: mapearReporteDesdeSql(data.reporte as Record<string, unknown>),
    };
  },

  /**
   * Consulta toda la tabla `alumnos` independientemente de su estatus (ACTIVO, BAJA, EGRESADO, etc.),
   * ordenada alfabéticamente por nombre completo.
   */
  async buscarAlumnos(busqueda?: string, signal?: AbortSignal): Promise<OpcionAlumnoReporte[]> {
    const { data, error } = await fetchAllSupabase(() => {
      let q = supabase
        .from('alumnos')
        .select('id, matricula, nombre_completo, licenciatura, grado_actual, turno, estatus')
        .order('nombre_completo', { ascending: true });
      if (signal) q = q.abortSignal(signal);
      return q;
    });
    if (error) throw normalizarErrorReporteAcademico(error);

    const filtro = normalizarTextoBusqueda(busqueda);
    const lista: OpcionAlumnoReporte[] = (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      matricula: row.matricula != null ? String(row.matricula) : null,
      nombreCompleto: String(row.nombre_completo ?? '').trim(),
      carrera: row.licenciatura != null ? String(row.licenciatura) : null,
      grado: row.grado_actual != null ? String(row.grado_actual) : null,
      turno: row.turno != null ? String(row.turno) : null,
      estatus: row.estatus != null ? String(row.estatus) : null,
    }));

    const filtrados = filtro
      ? lista.filter(a => {
          const texto = normalizarTextoBusqueda(`${a.nombreCompleto} ${a.matricula ?? ''} ${a.carrera ?? ''}`);
          return texto.includes(filtro);
        })
      : lista;

    return filtrados.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX'));
  },

  /**
   * Lista únicamente los docentes activos (`activo = true` o `estatus = 'activo'`),
   * ordenados alfabéticamente.
   */
  async listarDocentesActivos(signal?: AbortSignal): Promise<OpcionDocenteReporte[]> {
    let q = supabase
      .from('docentes')
      .select('*')
      .order('nombre_completo', { ascending: true });
    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q;
    if (error) throw normalizarErrorReporteAcademico(error);

    return (data || [])
      .filter((row: Record<string, unknown>) =>
        esRegistroActivo({
          activo: typeof row.activo === 'boolean' ? row.activo : undefined,
          estatus: typeof row.estatus === 'string' ? row.estatus : undefined,
        })
      )
      .map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        personaId: row.persona_id != null ? String(row.persona_id) : null,
        claveDocente: String(row.clave_legado ?? '').trim(),
        nombreCompleto: String(row.nombre_completo ?? '').trim(),
        activo: true,
      }))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX'));
  },

  /**
   * Lista los grupos pertenecientes exactamente al `cicloId` indicado junto con
   * la relación única y ordenada de alumnos inscritos en cada grupo para la selección 'PARCIAL'.
   */
  async listarGruposPorCiclo(cicloId: string, signal?: AbortSignal): Promise<OpcionGrupoReporte[]> {
    const idLimpio = (cicloId || '').trim();
    if (!idLimpio || idLimpio === 'TODOS') return [];

    let qGrupos = supabase
      .from('grupos')
      .select(
        'id, ciclo_id, plan_id, codigo_grupo, grado, es_multigrado, grado_inicio, grado_fin, turno, estatus, planes_estudio(nombre, carreras(nombre))'
      )
      .eq('ciclo_id', idLimpio)
      .order('codigo_grupo', { ascending: true });
    if (signal) qGrupos = qGrupos.abortSignal(signal);
    const { data: gruposData, error: errorGrupos } = await qGrupos;
    if (errorGrupos) throw normalizarErrorReporteAcademico(errorGrupos);

    const gruposRows = (gruposData || []) as Record<string, unknown>[];
    if (gruposRows.length === 0) return [];

    const grupoIds = gruposRows.map(g => String(g.id));
    let qRelaciones = supabase
      .from('alumnos_grupos')
      .select('grupo_id, alumno_id, alumnos(id, matricula, nombre_completo, licenciatura, grado_actual, turno, estatus)')
      .in('grupo_id', grupoIds);
    if (signal) qRelaciones = qRelaciones.abortSignal(signal);
    const { data: relData, error: errorRel } = await qRelaciones;
    if (errorRel) throw normalizarErrorReporteAcademico(errorRel);

    const alumnosPorGrupo = new Map<string, Map<string, OpcionAlumnoReporte>>();
    for (const rel of (relData || []) as Record<string, unknown>[]) {
      const gId = String(rel.grupo_id ?? '');
      const alumnoRaw = rel.alumnos as Record<string, unknown> | null;
      if (!gId || !alumnoRaw || !alumnoRaw.id) continue;
      const aId = String(alumnoRaw.id);
      if (!alumnosPorGrupo.has(gId)) {
        alumnosPorGrupo.set(gId, new Map());
      }
      const mapaGrupo = alumnosPorGrupo.get(gId)!;
      if (!mapaGrupo.has(aId)) {
        mapaGrupo.set(aId, {
          id: aId,
          matricula: alumnoRaw.matricula != null ? String(alumnoRaw.matricula) : null,
          nombreCompleto: String(alumnoRaw.nombre_completo ?? '').trim(),
          carrera: alumnoRaw.licenciatura != null ? String(alumnoRaw.licenciatura) : null,
          grado: alumnoRaw.grado_actual != null ? String(alumnoRaw.grado_actual) : null,
          turno: alumnoRaw.turno != null ? String(alumnoRaw.turno) : null,
          estatus: alumnoRaw.estatus != null ? String(alumnoRaw.estatus) : null,
        });
      }
    }

    return gruposRows
      .map(g => {
        const id = String(g.id ?? '');
        const plan = g.planes_estudio as Record<string, unknown> | null;
        const carreraObj = plan?.carreras as Record<string, unknown> | null;
        const carrera =
          (carreraObj?.nombre != null ? String(carreraObj.nombre) : null) ??
          (plan?.nombre != null ? String(plan.nombre) : null);
        const esMultigrado = Boolean(g.es_multigrado);
        const grado = esMultigrado
          ? `${g.grado_inicio ?? ''}-${g.grado_fin ?? ''}`
          : g.grado != null
            ? String(g.grado)
            : null;
        const inscritos = Array.from(alumnosPorGrupo.get(id)?.values() ?? []).sort((a, b) =>
          a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX')
        );
        return {
          id,
          cicloId: String(g.ciclo_id ?? idLimpio),
          planId: String(g.plan_id ?? ''),
          codigoGrupo: String(g.codigo_grupo ?? '').trim(),
          carrera,
          grado,
          turno: g.turno != null ? String(g.turno) : null,
          esMultigrado,
          alumnosInscritos: inscritos,
        };
      })
      .sort((a, b) => a.codigoGrupo.localeCompare(b.codigoGrupo, 'es-MX', { numeric: true }));
  },

  /**
   * Carga el personal administrativo activo (`empleados` activos) para elegir quién levanta el acta
   * y el catálogo combinado (`empleados` + `docentes` activos) para seleccionar testigos de asistencia.
   */
  async listarPersonalParaActa(signal?: AbortSignal): Promise<{
    administrativosActivos: OpcionPersonalReporte[];
    personalTestigosActivo: OpcionPersonalReporte[];
  }> {
    let qEmpleados = supabase.from('empleados').select('*');
    let qDocentes = supabase.from('docentes').select('*');
    if (signal) {
      qEmpleados = qEmpleados.abortSignal(signal);
      qDocentes = qDocentes.abortSignal(signal);
    }

    const [{ data: empData, error: empError }, { data: docData, error: docError }] = await Promise.all([
      qEmpleados,
      qDocentes,
    ]);
    if (empError) throw normalizarErrorReporteAcademico(empError);
    if (docError) throw normalizarErrorReporteAcademico(docError);

    const administrativosActivos: OpcionPersonalReporte[] = (empData || [])
      .filter((e: Record<string, unknown>) =>
        esRegistroActivo({
          activo: typeof e.activo === 'boolean' ? e.activo : undefined,
          estatus: typeof e.estatus === 'string' ? e.estatus : undefined,
        })
      )
      .map((e: Record<string, unknown>) => {
        const nombreCompleto = [e.nombres, e.apellido_paterno, e.apellido_materno]
          .map(parte => String(parte ?? '').trim())
          .filter(Boolean)
          .join(' ');
        return {
          id: String(e.id ?? ''),
          personaId: e.persona_id != null ? String(e.persona_id) : null,
          origen: 'EMPLEADO' as const,
          nombreCompleto,
          cargoIdentificacion: String(e.puesto ?? e.departamento ?? 'Personal administrativo').trim(),
          activo: true,
        };
      })
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX'));

    const docentesActivos: OpcionPersonalReporte[] = (docData || [])
      .filter((d: Record<string, unknown>) =>
        esRegistroActivo({
          activo: typeof d.activo === 'boolean' ? d.activo : undefined,
          estatus: typeof d.estatus === 'string' ? d.estatus : undefined,
        })
      )
      .map((d: Record<string, unknown>) => ({
        id: String(d.id ?? ''),
        personaId: d.persona_id != null ? String(d.persona_id) : null,
        origen: 'DOCENTE' as const,
        nombreCompleto: String(d.nombre_completo ?? '').trim(),
        cargoIdentificacion: `Docente${d.clave_legado ? ` (${String(d.clave_legado).trim()})` : ''}`,
        activo: true,
      }))
      .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX'));

    const personalTestigosActivo = [...administrativosActivos, ...docentesActivos].sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, 'es-MX')
    );

    return {
      administrativosActivos,
      personalTestigosActivo,
    };
  },
};
