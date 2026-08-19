import { StateCreator } from 'zustand';
import { PaymentPlan, PlantillaPlan } from '../../types';

export interface PagosSlice {
  plans: PaymentPlan[];
  plantillas: PlantillaPlan[];
  setPlans: (updater: PaymentPlan[] | ((prev: PaymentPlan[]) => PaymentPlan[])) => void;
  setPlantillas: (updater: PlantillaPlan[] | ((prev: PlantillaPlan[]) => PlantillaPlan[])) => void;
}

export const createPagosSlice: StateCreator<PagosSlice> = (set) => ({
  plans: [],
  plantillas: [],
  setPlans: (updater) => set((state) => ({ 
    plans: typeof updater === 'function' ? updater(state.plans) : updater 
  })),
  setPlantillas: (updater) => set((state) => ({ 
    plantillas: typeof updater === 'function' ? updater(state.plantillas) : updater 
  })),
});
