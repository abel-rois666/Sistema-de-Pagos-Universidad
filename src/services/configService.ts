import { getAppConfig } from '../lib/supabase';
import { AppConfig } from '../types';
import { Result, createSuccess, createError } from './types';

export const configService = {
  async getAppConfig(): Promise<Result<AppConfig | null>> {
    try {
      // Delegar al getAppConfig de supabase.ts que ya mapea correctamente
      // las claves de la BD (app_title, app_logo, etc.) a los campos
      // de la interfaz AppConfig (title, logoUrl, etc.)
      const config = await getAppConfig();
      return createSuccess(config);
    } catch (error) {
      return createError(error as Error);
    }
  }
};
