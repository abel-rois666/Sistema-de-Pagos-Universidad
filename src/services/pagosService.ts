import { supabase, fetchAllSupabase } from '../lib/supabase';
import { PaymentPlan, PlantillaPlan } from '../types';
import { Result, createSuccess, createError } from './types';

export const pagosService = {
  async getPlanesPago(): Promise<Result<PaymentPlan[]>> {
    try {
      const { data, error } = await fetchAllSupabase(() => 
        supabase.from('vista_planes_pago').select('*, detalles:planes_pago_detalles(*)').order('id')
      );
      
      if (error) throw error;
      return createSuccess(data as PaymentPlan[]);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async getPlantillasPlan(): Promise<Result<PlantillaPlan[]>> {
    try {
      const { data, error } = await fetchAllSupabase(() => 
        supabase.from('plantillas_plan').select('*').order('id')
      );
      
      if (error) throw error;
      return createSuccess(data as PlantillaPlan[]);
    } catch (error) {
      return createError(error as Error);
    }
  },

  async registrarPagoTransaccional(
    recibo: any,
    detalles: any[],
    planId?: string,
    planUpdates?: any,
    alumnoId?: string,
    saldoDelta?: number
  ): Promise<Result<{ folio: number; recibo_id: string }>> {
    try {
      const payload = {
        p_recibo: recibo,
        p_detalles: detalles,
        p_plan_id: planId || null,
        p_plan_updates: planUpdates || null,
        p_alumno_id: alumnoId || null,
        p_saldo_delta: saldoDelta || 0
      };

      const { data, error } = await supabase.rpc('registrar_pago_transaccional', payload);

      if (error) throw error;
      
      return createSuccess({
        folio: data.folio,
        recibo_id: data.recibo_id
      });
    } catch (error) {
      console.error('[registrarPagoTransaccional]', error);
      return createError(error as Error);
    }
  },

  async bulkSavePlanes(planes: PaymentPlan[], onProgress?: (saved: number) => void): Promise<Result<void>> {
    try {
      // Chunking array en grupos de 50 para no saturar Supabase
      const CHUNK_SIZE = 50;
      let totalSaved = 0;

      for (let i = 0; i < planes.length; i += CHUNK_SIZE) {
        const chunk = planes.slice(i, i + CHUNK_SIZE).map(plan => {
          const { ciclo_escolar, nombre_alumno, detalles, grado_turno, observaciones, ...rest } = plan as any;
          return rest;
        });
        const { error } = await supabase.from('planes_pago').upsert(chunk, { onConflict: 'id' });
        
        if (error) throw error;
        
        totalSaved += chunk.length;
        if (onProgress) onProgress(totalSaved);
      }

      return createSuccess(undefined);
    } catch (error) {
      console.error('[bulkSavePlanes]', error);
      return createError(error as Error);
    }
  }
};
