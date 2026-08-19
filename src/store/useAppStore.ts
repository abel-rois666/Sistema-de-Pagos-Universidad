import { create } from 'zustand';

import { AuthSlice, createAuthSlice } from './slices/createAuthSlice';
import { UISlice, createUISlice } from './slices/createUISlice';
import { AcademicosSlice, createAcademicosSlice } from './slices/createAcademicosSlice';
import { AlumnosSlice, createAlumnosSlice } from './slices/createAlumnosSlice';
import { PagosSlice, createPagosSlice } from './slices/createPagosSlice';
import { CatalogosSlice, createCatalogosSlice } from './slices/createCatalogosSlice';

import { academicosService } from '../services/academicosService';
import { alumnosService } from '../services/alumnosService';
import { pagosService } from '../services/pagosService';
import { catalogosService } from '../services/catalogosService';
import { configService } from '../services/configService';

type AppState = AuthSlice & 
  UISlice & 
  AcademicosSlice & 
  AlumnosSlice & 
  PagosSlice & 
  CatalogosSlice & {
    fetchAllData: () => Promise<void>;
    fetchCarreras: () => Promise<void>;
    refreshPlans: () => Promise<void>;
    refreshAlumnos: () => Promise<void>;
    refreshAfterPayment: () => Promise<void>;
  };

export const useAppStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createUISlice(...a),
  ...createAcademicosSlice(...a),
  ...createAlumnosSlice(...a),
  ...createPagosSlice(...a),
  ...createCatalogosSlice(...a),

  fetchCarreras: async () => {
    const res = await academicosService.getCarreras();
    if (res.success) {
      a[0]({ carreras: res.data });
    } else {
      console.error("Error fetching carreras:", res.error);
    }
  },

  fetchAllData: async () => {
    const set = a[0];
    const get = a[1];
    set({ loading: true });
    
    try {
      const [
        planesRes,
        ciclosRes,
        alumnosRes,
        catalogosRes,
        plantillasRes,
        configRes
      ] = await Promise.all([
        pagosService.getPlanesPago(),
        academicosService.getCiclosEscolares(),
        alumnosService.getAlumnos(),
        catalogosService.getCatalogos(),
        pagosService.getPlantillasPlan(),
        configService.getAppConfig()
      ]);

      await get().fetchCarreras();

      const newState: Partial<AppState> = {};

      if (configRes.success) newState.appConfig = configRes.data;
      if (planesRes.success) newState.plans = planesRes.data;
      if (alumnosRes.success) newState.alumnos = alumnosRes.data;
      if (plantillasRes.success) newState.plantillas = plantillasRes.data;
      
      if (catalogosRes.success) {
        // Aprovechar el setCatalogoItems del slice para que actualice la derivación 'catalogos'
        get().setCatalogoItems(catalogosRes.data);
      }

      if (ciclosRes.success && ciclosRes.data.length > 0) {
        newState.ciclos = ciclosRes.data;
        
        const currentActive = get().activeCicloId;
        const userCycle = get().currentUser?.ultimo_ciclo_id;
        const savedId = localStorage.getItem('current_ciclo_id');
        
        let targetId = currentActive || userCycle || savedId;
        
        if (targetId && ciclosRes.data.some(c => c.id === targetId)) {
          newState.activeCicloId = targetId;
        } else {
          const activeDb = ciclosRes.data.find(c => c.activo);
          if (activeDb) newState.activeCicloId = activeDb.id;
        }
      }

      set(newState);
    } catch (err) {
      console.log('Error al cargar datos globales en Zustand:', err);
    } finally {
      set({ loading: false, authChecked: true });
    }
  },

  refreshPlans: async () => {
    const res = await pagosService.getPlanesPago();
    if (res.success) a[0]({ plans: res.data });
  },

  refreshAlumnos: async () => {
    const res = await alumnosService.getAlumnos();
    if (res.success) a[0]({ alumnos: res.data });
  },

  refreshAfterPayment: async () => {
    await Promise.all([a[1]().refreshPlans(), a[1]().refreshAlumnos()]);
  }
}));
