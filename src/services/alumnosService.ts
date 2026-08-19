import { supabase, fetchAllSupabase } from '../lib/supabase';
import { Alumno } from '../types';
import { Result, createSuccess, createError } from './types';

export const alumnosService = {
  async getAlumnos(): Promise<Result<Alumno[]>> {
    try {
      const { data, error } = await fetchAllSupabase(() => 
        supabase.from('alumnos').select('*').order('id')
      );
      
      if (error) throw error;
      return createSuccess(data as Alumno[]);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async getAlumnoById(id: string): Promise<Result<Alumno>> {
    try {
      const { data, error } = await supabase
        .from('alumnos')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      return createSuccess(data as Alumno);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async updateAlumno(id: string, updates: Partial<Alumno>): Promise<Result<null>> {
    try {
      const { error } = await supabase.from('alumnos').update(updates).eq('id', id);
      if (error) throw error;
      return createSuccess(null);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async bulkSaveAlumnos(alumnos: Alumno[], onProgress?: (saved: number) => void): Promise<Result<void>> {
    try {
      // Mapear al payload correcto de la base de datos para omitir propiedades no necesarias o anidadas
      const dbPayload = alumnos.map(a => ({
        id: a.id,
        nombre_completo: a.nombre_completo,
        licenciatura: a.licenciatura,
        grado_actual: a.grado_actual,
        turno: a.turno,
        apellido_paterno: a.apellido_paterno || null,
        apellido_materno: a.apellido_materno || null,
        nombres: a.nombres || null,
        nombre_requiere_revision: a.nombre_requiere_revision || false,
        estatus: a.estatus || 'ACTIVO',
        beca_porcentaje: a.beca_porcentaje || '0%',
        beca_tipo: a.beca_tipo || 'NINGUNA',
        observaciones_pago_titulacion: a.observaciones_pago_titulacion || null,
        ciclo_ultima_asignacion_grado: a.ciclo_ultima_asignacion_grado || null,
        saldo_a_favor: a.saldo_a_favor
      }));

      const CHUNK_SIZE = 50;
      let totalSaved = 0;

      for (let i = 0; i < dbPayload.length; i += CHUNK_SIZE) {
        const chunk = dbPayload.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('alumnos').upsert(
          chunk,
          { onConflict: 'id' }
        );
        
        if (error) throw error;
        
        totalSaved += chunk.length;
        if (onProgress) onProgress(totalSaved);
      }

      return createSuccess(undefined);
    } catch (error) {
      console.error('[bulkSaveAlumnos]', error);
      return createError(error as Error);
    }
  }
};
