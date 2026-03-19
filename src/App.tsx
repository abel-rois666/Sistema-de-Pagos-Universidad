import { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, User, BarChart3, Users, Settings, GraduationCap, Calendar, BookOpen, Upload, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { supabase, savePlan, bulkSaveAlumnos, bulkSavePlanes, saveAlumno, deleteAlumno, saveCiclo, deleteCiclo, saveCatalogoItem, deleteCatalogoItem, savePlantilla, deletePlantilla } from './lib/supabase';
import { PaymentPlan, CicloEscolar, Alumno, CatalogoItem, Catalogos, PlantillaPlan } from './types';
import { MOCK_DATA, MOCK_CICLOS, MOCK_ALUMNOS } from './data';

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
  ...['ACTIVO', 'BAJA', 'EGRESADO']
    .map((v, i) => ({ id: `dea_${i}`, tipo: 'estatus_alumno' as const, valor: v, orden: i + 1, activo: true })),
];

const buildCatalogos = (items: CatalogoItem[]): Catalogos => ({
  conceptos: items.filter(i => i.tipo === 'concepto' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor),
  licenciaturas: items.filter(i => i.tipo === 'licenciatura' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor),
  beca_tipos: items.filter(i => i.tipo === 'beca_tipo' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor),
  beca_porcentajes: items.filter(i => i.tipo === 'beca_porcentaje' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor),
  grados: items.filter(i => i.tipo === 'grado' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor),
  turnos: items.filter(i => i.tipo === 'turno' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor),
  estatus_alumnos: items.filter(i => i.tipo === 'estatus_alumno' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor),
});

type View = 'home' | 'plan_pagos' | 'ficha_alumno' | 'estadisticas' | 'deudores' | 'ciclos' | 'alumnos' | 'catalogos' | 'plantillas' | 'usuarios';

// ── Page Wrapper Animado ─────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { duration: 0.25, ease: "easeOut" }
};

const PageWrapper = ({ children, keyStr, className }: { children: ReactNode, keyStr: string, className?: string }) => (
  <motion.div key={keyStr} initial="initial" animate="animate" exit="exit" variants={pageVariants} transition={pageVariants.transition as any} className={className || "min-h-screen bg-gray-50"}>
    {children}
  </motion.div>
);

export default function App() {
  const [plans, setPlans] = useState<PaymentPlan[]>(MOCK_DATA);
  const [ciclos, setCiclos] = useState<CicloEscolar[]>(MOCK_CICLOS);
  const [alumnos, setAlumnos] = useState<Alumno[]>(MOCK_ALUMNOS);
  const [plantillas, setPlantillas] = useState<PlantillaPlan[]>([]);
  const [activeCicloId, setActiveCicloId] = useState<string>(MOCK_CICLOS.find(c => c.activo)?.id || MOCK_CICLOS[0].id);
  const [catalogoItems, setCatalogoItems] = useState<CatalogoItem[]>(DEFAULT_CATALOGOS);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

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

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: planesData, error: planesError } = await supabase
        .from('vista_planes_pago').select('*');
      if (!planesError && planesData) {
        setPlans(planesData.length > 0 ? planesData as PaymentPlan[] : []);
      }

      const { data: ciclosData, error: ciclosError } = await supabase
        .from('ciclos_escolares').select('*');
      if (!ciclosError && ciclosData) {
        if (ciclosData.length > 0) {
          setCiclos(ciclosData as CicloEscolar[]);
          const active = ciclosData.find(c => c.activo);
          if (active) setActiveCicloId(active.id);
        } else {
          setCiclos([]);
        }
      }

      const { data: alumnosData, error: alumnosError } = await supabase
        .from('alumnos').select('*');
      if (!alumnosError && alumnosData) {
        setAlumnos(alumnosData.length > 0 ? alumnosData as Alumno[] : []);
      }

      const { data: catalogosData, error: catalogosError } = await supabase
        .from('catalogos').select('*').order('orden', { ascending: true });
      if (!catalogosError && catalogosData && catalogosData.length > 0) setCatalogoItems(catalogosData as CatalogoItem[]);

      const { data: plantillasData, error: plantillasError } = await supabase
        .from('plantillas_plan').select('*');
      if (!plantillasError && plantillasData) setPlantillas(plantillasData as PlantillaPlan[]);

    } catch {
      console.log('Using mock/default data (Supabase not connected or tables missing)');
    } finally {
      setLoading(false);
    }
  };

  const catalogos = buildCatalogos(catalogoItems);
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const filteredPlans = plans.filter(p => p.ciclo_id === activeCicloId || p.ciclo_escolar === activeCiclo?.nombre);

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
    if (newAlumnos.length > 0) setAlumnos(prev => [...prev, ...newAlumnos]);
    if (newPlans.length > 0) setPlans(prev => [...prev, ...newPlans]);

    const errA = await bulkSaveAlumnos(newAlumnos);
    const errP = await bulkSavePlanes(newPlans);
    if (errA || errP) {
      showToast('error', 'Importación local exitosa, pero hubo un error al guardar en BD.');
    } else if (newPlans.length > 0) {
      showToast('success', `${newPlans.length} plan(es) importado(s) y guardado(s) correctamente.`);
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
    return <Login onLogin={setCurrentUser} />;
  }

  const isCoordinador = currentUser.rol === 'COORDINADOR';

  // ── Renderizado Dinámico de Vistas ───────────────────────────────────────
  const renderView = () => {
    switch (currentView) {
      case 'plan_pagos': return <PageWrapper keyStr="plan_pagos"><PlanPagos currentUser={currentUser} plans={filteredPlans} alumnos={alumnos} activeCiclo={activeCiclo} catalogos={catalogos} plantillas={plantillas} onSavePlan={handleSavePlan} onBack={() => setCurrentView('home')} /></PageWrapper>;
      case 'ficha_alumno': return <PageWrapper keyStr="ficha_alumno"><FichaAlumno plans={filteredPlans} alumnos={alumnos} initialAlumnoId={selectedAlumnoId} onBack={() => { setSelectedAlumnoId(null); setCurrentView('home'); }} /></PageWrapper>;
      case 'estadisticas': return <PageWrapper keyStr="estadisticas"><Estadisticas plans={filteredPlans} alumnos={alumnos} onBack={() => setCurrentView('home')} /></PageWrapper>;
      case 'deudores': return <PageWrapper keyStr="deudores"><Deudores plans={filteredPlans} alumnos={alumnos} onBack={() => setCurrentView('home')} /></PageWrapper>;
      case 'ciclos': return <PageWrapper keyStr="ciclos"><CiclosConfig ciclos={ciclos} onSave={setCiclos} onBack={() => setCurrentView('home')} /></PageWrapper>;
      case 'alumnos': return <PageWrapper keyStr="alumnos"><AlumnosConfig currentUser={currentUser} alumnos={alumnos} ciclos={ciclos} activeCicloId={activeCicloId} activeCyclePlans={filteredPlans} catalogos={catalogos} plantillas={plantillas} onSave={setAlumnos} onCreatePlan={handleSavePlan} onViewFicha={(id) => { setSelectedAlumnoId(id); setCurrentView('ficha_alumno'); }} onBack={() => setCurrentView('home')} /></PageWrapper>;
      case 'catalogos': return <PageWrapper keyStr="catalogos"><CatalogosConfig catalogos={catalogos} rawItems={catalogoItems} onBack={() => setCurrentView('home')} onUpdate={setCatalogoItems} /></PageWrapper>;
      case 'plantillas': return <PageWrapper keyStr="plantillas"><PlantillasConfig plantillas={plantillas} ciclos={ciclos} catalogos={catalogos} onSave={setPlantillas} onBack={() => setCurrentView('home')} /></PageWrapper>;
      case 'usuarios': return <PageWrapper keyStr="usuarios"><UsuariosConfig currentUser={currentUser} onBack={() => setCurrentView('home')} /></PageWrapper>;
      case 'home':
      default:
        return (
          <PageWrapper keyStr="home" className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-6xl mx-auto">
              <AnimatePresence>
                {showImport && (
                  <ImportarCSV
                    activeCicloId={activeCicloId}
                    activeCicloNombre={activeCiclo?.nombre || ''}
                    existingAlumnos={alumnos}
                    existingPlans={filteredPlans}
                    onImport={handleImport}
                    onClose={() => setShowImport(false)}
                  />
                )}
              </AnimatePresence>

              {/* Header & Ciclo Selector */}
              <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-8">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="bg-blue-600 p-2 rounded-lg text-white"><Calendar size={24} /></div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Ciclo Escolar Activo</h2>
                    <select
                      className="text-xl font-extrabold text-gray-900 bg-transparent outline-none cursor-pointer"
                      value={activeCicloId}
                      onChange={(e) => setActiveCicloId(e.target.value)}
                    >
                      {ciclos.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre} ({c.meses_abarca} {c.anio})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap justify-end items-center">
                  {!isCoordinador && (
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold transition-colors text-sm border border-emerald-100">
                      <Upload size={18} /> Importar CSV
                    </button>
                  )}
                  <button onClick={() => setCurrentView('alumnos')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-semibold transition-colors text-sm border border-indigo-100">
                    <GraduationCap size={18} /> Alumnos
                  </button>
                  {!isCoordinador && (
                    <>
                      <button onClick={() => setCurrentView('catalogos')} className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg font-semibold transition-colors text-sm border border-violet-100">
                        <BookOpen size={18} /> Catálogos
                      </button>
                      <button onClick={() => setCurrentView('plantillas')} className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-700 hover:bg-pink-100 rounded-lg font-semibold transition-colors text-sm border border-pink-100">
                        <FileText size={18} /> Plantillas
                      </button>
                      <button onClick={() => setCurrentView('ciclos')} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-semibold transition-colors text-sm border border-gray-200">
                        <Settings size={18} /> Ciclos
                      </button>
                      <button onClick={() => setCurrentView('usuarios')} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg font-semibold transition-colors text-sm border border-amber-100">
                        <Shield size={18} /> Usuarios
                      </button>
                    </>
                  )}
                  
                  <div className="h-6 w-px bg-gray-300 mx-1 hidden md:block"></div>
                  
                  <div className="flex flex-col items-end mr-2">
                    <span className="text-sm font-bold text-gray-800">{currentUser.username}</span>
                    <span className="text-xs text-indigo-600 font-semibold">{currentUser.rol}</span>
                  </div>
                  <button onClick={() => setCurrentUser(null)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-semibold transition-colors text-sm border border-red-100" title="Cerrar Sesión">
                    Cerrar Sesión
                  </button>
                </div>
              </div>

              <header className="text-center mb-12 mt-4">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">Sistema de Control de Pagos</h1>
                <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                  Gestión financiera, seguimiento de alumnos y estadísticas para el ciclo <span className="font-bold text-blue-600">{activeCiclo?.nombre}</span>.
                </p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                <button onClick={() => setCurrentView('plan_pagos')} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all group text-left flex flex-col items-start">
                  <div className="bg-blue-50 p-4 rounded-xl text-blue-600 mb-6 group-hover:scale-110 transition-transform"><FileText size={32} /></div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Plan de Pagos</h2>
                  <p className="text-gray-500">Visualiza y edita el plan de pagos detallado por alumno para el ciclo escolar en curso.</p>
                </button>

                <button onClick={() => setCurrentView('ficha_alumno')} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-indigo-300 transition-all group text-left flex flex-col items-start">
                  <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600 mb-6 group-hover:scale-110 transition-transform"><User size={32} /></div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Ficha del Alumno</h2>
                  <p className="text-gray-500">Resumen compacto del estado financiero del alumno, becas asignadas y totales pagados/adeudados.</p>
                </button>

                <button onClick={() => setCurrentView('estadisticas')} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-emerald-300 transition-all group text-left flex flex-col items-start">
                  <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600 mb-6 group-hover:scale-110 transition-transform"><BarChart3 size={32} /></div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Estadísticas Generales</h2>
                  <p className="text-gray-500">Análisis mensual de ingresos y deudas totales por ciclo escolar.</p>
                </button>

                <button onClick={() => setCurrentView('deudores')} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-red-300 transition-all group text-left flex flex-col items-start">
                  <div className="bg-red-50 p-4 rounded-xl text-red-600 mb-6 group-hover:scale-110 transition-transform"><Users size={32} /></div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Lista de Deudores</h2>
                  <p className="text-gray-500">Directorio de alumnos con pagos pendientes, filtrado por concepto y ciclo escolar.</p>
                </button>
              </div>
            </div>
          </PageWrapper>
        );
    }
  };

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
      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>
    </>
  );
}
