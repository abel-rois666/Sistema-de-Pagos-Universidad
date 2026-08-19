import { StateCreator } from 'zustand';
import { CicloEscolar, Carrera } from '../../types';
import { userService } from '../../services/userService';
import { AuthSlice } from './createAuthSlice';

export interface AcademicosSlice {
  ciclos: CicloEscolar[];
  carreras: Carrera[];
  activeCicloId: string;
  setCiclos: (updater: CicloEscolar[] | ((prev: CicloEscolar[]) => CicloEscolar[])) => void;
  setCarreras: (carreras: Carrera[]) => void;
  setActiveCicloId: (id: string) => void;
  resolveCicloId: (nombrePeriodo: string, modalidad?: string) => string | undefined;
}

export const createAcademicosSlice: StateCreator<
  AcademicosSlice & AuthSlice,
  [],
  [],
  AcademicosSlice
> = (set, get) => ({
  ciclos: [],
  carreras: [],
  activeCicloId: '',

  setCiclos: (updater) => set((state) => ({ 
    ciclos: typeof updater === 'function' ? updater(state.ciclos) : updater 
  })),

  setCarreras: (carreras) => set({ carreras }),

  setActiveCicloId: (id) => {
    set({ activeCicloId: id });
    try { localStorage.setItem('current_ciclo_id', id); } catch {}
    
    const user = get().currentUser;
    if (user && user.id) {
      set({ currentUser: { ...user, ultimo_ciclo_id: id } });
      userService.updateUserPreferences(user.id, { ultimo_ciclo_id: id });
    }
  },

  resolveCicloId: (nombrePeriodo, modalidad) => {
    const ciclos = get().ciclos;
    if (!nombrePeriodo) return undefined;
    
    if (modalidad) {
      const modalidaKey = modalidad.toLowerCase().includes('semestral') ? 'semestral' : 'cuatrimestral';
      const exactMatch = ciclos.find(c => c.nombre === nombrePeriodo && c.tipo_periodo?.toLowerCase().includes(modalidaKey));
      if (exactMatch) return exactMatch.id;
    }
    
    const fallbackMatch = ciclos.find(c => c.nombre === nombrePeriodo);
    return fallbackMatch?.id;
  },
});
