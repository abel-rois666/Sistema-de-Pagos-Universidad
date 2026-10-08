import { supabase } from '../lib/supabase';
import type { ProgramaPromocion } from '../utils/promocionAlumnos';

/** Consulta siempre el programa vigente antes de previsualizar o guardar una promoción. */
export async function cargarProgramasVigentesPromocion(alumnoIds: string[]): Promise<Map<string, ProgramaPromocion>> {
  const programas = new Map<string, ProgramaPromocion>();
  for (let inicio = 0; inicio < alumnoIds.length; inicio += 100) {
    const ids = alumnoIds.slice(inicio, inicio + 100);
    const { data, error } = await supabase.from('alumno_programas')
      .select('id,alumno_id,plan_id,estatus,planes_estudio(total_periodos)')
      .in('alumno_id', ids).eq('es_vigente', true);
    if (error) throw new Error(`No se pudieron consultar los programas vigentes: ${error.message}`);
    for (const fila of data || []) {
      if (programas.has(fila.alumno_id)) throw new Error('Un alumno tiene más de un programa vigente. Revisa sus programas antes de promover.');
      const plan = Array.isArray(fila.planes_estudio) ? fila.planes_estudio[0] : fila.planes_estudio;
      programas.set(fila.alumno_id, {
        id: fila.id, alumno_id: fila.alumno_id, plan_id: fila.plan_id,
        estatus: fila.estatus ?? '', total_periodos: plan?.total_periodos ?? null,
      });
    }
  }
  return programas;
}

export interface ResultadoPromocionGuardada {
  tipo: 'AVANCE' | 'EGRESO';
  grado: string;
  plan_pago_id: string | null;
}

/** Con crearPlan=false, planPagoId puede identificar el plan ya existente del ciclo. */
export async function guardarPromocionAlumno(
  alumnoId: string,
  cicloId: string,
  programaId: string,
  gradoEsperado: string | null,
  planPagoId: string,
  copiarConceptos: boolean,
  crearPlan = true,
): Promise<ResultadoPromocionGuardada> {
  const { data, error } = await supabase.rpc('promover_alumno_ciclo', {
    p_alumno_id: alumnoId,
    p_ciclo_id: cicloId,
    p_programa_id: programaId,
    p_grado_esperado: gradoEsperado,
    p_plan_pago_id: planPagoId,
    p_copiar_conceptos: copiarConceptos,
    p_crear_plan: crearPlan,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('promover_alumno_ciclo')) {
      throw new Error('La función de promoción aún no está instalada en la base de datos.');
    }
    throw new Error(error.message);
  }
  return data as ResultadoPromocionGuardada;
}
