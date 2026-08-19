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
  },

  async saveCatalogoItem(item: Partial<CatalogoItem>): Promise<Result<null>> {
    try {
      if (item.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)) {
        throw new Error('ID no es UUID válido');
      }
      const { error } = await supabase.from('catalogos').upsert(item);
      if (error) throw error;
      return createSuccess(null);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async deleteCatalogoItem(id: string): Promise<Result<null>> {
    try {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new Error('ID no es UUID válido');
      }
      const { error } = await supabase.from('catalogos').delete().eq('id', id);
      if (error) throw error;
      return createSuccess(null);
    } catch (error) {
      return createError(error as Error);
    }
  }
};
