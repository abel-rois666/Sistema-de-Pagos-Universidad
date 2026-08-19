import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, User, BarChart3, Users, GraduationCap, Calendar, AlertCircle, Wallet, ChevronDown, TrendingDown, ClipboardList } from 'lucide-react';

import { useAppStore } from '../store/useAppStore';
import { useDashboardStats } from '../hooks/useDashboardStats';
import ImportarCSV from './ImportarCSV';
import { getMaxFolioCounter } from '../utils';
import { Alumno, PaymentPlan } from '../types';

const pageVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { duration: 0.25, ease: "easeOut" }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, ciclos, alumnos, plans, setAlumnos, setPlans, activeCicloId, appConfig } = useAppStore();
  const { activeCiclo, filteredPlans, totalActivos, totalDeudores, totalAdeudoCiclo } = useDashboardStats();

  const [showImport, setShowImport] = useState(false);
  const [sectionOperaciones, setSectionOperaciones] = useState(true);
  const [sectionReportes, setSectionReportes] = useState(true);

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
  };

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

  if (!currentUser) return null;

  return (
    <motion.div key="home" initial="initial" animate="animate" exit="exit" variants={pageVariants} transition={pageVariants.transition as any} className="w-full pb-10 transition-colors duration-300 min-h-screen bg-gray-50 dark:bg-gray-950">
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
        <div className="max-w-6xl mx-auto mb-10">
          <div className="relative bg-white dark:bg-[#181e25] rounded-[20px] border border-[#d1d5db] dark:border-[rgba(255,255,255,0.12)] shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] overflow-hidden">
            
            <div className="px-5 sm:px-6 py-4 sm:py-5 bg-transparent border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div>
                  <h2 className="text-lg sm:text-[22px] font-semibold text-[#222222] dark:text-gray-100 leading-[1.10] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    👋 ¡Hola, {currentUser.username}!
                  </h2>
                  <p className="text-[14px] text-[#45515e] dark:text-[#8e8e93] mt-1.5 leading-[1.50]">
                    {dateStr} · Ciclo: <span className="font-medium text-[#222222] dark:text-gray-200">{activeCiclo?.nombre || '—'}</span>
                  </p>
                </div>
                {currentUser.rol === 'ADMINISTRADOR' && (
                  <button
                    onClick={() => setShowImport(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                  >
                    <FileText size={16} />
                    Importar CSV
                  </button>
                )}
              </div>
            </div>

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

        {/* Sección 1: Operaciones Financieras */}
        <div className="max-w-6xl mx-auto mb-6">
          <div className="relative bg-white dark:bg-[#181e25] rounded-[20px] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] overflow-hidden">
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
    </motion.div>
  );
}
