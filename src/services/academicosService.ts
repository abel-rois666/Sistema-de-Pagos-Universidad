import { supabase, fetchAllSupabase } from '../lib/supabase';
import { CicloEscolar, Carrera } from '../types';
import { Result, createSuccess, createError } from './types';

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
