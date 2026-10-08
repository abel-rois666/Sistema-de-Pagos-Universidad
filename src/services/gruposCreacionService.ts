import { supabase } from '../lib/supabase';
import { leerTodasFilas } from '../horarios/consultas';
import type { AlumnoNuevoGrupo, AsignaturaNuevoGrupo } from '../utils/nuevoGrupoUtils';

export interface PlanNuevoGrupo {
  id: string;
  nombre: string;
  carrera: { nombre: string } | null;
  modelo: string | null;
  total_periodos: number | null;
}

export interface BorradorNuevoGrupo {
  id: string;
  codigo: string;
  cicloId: string;
  planId: string;
  grado: number;
  esMultigrado: boolean;
  gradoInicio: number | null;
  gradoFin: number | null;
  turno: 'Matutino' | 'Vespertino' | 'Mixto';
  estatus: 'activo' | 'inactivo';
  asignaturaIds: string[];
  alumnoIds: string[];
}

export async function cargarPlanesNuevoGrupo(): Promise<PlanNuevoGrupo[]> {
  const planes = await leerTodasFilas<PlanNuevoGrupo>('planes_estudio', 'id,nombre,modelo,total_periodos,carrera:carreras(nombre)', 'id');
  return planes.sort((a, b) => (a.carrera?.nombre || '').localeCompare(b.carrera?.nombre || '', 'es') || a.nombre.localeCompare(b.nombre, 'es'));
}

export async function cargarAsignaturasNuevoGrupo(planId: string): Promise<AsignaturaNuevoGrupo[]> {
  return leerTodasFilas<AsignaturaNuevoGrupo>('asignaturas', 'id,nombre,clave_legado,numero_periodo,activo', 'id', { campo: 'plan_id', valor: planId });
}

export async function cargarAlumnosNuevoGrupo(planId?: string): Promise<AlumnoNuevoGrupo[]> {
  const alumnos: AlumnoNuevoGrupo[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await supabase.from('alumnos')
      .select('id,nombre_completo,matricula,licenciatura,grado_actual,turno,estatus')
      .ilike('estatus', 'activo').order('id').range(inicio, inicio + 999);
    if (error) throw error;
    alumnos.push(...(data || []) as AlumnoNuevoGrupo[]);
    if (!data || data.length < 1000) break;
  }
  if (planId) {
    const vigentesIds = new Set<string>();
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error } = await supabase.from('alumno_programas').select('alumno_id,estatus')
        .eq('plan_id', planId).eq('es_vigente', true)
        .order('alumno_id').range(inicio, inicio + 999);
      if (error) throw error;
      for (const item of data || []) if (['CURSANDO', 'ACTIVO'].includes(item.estatus?.toUpperCase() || '')) vigentesIds.add(item.alumno_id);
      if (!data || data.length < 1000) break;
    }
    for (const alumno of alumnos) if (vigentesIds.has(alumno.id)) alumno.planVigenteIds = [planId];
  }
  return alumnos.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'));
}

export async function crearGrupoCompleto(borrador: BorradorNuevoGrupo): Promise<string> {
  const parametros = {
    p_grupo_id: borrador.id,
    p_codigo: borrador.codigo.trim(),
    p_ciclo_id: borrador.cicloId,
    p_plan_id: borrador.planId,
    p_grado: borrador.grado,
    p_turno: borrador.turno,
    p_estatus: borrador.estatus,
    p_asignatura_ids: borrador.asignaturaIds,
    p_alumno_ids: borrador.alumnoIds,
  };
  const { data, error } = borrador.esMultigrado
    ? await supabase.rpc('crear_grupo_multigrado_completo', {
      ...parametros, p_grado_inicio: borrador.gradoInicio, p_grado_fin: borrador.gradoFin,
    })
    : await supabase.rpc('crear_grupo_completo', parametros);
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('La base no devolvió el identificador del grupo.');
  return data;
}
