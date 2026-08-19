import { supabase } from '../lib/supabase';
import { AppConfig } from '../types';
import { Result, createSuccess, createError } from './types';

export const configService = {
  async getAppConfig(): Promise<Result<AppConfig | null>> {
    try {
      const { data, error } = await supabase.from('configuracion_app').select('*');
      if (error) throw error;

      if (!data || data.length === 0) return createSuccess(null);
      
      const configObj: Record<string, string> = {};
      data.forEach(row => { configObj[row.id] = row.valor; });
      return createSuccess(configObj as unknown as AppConfig);
    } catch (error) {
      return createError(error as Error);
    }
  }
};
