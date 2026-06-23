import { useState, useEffect, useMemo, ReactNode, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, User, BarChart3, Users, Settings, GraduationCap, Calendar, BookOpen, Upload, Download, CheckCircle, AlertCircle, Shield, Wallet, ChevronDown, TrendingDown, ClipboardList, LayoutDashboard, Briefcase } from 'lucide-react';
import { supabase, savePlan, bulkSaveAlumnos, bulkSavePlanes, saveAlumno, deleteAlumno, saveCiclo, deleteCiclo, saveCatalogoItem, deleteCatalogoItem, savePlantilla, deletePlantilla, getAppConfig, updateUserPreferences, fetchAllSupabase } from './lib/supabase';
import { PaymentPlan, CicloEscolar, Alumno, CatalogoItem, Catalogos, PlantillaPlan, AppConfig } from './types';
import { MOCK_DATA, MOCK_CICLOS, MOCK_ALUMNOS } from './data';
import { CSV_HEADERS, generateCSV, downloadCSV, getMaxFolioCounter, getCyclePrefix, isPaid, getRestanteFromEstatus } from './utils';
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
  <motion.div key={keyStr} initial="initial" animate="animate" exit="exit" variants={pageVariants} transition={pageVariants.transition as any} className={className || "min-h-screen bg-gray-50 dark:bg-gray-950"}>
    {children}
  </motion.div>
);

export default function App() {
  const {
    currentUser, authChecked, loading,
    plans, ciclos, alumnos, plantillas, catalogoItems, appConfig, activeCicloId,
    setCurrentUser, setAuthChecked, setActiveCicloId, setLoading,
    fetchAllData, refreshAfterPayment,
    setPlans, setAlumnos, setCiclos, setPlantillas, setCatalogoItems, setAppConfig
  } = useAppStore();

  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as any;
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(navState.alumnoId || null);
  const [showImport, setShowImport] = useState(false);
  const [sectionOperaciones, setSectionOperaciones] = useState(true);
  const [sectionReportes, setSectionReportes] = useState(true);

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
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const filteredPlans = plans.filter(p => p.ciclo_id === activeCicloId || p.ciclo_escolar === activeCiclo?.nombre);

  const totalActivos = alumnos.filter(a => a.estatus === 'ACTIVO').length;
  // Solo cuenta alumnos con AL MENOS UN pago vencido a la fecha de hoy (no pagos futuros)
  const totalDeudores = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const parsePaymentDate = (dStr: string): Date | null => {
      if (!dStr) return null;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
        const [d, m, y] = dStr.split('/');
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        const [y, m, d] = dStr.split('-');
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      return null;
    };
    return filteredPlans.filter(p => {
      const alumno = alumnos.find(a => a.id === p.alumno_id || a.nombre_completo === p.nombre_alumno);
      if (alumno?.estatus === 'BAJA') return false;
      for (let i = 1; i <= 9; i++) {
        const estatus = p[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha = p[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (estatus !== 'PENDIENTE' || !fecha) continue;
        const d = parsePaymentDate(fecha);
        if (d && d <= today) return true;
      }
      return false;
    }).length;
  }, [filteredPlans, alumnos]);

  // Suma del adeudo vencido hasta hoy (fecha_limite <= hoy, excluye pagos futuros)
  const totalAdeudoCiclo = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const parseDate = (dStr: string): Date | null => {
      if (!dStr) return null;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
        const [d, m, y] = dStr.split('/');
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        const [y, m, d] = dStr.split('-');
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
      return null;
    };
    let total = 0;
    filteredPlans.forEach(plan => {
      const alumno = alumnos.find(a => a.id === plan.alumno_id || a.nombre_completo === plan.nombre_alumno);
      if (alumno?.estatus === 'BAJA') return;
      for (let i = 1; i <= 9; i++) {
        const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
        const estatus  = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha    = plan[`fecha_${i}`   as keyof PaymentPlan] as string | undefined;
        if (cantidad && estatus && fecha && !isPaid(estatus)) {
          const fechaDate = parseDate(fecha);
          // Solo sumar si la fecha ya venció (hasta hoy)
          if (fechaDate && fechaDate <= today) {
            total += getRestanteFromEstatus(estatus, Number(cantidad));
          }
        }
      }
    });
    return total;
  }, [filteredPlans, alumnos]);

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
    }} />;
  }

  const isRestrictedRole = currentUser.rol === 'COORDINADOR' || currentUser.rol === 'CAJERO';


    const handleExportCSV = () => {
      if (filteredPlans.length === 0) {
        showToast('error', 'No hay planes para exportar en este ciclo.');
        return;
      }
      const rows = filteredPlans.map(p => {
        const a = alumnos.find(al => al.id === p.alumno_id);
        return [
          p.nombre_alumno || (a ? a.nombre_completo : ''),
          a?.apellido_paterno || '',
          a?.apellido_materno || '',
          a?.nombres || '',
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
          String(a?.saldo_a_favor ?? ''),
          a?.observaciones_pago_titulacion || '',
          ...Array.from({ length: 9 }, (_, i) => {
             const id = i + 1;
             return [
               p[`concepto_${id}` as keyof PaymentPlan] as string || '',
               p[`fecha_${id}` as keyof PaymentPlan] as string || '',
               String(p[`cantidad_${id}` as keyof PaymentPlan] || ''),
               p[`estatus_${id}` as keyof PaymentPlan] as string || ''
             ];
          }).flat()
        ];
      });

      const csvContent = generateCSV(CSV_HEADERS, rows);
      downloadCSV(csvContent, `planes_${activeCiclo?.nombre || 'ciclo'}.csv`);
    };

    const homePageContent = (
      <PageWrapper keyStr="home" className="w-full pb-10 transition-colors duration-300">
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





          {/* ── Dashboard de vistazo rápido ── */}
          {(() => {
            const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
            const now = new Date();
            const dateStr = `${dayNames[now.getDay()]}, ${now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`;
            const statCards = [
              {
                label: 'Alumnos Activos',
                value: totalActivos.toLocaleString(),
                icon: <GraduationCap size={22} />,
                from: 'from-blue-500', to: 'to-indigo-600',
                glow: 'group-hover:shadow-blue-500/40',
                textColor: 'text-blue-600 dark:text-blue-400',
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                border: 'border-blue-100 dark:border-blue-800',
                sub: 'del ciclo activo',
              },
              {
                label: 'Adeudo del Ciclo',
                value: `$${totalAdeudoCiclo.toLocaleString()}`,
                icon: <TrendingDown size={22} />,
                from: 'from-rose-500', to: 'to-red-600',
                glow: 'group-hover:shadow-rose-500/40',
                textColor: 'text-rose-600 dark:text-rose-400',
                bg: 'bg-rose-50 dark:bg-rose-900/20',
                border: 'border-rose-100 dark:border-rose-800',
                sub: 'vencido hasta hoy',
              },
              {
                label: 'Alumnos Deudores',
                value: totalDeudores.toLocaleString(),
                icon: <AlertCircle size={22} />,
                from: 'from-amber-500', to: 'to-orange-600',
                glow: 'group-hover:shadow-amber-500/40',
                textColor: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-50 dark:bg-amber-900/20',
                border: 'border-amber-100 dark:border-amber-800',
                sub: 'con pagos vencidos a hoy',
              },
              {
                label: 'Planes del Ciclo',
                value: filteredPlans.length.toLocaleString(),
                icon: <ClipboardList size={22} />,
                from: 'from-emerald-500', to: 'to-teal-600',
                glow: 'group-hover:shadow-emerald-500/40',
                textColor: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                border: 'border-emerald-100 dark:border-emerald-800',
                sub: 'registrados',
              },
            ];
            return (
              <div className="max-w-6xl mx-auto mb-10">
                {/* Saludo + Stat Cards dentro de una tarjeta */}
                <div className="relative bg-white dark:bg-[#181e25] rounded-[20px] border border-[#d1d5db] dark:border-[rgba(255,255,255,0.12)] shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] overflow-hidden">
                  
                  {/* Card Header */}
                  <div className="px-5 sm:px-6 py-4 sm:py-5 bg-transparent border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] relative overflow-hidden">
                    <h2 className="text-lg sm:text-[22px] font-semibold text-[#222222] dark:text-gray-100 leading-[1.10] tracking-tight relative z-10" style={{ fontFamily: 'var(--font-display)' }}>
                      👋 ¡Hola, {currentUser.username}!
                    </h2>
                    <p className="text-[14px] text-[#45515e] dark:text-[#8e8e93] mt-1.5 leading-[1.50] relative z-10">
                      {dateStr} · Ciclo: <span className="font-medium text-[#222222] dark:text-gray-200">{activeCiclo?.nombre || '—'}</span>
                    </p>
                  </div>

                  {/* Card Content (Stat Cards en fondo blanco puro) */}
                  {currentUser.rol !== 'CAJERO' && (
                    <div className="px-5 sm:px-6 py-5 sm:py-6 relative">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 relative z-10">
                        {statCards.map((card, idx) => (
                          <div
                            key={card.label}
                            className={`card-interactive group relative flex flex-col gap-2 p-4 rounded-[20px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#1c2228] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1 transition-all duration-300`}
                            onMouseMove={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                              e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                            }}
                            style={{ animationDelay: `${idx * 80}ms` }}
                          >
                            <div className={`absolute -right-4 -top-4 w-20 h-20 bg-[#3b82f6] opacity-[0.06] rounded-full blur-2xl group-hover:opacity-[0.15] transition-opacity duration-500`} />
                            <div className={`w-9 h-9 rounded-[13px] bg-[#1456f0] dark:bg-[#3b82f6] flex items-center justify-center text-white shadow-[var(--shadow-subtle)] group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                              {card.icon}
                            </div>
                            <div>
                              <div className="text-xl font-semibold text-[#222222] dark:text-gray-100 leading-tight stat-value-enter" style={{ animationDelay: `${idx * 80 + 100}ms` }}>{card.value}</div>
                              <div className="text-[13px] font-medium text-[#45515e] dark:text-gray-300 mt-0.5">{card.label}</div>
                              <div className="text-[10px] text-[#8e8e93] dark:text-gray-500 line-clamp-1">{card.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Sección 1: Operaciones Financieras */}
          <div className="max-w-6xl mx-auto mb-6">
            <div className="relative bg-white dark:bg-[#181e25] rounded-[20px] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] overflow-hidden">
              {/* Card Header — clickeable para colapsar */}
              <button
                onClick={() => setSectionOperaciones(p => !p)}
                className={`w-full flex items-center justify-between px-5 sm:px-6 py-4 bg-[#eef2ff] dark:bg-[rgba(255,255,255,0.04)] hover:bg-[#e8eeff] dark:hover:bg-[rgba(255,255,255,0.06)] transition-colors ${sectionOperaciones ? 'border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]' : ''}`}
              >
                <span className="flex items-center gap-2.5 text-base font-semibold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-mid)' }}>
                  <Wallet size={18} className="text-[#1456f0]" /> Operaciones Financieras
                </span>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 transition-transform duration-300 ${sectionOperaciones ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Contenido colapsable */}
              <AnimatePresence initial={false}>
                {sectionOperaciones && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] px-5 sm:px-6 pb-5 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tarjeta 1: Plan de Pagos */}
                        <button
                          onClick={() => navigate('/plan-pagos')}
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                            e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                          }}
                          className="card-interactive bg-white dark:bg-[#1c2228] p-6 rounded-[20px] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1.5 transition-all duration-300 group text-left flex flex-col items-start border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] relative"
                        >
                          <div className="bg-[#1456f0] p-4 rounded-[13px] text-white mb-4 group-hover:scale-110 group-hover:rotate-2 shadow-[var(--shadow-subtle)] group-hover:shadow-[var(--shadow-brand)] transition-all duration-300">
                            <FileText size={28} />
                          </div>
                          <h2 className="text-[20px] font-semibold text-[#18181b] dark:text-gray-100 mb-2 group-hover:text-[#1456f0] dark:group-hover:text-[#60a5fa] transition-colors" style={{ fontFamily: 'var(--font-display)' }}>Plan de Pagos</h2>
                          <p className="text-[14px] text-[#45515e] dark:text-[#8e8e93] leading-[1.50]">Visualiza y edita el plan detallado por alumno para el ciclo en curso.</p>
                        </button>

                        {/* Tarjeta 2: Control de Ingresos */}
                        <button
                          onClick={() => navigate('/control-ingresos')}
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                            e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                          }}
                          className="card-interactive bg-white dark:bg-[#1c2228] p-6 rounded-[20px] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1.5 transition-all duration-300 group text-left flex flex-col items-start border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] relative"
                        >
                          <div className="bg-[#2563eb] p-4 rounded-[13px] text-white mb-4 group-hover:scale-110 group-hover:rotate-2 shadow-[var(--shadow-subtle)] group-hover:shadow-[var(--shadow-brand)] transition-all duration-300">
                            <Wallet size={28} />
                          </div>
                          <h2 className="text-[20px] font-semibold text-[#18181b] dark:text-gray-100 mb-2 group-hover:text-[#1456f0] dark:group-hover:text-[#60a5fa] transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                            {currentUser.rol === 'CAJERO' ? 'Registrar Cobro' : 'Control de Ingresos'}
                          </h2>
                          <p className="text-[14px] text-[#45515e] dark:text-[#8e8e93] leading-[1.50]">
                            {currentUser.rol === 'CAJERO' ? 'Registra cobros y emite comprobantes adicionales.' : 'Registra cobros, emite comprobantes y consulta el historial de pagos.'}
                          </p>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Sección 2: Consultas y Reportes */}
          <div className="max-w-6xl mx-auto mb-6">
            <div className="relative bg-white dark:bg-[#181e25] rounded-[20px] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] overflow-hidden">
              {/* Card Header — clickeable para colapsar */}
              <button
                onClick={() => setSectionReportes(p => !p)}
                className={`w-full flex items-center justify-between px-5 sm:px-6 py-4 bg-[#eef2ff] dark:bg-[rgba(255,255,255,0.04)] hover:bg-[#e8eeff] dark:hover:bg-[rgba(255,255,255,0.06)] transition-colors ${sectionReportes ? 'border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]' : ''}`}
              >
                <span className="flex items-center gap-2.5 text-base font-semibold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-mid)' }}>
                  <BarChart3 size={18} className="text-[#1456f0]" /> Consultas y Reportes
                </span>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 transition-transform duration-300 ${sectionReportes ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Contenido colapsable */}
              <AnimatePresence initial={false}>
                {sectionReportes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] px-5 sm:px-6 pb-5 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        <button
                          onClick={() => navigate('/ficha-alumno')}
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                            e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                          }}
                          className="card-interactive bg-white dark:bg-[#1c2228] p-6 rounded-[20px] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1.5 transition-all duration-300 group text-left flex flex-col items-start border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] relative"
                        >
                          <div className="bg-[#1456f0] p-3 rounded-[13px] text-white mb-4 group-hover:scale-110 group-hover:rotate-2 shadow-[var(--shadow-subtle)] group-hover:shadow-[var(--shadow-brand)] transition-all duration-300">
                            <User size={24} />
                          </div>
                          <h2 className="text-[18px] font-semibold text-[#18181b] dark:text-gray-100 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Ficha del Alumno</h2>
                          <p className="text-[13px] text-[#45515e] dark:text-[#8e8e93] leading-[1.50]">Resumen compacto del estado financiero y becas.</p>
                        </button>

                        {currentUser.rol !== 'CAJERO' && (
                          <button
                            onClick={() => navigate('/estadisticas')}
                            onMouseMove={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                              e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                            }}
                            className="card-interactive bg-white dark:bg-[#1c2228] p-6 rounded-[20px] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1.5 transition-all duration-300 group text-left flex flex-col items-start border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] relative"
                          >
                            <div className="bg-[#3b82f6] p-3 rounded-[13px] text-white mb-4 group-hover:scale-110 group-hover:rotate-2 shadow-[var(--shadow-subtle)] group-hover:shadow-[var(--shadow-brand)] transition-all duration-300">
                              <BarChart3 size={24} />
                            </div>
                            <h2 className="text-[18px] font-semibold text-[#18181b] dark:text-gray-100 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Estadísticas</h2>
                            <p className="text-[13px] text-[#45515e] dark:text-[#8e8e93] leading-[1.50]">Análisis mensual de ingresos y deudas totales por ciclo.</p>
                          </button>
                        )}

                        {currentUser.rol !== 'CAJERO' && (
                          <button
                            onClick={() => navigate('/deudores')}
                            onMouseMove={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                              e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                            }}
                            className="card-interactive bg-white dark:bg-[#1c2228] p-6 rounded-[20px] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1.5 transition-all duration-300 group text-left flex flex-col items-start border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] relative"
                          >
                            <div className="bg-[#1d4ed8] p-3 rounded-[13px] text-white mb-4 group-hover:scale-110 group-hover:rotate-2 shadow-[var(--shadow-subtle)] group-hover:shadow-[var(--shadow-brand)] transition-all duration-300">
                              <Users size={24} />
                            </div>
                            <h2 className="text-[18px] font-semibold text-[#18181b] dark:text-gray-100 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Deudores</h2>
                            <p className="text-[13px] text-[#45515e] dark:text-[#8e8e93] leading-[1.50]">Directorio de alumnos con pagos pendientes y retrasos.</p>
                            {totalDeudores > 0 && (
                              <div className="absolute top-4 right-4 bg-[#bfdbfe] text-[#1456f0] dark:bg-[#1d4ed8]/30 dark:text-[#60a5fa] text-xs font-semibold px-2 py-1 rounded-[9999px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] flex items-center gap-1">
                                 <AlertCircle size={10} /> {totalDeudores}
                              </div>
                            )}
                          </button>
                        )}

                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <footer className="max-w-6xl mx-auto mt-10 pt-6 pb-4 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Logo + Nombre */}
              <div className="flex items-center gap-2.5 opacity-40 hover:opacity-60 transition-opacity cursor-default">
                {appConfig?.logoUrl ? (
                  <img src={appConfig.logoUrl} alt="" className="h-5 w-auto grayscale" />
                ) : (
                  <div className="w-5 h-5 bg-[#181e25] dark:bg-[#3b82f6] rounded-[4px] flex items-center justify-center text-white text-[10px] font-semibold">U</div>
                )}
                <span className="text-[12px] font-medium text-[#8e8e93] dark:text-[#8e8e93]">
                  {appConfig?.title || 'Sistema de Control de Pagos'}
                </span>
              </div>

              {/* Centro: ciclo activo */}
              <div className="flex items-center gap-1.5 text-[11px] text-[#8e8e93] dark:text-[#8e8e93]">
                <Calendar size={11} />
                <span>Ciclo activo: <span className="font-semibold">{activeCiclo?.nombre || '—'}</span></span>
              </div>

              {/* Versión + Año */}
              <div className="text-[11px] text-[#8e8e93] dark:text-[#8e8e93] font-medium">
                v1.0.0 &nbsp;&middot;&nbsp; &copy; {new Date().getFullYear()}
              </div>
            </div>
          </footer>

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
          <Route path="/" element={homePageContent} />
          {/* Rutas Placeholders para el Sidebar */}
          <Route path="/dashboard" element={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <LayoutDashboard size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                <h2 className="text-2xl font-bold text-gray-500 dark:text-gray-400">Dashboard General</h2>
                <p className="text-gray-400 dark:text-gray-500 mt-2">Próximamente...</p>
              </div>
            </div>
          } />
          <Route path="/academico" element={
            <PageWrapper keyStr="academico">
              <ControlAcademico />
            </PageWrapper>
          } />
          <Route path="/rh" element={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Briefcase size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                <h2 className="text-2xl font-bold text-gray-500 dark:text-gray-400">Recursos Humanos</h2>
                <p className="text-gray-400 dark:text-gray-500 mt-2">En construcción...</p>
              </div>
            </div>
          } />
          <Route path="*" element={homePageContent} />
        </Routes>
      </AppLayout>
    </>
  );
}
