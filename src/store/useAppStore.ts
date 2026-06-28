import { create } from 'zustand';
import { supabase, fetchAllSupabase, getAppConfig, updateUserPreferences } from '../lib/supabase';
import { PaymentPlan, CicloEscolar, Alumno, CatalogoItem, Catalogos, PlantillaPlan, AppConfig, Usuario, Carrera } from '../types';

export const buildCatalogos = (items: CatalogoItem[]): Catalogos => ({
  conceptos: Array.from(new Set(items.filter(i => i.tipo === 'concepto' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  licenciaturas: Array.from(new Set(items.filter(i => i.tipo === 'licenciatura' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  beca_tipos: Array.from(new Set(items.filter(i => i.tipo === 'beca_tipo' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  beca_porcentajes: Array.from(new Set(items.filter(i => i.tipo === 'beca_porcentaje' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  grados: Array.from(new Set(items.filter(i => i.tipo === 'grado' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  turnos: Array.from(new Set(items.filter(i => i.tipo === 'turno' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  estatus_alumnos: Array.from(new Set(items.filter(i => i.tipo === 'estatus_alumno' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  empresas_ss: Array.from(new Set(items.filter(i => i.tipo === 'empresa_ss' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  modalidades_titulacion: Array.from(new Set(items.filter(i => i.tipo === 'modalidad_titulacion' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  licenciaturasMetadata: Object.fromEntries(
    items
      .filter(i => i.tipo === 'licenciatura' && i.activo && i.metadata)
      .map(i => [i.valor, i.metadata!])
  ),
});
interface AppState {
  currentUser: Usuario | null;
  authChecked: boolean;
  loading: boolean;
  
  plans: PaymentPlan[];
  ciclos: CicloEscolar[];
  alumnos: Alumno[];
  plantillas: PlantillaPlan[];
  catalogoItems: CatalogoItem[];
  catalogos: Catalogos;
  appConfig: AppConfig | null;
  activeCicloId: string;
  carreras: Carrera[];

  // Acciones
  setCurrentUser: (user: Usuario | null) => void;
  setAuthChecked: (checked: boolean) => void;
  setLoading: (loading: boolean) => void;
  setActiveCicloId: (id: string) => void;
  
  // Data fetchers
  fetchAllData: () => Promise<void>;
  fetchCarreras: () => Promise<void>;
  refreshPlans: () => Promise<void>;
  refreshAlumnos: () => Promise<void>;
  refreshAfterPayment: () => Promise<void>;

  // Data modifiers (opcional, para setters rápidos en caché)
  setPlans: (updater: PaymentPlan[] | ((prev: PaymentPlan[]) => PaymentPlan[])) => void;
  setAlumnos: (updater: Alumno[] | ((prev: Alumno[]) => Alumno[])) => void;
  setCiclos: (updater: CicloEscolar[] | ((prev: CicloEscolar[]) => CicloEscolar[])) => void;
  setPlantillas: (updater: PlantillaPlan[] | ((prev: PlantillaPlan[]) => PlantillaPlan[])) => void;
  setCatalogoItems: (updater: CatalogoItem[] | ((prev: CatalogoItem[]) => CatalogoItem[])) => void;
  setAppConfig: (config: AppConfig | null) => void;
  setCarreras: (carreras: Carrera[]) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: null,
  authChecked: false,
  loading: false,

  plans: [],
  ciclos: [],
  alumnos: [],
  plantillas: [],
  catalogoItems: [],
  catalogos: buildCatalogos([]),
  appConfig: null,
  activeCicloId: '',
  carreras: [],

  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthChecked: (checked) => set({ authChecked: checked }),
  setLoading: (loading) => set({ loading }),
  
  setActiveCicloId: (id) => {
    set({ activeCicloId: id });
    try { localStorage.setItem('current_ciclo_id', id); } catch {}
    
    // Si hay usuario logueado, actualizamos sus preferencias
    const user = get().currentUser;
    if (user && user.id) {
      set({ currentUser: { ...user, ultimo_ciclo_id: id } });
      updateUserPreferences(user.id, { ultimo_ciclo_id: id });
    }
  },

  setPlans: (updater) => set((state) => ({ plans: typeof updater === 'function' ? updater(state.plans) : updater })),
  setAlumnos: (updater) => set((state) => ({ alumnos: typeof updater === 'function' ? updater(state.alumnos) : updater })),
  setCiclos: (updater) => set((state) => ({ ciclos: typeof updater === 'function' ? updater(state.ciclos) : updater })),
  setPlantillas: (updater) => set((state) => ({ plantillas: typeof updater === 'function' ? updater(state.plantillas) : updater })),
  setCatalogoItems: (updater) => set((state) => {
    const newItems = typeof updater === 'function' ? updater(state.catalogoItems) : updater;
    return { catalogoItems: newItems, catalogos: buildCatalogos(newItems) };
  }),
  setAppConfig: (config) => set({ appConfig: config }),
  setCarreras: (carreras) => set({ carreras }),

  fetchCarreras: async () => {
    const { data, error } = await supabase.from('carreras').select('*').order('nombre');
    if (data) set({ carreras: data as Carrera[] });
    if (error) console.error("Error fetching carreras:", error);
  },

  fetchAllData: async () => {
    set({ loading: true });
    try {
      const { data: planesData, error: planesError } = await fetchAllSupabase(() => supabase.from('vista_planes_pago').select('*, detalles:planes_pago_detalles(*)').order('id'));
      const { data: ciclosData, error: ciclosError } = await fetchAllSupabase(() => supabase.from('ciclos_escolares').select('*').order('id'));
      const { data: alumnosData, error: alumnosError } = await fetchAllSupabase(() => supabase.from('alumnos').select('*').order('id'));
      const { data: catalogosData, error: catalogosError } = await fetchAllSupabase(() => supabase.from('catalogos').select('*').order('orden', { ascending: true }));
      const { data: plantillasData, error: plantillasError } = await fetchAllSupabase(() => supabase.from('plantillas_plan').select('*').order('id'));
      
      const config = await getAppConfig();

      // Llamada paralela a la función de carreras
      await get().fetchCarreras();

      const newState: Partial<AppState> = {
        appConfig: config,
      };

      if (!planesError && planesData) newState.plans = planesData as PaymentPlan[];
      if (!alumnosError && alumnosData) newState.alumnos = alumnosData as Alumno[];
      if (!catalogosError && catalogosData) {
        newState.catalogoItems = catalogosData as CatalogoItem[];
        newState.catalogos = buildCatalogos(newState.catalogoItems);
      }
      if (!plantillasError && plantillasData) newState.plantillas = plantillasData as PlantillaPlan[];

      if (!ciclosError && ciclosData && ciclosData.length > 0) {
        newState.ciclos = ciclosData as CicloEscolar[];
        
        // Determinar ciclo activo
        const currentActive = get().activeCicloId;
        const userCycle = get().currentUser?.ultimo_ciclo_id;
        const savedId = localStorage.getItem('current_ciclo_id');
        
        // Prioridad: 1. Estado local ya seteado, 2. Preferencia de usuario, 3. LocalStorage, 4. El marcado como activo en BD
        let targetId = currentActive || userCycle || savedId;
        
        if (targetId && (ciclosData as CicloEscolar[]).some(c => c.id === targetId)) {
          newState.activeCicloId = targetId;
        } else {
          const activeDb = (ciclosData as CicloEscolar[]).find(c => c.activo);
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
    try {
      const { data, error } = await fetchAllSupabase(() => supabase.from('vista_planes_pago').select('*, detalles:planes_pago_detalles(*)').order('id'));
      if (!error && data) set({ plans: data as PaymentPlan[] });
    } catch { /* silenciar */ }
  },

  refreshAlumnos: async () => {
    try {
      const { data, error } = await fetchAllSupabase(() => supabase.from('alumnos').select('*').order('id'));
      if (!error && data) set({ alumnos: data as Alumno[] });
    } catch { /* silenciar */ }
  },

  refreshAfterPayment: async () => {
    await Promise.all([get().refreshPlans(), get().refreshAlumnos()]);
  }
}));
