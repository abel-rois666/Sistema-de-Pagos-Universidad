import { useState, useEffect, ReactNode } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, User, BarChart3, Users, Settings, GraduationCap, Calendar, BookOpen, Upload, Download, CheckCircle, AlertCircle, Shield, Wallet, ChevronDown } from 'lucide-react';
import { supabase, savePlan, bulkSaveAlumnos, bulkSavePlanes, saveAlumno, deleteAlumno, saveCiclo, deleteCiclo, saveCatalogoItem, deleteCatalogoItem, savePlantilla, deletePlantilla, getAppConfig, updateUserPreferences, fetchAllSupabase } from './lib/supabase';
import { PaymentPlan, CicloEscolar, Alumno, CatalogoItem, Catalogos, PlantillaPlan, AppConfig } from './types';
import { MOCK_DATA, MOCK_CICLOS, MOCK_ALUMNOS } from './data';
import { CSV_HEADERS, generateCSV, downloadCSV, getMaxFolioCounter, getCyclePrefix } from './utils';

import PlanPagos from './components/PlanPagos';
import FichaAlumno from './components/FichaAlumno';
import Estadisticas from './components/Estadisticas';
import Deudores from './components/Deudores';
import CiclosConfig from './components/CiclosConfig';
import AlumnosConfig from './components/AlumnosConfig';
import CatalogosConfig from './components/CatalogosConfig';
import ImportarCSV from './components/ImportarCSV';
import PlantillasConfig from './components/PlantillasConfig';
import Login from './components/Login';
import UsuariosConfig from './components/UsuariosConfig';
import ControlIngresos from './components/ControlIngresos';
import { AppConfigSettings } from './components/AppConfigSettings';
import DarkModeToggle from './components/DarkModeToggle';
import type { Usuario } from './types';

// ── Default catalogs (fallback) ──────────────────────────────────────────────
const DEFAULT_CATALOGOS: CatalogoItem[] = [
  ...['INSCRIPCIÓN', 'REINSCRIPCIÓN', '1ER PAGO', '2DO PAGO', '3ER PAGO', '4TO PAGO',
    '5TO PAGO', '6TO PAGO', '7MO PAGO', '8VO PAGO', 'CONSTANCIAS RENOVACIÓN DE BECA',
    'SEGURO ESTUDIANTIL', 'CREDENCIAL', 'OTROS']
    .map((v, i) => ({ id: `dc_${i}`, tipo: 'concepto' as const, valor: v, orden: i + 1, activo: true })),
  ...['ADMINISTRACIÓN', 'DERECHO', 'PSICOLOGÍA', 'CONTABILIDAD']
    .map((v, i) => ({ id: `dl_${i}`, tipo: 'licenciatura' as const, valor: v, orden: i + 1, activo: true })),
  ...['NINGUNA', 'BECA ALCALDÍA', 'BECA INSTITUCIONAL', 'BECA DEPORTIVA']
    .map((v, i) => ({ id: `dbt_${i}`, tipo: 'beca_tipo' as const, valor: v, orden: i + 1, activo: true })),
  ...['0%', '10%', '25%', '35%', '50%', '75%', '100%']
    .map((v, i) => ({ id: `dbp_${i}`, tipo: 'beca_porcentaje' as const, valor: v, orden: i + 1, activo: true })),
  ...['1ER', '2DO', '3ER', '4TO', '5TO', '6TO', '7MO', '8VO', '9NO']
    .map((v, i) => ({ id: `dg_${i}`, tipo: 'grado' as const, valor: v, orden: i + 1, activo: true })),
  ...['MATUTINO', 'VESPERTINO', 'MIXTO', 'SABATINO']
    .map((v, i) => ({ id: `dt_${i}`, tipo: 'turno' as const, valor: v, orden: i + 1, activo: true })),
  ...['ACTIVO', 'BAJA', 'EGRESADO', 'EGRESADO TITULADO']
    .map((v, i) => ({ id: `dea_${i}`, tipo: 'estatus_alumno' as const, valor: v, orden: i + 1, activo: true })),
];

const buildCatalogos = (items: CatalogoItem[]): Catalogos => ({
  conceptos: Array.from(new Set(items.filter(i => i.tipo === 'concepto' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  licenciaturas: Array.from(new Set(items.filter(i => i.tipo === 'licenciatura' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  beca_tipos: Array.from(new Set(items.filter(i => i.tipo === 'beca_tipo' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  beca_porcentajes: Array.from(new Set(items.filter(i => i.tipo === 'beca_porcentaje' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  grados: Array.from(new Set(items.filter(i => i.tipo === 'grado' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  turnos: Array.from(new Set(items.filter(i => i.tipo === 'turno' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  estatus_alumnos: Array.from(new Set(items.filter(i => i.tipo === 'estatus_alumno' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
});



// ── Page Wrapper Animado ─────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { duration: 0.25, ease: "easeOut" }
};

const PageWrapper = ({ children, keyStr, className }: { children: ReactNode, keyStr: string, className?: string }) => (
  <motion.div key={keyStr} initial="initial" animate="animate" exit="exit" variants={pageVariants} transition={pageVariants.transition as any} className={className || "min-h-screen bg-gray-50 dark:bg-gray-950"}>
    {children}
  </motion.div>
);

export default function App() {
  const [plans, setPlans] = useState<PaymentPlan[]>(MOCK_DATA);
  const [ciclos, setCiclos] = useState<CicloEscolar[]>(MOCK_CICLOS);
  const [alumnos, setAlumnos] = useState<Alumno[]>(MOCK_ALUMNOS);
  const [plantillas, setPlantillas] = useState<PlantillaPlan[]>([]);
  const [activeCicloId, setActiveCicloId] = useState<string>(() => {
    return localStorage.getItem('current_ciclo_id') || MOCK_CICLOS.find(c => c.activo)?.id || MOCK_CICLOS[0].id;
  });
  const [catalogoItems, setCatalogoItems] = useState<CatalogoItem[]>(DEFAULT_CATALOGOS);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as any;
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(navState.alumnoId || null);
  const [showImport, setShowImport] = useState(false);
  const [showConfigMenu, setShowConfigMenu] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  // 1. Inicialización síncrona de sesión: evita flasheos de vista de "Login" al refrescar la página
  const [currentUser, setCurrentUser] = useState<Usuario | null>(() => {
    try {
      const savedUser = localStorage.getItem('crm_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error al cargar sesión:', e);
    }
    return null;
  });

  // ── Toast global ─────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Persistencia de Sesión (Escrito) ───────────────────────────────────────────────
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('crm_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('crm_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeCicloId) {
      localStorage.setItem('current_ciclo_id', activeCicloId);
    }
  }, [activeCicloId]);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: planesData, error: planesError } = await fetchAllSupabase(() => supabase.from('vista_planes_pago').select('*'));
      if (!planesError && planesData) {
        setPlans(planesData.length > 0 ? planesData as PaymentPlan[] : []);
      }

      const { data: ciclosData, error: ciclosError } = await fetchAllSupabase(() => supabase.from('ciclos_escolares').select('*'));
      if (!ciclosError && ciclosData) {
        if (ciclosData.length > 0) {
          setCiclos(ciclosData as CicloEscolar[]);
          const savedId = localStorage.getItem('current_ciclo_id');
          if (savedId && (ciclosData as CicloEscolar[]).some(c => c.id === savedId)) {
            setActiveCicloId(savedId);
          } else {
            const active = ciclosData.find((c: CicloEscolar) => c.activo);
            if (active) setActiveCicloId(active.id);
          }
        } else {
          setCiclos([]);
        }
      }

      const { data: alumnosData, error: alumnosError } = await fetchAllSupabase(() => supabase.from('alumnos').select('*'));
      if (!alumnosError && alumnosData) {
        setAlumnos(alumnosData.length > 0 ? alumnosData as Alumno[] : []);
      }

      const { data: catalogosData, error: catalogosError } = await fetchAllSupabase(() => supabase.from('catalogos').select('*').order('orden', { ascending: true }));
      if (!catalogosError && catalogosData && catalogosData.length > 0) setCatalogoItems(catalogosData as CatalogoItem[]);

      const { data: plantillasData, error: plantillasError } = await fetchAllSupabase(() => supabase.from('plantillas_plan').select('*'));
      if (!plantillasError && plantillasData) setPlantillas(plantillasData as PlantillaPlan[]);

      const config = await getAppConfig();
      setAppConfig(config);

    } catch {
      console.log('Using mock/default data (Supabase not connected or tables missing)');
    } finally {
      setLoading(false);
    }
  };

  /** Recarga ligera: solo planes (no pone loading=true para no destruir la UI) */
  const refreshPlans = async () => {
    try {
      const { data, error } = await fetchAllSupabase(() => supabase.from('vista_planes_pago').select('*'));
      if (!error && data) setPlans(data.length > 0 ? data as PaymentPlan[] : []);
    } catch { /* silenciar */ }
  };

  const catalogos = buildCatalogos(catalogoItems);
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const filteredPlans = plans.filter(p => p.ciclo_id === activeCicloId || p.ciclo_escolar === activeCiclo?.nombre);

  const totalActivos = alumnos.filter(a => a.estatus === 'ACTIVO').length;
  const totalDeudores = filteredPlans.filter(p => {
    for (let i = 1; i <= 9; i++) {
        if (p[`estatus_${i}` as keyof PaymentPlan] === 'PENDIENTE') return true;
    }
    return false;
  }).length;

  // ── Handlers con persistencia ────────────────────────────────────────────
  const handleSavePlan = async (updatedPlan: PaymentPlan) => {
    const exists = plans.some(p => p.id === updatedPlan.id);
    setPlans(prev => exists
      ? prev.map(p => p.id === updatedPlan.id ? updatedPlan : p)
      : [...prev, updatedPlan]
    );
    const error = await savePlan(updatedPlan);
    if (error) showToast('error', `Error al guardar plan: ${error}`);
  };

  const handleImport = async (newAlumnos: Alumno[], newPlans: PaymentPlan[]) => {
    if (newAlumnos.length > 0) {
      setAlumnos(prev => {
        const copy = [...prev];
        newAlumnos.forEach(na => {
          const idx = copy.findIndex(a => a.id === na.id);
          if (idx >= 0) copy[idx] = na;
          else copy.push(na);
        });
        return copy;
      });
    }
    if (newPlans.length > 0) {
      setPlans(prev => {
        const copy = [...prev];
        newPlans.forEach(np => {
          const idx = copy.findIndex(p => p.id === np.id);
          if (idx >= 0) copy[idx] = np;
          else copy.push(np);
        });
        return copy;
      });
    }

    const errA = await bulkSaveAlumnos(newAlumnos);
    const errP = await bulkSavePlanes(newPlans);
    
    if (errA || errP) {
      showToast('error', `Error BD: Alumnos(${errA || 'OK'}) Planes(${errP || 'OK'})`);
    } else if (newPlans.length > 0 || newAlumnos.length > 0) {
      const msgs = [];
      if (newAlumnos.length > 0) msgs.push(`${newAlumnos.length} alumno(s)`);
      if (newPlans.length > 0) msgs.push(`${newPlans.length} plan(es)`);
      showToast('success', `${msgs.join(' y ')} importado(s) correctamente.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl font-bold text-blue-600 animate-pulse">Cargando datos...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={(u) => {
      setCurrentUser(u);
      
      if (u.preferencia_tema) {
         localStorage.setItem('theme', u.preferencia_tema);
         const root = window.document.documentElement;
         if (u.preferencia_tema === 'dark') root.classList.add('dark');
         else root.classList.remove('dark');
      }
      
      if (u.ultimo_ciclo_id) {
         setActiveCicloId(u.ultimo_ciclo_id);
         localStorage.setItem('current_ciclo_id', u.ultimo_ciclo_id);
      }
    }} />;
  }

  const isCoordinador = currentUser.rol === 'COORDINADOR';


    const handleExportCSV = () => {
      if (filteredPlans.length === 0) {
        showToast('error', 'No hay planes para exportar en este ciclo.');
        return;
      }
      const rows = filteredPlans.map(p => {
        const a = alumnos.find(al => al.id === p.alumno_id);
        return [
          p.nombre_alumno || (a ? a.nombre_completo : ''),
          p.no_plan_pagos || '',
          p.licenciatura || (a ? a.licenciatura : ''),
          p.grado || (a ? a.grado_actual : ''),
          p.turno || (a ? a.turno : ''),
          a ? (a.estatus || 'ACTIVO') : 'ACTIVO',
          p.ciclo_escolar || '',
          p.fecha_plan || '',
          p.tipo_plan || 'Cuatrimestral',
          p.beca_tipo || 'NINGUNA',
          p.beca_porcentaje || '0%',
          a?.observaciones_pago_titulacion || '',
          ...Array.from({ length: 9 }, (_, i) => {
             const id = i + 1;
             return [
               p[`concepto_${id}` as keyof PaymentPlan] as string || '',
               p[`fecha_${id}` as keyof PaymentPlan] as string || '',
               p[`cantidad_${id}` as keyof PaymentPlan] as never || '',
               p[`estatus_${id}` as keyof PaymentPlan] as string || ''
             ];
          }).flat()
        ];
      });
      const csvContent = generateCSV(CSV_HEADERS, rows);
      downloadCSV(csvContent, `planes_${activeCiclo?.nombre || 'ciclo'}.csv`);
    };

    const homePageContent = (
      <PageWrapper keyStr="home" className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8 font-sans transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence>
            {showImport && (
              <ImportarCSV
                activeCicloId={activeCicloId}
                activeCicloNombre={activeCiclo?.nombre || ''}
                ciclos={ciclos}
                globalMaxCounter={getMaxFolioCounter(plans)}
                existingAlumnos={alumnos}
                existingPlans={filteredPlans}
                onImport={handleImport}
                onClose={() => setShowImport(false)}
              />
            )}
          </AnimatePresence>

          {/* Header & Ciclo Selector (Rediseño visual) */}
          <div className="sticky top-4 z-40 w-full max-w-7xl mx-auto rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-200/60 dark:border-gray-800 bg-white dark:bg-gray-900 mb-8 transition-colors duration-300">
            
            {/* TOP ROW: White BG */}
            <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-t-xl">
              
              {/* Left: Logo, Title, Cycle */}
              <div className="flex flex-wrap items-center gap-4">
                {appConfig?.logoUrl ? (
                  <img src={appConfig.logoUrl} alt="App Logo" className="h-10 sm:h-12 w-auto object-contain" />
                ) : (
                  <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-[#1c2c54] to-[#263e77] rounded-xl flex items-center justify-center shadow-inner shrink-0 text-white font-extrabold text-lg sm:text-xl border border-[#2b4482]">
                    U
                  </div>
                )}
                
                <h1 className="text-lg sm:text-[22px] font-extrabold text-[#11192b] dark:text-white tracking-tight leading-none whitespace-nowrap">
                  {appConfig?.title || 'Sistema de Control de Pagos'}
                </h1>

                {/* Vertical Separator */}
                <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-gray-800 mx-2"></div>

                {/* Dropdown Ciclo con Glow */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-[#244287] rounded-lg blur opacity-40 group-hover:opacity-60 transition duration-200"></div>
                  <div className="relative flex items-center gap-2 px-3 py-1.5 bg-[#183168] border border-[#264287] text-white rounded-lg shadow-sm cursor-pointer select-none min-w-max">
                    <Calendar size={14} className="text-[#a4c5ff]" />
                    <select
                      className="text-sm font-bold bg-transparent outline-none cursor-pointer appearance-none pr-5 w-full text-white"
                      value={activeCicloId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setActiveCicloId(newId);
                        if (currentUser) {
                          setCurrentUser({ ...currentUser, ultimo_ciclo_id: newId });
                          updateUserPreferences(currentUser.id, { ultimo_ciclo_id: newId });
                        }
                      }}
                    >
                      {ciclos.map(c => (
                        <option key={c.id} value={c.id} className="bg-gray-800 text-white">{c.nombre}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 pointer-events-none text-white/70" />
                  </div>
                </div>
              </div>

              {/* Right: Dark Mode, User, Logout */}
              <div className="flex items-center gap-4">
                <DarkModeToggle 
                  initialTheme={currentUser.preferencia_tema} 
                  onChange={(isDark) => {
                    const theme = isDark ? 'dark' : 'light';
                    setCurrentUser({ ...currentUser, preferencia_tema: theme });
                    updateUserPreferences(currentUser.id, { preferencia_tema: theme });
                  }} 
                />
                
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-800 hidden sm:block"></div>
                
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end leading-none">
                    <span className="text-[15px] font-extrabold text-[#0a152d] dark:text-gray-200">{currentUser.username}</span>
                    <span className="text-[10px] font-bold text-[#3d2793] dark:text-indigo-400 uppercase tracking-widest mt-1">{currentUser.rol}</span>
                  </div>
                  
                  <div className="w-9 h-9 ml-1 rounded-full bg-[#d0cedd] border border-[#c0bdd0] dark:bg-gray-700 flex items-center justify-center text-[#1c1836] dark:text-white font-extrabold text-sm shadow-inner">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                </div>

                <button onClick={() => setCurrentUser(null)} className="relative ml-2 group shrink-0">
                  <div className="absolute -inset-1 bg-red-500 rounded-lg blur opacity-30 group-hover:opacity-50 transition duration-200"></div>
                  <div className="relative px-4 py-1.5 border border-[#fcb5b5] bg-[#ffeaea] dark:bg-red-900/40 text-[#ce2121] dark:text-red-300 dark:border-red-800 rounded-lg text-xs font-bold tracking-wide hover:bg-[#ffd9d9] dark:hover:bg-red-900/60 transition-colors">
                    SALIR
                  </div>
                </button>
              </div>
            </div>

            {/* BOTTOM ROW: Purple-ish gray BG */}
            <div className="bg-[#cdcad9] dark:bg-gray-800/80 border-t border-[#b9b5c9] dark:border-gray-700 px-6 py-3 flex flex-wrap items-center gap-3 shadow-inner rounded-b-xl">
              
              <button onClick={() => navigate('/alumnos')} className="relative flex items-center gap-2 px-4 py-1.5 bg-[#4c35ad] border border-[#5d46be] text-white rounded-lg font-bold text-sm shadow-[0_2px_8px_rgba(76,53,173,0.4)] hover:bg-[#3d2a8b] transition-colors shrink-0">
                <GraduationCap size={16} /> Alumnos
                {totalActivos > 0 && (
                  <span className="absolute -top-2.5 -right-2 bg-[#6b52d6] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-[#4c35ad]">
                    {totalActivos}
                  </span>
                )}
              </button>

              {!isCoordinador && (
                <>
                  <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#ddfbe9] text-[#137546] border border-[#b8efce] hover:bg-[#c9f5db] dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700 rounded-lg font-bold text-sm transition-colors shrink-0">
                    <Upload size={16} /> Importar
                  </button>
                  
                  <button onClick={handleExportCSV} className="relative group shrink-0">
                    <div className="absolute -inset-1 bg-[#1aaec5] rounded-lg blur opacity-30 group-hover:opacity-50 transition duration-200"></div>
                    <div className="relative flex items-center gap-1.5 px-4 py-1.5 bg-[#d8f8fd] text-[#0e7490] border border-[#a1ebf8] hover:bg-[#c1f3fa] dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700 rounded-lg font-bold text-sm transition-colors">
                      <Download size={16} /> Exportar
                    </div>
                  </button>
                  
                  <div className="relative shrink-0 ml-1">
                    <button
                      onClick={() => setShowConfigMenu(prev => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#cecbd7] text-[#4d485e] border border-[#b5b1c2] hover:bg-[#bfbccc] dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 rounded-lg font-bold text-sm transition-colors"
                    >
                      <Settings size={16} /> Configuración <ChevronDown size={14} className={`transition-transform ${showConfigMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showConfigMenu && (
                      <div className="absolute top-full right-0 md:left-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[200px]">
                        <button onClick={() => { navigate('/catalogos'); setShowConfigMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                          <BookOpen size={16} /> Catálogos
                        </button>
                        <button onClick={() => { navigate('/plantillas'); setShowConfigMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/30 hover:text-pink-700 dark:hover:text-pink-300 transition-colors">
                          <FileText size={16} /> Plantillas
                        </button>
                        <button onClick={() => { navigate('/ciclos'); setShowConfigMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors">
                          <Calendar size={16} /> Ciclos Escolares
                        </button>
                        <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                        <button onClick={() => { navigate('/configuracion-app'); setShowConfigMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                          <Settings size={16} /> Generales
                        </button>
                        <button onClick={() => { navigate('/usuarios'); setShowConfigMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                          <Shield size={16} /> Módulo de Usuarios
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>



          {/* Sección 1: Operaciones Financieras */}
          <div className="max-w-6xl mx-auto mb-12">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
              <Wallet className="text-blue-500" /> Operaciones Financieras
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tarjeta 1: Plan de Pagos */}
              <button onClick={() => navigate('/plan-pagos')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-blue-500/20 hover:-translate-y-1 transition-all duration-300 group text-left flex flex-col items-start border border-gray-200 dark:border-gray-800 ring-1 ring-black/5 dark:ring-white/5 relative overflow-hidden">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-xl text-white mb-4 group-hover:scale-110 group-hover:shadow-blue-500/50 shadow-lg transition-all duration-300">
                  <FileText size={28} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Plan de Pagos</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Visualiza y edita el plan detallado por alumno para el ciclo en curso.</p>
              </button>

              {/* Tarjeta 2: Control de Ingresos */}
              <button onClick={() => navigate('/control-ingresos')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1 transition-all duration-300 group text-left flex flex-col items-start border border-gray-200 border-l-4 border-l-emerald-500 dark:border-gray-800 dark:border-l-emerald-500 ring-1 ring-black/5 dark:ring-white/5 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                <div className="bg-gradient-to-br from-emerald-400 to-teal-600 p-4 rounded-xl text-white mb-4 group-hover:scale-110 group-hover:shadow-emerald-500/50 shadow-lg transition-all duration-300">
                  <Wallet size={28} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Control de Ingresos</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Registra cobros, emite comprobantes y consulta el historial de pagos.</p>
              </button>
            </div>
          </div>

          {/* Sección 2: Consultas y Reportes */}
          <div className="max-w-6xl mx-auto">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
              <BarChart3 className="text-indigo-500" /> Consultas y Reportes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <button onClick={() => navigate('/ficha-alumno')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-1 transition-all duration-300 group text-left flex flex-col items-start border border-gray-200 dark:border-gray-800 ring-1 ring-black/5 dark:ring-white/5 relative">
                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-3 rounded-xl text-white mb-4 group-hover:scale-110 group-hover:shadow-indigo-500/50 shadow-lg transition-all duration-300">
                  <User size={24} />
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Ficha del Alumno</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Resumen compacto del estado financiero y becas.</p>
              </button>

              <button onClick={() => navigate('/estadisticas')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-purple-500/20 hover:-translate-y-1 transition-all duration-300 group text-left flex flex-col items-start border border-gray-200 dark:border-gray-800 ring-1 ring-black/5 dark:ring-white/5 relative">
                <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 p-3 rounded-xl text-white mb-4 group-hover:scale-110 group-hover:shadow-purple-500/50 shadow-lg transition-all duration-300">
                  <BarChart3 size={24} />
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Estadísticas</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Análisis mensual de ingresos y deudas totales por ciclo.</p>
              </button>

              <button onClick={() => navigate('/deudores')} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-rose-500/20 hover:-translate-y-1 transition-all duration-300 group text-left flex flex-col items-start border border-gray-200 dark:border-gray-800 ring-1 ring-black/5 dark:ring-white/5 relative overflow-hidden">
                <div className="bg-gradient-to-br from-rose-500 to-red-600 p-3 rounded-xl text-white mb-4 group-hover:scale-110 group-hover:shadow-rose-500/50 shadow-lg transition-all duration-300">
                  <Users size={24} />
                </div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Deudores</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Directorio de alumnos con pagos pendientes y retrasos.</p>
                {totalDeudores > 0 && (
                  <div className="absolute top-4 right-4 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs font-bold px-2 py-1 rounded-lg border border-red-200 dark:border-red-800/50 flex items-center gap-1">
                     <AlertCircle size={10} /> {totalDeudores}
                  </div>
                )}
              </button>

            </div>
          </div>
        </div>
      </PageWrapper>
    );

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`fixed bottom-5 right-5 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all
              ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
          >
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
      <Routes>
        <Route path="/plan-pagos" element={
          <PageWrapper keyStr="plan_pagos">
            <PlanPagos currentUser={currentUser} plans={filteredPlans} alumnos={alumnos} activeCiclo={activeCiclo} catalogos={catalogos} plantillas={plantillas} initialAlumnoId={selectedAlumnoId || navState.alumnoId}
              onSavePlan={handleSavePlan}
              onBack={() => { setSelectedAlumnoId(null); navigate('/'); }}
              onGoToPagos={(aId, cIdx) => navigate('/control-ingresos', { state: { alumnoId: aId, conceptoIdx: cIdx, view: 'registrar' } })}
              onViewReceipt={(folio) => navigate('/control-ingresos', { state: { view: 'consultar', searchTerm: folio } })}
            />
          </PageWrapper>
        } />
        <Route path="/ficha-alumno" element={
          <PageWrapper keyStr="ficha_alumno">
            <FichaAlumno plans={filteredPlans} alumnos={alumnos} initialAlumnoId={selectedAlumnoId || navState.alumnoId}
              onBack={() => { setSelectedAlumnoId(null); navigate('/'); }}
              onGoToPlan={(id) => { setSelectedAlumnoId(id); navigate('/plan-pagos', { state: { alumnoId: id } }); }}
            />
          </PageWrapper>
        } />
        <Route path="/estadisticas" element={<PageWrapper keyStr="estadisticas"><Estadisticas plans={filteredPlans} alumnos={alumnos} onBack={() => navigate('/')} /></PageWrapper>} />
        <Route path="/deudores" element={<PageWrapper keyStr="deudores"><Deudores plans={filteredPlans} alumnos={alumnos} onBack={() => navigate('/')} /></PageWrapper>} />
        <Route path="/ciclos" element={<PageWrapper keyStr="ciclos"><CiclosConfig ciclos={ciclos} onSave={setCiclos} onBack={() => navigate('/')} /></PageWrapper>} />
        <Route path="/alumnos" element={
          <PageWrapper keyStr="alumnos">
            <AlumnosConfig currentUser={currentUser} alumnos={alumnos} ciclos={ciclos} activeCicloId={activeCicloId} activeCyclePlans={filteredPlans} globalMaxCounter={getMaxFolioCounter(plans)} catalogos={catalogos} plantillas={plantillas}
              onSave={setAlumnos}
              onCreatePlan={handleSavePlan}
              onViewFicha={(id) => { setSelectedAlumnoId(id); navigate('/ficha-alumno', { state: { alumnoId: id } }); }}
              onBack={() => navigate('/')}
            />
          </PageWrapper>
        } />
        <Route path="/catalogos" element={<PageWrapper keyStr="catalogos"><CatalogosConfig catalogos={catalogos} rawItems={catalogoItems} onBack={() => navigate('/')} onUpdate={setCatalogoItems} /></PageWrapper>} />
        <Route path="/plantillas" element={<PageWrapper keyStr="plantillas"><PlantillasConfig plantillas={plantillas} ciclos={ciclos} catalogos={catalogos} onSave={setPlantillas} onBack={() => navigate('/')} /></PageWrapper>} />
        <Route path="/usuarios" element={<PageWrapper keyStr="usuarios"><UsuariosConfig currentUser={currentUser} onBack={() => navigate('/')} /></PageWrapper>} />
        <Route path="/configuracion-app" element={
          <PageWrapper keyStr="config_app">
            <AppConfigSettings 
              config={appConfig || { title: 'Sistema de Control de Pagos', logoUrl: '' }} 
              onSave={(newC) => { setAppConfig(newC); navigate('/'); showToast('success', 'Configuración guardada correctamente.'); }} 
              onBack={() => navigate('/')} 
            />
          </PageWrapper>
        } />
        <Route path="/control-ingresos" element={
          <PageWrapper keyStr={`control_ingresos_${navState.alumnoId || ''}_${navState.conceptoIdx || ''}_${navState.searchTerm || ''}`}>
            <ControlIngresos key={`ci_${navState.alumnoId || ''}_${navState.conceptoIdx || ''}_${navState.searchTerm || ''}`}
              alumnos={alumnos} activeCiclo={activeCiclo} ciclos={ciclos} plans={filteredPlans} catalogos={catalogos}
              onBack={() => navigate('/')}
              initialAlumnoId={navState.alumnoId}
              initialConceptIndex={navState.conceptoIdx}
              initialView={navState.view}
              initialSearchTerm={navState.searchTerm}
              onPaymentSaved={refreshPlans}
            />
          </PageWrapper>
        } />
        <Route path="/" element={homePageContent} />
        <Route path="*" element={homePageContent} />
      </Routes>
    </>
  );
}
