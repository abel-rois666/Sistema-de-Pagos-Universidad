import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Search, User, Wallet, Edit2, Loader2, Briefcase, FileText, GraduationCap, ScrollText, ClipboardList, BookOpen } from 'lucide-react';
import type { PaymentPlan, Alumno, Usuario, Catalogos, ServicioSocial } from '../types';
import { DEFAULT_CONSTANCIA_PARAMS } from '../types';
import { calculateStudentTotals, toTitleCase } from '../utils';
import TabPagos from './tabs/TabPagos';
import TabServicioSocial from './tabs/TabServicioSocial';
import TabCertificacion from './tabs/TabCertificacion';
import TabTitulacion from './tabs/TabTitulacion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { formatGrado } from '../utils/formatUtils';
import TabDatosGenerales from './tabs/TabDatosGenerales';
import TabHistorialAcademico from './tabs/TabHistorialAcademico';
import { useFichaAlumnoLogic, type TabId, type TabDef } from '../hooks/useFichaAlumnoLogic';

// ── Tabs disponibles ────────────────────────────────────────────────────────

const TABS: TabDef[] = [
  { id: 'pagos',            label: 'Pagos',            icon: <FileText size={15} /> },
  { id: 'datos_generales',  label: 'Datos Generales',  icon: <ClipboardList size={15} /> },
  { id: 'academico',        label: 'Historial Acad.',  icon: <BookOpen size={15} /> },
  { id: 'servicio_social',  label: 'Servicio Social',  icon: <Briefcase size={15} />, adminOnly: true },
  { id: 'certificacion',    label: 'Certificación',    icon: <ScrollText size={15} />, adminOnly: true },
  { id: 'titulacion',       label: 'Titulación',       icon: <GraduationCap size={15} />, adminOnly: true },
];

// ── Props ───────────────────────────────────────────────────────────────────
interface FichaAlumnoProps {
  initialAlumnoId?: string | null;
  onBack: () => void;
  onGoToPlan?: (id: string, planId?: string) => void;
  onBackToAlumnos?: () => void;
  onBackToReporteEgresados?: () => void;
}

// ── Componente ──────────────────────────────────────────────────────────────
export default function FichaAlumno({
  initialAlumnoId, onBack, onGoToPlan, onBackToAlumnos, onBackToReporteEgresados
}: FichaAlumnoProps) {

  const {
    selectedAlumnoId, setSelectedAlumnoId,
    searchTerm, setSearchTerm,
    showSuggestions, setShowSuggestions,
    activeTab, setActiveTab,
    activePlanId, setActivePlanId,
    editingMonedero, setEditingMonedero,
    tempMonedero, setTempMonedero,
    guardandoMonedero, setGuardandoMonedero,
    showConfirmMonedero, setShowConfirmMonedero,
    empresasLocales, setEmpresasLocales,
    ssRegistros, setSsRegistros,
    certEstatus, setCertEstatus,
    isEditingEstatus, setIsEditingEstatus,
    tempEstatus, setTempEstatus,
    guardandoEstatus, setGuardandoEstatus,

    filteredAlumnos,
    selectedAlumno,
    activePlan,
    isAdmin,
    isRestrictedRole,
    visibleTabs,
    esEspecialidad,
    planesDelAlumno,
    catalogos,
    onRefreshAlumnos,
    appConfig,
    catalogoItems,
    carreras,
    alumnos,

    handleSuggestionClick,
    handleClear,
    handleSaveEstatus,
    handleUpdateMonederoClick,
    executeUpdateMonedero,
  } = useFichaAlumnoLogic(initialAlumnoId, TABS);

  // ── Barra de búsqueda (inline para no perder foco) ────────────────────────
  const searchBarJSX = (
    <div className="relative w-full max-w-lg">
      <div className="bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] rounded-[8px] p-3 flex items-center gap-3 shadow-[var(--shadow-subtle)] focus-within:border-[#3b82f6] dark:focus-within:border-[#3b82f6] transition-colors">
        <Search size={20} className="text-[#8e8e93] flex-shrink-0" />
        <input
          type="text"
          className="w-full bg-transparent outline-none text-base text-[#222222] dark:text-gray-100"
          style={{ fontFamily: 'var(--font-ui)' }}
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Buscar alumno por nombre..."
        />
        {searchTerm && (
          <button onMouseDown={e => { e.preventDefault(); handleClear(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">✕</button>
        )}
      </div>
      {showSuggestions && searchTerm && (
        <div className="absolute z-10 w-full bg-white dark:bg-[#1c2228] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] mt-1 max-h-64 overflow-y-auto shadow-[var(--shadow-elevated)] rounded-[13px]">
          {filteredAlumnos.length > 0 ? filteredAlumnos.map(a => (
            <div key={a.id}
              className="p-3 text-sm hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.06)] hover:text-[#1456f0] dark:hover:text-[#60a5fa] cursor-pointer border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] last:border-0"
              style={{ fontFamily: 'var(--font-ui)' }}
              onMouseDown={e => { e.preventDefault(); handleSuggestionClick(a); }}
            >
              <span className="font-medium text-[#222222] dark:text-gray-200 block">{toTitleCase(a.nombre_completo)}</span>
              <span className="text-[#8e8e93] text-xs">{toTitleCase(a.licenciatura)} · {formatGrado(a.grado_actual)} · {a.turno}</span>
            </div>
          )) : (
            <div className="p-4 text-sm text-gray-500 text-center">Sin coincidencias</div>
          )}
        </div>
      )}
    </div>
  );

  // ── Estado vacío ──────────────────────────────────────────────────────────
  if (!selectedAlumno) {
    return (
      <div className="w-full font-sans">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-8">
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white font-bold transition-colors">
              <ArrowLeft size={20} /> Volver al Inicio
            </button>
            {onBackToAlumnos && (
              <>
                <div className="hidden sm:block w-px h-5 bg-gray-300 dark:bg-gray-700" />
                <button onClick={onBackToAlumnos} className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-bold transition-colors shrink-0">
                  <User size={18} /> Regresar a Gestión
                </button>
              </>
            )}
          </div>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-[#1456f0] rounded-[20px] flex items-center justify-center shadow-[var(--shadow-brand)]">
                <User size={40} className="text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#2563eb] rounded-full flex items-center justify-center shadow-[var(--shadow-subtle)]">
                <Search size={14} className="text-white" />
              </div>
            </div>
            <h1 className="text-[28px] font-semibold text-[#222222] dark:text-gray-100 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Ficha del Alumno</h1>
            <p className="text-[#45515e] dark:text-[#8e8e93] mb-8 text-center max-w-sm leading-[1.50]">
              Busca un alumno para ver su ficha con el desglose de pagos y más información.
            </p>
            {searchBarJSX}
            {alumnos.length === 0 && (
              <p className="text-sm text-gray-400 mt-6">No hay alumnos con plan de pagos en el ciclo seleccionado.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Ficha con alumno seleccionado ─────────────────────────────────────────
  const totals = activePlan ? calculateStudentTotals(activePlan, selectedAlumno.estatus) : null;

  return (
    <div className="w-full font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 pb-8">

        {/* Navegación superior */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex flex-wrap items-center gap-4">
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBack(); }} 
              className="flex items-center gap-2 text-[#45515e] dark:text-gray-300 hover:text-[#222222] dark:hover:text-white font-medium transition-colors" 
              style={{ fontFamily: 'var(--font-ui)' }}
            >
              <ArrowLeft size={20} /> Volver al Inicio
            </button>
            {onBackToAlumnos && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBackToAlumnos(); }}
                className="text-xs font-bold px-3 py-1.5 bg-[#f0f4ff] dark:bg-[#1456f0]/20 text-[#1456f0] dark:text-[#60a5fa] rounded-[8px] hover:bg-[#e0e7ff] dark:hover:bg-[#1456f0]/30 transition-colors shadow-sm"
              >
                Volver a Alumnos
              </button>
            )}
            {onBackToReporteEgresados && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBackToReporteEgresados(); }}
                className="text-xs font-bold px-3 py-1.5 bg-[#f0f4ff] dark:bg-[#1456f0]/20 text-[#1456f0] dark:text-[#60a5fa] rounded-[8px] hover:bg-[#e0e7ff] dark:hover:bg-[#1456f0]/30 transition-colors shadow-sm"
              >
                Volver al Reporte
              </button>
            )}
          </div>
          {searchBarJSX}
        </div>

        {/* Card principal */}
        <div className="bg-white dark:bg-[#181e25] rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden">

          {/* ── Header oscuro del alumno ─────────────────────────────────── */}
          <div className="relative bg-[#181e25] p-6 sm:p-8 text-white overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#3b82f6]/8 rounded-full blur-3xl" />
            <div className="absolute right-8 bottom-0 w-32 h-32 bg-[#1456f0]/10 rounded-full blur-2xl" />

            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              {/* Avatar + datos */}
              <div className="flex items-start gap-5">
                <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-[13px] bg-white/15 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-[var(--shadow-brand)]">
                  <span className="text-xl sm:text-2xl font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    {selectedAlumno.nombre_completo.split(' ').slice(0, 2).map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-2xl font-semibold text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    {toTitleCase(selectedAlumno.nombre_completo)}
                  </h2>
                  {isEditingEstatus ? (
                    <div className="inline-flex items-center mt-1.5 gap-2">
                      <select
                        value={tempEstatus}
                        onChange={e => setTempEstatus(e.target.value)}
                        disabled={guardandoEstatus}
                        className="text-sm bg-white dark:bg-[#1c2228] border border-gray-300 dark:border-[rgba(255,255,255,0.2)] rounded-md px-2 py-0.5 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
                        style={{ fontFamily: 'var(--font-ui)' }}
                      >
                        {catalogos.estatus_alumnos.map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                      <button onClick={handleSaveEstatus} disabled={guardandoEstatus} className="px-2 py-0.5 bg-[#1456f0] text-white text-xs font-semibold rounded-[6px] hover:bg-blue-600 disabled:opacity-50 transition-colors">Guardar</button>
                      <button onClick={() => setIsEditingEstatus(false)} disabled={guardandoEstatus} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-[6px] hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors">Cancelar</button>
                    </div>
                  ) : (
                    <span 
                      onClick={() => { setTempEstatus(selectedAlumno.estatus || 'ACTIVO'); setIsEditingEstatus(true); }}
                      title="Haz clic para editar estatus"
                      className={`inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-[9999px] text-xs font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${
                        selectedAlumno.estatus === 'BAJA'             ? 'bg-red-900/60 border-red-600 text-red-200' :
                        selectedAlumno.estatus?.includes('EGRESADO')  ? 'bg-amber-900/60 border-amber-600 text-amber-200' :
                                                                        'bg-emerald-900/60 border-emerald-600 text-emerald-200'
                      }`}
                    >
                      {selectedAlumno.estatus || 'ACTIVO'}
                      <Edit2 size={10} className="ml-1.5 opacity-70" />
                    </span>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="bg-white/10 border border-white/20 text-white/90 text-xs px-2.5 py-1 rounded-[9999px] font-medium">{toTitleCase(selectedAlumno.licenciatura)}</span>
                    <span className="bg-white/10 border border-white/20 text-white/90 text-xs px-2.5 py-1 rounded-[9999px] font-medium">{activePlan?.grado ? formatGrado(activePlan.grado) : formatGrado(selectedAlumno.grado_actual)}</span>
                    <span className="bg-white/10 border border-white/20 text-white/90 text-xs px-2.5 py-1 rounded-[9999px] font-medium">{activePlan?.turno || selectedAlumno.turno}</span>
                    {selectedAlumno.beca_porcentaje && selectedAlumno.beca_porcentaje !== '0%' && (
                      <span className="bg-[#1456f0]/30 border border-[#3b82f6]/50 text-blue-200 text-xs px-2.5 py-1 rounded-[9999px] font-medium">Beca {selectedAlumno.beca_porcentaje}</span>
                    )}
                    {activePlan && (
                      <span className="bg-[#3b82f6]/30 border border-[#60a5fa]/50 text-blue-200 text-xs px-2.5 py-1 rounded-[9999px] font-medium">Plan #{activePlan.no_plan_pagos}</span>
                    )}
                    {/* Monedero */}
                    {((selectedAlumno.saldo_a_favor ?? 0) > 0 || isAdmin) && (
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1.5 border text-xs px-2.5 py-1 rounded-[9999px] font-semibold shadow-lg ${
                          (selectedAlumno.saldo_a_favor ?? 0) > 0
                            ? 'bg-emerald-900/70 border-emerald-500/70 text-emerald-200 shadow-emerald-900/40'
                            : 'bg-white/5 border-white/20 text-white/50 backdrop-blur-sm'
                        }`}>
                          <Wallet size={11} />
                          Monedero: ${(selectedAlumno.saldo_a_favor ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                        </span>
                        {isAdmin && (
                          <button onClick={() => { setTempMonedero((selectedAlumno.saldo_a_favor || 0).toString()); setEditingMonedero(true); }}
                            className="p-1 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/20 rounded-[8px] border border-white/10" title="Ajustar Monedero (Admin)">
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Mini-card financiero */}
              {activePlan && totals ? (
                <div className="md:ml-auto shrink-0 bg-white/8 border border-white/15 backdrop-blur-md rounded-[20px] p-4 sm:p-5 shadow-[var(--shadow-brand)] min-w-[200px]">
                  <p className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider mb-3">{activePlan.ciclo_escolar}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-blue-200 font-medium mb-0.5">Pagado</p>
                      <p className="text-xl font-semibold text-emerald-300" style={{ fontFamily: 'var(--font-data)' }}>${totals.paid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-blue-200 font-medium mb-0.5">Adeudo</p>
                      <p className="text-xl font-semibold text-rose-300" style={{ fontFamily: 'var(--font-data)' }}>${totals.owed.toLocaleString()}</p>
                    </div>
                  </div>
                  {(totals.paid + totals.owed) > 0 && (
                    <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-[#3b82f6] rounded-full transition-all duration-700" style={{ width: `${(totals.paid / (totals.paid + totals.owed)) * 100}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="md:ml-auto shrink-0 bg-white/8 border border-white/15 backdrop-blur-md rounded-[20px] p-4 shadow-[var(--shadow-brand)] flex items-center gap-3">
                  <div className="bg-amber-400/20 text-amber-200 p-2 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-base leading-tight">Sin Plan Activo</p>
                    <p className="text-xs text-blue-200 mt-0.5">No inscrito en el ciclo.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Barra de tabs ────────────────────────────────────────────── */}
          {visibleTabs.length > 1 && (
            <div className="flex border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-[#f8f9ff] dark:bg-[#1c2228] px-6 overflow-x-auto">
              {visibleTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                    activeTab === tab.id
                      ? tab.id === 'servicio_social'
                        ? 'border-purple-500 text-purple-700 dark:text-purple-400'
                        : tab.id === 'titulacion'
                          ? 'border-indigo-500 text-indigo-700 dark:text-indigo-400'
                          : 'border-[#1456f0] text-[#1456f0] dark:text-[#60a5fa]'
                      : 'border-transparent text-[#8e8e93] hover:text-[#45515e] dark:hover:text-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Contenido del tab activo ──────────────────────────────────── */}
          {activeTab === 'pagos' && (
            <TabPagos
              alumno={selectedAlumno}
              activePlan={activePlan}
              allPlans={planesDelAlumno}
              onGoToPlan={onGoToPlan}
              onPlanChange={setActivePlanId}
            />
          )}
          {activeTab === 'datos_generales' && (
            <TabDatosGenerales
              alumno={selectedAlumno}
              isAdmin={isAdmin}
              onAlumnoUpdated={() => onRefreshAlumnos?.()}
            />
          )}
          {activeTab === 'academico' && (
            <TabHistorialAcademico alumno={selectedAlumno} />
          )}
          {activeTab === 'servicio_social' && isAdmin && (
            <TabServicioSocial
              alumnoId={selectedAlumno.id}
              alumno={selectedAlumno}
              appConfig={appConfig ?? { title: '', logoUrl: '', directorNombre: 'LIC. ARTURO RODRIGUEZ ISLAS', directorCargo: 'DIRECTOR DE CONTROL ESCOLAR', constanciaParams: DEFAULT_CONSTANCIA_PARAMS }}
              catalogoItems={catalogoItems}
              isAdmin={isAdmin}
              empresasCatalogo={empresasLocales}
              onEmpresaAgregada={emp => setEmpresasLocales(prev => prev.includes(emp) ? prev : [...prev, emp])}
              onRegistrosChange={setSsRegistros}
            />
          )}
          {activeTab === 'certificacion' && isAdmin && (
            <TabCertificacion
              alumnoId={selectedAlumno.id}
              esEspecialidad={esEspecialidad}
              onEstatusChange={setCertEstatus}
              onUpdate={() => onRefreshAlumnos?.()}
            />
          )}
          {activeTab === 'titulacion' && isAdmin && (
            <TabTitulacion
              alumnoId={selectedAlumno.id}
              esEspecialidad={esEspecialidad}
              modalidadesCatalogo={catalogos?.modalidades_titulacion ?? []}
              servicioSocialRegistros={ssRegistros}
              planesAlumno={planesDelAlumno}
              certificacionEstatus={certEstatus}
            />
          )}

        </div>{/* fin card */}
      </div>

      {/* ── Modal Monedero (admin) ────────────────────────────────────────── */}
      {editingMonedero && selectedAlumno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1c2228] rounded-[24px] p-6 w-full max-w-sm shadow-[var(--shadow-brand)] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-3 mb-4 text-emerald-600 dark:text-emerald-400">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-[8px]"><Wallet size={24} /></div>
              <h3 className="font-semibold text-lg text-[#222222] dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>Ajustar Monedero</h3>
            </div>
            <p className="text-sm text-[#45515e] dark:text-[#8e8e93] mb-4 leading-[1.50]">
              Ajusta el saldo a favor de <strong className="text-[#222222] dark:text-gray-300">{toTitleCase(selectedAlumno.nombre_completo)}</strong> de forma silenciosa. Esta acción administrativa no genera recibo.
            </p>
            <div className="mb-2 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-gray-500 font-bold">$</span></div>
              <input type="number"
                className="w-full pl-8 pr-4 py-3 bg-white dark:bg-[#181e25] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] rounded-[8px] outline-none focus:ring-2 focus:ring-[#3b82f6] font-semibold text-[#222222] dark:text-white transition-shadow"
                value={tempMonedero} onChange={e => setTempMonedero(e.target.value)} min="0" step="0.01" placeholder="0.00" disabled={showConfirmMonedero}
              />
            </div>
            {!showConfirmMonedero ? (
              <div className="flex items-center justify-end gap-3 pt-4">
                <button disabled={guardandoMonedero} onClick={() => setEditingMonedero(false)} className="px-4 py-2 font-medium text-[#45515e] dark:text-gray-400 hover:bg-[#f0f0f0] dark:hover:bg-[rgba(255,255,255,0.08)] rounded-[8px] transition-colors">Cancelar</button>
                <button onClick={handleUpdateMonederoClick} className="flex items-center gap-2 px-5 py-2 font-medium text-white bg-[#181e25] hover:bg-[#222222] rounded-[8px] shadow-[var(--shadow-subtle)] transition-colors">Guardar Ajuste</button>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-[13px]">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-2 flex items-center gap-2"><span>⚠️</span> Confirmar Ajuste</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mb-4 leading-relaxed">
                  ¿Estás seguro de establecer el monedero en <strong>${parseFloat(tempMonedero).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>? Esta acción actualizará la BD sin generar notas contables automáticas.
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowConfirmMonedero(false)} className="px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 rounded-[8px] transition-colors">Verificar</button>
                  <button onClick={executeUpdateMonedero} disabled={guardandoMonedero} className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-[#181e25] hover:bg-[#222222] rounded-[8px] shadow-[var(--shadow-subtle)] disabled:opacity-50 transition-all active:scale-95">
                    {guardandoMonedero ? <Loader2 size={14} className="animate-spin" /> : 'Sí, confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
