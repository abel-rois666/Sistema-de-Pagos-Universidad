import { supabase, fetchAllSupabase } from '../lib/supabase';
import { CatalogoItem } from '../types';
import { Result, createSuccess, createError } from './types';

export const catalogosService = {
  async getCatalogos(): Promise<Result<CatalogoItem[]>> {
    try {
      const { data, error } = await fetchAllSupabase(() => 
        supabase.from('catalogos').select('*').order('orden', { ascending: true })
      );
      
      if (error) throw error;
      return createSuccess(data as CatalogoItem[]);
    } catch (error) {
      return createError(error as Error);
    }
  }
};
