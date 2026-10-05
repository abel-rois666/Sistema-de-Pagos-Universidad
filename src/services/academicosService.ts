import { supabase, fetchAllSupabase } from '../lib/supabase';
import { CicloEscolar, Carrera, PlanEstudio, AlumnoPrograma } from '../types';
import { Result, createSuccess, createError } from './types';

/**
 * Calcula el estatus institucional del alumno evaluando la totalidad de sus programas académicos.
 * Principio Rector Saeko/Banner:
 * 1. El Programa Rector Vigente (es_vigente = true) rige de manera prioritaria el estatus institucional del alumno.
 * 2. Fallback jerárquico si ningún programa tiene la bandera es_vigente explícita:
 *    - ACTIVO si tiene al menos un programa en CURSANDO.
 *    - TITULADO si no está cursando nada y tiene al menos un programa en TITULADO.
 *    - EGRESADO si no está cursando ni titulado, y tiene al menos un programa en EGRESADO.
 *    - BAJA si todos sus programas registrados están en baja.
 */
export function calcularEstatusInstitucional(programas: Array<{ estatus: string; es_vigente?: boolean }>): string {
  if (!programas || programas.length === 0) return 'ACTIVO';

  // 1. Prioridad Absoluta: El Plan Rector Vigente
  const progVigente = programas.find(p => p.es_vigente);
  if (progVigente) {
    if (progVigente.estatus === 'CURSANDO') return 'ACTIVO';
    if (['BAJA', 'BAJA_POR_CAMBIO'].includes(progVigente.estatus)) return 'BAJA';
    return progVigente.estatus; // 'TITULADO' o 'EGRESADO'
  }

  // 2. Fallback si ningún programa tiene la bandera vigente
  if (programas.some(p => p.estatus === 'CURSANDO')) return 'ACTIVO';
  if (programas.some(p => p.estatus === 'TITULADO')) return 'TITULADO';
  if (programas.some(p => p.estatus === 'EGRESADO')) return 'EGRESADO';
  if (programas.every(p => ['BAJA', 'BAJA_POR_CAMBIO'].includes(p.estatus))) return 'BAJA';
  return 'ACTIVO';
}

export const academicosService = {
  async getCiclosEscolares(): Promise<Result<CicloEscolar[]>> {
    try {
      const { data, error } = await fetchAllSupabase(() => 
        supabase.from('ciclos_escolares').select('*').order('id')
      );
      
      if (error) throw error;
      return createSuccess(data as CicloEscolar[]);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async getCarreras(): Promise<Result<Carrera[]>> {
    try {
      const { data, error } = await supabase
        .from('carreras')
        .select('*')
        .order('nombre');
        
      if (error) throw error;
      return createSuccess(data as Carrera[]);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async getPlanesEstudio(carreraId?: string): Promise<Result<PlanEstudio[]>> {
    try {
      let query = supabase
        .from('planes_estudio')
        .select('*, carreras:carrera_id(*)')
        .order('nombre');
      
      if (carreraId) {
        query = query.eq('carrera_id', carreraId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return createSuccess((data || []) as PlanEstudio[]);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async getProgramasAlumno(alumnoId: string): Promise<Result<AlumnoPrograma[]>> {
    try {
      const { data, error } = await supabase
        .from('alumno_programas')
        .select('*, planes_estudio(*, carreras:carrera_id(*))')
        .eq('alumno_id', alumnoId)
        .order('fecha_inscripcion', { ascending: false });

      if (error) throw error;
      return createSuccess((data || []) as AlumnoPrograma[]);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async inscribirAlumnoPrograma(
    alumnoId: string, 
    planId: string, 
    estatus: string = 'CURSANDO', 
    fechaInscripcion?: string,
    esVigente: boolean = true,
    motivoEstatus?: string,
    estatusPrevio?: string | null
  ): Promise<Result<any>> {
    try {
      const nowIso = new Date().toISOString();

      // 1. Consultar estado existente de este plan (si ya estaba registrado en historial)
      const { data: existente } = await supabase
        .from('alumno_programas')
        .select('id, estatus, motivo_estatus, estatus_previo, fecha_inscripcion, es_vigente')
        .eq('alumno_id', alumnoId)
        .eq('plan_id', planId)
        .maybeSingle();

      const esConcluido = ['EGRESADO', 'TITULADO'].includes(estatus);
      const eraBaja = existente && ['BAJA', 'BAJA_POR_CAMBIO'].includes(existente.estatus);

      let estatusFinal = estatus;
      let motivoFinal = motivoEstatus;
      let estatusPrevioFinal = estatusPrevio !== undefined ? estatusPrevio : (existente?.estatus_previo || null);

      // Regla de Oro Vía 1:
      // A. Si estaba en BAJA y se activa como vigente pasando a CURSANDO -> motivo REINGRESO y guardar estatus_previo
      if (eraBaja && esVigente && (estatus === 'CURSANDO' || !motivoEstatus)) {
        estatusFinal = 'CURSANDO';
        motivoFinal = motivoEstatus || 'REINGRESO';
        estatusPrevioFinal = existente.estatus;
      } 
      // B. Si se retira la vigencia y tenía un estatus_previo de BAJA (y no es carrera simultánea) -> revertir
      else if (!esVigente && existente?.es_vigente && existente?.estatus_previo && estatusFinal === 'CURSANDO' && motivoFinal !== 'CARRERA_SIMULTANEA') {
        estatusFinal = existente.estatus_previo;
        motivoFinal = 'DESERCION_VOLUNTARIA';
      }

      // Blindaje de Seguridad Inviolable:
      // Si el plan es un logro académico concluido, su motivo es SIEMPRE PLAN_CONCLUIDO
      if (esConcluido) {
        motivoFinal = 'PLAN_CONCLUIDO';
      } else if (!motivoFinal) {
        if (eraBaja && esVigente) {
          motivoFinal = 'REINGRESO';
        } else if (esVigente) {
          motivoFinal = 'REGULAR';
        } else {
          motivoFinal = 'CAMBIO_DE_CARRERA';
        }
      }

      // 2. Si el nuevo programa será el rector vigente (esVigente = true)
      if (esVigente) {
        // A. Apagar vigencia de los demás planes
        await supabase
          .from('alumno_programas')
          .update({ 
            es_vigente: false, 
            fecha_ultimo_cambio: nowIso
          })
          .eq('alumno_id', alumnoId)
          .neq('plan_id', planId);

        // B. Los planes concluidos (EGRESADO, TITULADO) conservan su logro
        await supabase
          .from('alumno_programas')
          .update({ 
            motivo_estatus: 'PLAN_CONCLUIDO'
          })
          .eq('alumno_id', alumnoId)
          .neq('plan_id', planId)
          .in('estatus', ['EGRESADO', 'TITULADO']);

        // C. Los planes activos que NO son CARRERA_SIMULTANEA se marcan como CAMBIO_DE_CARRERA
        // (Los planes con CARRERA_SIMULTANEA se protegen y permanecen intactos en CURSANDO)
        await supabase
          .from('alumno_programas')
          .update({ 
            motivo_estatus: 'CAMBIO_DE_CARRERA'
          })
          .eq('alumno_id', alumnoId)
          .neq('plan_id', planId)
          .not('estatus', 'in', '("EGRESADO","TITULADO")')
          .neq('motivo_estatus', 'CARRERA_SIMULTANEA');
      }

      // 3. Insertar o actualizar registro en alumno_programas
      let data;
      if (existente) {
        const { data: updated, error: updateError } = await supabase
          .from('alumno_programas')
          .update({
            estatus: estatusFinal,
            es_vigente: esVigente,
            motivo_estatus: motivoFinal,
            estatus_previo: estatusPrevioFinal,
            fecha_ultimo_cambio: nowIso,
            fecha_inscripcion: fechaInscripcion || existente.fecha_inscripcion || nowIso.split('T')[0]
          })
          .eq('id', existente.id)
          .select()
          .single();
        if (updateError) throw updateError;
        data = updated;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('alumno_programas')
          .insert({
            alumno_id: alumnoId,
            plan_id: planId,
            estatus: estatusFinal,
            es_vigente: esVigente,
            motivo_estatus: motivoFinal,
            estatus_previo: estatusPrevioFinal,
            fecha_ultimo_cambio: nowIso,
            fecha_inscripcion: fechaInscripcion || nowIso.split('T')[0]
          })
          .select()
          .single();
        if (insertError) throw insertError;
        data = inserted;
      }

      // 4. Sincronizar tabla alumnos (licenciatura y estatus institucional calculado)
      const { data: todosProgramas } = await supabase
        .from('alumno_programas')
        .select('estatus, es_vigente')
        .eq('alumno_id', alumnoId);

      const updates: any = {};
      if (esVigente) {
        const { data: planData } = await supabase
          .from('planes_estudio')
          .select('carreras:carrera_id(nombre)')
          .eq('id', planId)
          .single();
        const carreraNombre = (planData as any)?.carreras?.nombre;
        if (carreraNombre) updates.licenciatura = carreraNombre;

        // El programa rector vigente determina de forma directa y prioritaria el estatus institucional
        if (estatusFinal === 'CURSANDO') {
          updates.estatus = 'ACTIVO';
        } else if (['BAJA', 'BAJA_POR_CAMBIO'].includes(estatusFinal)) {
          updates.estatus = 'BAJA';
        } else {
          updates.estatus = estatusFinal; // 'TITULADO' o 'EGRESADO'
        }
      } else if (todosProgramas && todosProgramas.length > 0) {
        updates.estatus = calcularEstatusInstitucional(todosProgramas);
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('alumnos').update(updates).eq('id', alumnoId);
      }

      return createSuccess(data);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async activarPlanVigente(alumnoId: string, planId: string): Promise<Result<any>> {
    try {
      const nowIso = new Date().toISOString();

      // 1. Obtener estado actual del plan que se activará
      const { data: planActual } = await supabase
        .from('alumno_programas')
        .select('estatus, motivo_estatus, estatus_previo')
        .eq('alumno_id', alumnoId)
        .eq('plan_id', planId)
        .maybeSingle();

      const targetEstatus = planActual?.estatus || 'CURSANDO';
      const isConcluido = ['EGRESADO', 'TITULADO'].includes(targetEstatus);
      const isBaja = ['BAJA', 'BAJA_POR_CAMBIO'].includes(targetEstatus);

      let nuevoEstatus = targetEstatus;
      let nuevoMotivo = planActual?.motivo_estatus || 'REGULAR';
      let nuevoEstatusPrevio = planActual?.estatus_previo || null;

      if (isConcluido) {
        // Los logros oficiales de egreso se respetan y nunca se reinician a Cursando
        nuevoMotivo = 'PLAN_CONCLUIDO';
      } else if (isBaja) {
        // Vía 1: De BAJA pasa automáticamente a CURSANDO con motivo REINGRESO y respaldo de estatus_previo
        nuevoEstatus = 'CURSANDO';
        nuevoMotivo = 'REINGRESO';
        nuevoEstatusPrevio = targetEstatus;
      } else if (planActual?.motivo_estatus === 'CARRERA_SIMULTANEA') {
        nuevoMotivo = 'CARRERA_SIMULTANEA';
      } else if (planActual?.motivo_estatus === 'SEGUNDA_CARRERA') {
        nuevoMotivo = 'SEGUNDA_CARRERA';
      }

      // 2. Apagar la vigencia de TODOS los demás planes del alumno
      await supabase
        .from('alumno_programas')
        .update({ 
          es_vigente: false, 
          fecha_ultimo_cambio: nowIso
        })
        .eq('alumno_id', alumnoId)
        .neq('plan_id', planId);

      // 3. Proteger planes concluidos con motivo 'PLAN_CONCLUIDO'
      await supabase
        .from('alumno_programas')
        .update({ 
          motivo_estatus: 'PLAN_CONCLUIDO'
        })
        .eq('alumno_id', alumnoId)
        .neq('plan_id', planId)
        .in('estatus', ['EGRESADO', 'TITULADO']);

      // 4. Los planes activos que NO son CARRERA_SIMULTANEA se marcan como 'CAMBIO_DE_CARRERA'
      // (Si hay una carrera simultánea en curso, se preserva intacta en CURSANDO sin cambiar motivo)
      await supabase
        .from('alumno_programas')
        .update({ 
          motivo_estatus: 'CAMBIO_DE_CARRERA'
        })
        .eq('alumno_id', alumnoId)
        .neq('plan_id', planId)
        .not('estatus', 'in', '("EGRESADO","TITULADO")')
        .neq('motivo_estatus', 'CARRERA_SIMULTANEA');

      // 5. Activar como vigente este plan con su nuevo estatus y motivo
      const { data, error } = await supabase
        .from('alumno_programas')
        .update({ 
          es_vigente: true, 
          estatus: nuevoEstatus,
          motivo_estatus: nuevoMotivo,
          estatus_previo: nuevoEstatusPrevio,
          fecha_ultimo_cambio: nowIso
        })
        .eq('alumno_id', alumnoId)
        .eq('plan_id', planId)
        .select()
        .single();

      if (error) throw error;

      // 6. Sincronizar alumnos.licenciatura y estatus institucional derivado de su programa rector
      const { data: planData } = await supabase
        .from('planes_estudio')
        .select('carreras:carrera_id(nombre)')
        .eq('id', planId)
        .single();
      const carreraNombre = (planData as any)?.carreras?.nombre;

      const updates: any = {};
      if (carreraNombre) updates.licenciatura = carreraNombre;

      // El programa rector vigente determina de forma directa y prioritaria el estatus institucional
      if (nuevoEstatus === 'CURSANDO') {
        updates.estatus = 'ACTIVO';
      } else if (['BAJA', 'BAJA_POR_CAMBIO'].includes(nuevoEstatus)) {
        updates.estatus = 'BAJA';
      } else {
        updates.estatus = nuevoEstatus; // 'TITULADO' o 'EGRESADO'
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('alumnos').update(updates).eq('id', alumnoId);
      }

      return createSuccess(data);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async getServicioSocialByAlumno(alumnoId: string): Promise<Result<any[]>> {
    try {
      const { data, error } = await supabase.from('servicio_social').select('*').eq('alumno_id', alumnoId);
      if (error) throw error;
      return createSuccess(data || []);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async getCertificacionEstatusByAlumno(alumnoId: string): Promise<Result<{ tramite_completado: boolean } | null>> {
    try {
      const { data, error } = await supabase.from('ficha_certificacion').select('tramite_completado').eq('alumno_id', alumnoId).maybeSingle();
      if (error) throw error;
      return createSuccess(data);
    } catch (error) {
      return createError(error as Error);
    }
  }
};
