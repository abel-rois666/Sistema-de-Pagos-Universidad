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
};
