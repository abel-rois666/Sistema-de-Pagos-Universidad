import { supabase } from '../lib/supabase';
import { Result, createSuccess, createError } from './types';

export const userService = {
  async updateUserPreferences(userId: string, preferences: Record<string, any>): Promise<Result<void>> {
    try {
      const { error } = await supabase
        .from('usuarios')
        .update(preferences)
        .eq('id', userId);
        
      if (error) throw error;
      return createSuccess(undefined);
    } catch (error) {
      return createError(error as Error);
    }
  }
};
