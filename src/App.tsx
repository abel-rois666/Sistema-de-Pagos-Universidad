import { useState, useEffect, ReactNode } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, LayoutDashboard, Briefcase } from 'lucide-react';
import { supabase, savePlan, saveAlumno, deleteAlumno, saveCiclo, deleteCiclo, saveCatalogoItem, deleteCatalogoItem, savePlantilla, deletePlantilla, getAppConfig, updateUserPreferences, fetchAllSupabase } from './lib/supabase';
import { PaymentPlan, CicloEscolar, Alumno, CatalogoItem, Catalogos, PlantillaPlan, AppConfig } from './types';
import { MOCK_DATA, MOCK_CICLOS, MOCK_ALUMNOS } from './data';

import { useAppStore } from './store/useAppStore';
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
import LoadingSkeleton from './components/LoadingSkeleton';
import AppLayout from './components/AppLayout';
import ControlAcademico from './components/ControlAcademico';
import GruposConfig from './components/GruposConfig';
import DocentesConfig from './components/DocentesConfig';
import Dashboard from './components/Dashboard';
import CalificacionesModule from './components/CalificacionesModule';
import RecursosHumanosConfig from './components/RecursosHumanosConfig';
import EvaluacionNom035 from './components/EvaluacionNom035';
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
  empresas_ss: Array.from(new Set(items.filter(i => i.tipo === 'empresa_ss' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  modalidades_titulacion: Array.from(new Set(items.filter(i => i.tipo === 'modalidad_titulacion' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
  licenciaturasMetadata: Object.fromEntries(
    items
      .filter(i => i.tipo === 'licenciatura' && i.activo && i.metadata)
      .map(i => [i.valor, i.metadata!])
  ),
});




// ── Page Wrapper Animado ─────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { duration: 0.25, ease: "easeOut" }
};

const PageWrapper = ({ children, keyStr, className }: { children: ReactNode, keyStr: string, className?: string }) => (
  <motion.div key={keyStr} initial="initial" animate="animate" exit="exit" variants={pageVariants} transition={pageVariants.transition as any} className={className || "bg-gray-50 dark:bg-gray-950"}>
    {children}
  </motion.div>
);

export default function App() {
  const {
    currentUser, authChecked, loading,
    plans, ciclos, alumnos, plantillas, catalogoItems, appConfig, activeCicloId,
    setCurrentUser, setAuthChecked, setActiveCicloId, setLoading,
    fetchAllData, refreshAfterPayment, fetchCarreras,
    setPlans, setAlumnos, setCiclos, setPlantillas, setCatalogoItems, setAppConfig
  } = useAppStore();

  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as any;
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(navState.alumnoId || null);

  // ── Toast global ─────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Persistencia del último ciclo seleccionado ───────────────────────────────────────
  useEffect(() => {
    if (activeCicloId) {
      try { localStorage.setItem('current_ciclo_id', activeCicloId); } catch {}
    }
  }, [activeCicloId]);

  // ── Supabase Auth: verificar sesión al montar y escuchar cambios ──────────────────────
  useEffect(() => {
    // Al recargar la página: busca sesión JWT activa
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Hay sesión — cargar el perfil del usuario
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('id, username, rol, preferencia_tema, ultimo_ciclo_id')
          .eq('auth_id', session.user.id)
          .maybeSingle();

        if (perfil) {
          const u = perfil as Usuario;
          setCurrentUser(u);
          // Aplicar tema guardado
          if (u.preferencia_tema) {
            const root = window.document.documentElement;
            if (u.preferencia_tema === 'dark') root.classList.add('dark');
            else root.classList.remove('dark');
          }
          // Aplicar último ciclo
          if (u.ultimo_ciclo_id) {
            setActiveCicloId(u.ultimo_ciclo_id);
          }
          // Cargar datos del sistema
          await fetchAllData();
          await fetchCarreras(); // Inicialización forzada de carreras
          return;
        } else {
          // Sesión Auth válida pero sin perfil en la BD — cerrar sesión
          await supabase.auth.signOut();
        }
      }
      // Sin sesión o perfil no encontrado
      setAuthChecked(true);
    });

    // Escuchar cambios de estado (logout desde otra pestaña, expiración de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setCurrentUser, setActiveCicloId, setAuthChecked, fetchAllData]);

  const catalogos = buildCatalogos(catalogoItems);

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
  // Guard para rol DOCENTE (Debe ir antes de los early returns por las reglas de Hooks)
  useEffect(() => {
    if (currentUser?.rol === 'DOCENTE' && location.pathname !== '/calificaciones') {
      navigate('/calificaciones', { replace: true });
    }
  }, [currentUser, location.pathname, navigate]);

  // Mostrar skeleton mientras se verifica la sesión o se cargan datos
  if (!authChecked || loading) {
    return <LoadingSkeleton type="full" text="Cargando sistema..." />;
  }

  // Sin sesión válida → mostrar Login
  if (!currentUser) {
    return <Login onLogin={(u) => {
      setCurrentUser(u);

      // Aplicar tema del usuario recién autenticado
      if (u.preferencia_tema) {
        const root = window.document.documentElement;
        if (u.preferencia_tema === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
      }

      // Aplicar último ciclo guardado
      if (u.ultimo_ciclo_id) {
        setActiveCicloId(u.ultimo_ciclo_id);
      }

      // Cargar todos los datos del sistema
      fetchAllData();
      fetchCarreras();
    }} />;
  }

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
      <AppLayout>
        <Routes>
          <Route path="/plan-pagos" element={
            <PageWrapper keyStr="plan_pagos">
              <PlanPagos initialAlumnoId={selectedAlumnoId || navState.alumnoId}
                onSavePlan={handleSavePlan}
                onDeletePlan={(planId) => setPlans(prev => prev.filter(p => p.id !== planId))}
                onBack={() => { setSelectedAlumnoId(null); navigate('/'); }}
                onGoToPagos={(aId, cIdx, pId) => navigate('/control-ingresos', { state: { alumnoId: aId, conceptoIdx: cIdx, initialPlanId: pId, view: 'registrar', fromPlan: true, fromFicha: navState.fromFicha, fromAlumnos: navState.fromAlumnos } })}
                onViewReceipt={(folio, aId) => navigate('/control-ingresos', { state: { view: 'consultar', searchTerm: folio, fromPlan: true, alumnoId: aId, fromFicha: navState.fromFicha, fromAlumnos: navState.fromAlumnos } })}
                onBackToFicha={navState.fromFicha ? (id) => { setSelectedAlumnoId(id); navigate('/ficha-alumno', { state: { alumnoId: id, fromAlumnos: navState.fromAlumnos } }); } : undefined}
                onBackToReceipt={navState.returnFolio ? () => navigate('/control-ingresos', { state: { view: 'consultar', searchTerm: navState.returnFolio, fromPlan: true, alumnoId: selectedAlumnoId || navState.alumnoId } }) : undefined}
              />
            </PageWrapper>
          } />
          <Route path="/ficha-alumno" element={
            <PageWrapper keyStr="ficha_alumno">
              <FichaAlumno initialAlumnoId={selectedAlumnoId || navState.alumnoId}
                onBack={() => { setSelectedAlumnoId(null); navigate('/'); }}
                onGoToPlan={(id) => { setSelectedAlumnoId(id); navigate('/plan-pagos', { state: { alumnoId: id, fromFicha: true, fromAlumnos: navState.fromAlumnos } }); }}
                onBackToAlumnos={navState.fromAlumnos ? () => { setSelectedAlumnoId(null); navigate('/alumnos'); } : undefined}
              />
            </PageWrapper>
          } />
          <Route path="/estadisticas" element={<PageWrapper keyStr="estadisticas"><Estadisticas onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/deudores" element={<PageWrapper keyStr="deudores"><Deudores onBack={() => navigate('/')} onNavigateToAlumno={(alumnoId) => { setSelectedAlumnoId(alumnoId); navigate('/ficha-alumno', { state: { alumnoId } }); }} /></PageWrapper>} />
          <Route path="/ciclos" element={<PageWrapper keyStr="ciclos"><CiclosConfig onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/alumnos" element={
            <PageWrapper keyStr="alumnos">
              <AlumnosConfig 
                onViewFicha={(id) => { setSelectedAlumnoId(id); navigate('/ficha-alumno', { state: { alumnoId: id, fromAlumnos: true } }); }}
                onBack={() => navigate('/')}
              />
            </PageWrapper>
          } />
          <Route path="/control-escolar" element={
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center bg-white dark:bg-[#1c2228] p-10 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <LayoutDashboard size={48} className="mx-auto text-[#1456f0] dark:text-blue-500 mb-4 opacity-50" />
                <h2 className="text-2xl font-bold text-[#222222] dark:text-gray-100 font-display">Dashboard: Control Escolar</h2>
                <p className="text-[#45515e] dark:text-gray-400 mt-2">Próximamente...</p>
              </div>
            </div>
          } />
          <Route path="/control-academico" element={
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center bg-white dark:bg-[#1c2228] p-10 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <LayoutDashboard size={48} className="mx-auto text-[#1456f0] dark:text-blue-500 mb-4 opacity-50" />
                <h2 className="text-2xl font-bold text-[#222222] dark:text-gray-100 font-display">Dashboard: Control Académico</h2>
                <p className="text-[#45515e] dark:text-gray-400 mt-2">Próximamente...</p>
              </div>
            </div>
          } />
          <Route path="/catalogos" element={<PageWrapper keyStr="catalogos"><CatalogosConfig onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/plantillas" element={<PageWrapper keyStr="plantillas"><PlantillasConfig onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/usuarios" element={<PageWrapper keyStr="usuarios"><UsuariosConfig onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/configuracion-app" element={
            <PageWrapper keyStr="config_app">
              <AppConfigSettings onBack={() => navigate('/')} />
            </PageWrapper>
          } />
          <Route path="/control-ingresos" element={
            <PageWrapper keyStr={`control_ingresos_${navState.alumnoId || ''}_${navState.conceptoIdx || ''}_${navState.searchTerm || ''}`}>
              <ControlIngresos key={`ci_${navState.alumnoId || ''}_${navState.conceptoIdx || ''}_${navState.searchTerm || ''}`}
                onBack={() => navigate('/')}
                onBackToPlan={navState.fromPlan && navState.alumnoId
                  ? () => navigate('/plan-pagos', { state: { alumnoId: navState.alumnoId, fromFicha: navState.fromFicha, fromAlumnos: navState.fromAlumnos } })
                  : undefined}
                initialAlumnoId={navState.alumnoId}
                initialConceptIndex={navState.conceptoIdx}
                initialPlanId={navState.initialPlanId}
                initialView={navState.view}
                initialSearchTerm={navState.searchTerm}
                onNavigateToPlan={(alumnoId, folio) => {
                  setSelectedAlumnoId(alumnoId);
                  navigate('/plan-pagos', { state: { alumnoId, returnFolio: folio } });
                }}
              />
            </PageWrapper>
          } />
          <Route path="/" element={<Dashboard />} />
          {/* Rutas Placeholders para el Sidebar */}
          <Route path="/dashboard" element={
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center bg-white dark:bg-[#1c2228] p-10 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <LayoutDashboard size={48} className="mx-auto text-[#1456f0] dark:text-blue-500 mb-4 opacity-50" />
                <h2 className="text-2xl font-bold text-[#222222] dark:text-gray-100 font-display">Dashboard General</h2>
                <p className="text-[#45515e] dark:text-gray-400 mt-2">Próximamente...</p>
              </div>
            </div>
          } />
          <Route path="/planes-estudio" element={
            <PageWrapper keyStr="academico">
              <ControlAcademico />
            </PageWrapper>
          } />
          <Route path="/grupos" element={
            <PageWrapper keyStr="grupos">
              <GruposConfig />
            </PageWrapper>
          } />
          <Route path="/calificaciones" element={
            <PageWrapper keyStr="calificaciones">
              <CalificacionesModule />
            </PageWrapper>
          } />
          <Route path="/docentes" element={
            <PageWrapper keyStr="docentes">
              <DocentesConfig />
            </PageWrapper>
          } />
          <Route path="/rh" element={
            <PageWrapper keyStr="rh">
              <RecursosHumanosConfig 
                onBack={() => navigate('/')} 
                onNavigateToEvaluacion={() => navigate('/rh/evaluacion')} 
              />
            </PageWrapper>
          } />
          <Route path="/rh/evaluacion" element={
            <PageWrapper keyStr="rh_eval">
              <EvaluacionNom035 onBack={() => navigate('/rh')} />
            </PageWrapper>
          } />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </AppLayout>
    </>
  );
}
