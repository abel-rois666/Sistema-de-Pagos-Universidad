import { supabase } from '../lib/supabase';
import { listarCalendarios } from '../calendario/service';
import type { CicloEscolar, PaymentPlan } from '../types';
import { esNuevoIngresoSinBoleta, esPrimerGradoPersonal, tieneHistorialAnterior,
  seleccionarCalendario, seleccionarGruposConHorario, seleccionarPlanDePagos,
  type GrupoComunicado, type ReferenciaPlanPagoComunicado, type SeleccionDocumento } from './preparacion';
import { esAsignaturaIngles } from '../utils/asignaturaIngles';
import { ciclosBoletaElegibles } from './ciclos';

interface GrupoFila { id: string; ciclo_id: string; plan_id: string; codigo_grupo: string; turno: string }
interface AlumnoGrupoFila { id: string; alumno_id: string; grupo_id: string }
interface AlumnoFila { id: string; matricula: string | null; nombre_completo: string; estatus: string; email: string | null; grado_actual: string | number | null }
interface PlanFila { id: string; tipo_periodo: string; modalidad: string | null }
interface InscripcionFila { id: string; alumno_id: string; ciclo_id: string | null; calificacion_final: unknown;
  asignaturas: { plan_id: string; nombre: string } | { plan_id: string; nombre: string }[] | null }

export interface FilaComunicado {
  alumno: AlumnoFila;
  grupos: GrupoComunicado[];
  planId: string | null;
  cicloEntregaId: string;
  cicloBoletaId: string | null;
  boleta: SeleccionDocumento<{ inscripciones: number; calificacionesPendientes: number }>;
  calendario: SeleccionDocumento<{ id: string; nombre: string }>;
  horario: SeleccionDocumento<GrupoComunicado[]>;
  pagos: SeleccionDocumento<{ id: string; folio: string }>;
  materiasIngles: string[];
}

async function paginar<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw new Error(error.message);
    filas.push(...(data || []));
    if ((data || []).length < 1000) return filas;
  }
}

async function porIds<T>(ids: string[], consultar: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const filas: T[] = [];
  for (let inicio = 0; inicio < ids.length; inicio += 80)
    filas.push(...await consultar(ids.slice(inicio, inicio + 80)));
  return filas;
}

const falta = <T>(motivo: string): SeleccionDocumento<T> => ({ estado: 'FALTANTE', motivo });
const ambiguo = <T>(motivo: string): SeleccionDocumento<T> => ({ estado: 'AMBIGUO', motivo });
const agruparPorAlumno = <T extends { alumno_id?: string }>(filas: T[]): Map<string, T[]> => {
  const porAlumno = new Map<string, T[]>();
  for (const fila of filas) {
    if (!fila.alumno_id) continue;
    const actuales = porAlumno.get(fila.alumno_id) || [];
    actuales.push(fila);
    porAlumno.set(fila.alumno_id, actuales);
  }
  return porAlumno;
};

/** Alumnos activos con programa de la periodicidad elegida que aún no tienen grupo en el ciclo. */
export async function listarAlumnosSinGrupoComunicados(ciclo: CicloEscolar, agrupados: readonly string[]) {
  const programas = await paginar<{ alumno_id: string; plan_id: string }>((desde, hasta) => supabase
    .from('alumno_programas').select('alumno_id,plan_id').eq('es_vigente', true)
    .in('estatus', ['ACTIVO', 'CURSANDO']).order('alumno_id').range(desde, hasta));
  const planIds = [...new Set(programas.map(programa => programa.plan_id))];
  const planes = await porIds(planIds, lote => paginar<{ id: string; tipo_periodo: string }>((desde, hasta) => supabase
    .from('planes_estudio').select('id,tipo_periodo').in('id', lote).order('id').range(desde, hasta)));
  const periodoPorPlan = new Map(planes.map(plan => [plan.id, plan.tipo_periodo?.toUpperCase()]));
  const periodoCiclo = ciclo.tipo_periodo?.toUpperCase() || '';
  const agrupadosSet = new Set(agrupados);
  const ids = [...new Set(programas.filter(programa => periodoPorPlan.get(programa.plan_id) === periodoCiclo
    && !agrupadosSet.has(programa.alumno_id)).map(programa => programa.alumno_id))];
  const alumnos = await porIds(ids, lote => paginar<AlumnoFila>((desde, hasta) => supabase.from('alumnos')
    .select('id,matricula,nombre_completo,estatus,email,grado_actual').in('id', lote).order('id').range(desde, hasta)));
  return alumnos.filter(alumno => alumno.estatus?.toUpperCase() === 'ACTIVO')
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
}

/** Revisión de solo lectura. Ningún archivo se sube ni se envía desde esta consulta. */
export async function revisarComunicadosDelCiclo(cicloId: string, cicloBoletaId: string | null,
  ciclos: readonly CicloEscolar[]): Promise<FilaComunicado[]> {
  const cicloActual = ciclos.find(item => item.id === cicloId) || null;
  const ciclosAnteriores = new Set(ciclosBoletaElegibles(ciclos, cicloActual).map(item => item.id));
  const grupos = await paginar<GrupoFila>((desde, hasta) => supabase.from('grupos')
    .select('id,ciclo_id,plan_id,codigo_grupo,turno').eq('ciclo_id', cicloId)
    .order('id').range(desde, hasta));
  if (!grupos.length) return [];
  const gruposPorId = new Map(grupos.map(grupo => [grupo.id, grupo]));
  const relaciones = await porIds(grupos.map(grupo => grupo.id), lote => paginar<AlumnoGrupoFila>(
    (desde, hasta) => supabase.from('alumnos_grupos').select('id,alumno_id,grupo_id')
      .in('grupo_id', lote).order('id').range(desde, hasta)));
  const alumnoIds = [...new Set(relaciones.map(fila => fila.alumno_id))];
  const planIds = [...new Set(grupos.map(grupo => grupo.plan_id))];
  const [alumnos, planes, inscripciones, pagos, referenciasPago, calendarios, version] = await Promise.all([
    porIds(alumnoIds, lote => paginar<AlumnoFila>((desde, hasta) => supabase.from('alumnos')
      .select('id,matricula,nombre_completo,estatus,email,grado_actual').in('id', lote).order('id').range(desde, hasta))),
    porIds(planIds, lote => paginar<PlanFila>((desde, hasta) => supabase.from('planes_estudio')
      .select('id,tipo_periodo,modalidad').in('id', lote).order('id').range(desde, hasta))),
    porIds(alumnoIds, lote => paginar<InscripcionFila>((desde, hasta) => supabase.from('inscripciones_academicas')
      .select('id,alumno_id,ciclo_id,calificacion_final,asignaturas(plan_id,nombre)').in('alumno_id', lote)
      .order('id').range(desde, hasta))),
    porIds(alumnoIds, lote => paginar<PaymentPlan>((desde, hasta) => supabase.from('planes_pago')
      .select('*,detalles:planes_pago_detalles(*)').in('alumno_id', lote).eq('ciclo_id', cicloId)
      .order('id').range(desde, hasta))),
    porIds(alumnoIds, lote => paginar<ReferenciaPlanPagoComunicado>((desde, hasta) => supabase.from('planes_pago')
      .select('id,alumno_id,ciclo_id,tipo_plan').in('alumno_id', lote)
      .order('id').range(desde, hasta))),
    listarCalendarios(cicloId),
    supabase.from('horarios_versiones').select('id,ciclo_id,grupos_id,version')
      .eq('ciclo_id', cicloId).eq('estado', 'publicado').order('version', { ascending: false })
      .limit(1).maybeSingle(),
  ]);
  if (version.error) throw new Error(version.error.message);
  const sesionesPublicadas = version.data ? await paginar<{ id: string; grupo_id: string | null }>(
    (desde, hasta) => supabase.from('horarios_sesiones').select('id,grupo_id')
      .eq('horario_id', version.data.id).order('id').range(desde, hasta)) : [];
  const gruposConSesiones = new Set(sesionesPublicadas.map(sesion => sesion.grupo_id).filter(Boolean));
  const planesPorId = new Map(planes.map(plan => [plan.id, plan]));
  const gruposPorAlumno = agruparPorAlumno(relaciones);
  const inscripcionesPorAlumno = agruparPorAlumno(inscripciones);
  const pagosPorAlumno = agruparPorAlumno(pagos);
  const referenciasPagoPorAlumno = agruparPorAlumno(referenciasPago);
  return alumnos.map(alumno => {
    const gruposAlumno = [...new Set((gruposPorAlumno.get(alumno.id) || [])
      .map(relacion => relacion.grupo_id))].map(id => gruposPorId.get(id)).filter((grupo): grupo is GrupoFila => Boolean(grupo));
    const idsPlan = [...new Set(gruposAlumno.map(grupo => grupo.plan_id))];
    const planId = idsPlan.length === 1 ? idsPlan[0] : null;
    const grupoDocumentos = gruposAlumno.map(grupo => ({ id: grupo.id, cicloId: grupo.ciclo_id,
      planId: grupo.plan_id, codigo: grupo.codigo_grupo }));
    const plan = planId ? planesPorId.get(planId) : null;
    const turnos = [...new Set(gruposAlumno.filter(grupo => grupo.plan_id === planId)
      .map(grupo => grupo.turno))];
    const insAlumno = inscripcionesPorAlumno.get(alumno.id) || [];
    const insPlan = insAlumno.filter(fila => {
      const materia = Array.isArray(fila.asignaturas) ? fila.asignaturas[0] : fila.asignaturas;
      return materia?.plan_id === planId;
    });
    const materiasIngles = [...new Set(insPlan.filter(fila => fila.ciclo_id === cicloId)
      .map(fila => Array.isArray(fila.asignaturas) ? fila.asignaturas[0] : fila.asignaturas)
      .map(materia => materia?.nombre || '').filter(esAsignaturaIngles))];
    const tieneHistorialDelPlan = tieneHistorialAnterior(insPlan.map(fila => fila.ciclo_id), ciclosAnteriores);
    const nuevoIngreso = Boolean(planId && esNuevoIngresoSinBoleta(alumno.grado_actual,
      tieneHistorialDelPlan));
    const insBoleta = insPlan.filter(fila => fila.ciclo_id === cicloBoletaId);
    const boleta: FilaComunicado['boleta'] = !planId
      ? ambiguo('Revisa a qué plan corresponden los grupos del alumno.')
      : nuevoIngreso
      ? { estado: 'NO_APLICA', motivo: 'Nuevo ingreso en primer grado, sin historial académico previo de este plan.' }
      : !cicloBoletaId
      ? falta('Selecciona un ciclo anterior de la misma periodicidad para la boleta.')
      : !insBoleta.length
      ? falta(esPrimerGradoPersonal(alumno.grado_actual) && tieneHistorialDelPlan
        ? 'No hay boleta del ciclo elegido, pero existen inscripciones de este plan en ciclos anteriores. Revisa ese historial antes de omitir la boleta.'
        : `No hay boleta del ciclo elegido. El grado de avance personal registrado es ${String(alumno.grado_actual || 'sin definir')}; verifica que sea primero y que no exista historial previo del plan.`)
      : { estado: 'LISTO', valor: { inscripciones: insBoleta.length,
        calificacionesPendientes: insBoleta.filter(fila => fila.calificacion_final == null || fila.calificacion_final === '').length } };
    const calendario: FilaComunicado['calendario'] = !planId
      ? ambiguo('El alumno aparece en grupos de varios planes del ciclo.')
      : !plan ? falta('No se encontró el plan de estudios del grupo.')
        : (() => {
          const resultados = turnos.map(turno => seleccionarCalendario(calendarios, cicloId, {
            planId, tipoPeriodo: plan.tipo_periodo, modalidad: plan.modalidad || 'ESCOLARIZADA', turno,
          }));
          const fallido = resultados.find(resultado => resultado.estado !== 'LISTO');
          if (fallido) return fallido;
          const encontrados = resultados.flatMap(resultado => resultado.estado === 'LISTO' ? [resultado.valor] : []);
          if (new Set(encontrados.map(item => item.id)).size !== 1)
            return ambiguo('Los grupos del alumno requieren calendarios distintos. Revisa qué documentos enviar.');
          return { estado: 'LISTO', valor: { id: encontrados[0].id, nombre: encontrados[0].nombre } };
        })();
    const horario = !planId ? ambiguo<GrupoComunicado[]>('Revisa a qué plan corresponden los grupos del alumno.')
      : seleccionarGruposConHorario(grupoDocumentos, version.data ? {
        cicloId: version.data.ciclo_id,
        grupoIds: (version.data.grupos_id || []).filter(id => gruposConSesiones.has(id)),
      } : null, cicloId, planId);
    const planPago = seleccionarPlanDePagos(pagosPorAlumno.get(alumno.id) || [], alumno.id, cicloId,
      ciclos, referenciasPagoPorAlumno.get(alumno.id) || []);
    const pagoSeleccionado: FilaComunicado['pagos'] = planPago.estado === 'LISTO'
      ? { estado: 'LISTO', valor: { id: planPago.valor.id, folio: planPago.valor.no_plan_pagos } }
      : planPago;
    return { alumno, grupos: grupoDocumentos, planId, cicloEntregaId: cicloId,
      cicloBoletaId, boleta, calendario, horario, pagos: pagoSeleccionado, materiasIngles };
  }).sort((a, b) => a.alumno.nombre_completo.localeCompare(b.alumno.nombre_completo, 'es'));
}
