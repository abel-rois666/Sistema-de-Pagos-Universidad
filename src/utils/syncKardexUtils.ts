import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

export interface SyncKardexResult {
  success: boolean;
  message: string;
  registrosAfectados?: number;
  planesAfectados?: number;
}

export async function syncAlumnoKardex(
  alumno: { id: string; matricula: string | null; estatus: string | null },
  asignaturas: { id: string; clave_legado: string | null; plan_id: string | null }[],
  planes: { id: string; clave_legado: string | null; tipo_periodo: string | null }[],
  calificacionMinima: number = 6
): Promise<SyncKardexResult> {
  if (!alumno.matricula) {
    return { success: false, message: 'El alumno no tiene una matrícula asignada.' };
  }

  // 1. Fetch from legacy API
  // Temporalmente forzamos localhost para la prueba local del Sincronizador Kardex
  const baseUrl = 'http://localhost:3001';
  const response = await fetch(`${baseUrl}/api/legacy/kardex/${alumno.matricula}?umbral=${calificacionMinima}`);
  
  if (!response.ok) {
    throw new Error(`Error HTTP! status: ${response.status}`);
  }
  const dataGES = await response.json();

  if (!dataGES || dataGES.length === 0) {
    return { success: false, message: 'No se encontraron registros en el historial del GES 4 para esta matrícula.' };
  }

  // 2. Mapeo de registros
  const registrosMapeados: any[] = [];
  
  for (const item of dataGES) {
    const planMatch = planes.find(p => p.clave_legado === item.clave_plan);
    if (!planMatch) continue;

    const asigMatch = asignaturas.find(a => a.clave_legado === item.clave_asignatura && a.plan_id === planMatch.id);
    if (!asigMatch) continue;

    // Respetar los valores ya saneados por el microservicio (null = null, no convertir)
    const parseOrNull = (val: any) => (val !== null && val !== undefined) ? parseFloat(val) : null;
    
    const p1 = parseOrNull(item.parcial_1);
    const p2 = parseOrNull(item.parcial_2);
    const p3 = parseOrNull(item.parcial_3);
    let promParc = parseOrNull(item.promedio_calculado);

    // Calcular promedio solo si el microservicio no lo trajo y hay parciales reales
    if (promParc === null && (p1 !== null || p2 !== null || p3 !== null)) {
        let sum = 0, count = 0;
        if (p1 !== null) { sum += (p1 === -555 ? 0 : p1); count++; }
        if (p2 !== null) { sum += (p2 === -555 ? 0 : p2); count++; }
        if (p3 !== null) { sum += (p3 === -555 ? 0 : p3); count++; }
        if (count > 0) promParc = Number((sum / count).toFixed(2));
    }

    // Usar el estatus calculado por el microservicio; si no viene, derivar uno básico
    const estatus = item.estatus || (
      item.calificacion_final === null ? 'EN_CURSO' :
      item.calificacion_final >= calificacionMinima ? 'APROBADA' : 'REPROBADA'
    );

    // Mapeo automático de ciclo_id basado en ciclo_legado y tipo_periodo del plan
    let mappedCicloId = null;
    if (item.ciclo_legado) {
      mappedCicloId = useAppStore.getState().resolveCicloId(item.ciclo_legado, planMatch.tipo_periodo || undefined);
    }

    registrosMapeados.push({
      alumno_id: alumno.id,
      ciclo_id: mappedCicloId,
      ciclo_legado: item.ciclo_legado,
      asignatura_id: asigMatch.id,
      parcial_1: p1,
      parcial_2: p2,
      parcial_3: p3,
      promedio_calculado: promParc,
      calificacion_final: parseOrNull(item.calificacion_final),
      tipo_evaluacion: item.tipo_evaluacion || 'ORDINARIO',
      estatus: estatus,
      modificada_manualmente: false,
      observaciones: item.observaciones || 'Importado de GES 4'
    });
  }

  if (registrosMapeados.length === 0) {
    return { success: false, message: 'No se pudo mapear ninguna materia. Verifica que los planes y materias coincidan con el GES.' };
  }

  // 3. Delete old records and insert new ones
  await supabase.from('inscripciones_academicas').delete().eq('alumno_id', alumno.id);
  const { error: insertError } = await supabase.from('inscripciones_academicas').insert(registrosMapeados);

  if (insertError) throw insertError;

  // 4. AUTO-REGISTRAR TODOS LOS PLANES DETECTADOS en alumno_programas
  const planIdsImportados = [...new Set(registrosMapeados.map(r => r.asignatura_id).map(asigId => {
    const asig = asignaturas.find(a => a.id === asigId);
    return asig?.plan_id;
  }).filter(Boolean))] as string[];

  const { data: programasExistentes } = await supabase
    .from('alumno_programas')
    .select('plan_id')
    .eq('alumno_id', alumno.id);

  const planIdsExistentes = (programasExistentes || []).map(p => p.plan_id);
  const planesFaltantes = planIdsImportados.filter(pid => !planIdsExistentes.includes(pid));

  if (planesFaltantes.length > 0) {
    const nuevosRegistros = planesFaltantes.map(pid => ({
      alumno_id: alumno.id,
      plan_id: pid,
      estatus: alumno.estatus || 'CURSANDO',
      fecha_inscripcion: new Date().toISOString().split('T')[0]
    }));
    await supabase.from('alumno_programas').insert(nuevosRegistros);
  }

  // Marcar al alumno como sincronizado en la base de datos local
  await supabase.from('alumnos').update({ 
    kardex_sincronizado: true,
    kardex_sincronizado_at: new Date().toISOString()
  }).eq('id', alumno.id);

  return {
    success: true,
    message: `Sincronizado: ${registrosMapeados.length} registros.`,
    registrosAfectados: registrosMapeados.length,
    planesAfectados: planIdsImportados.length
  };
}
