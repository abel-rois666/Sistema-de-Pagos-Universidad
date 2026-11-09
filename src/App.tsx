import InicioArea from './app/InicioArea';
import AccesoRuta from './app/AccesoRuta';
import PaginaNoEncontrada from './app/PaginaNoEncontrada';
import notificar from 'react-hot-toast';
import LimiteError from './app/LimiteError';
import { useState, useEffect, ReactNode, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';

import { supabase, savePlan } from './lib/supabase';
import { PaymentPlan, CatalogoItem, Catalogos } from './types';

import { useAppStore } from './store/useAppStore';
const PlanPagos = lazy(() => import('./components/PlanPagos'));
const FichaAlumno = lazy(() => import('./components/FichaAlumno'));
const Estadisticas = lazy(() => import('./components/Estadisticas'));
const Deudores = lazy(() => import('./components/Deudores'));
const CiclosConfig = lazy(() => import('./components/CiclosConfig'));
const AlumnosConfig = lazy(() => import('./components/AlumnosConfig'));
const CatalogosConfig = lazy(() => import('./components/CatalogosConfig'));
const ImportarCSV = lazy(() => import('./components/ImportarCSV'));
const PlantillasConfig = lazy(() => import('./components/PlantillasConfig'));
import Login from './components/Login';
const UsuariosConfig = lazy(() => import('./components/UsuariosConfig'));
const ControlIngresos = lazy(() => import('./components/ControlIngresos'));
const AppConfigSettings = lazy(() => import('./components/AppConfigSettings').then(modulo => ({ default: modulo.AppConfigSettings })));

import LoadingSkeleton from './components/LoadingSkeleton';
import AppLayout from './components/AppLayout';
const ControlAcademico = lazy(() => import('./components/ControlAcademico'));
const GruposConfig = lazy(() => import('./components/GruposConfig'));
const DocentesConfig = lazy(() => import('./components/DocentesConfig'));
const HorariosAcademicos = lazy(() => import('./components/horarios/HorariosAcademicos'));
const CalendarioAcademico = lazy(() => import('./components/calendario/CalendarioAcademico'));
const ComunicadosEscolares = lazy(() => import('./components/comunicados/ComunicadosEscolares'));
const Estadistica911 = lazy(() => import('./components/estadistica911/Estadistica911'));
const InscripcionesCiclo = lazy(() => import('./components/inscripciones/InscripcionesCiclo'));
import { ROLES911 } from './estadistica911/types';
const Dashboard = lazy(() => import('./components/Dashboard'));
const CalificacionesModule = lazy(() => import('./components/CalificacionesModule'));
const RecursosHumanosConfig = lazy(() => import('./components/RecursosHumanosConfig'));
const EvaluacionNom035 = lazy(() => import('./components/EvaluacionNom035'));
const WizardLayoutDGAIR = lazy(() => import('./components/certificacion/WizardLayoutDGAIR'));
const WizardLayoutTitulacion = lazy(() => import('./components/titulacion/WizardLayoutTitulacion'));
const ReportesControlEscolar = lazy(() => import('./components/reportes/ReportesControlEscolar').then(modulo => ({ default: modulo.ReportesControlEscolar })));
const AprobacionProspectos = lazy(() => import('./components/AprobacionProspectos'));
const PagosAdeudosAlumnos = lazy(() => import('./components/reportes/PagosAdeudosAlumnos'));
const CoberturaPlanesPago = lazy(() => import('./components/reportes/CoberturaPlanesPago'));
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
  ...['ACTIVO', 'BAJA', 'EGRESADO', 'TITULADO']
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
  observacion_plan: Array.from(new Set(items.filter(i => i.tipo === 'observacion_plan' && i.activo).sort((a, b) => a.orden - b.orden).map(i => i.valor))),
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
    <LimiteError key={keyStr}>{children}</LimiteError>
  </motion.div>
);

export default function App() {
  const {
    currentUser, authChecked, loading,
    plans, ciclos, alumnos, plantillas, catalogoItems, appConfig, activeCicloId,
    setCurrentUser, setAuthChecked, setActiveCicloId, setLoading,
    fetchAllData, refreshPlans, refreshAfterPayment, fetchCarreras,
    setPlans, setAlumnos, setCiclos, setPlantillas, setCatalogoItems, setAppConfig
  } = useAppStore();

  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as any;
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(navState.alumnoId || null);

  // ── Toast global ─────────────────────────────────────────────────────────
  const [authConnectionError, setAuthConnectionError] = useState('');
  const showToast = (type: 'success' | 'error', msg: string) => notificar[type](msg, { id: type === 'error' ? 'aviso-aplicacion' : undefined });

  // ── Persistencia del último ciclo seleccionado ───────────────────────────────────────
  useEffect(() => {
    if (activeCicloId) {
      try { localStorage.setItem('current_ciclo_id', activeCicloId); } catch {}
    }
  }, [activeCicloId]);

  // ── Supabase Auth: verificar sesión al montar y escuchar cambios ──────────────────────
  useEffect(() => {
    // Al recargar la página: busca sesión JWT activa
    void supabase.auth.getSession().then(async ({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        console.error('Error al recuperar la sesión:', sessionError);
        setAuthConnectionError('No se pudo conectar con el servidor de autenticación. Revisa tu conexión e inténtalo de nuevo.');
        return;
      }
      if (session?.user) {
        // Hay sesión — cargar el perfil del usuario
        const { data: perfil, error: perfilError } = await supabase
          .from('usuarios')
          .select('id, username, rol, preferencia_tema, ultimo_ciclo_id, docente_id, activo')
          .eq('auth_id', session.user.id)
          .maybeSingle();

        if (perfilError) {
          console.error('Error al cargar el perfil:', perfilError);
          setAuthConnectionError('No se pudo cargar tu perfil. Revisa la conexión y vuelve a intentarlo.');
          return;
        }

        if (perfil) {
          if (perfil.activo !== true) {
            setAuthConnectionError('Tu cuenta está inactiva. Consulta a Administración.');
            await supabase.auth.signOut({ scope: 'local' });
            return;
          }
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
    }).catch((error) => {
      console.error('Error al verificar la sesión:', error);
      setAuthConnectionError('No se pudo conectar con el servidor de autenticación. Revisa tu conexión e inténtalo de nuevo.');
    }).finally(() => setAuthChecked(true));

    // Escuchar cambios de estado (logout desde otra pestaña, expiración de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    // Global fetch error interceptor (RLS exceptions 401/403)
    let comprobandoSesion = false;
    const handleGlobalAuthError = async (event: Event) => {
      const e = event as CustomEvent;
      if (comprobandoSesion) return;
      if (e.detail?.status === 403) {
        showToast('error', 'No tienes permiso para realizar esa operación. Tu sesión permanece abierta.');
        return;
      }
      if (e.detail?.status !== 401) return;
      comprobandoSesion = true;
      try {
        // Un 401 de una RPC o integración no prueba que la sesión Auth sea inválida.
        const { error } = await supabase.auth.getUser();
        if (error && ['bad_jwt', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'user_not_found'].includes(error.code || '')) {
          showToast('error', 'Tu sesión venció. Inicia sesión nuevamente.');
          await supabase.auth.signOut({ scope: 'local' });
          setCurrentUser(null);
        } else {
          showToast('error', 'No se pudo autorizar la operación. Tu captura se conserva; revisa tus permisos o la conexión.');
        }
      } catch { showToast('error', 'No se pudo comprobar la sesión. Revisa la conexión; tu captura se conserva.'); }
      finally { comprobandoSesion = false; }
    };
    window.addEventListener('supabase-auth-error', handleGlobalAuthError);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('supabase-auth-error', handleGlobalAuthError);
    };
  }, [setCurrentUser, setActiveCicloId, setAuthChecked, fetchAllData]);

  const catalogos = buildCatalogos(catalogoItems);

  // ── Handlers con persistencia ────────────────────────────────────────────
  const handleSavePlan = async (updatedPlan: PaymentPlan): Promise<boolean> => {
    const error = await savePlan(updatedPlan);
    if (error) { showToast('error', `Error al guardar plan: ${error}`); return false; }
    setPlans(prev => prev.some(p => p.id === updatedPlan.id)
      ? prev.map(p => p.id === updatedPlan.id ? updatedPlan : p)
      : [...prev, updatedPlan]);
    await refreshPlans();
    return true;
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
    return <Login connectionError={authConnectionError} onLogin={(u) => {
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

      // Marcar como cargando ANTES de fetchAllData para evitar
      // pantalla en blanco (race condition en móvil/conexiones lentas)
      setLoading(true);
      fetchAllData();
      fetchCarreras();
    }} />;
  }

  return (
    <>
      <AppLayout>
        <AccesoRuta><Suspense fallback={<LoadingSkeleton type="table" text="Abriendo sección…" />}><Routes>
          <Route path="/plan-pagos" element={
            <PageWrapper keyStr="plan_pagos">
              <PlanPagos initialAlumnoId={navState.alumnoId || selectedAlumnoId} initialPlanId={navState.initialPlanId}
                origenComunicados={Boolean(navState.fromComunicados)}
                onSavePlan={handleSavePlan}
                onDeletePlan={(planId) => setPlans(prev => prev.filter(p => p.id !== planId))}
                onBack={() => { setSelectedAlumnoId(null); navigate(navState.fromComunicados ? '/comunicados'
                  : navState.fromCoverageReport ? '/cobertura-planes-pago' : '/', navState.fromCoverageReport
                    ? { state: { coverageFilters: navState.coverageFilters } } : undefined); }}
                onGoToPagos={(aId, cIdx, pId) => navigate('/control-ingresos', { state: { alumnoId: aId, conceptoIdx: cIdx, initialPlanId: pId, view: 'registrar', fromPlan: true, fromFicha: navState.fromFicha, fromAlumnos: navState.fromAlumnos } })}
                onViewReceipt={(folio, aId) => navigate('/control-ingresos', { state: { view: 'consultar', searchTerm: folio, fromPlan: true, alumnoId: aId, fromFicha: navState.fromFicha, fromAlumnos: navState.fromAlumnos } })}
                onBackToFicha={navState.fromFicha ? (id) => { setSelectedAlumnoId(id); navigate('/ficha-alumno', { state: { alumnoId: id, fromAlumnos: navState.fromAlumnos } }); } : undefined}
                onBackToReceipt={navState.returnFolio ? () => navigate('/control-ingresos', { state: { view: 'consultar', searchTerm: navState.returnFolio, fromPlan: true, alumnoId: selectedAlumnoId || navState.alumnoId } }) : undefined}
              />
            </PageWrapper>
          } />
          <Route path="/ficha-alumno" element={
            <PageWrapper keyStr="ficha_alumno">
              <FichaAlumno initialAlumnoId={navState.alumnoId || selectedAlumnoId}
                onBack={() => { setSelectedAlumnoId(null); navigate(navState.fromCoverageReport ? '/cobertura-planes-pago' : '/', navState.fromCoverageReport ? { state: { coverageFilters: navState.coverageFilters } } : undefined); }}
                onGoToPlan={(id, planId) => { setSelectedAlumnoId(id); navigate('/plan-pagos', { state: { alumnoId: id, initialPlanId: planId, fromFicha: true, fromAlumnos: navState.fromAlumnos } }); }}
                onBackToAlumnos={navState.fromAlumnos ? () => { setSelectedAlumnoId(null); navigate('/alumnos'); } : undefined}
                onBackToReporteEgresados={navState.fromReporteEgresados ? () => { setSelectedAlumnoId(null); navigate('/reporte-egresados'); } : undefined}
              />
            </PageWrapper>
          } />
          <Route path="/estadisticas" element={<PageWrapper keyStr="estadisticas"><Estadisticas onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/pagos-adeudos-alumnos" element={<PageWrapper keyStr="pagos-adeudos-alumnos"><PagosAdeudosAlumnos /></PageWrapper>} />
          <Route path="/cobertura-planes-pago" element={
            currentUser.rol === 'ADMINISTRADOR' || currentUser.rol === 'COORDINADOR FINANCIERO'
              ? <PageWrapper keyStr="cobertura-planes-pago"><CoberturaPlanesPago /></PageWrapper>
              : <Navigate to="/" replace />
          } />
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
          <Route path="/comunicados" element={
            currentUser.rol === 'ADMINISTRADOR' || currentUser.rol === 'COORDINADOR CONTROL ESCOLAR'
              ? <PageWrapper keyStr="comunicados"><ComunicadosEscolares /></PageWrapper>
              : <Navigate to="/" replace />
          } />
          <Route path="/estadistica-911" element={ROLES911.includes(currentUser.rol)
            ? <PageWrapper keyStr="estadistica-911"><Estadistica911 /></PageWrapper>
            : <Navigate to="/" replace />} />
          <Route path="/inscripciones" element={['ADMINISTRADOR','COORDINADOR CONTROL ESCOLAR'].includes(currentUser.rol)
            ? <PageWrapper keyStr="inscripciones"><InscripcionesCiclo /></PageWrapper>
            : <Navigate to="/" replace />} />
          <Route path="/control-escolar" element={<InicioArea area="escolar" />} />

          <Route path="/control-academico" element={<InicioArea area="academico" />} />

          <Route path="/certificacion" element={<PageWrapper keyStr="certificacion"><WizardLayoutDGAIR /></PageWrapper>} />
          <Route path="/titulacion" element={<PageWrapper keyStr="titulacion"><WizardLayoutTitulacion /></PageWrapper>} />
          <Route path="/reportes-escolares" element={<PageWrapper keyStr="reportes-escolares"><ReportesControlEscolar /></PageWrapper>} />
          <Route path="/reporte-egresados" element={<Navigate to="/reportes-escolares?vista=egresados" state={location.state} replace />} />
          <Route path="/aprobacion-prospectos" element={<PageWrapper keyStr="aprobacion_prospectos"><AprobacionProspectos /></PageWrapper>} />
          <Route path="/catalogos" element={<PageWrapper keyStr="catalogos"><CatalogosConfig onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/plantillas" element={<PageWrapper keyStr="plantillas"><PlantillasConfig onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/usuarios" element={<PageWrapper keyStr="usuarios"><UsuariosConfig onBack={() => navigate('/')} /></PageWrapper>} />
          <Route path="/configuracion-app" element={
            <PageWrapper keyStr="config_app">
              <AppConfigSettings onBack={() => navigate('/')} />
            </PageWrapper>
          } />
          <Route path="/control-ingresos/*" element={
            <PageWrapper keyStr={`control_ingresos_${navState.alumnoId || ''}_${navState.conceptoIdx || ''}_${navState.searchTerm || ''}`}>
              <ControlIngresos key={`ci_${navState.alumnoId || ''}_${navState.conceptoIdx || ''}_${navState.searchTerm || ''}`}
                onBack={() => navigate('/')}
                onBackToPlan={navState.fromPlan && navState.alumnoId
                  ? () => navigate('/plan-pagos', { state: { alumnoId: navState.alumnoId, fromFicha: navState.fromFicha, fromAlumnos: navState.fromAlumnos } })
                  : undefined}
                initialAlumnoId={navState.alumnoId}
                initialConceptIndex={navState.conceptoIdx}
                initialPlanId={navState.initialPlanId}
                initialView={location.pathname.endsWith('/consultar') ? 'consultar' : location.pathname.endsWith('/registrar') ? 'registrar' : navState.view}
                initialSearchTerm={navState.searchTerm}
                onNavigateToPlan={(alumnoId, folio, planId) => {
                  setSelectedAlumnoId(alumnoId);
                  navigate('/plan-pagos', { state: { alumnoId, returnFolio: folio, initialPlanId: planId } });
                }}
              />
            </PageWrapper>
          } />
          <Route path="/" element={['ADMINISTRADOR','COORDINADOR FINANCIERO','CAJERO'].includes(currentUser.rol)
            ? <PageWrapper keyStr="inicio-financiero"><Dashboard /></PageWrapper> : <InicioArea />} />
          {/* Rutas Placeholders para el Sidebar */}
          <Route path="/dashboard" element={<InicioArea />} />

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
          <Route path="/calendarios" element={
            currentUser.rol === 'ADMINISTRADOR' || currentUser.rol === 'COORDINADOR CONTROL ESCOLAR'
              ? <PageWrapper keyStr="calendarios"><CalendarioAcademico /></PageWrapper>
              : <Navigate to="/" replace />
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
          <Route path="/horarios" element={
            currentUser.rol === 'ADMINISTRADOR' || currentUser.rol === 'COORDINADOR ACADEMICO'
              ? <PageWrapper keyStr="horarios"><HorariosAcademicos /></PageWrapper>
              : <Navigate to="/" replace />
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
          <Route path="*" element={<PaginaNoEncontrada />} />
        </Routes></Suspense></AccesoRuta>
      </AppLayout>
    </>
  );
}
