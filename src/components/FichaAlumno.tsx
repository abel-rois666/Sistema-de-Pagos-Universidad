import React, { useState } from 'react';
import { ArrowLeft, Search, User, FileText, Wallet } from 'lucide-react';
import { PaymentPlan, Alumno } from '../types';
import { calculateStudentTotals, isPaid, formatDate } from '../utils';

interface FichaAlumnoProps {
  plans: PaymentPlan[];
  alumnos?: Alumno[];
  initialAlumnoId?: string | null;
  onBack: () => void;
  onGoToPlan?: (id: string) => void;
  onBackToAlumnos?: () => void;
}

export default function FichaAlumno({ plans, alumnos = [], initialAlumnoId, onBack, onGoToPlan, onBackToAlumnos }: FichaAlumnoProps) {
  const [selectedAlumnoId, setSelectedAlumnoId] = useState<string | null>(initialAlumnoId || null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredAlumnos = alumnos.filter(a =>
    a.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSuggestionClick = (alumno: Alumno) => {
    setSelectedAlumnoId(alumno.id);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const handleClear = () => {
    setSelectedAlumnoId(null);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const selectedAlumno = alumnos.find(a => a.id === selectedAlumnoId);
  const activePlan = selectedAlumno ? plans.find(p => p.alumno_id === selectedAlumno.id || p.nombre_alumno === selectedAlumno.nombre_completo) : null;

  // ── Barra de búsqueda (JSX inline, NO sub-componente para no perder foco) ──
  const searchBarJSX = (
    <div className="relative w-full max-w-lg">
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 rounded-xl p-3 flex items-center gap-3 shadow-sm focus-within:border-blue-400 dark:focus-within:border-blue-500 transition-colors">
        <Search size={20} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <input
          type="text"
          className="w-full bg-transparent outline-none text-base dark:text-gray-100"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Buscar alumno por nombre..."
        />
        {searchTerm && (
          <button
            onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-lg leading-none"
          >✕</button>
        )}
      </div>
      {showSuggestions && searchTerm && (
        <div className="absolute z-10 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 mt-1 max-h-64 overflow-y-auto shadow-xl rounded-xl">
          {filteredAlumnos.length > 0 ? filteredAlumnos.map(a => (
            <div
              key={a.id}
              className="p-3 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
              onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(a); }}
            >
              <span className="font-semibold block">{a.nombre_completo}</span>
              <span className="text-gray-400 text-xs">{a.licenciatura} · {a.grado_actual} · {a.turno}</span>
            </div>
          )) : (
            <div className="p-4 text-sm text-gray-500 text-center">Sin coincidencias</div>
          )}
        </div>
      )}
    </div>
  );

  // ── Estado vacío (sin alumno seleccionado) ───────────────────────────────
  if (!selectedAlumno) {
    return (
      <div className="w-full font-sans">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-8">
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <button onClick={onBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white font-bold transition-colors">
              <ArrowLeft size={20} /> Volver al Inicio
            </button>
            {onBackToAlumnos && (
              <>
                <div className="hidden sm:block w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
                <button onClick={onBackToAlumnos}
                  className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-bold transition-colors shrink-0">
                  <User size={18} /> Regresar a Gestión
                </button>
              </>
            )}
          </div>

          <div className="flex flex-col items-center justify-center py-16">
            {/* Icono */}
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30">
                <User size={40} className="text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                <Search size={14} className="text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100 mb-2">Ficha del Alumno</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-center max-w-sm">
              Busca un alumno para ver su ficha financiera con el desglose completo de pagos.
            </p>
            {searchBarJSX}
            {plans.length === 0 && (
              <p className="text-sm text-gray-400 mt-6">No hay alumnos con plan de pagos en el ciclo seleccionado.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Ficha del alumno seleccionado ────────────────────────────────────────

  const renderPaymentRow = (concepto: string, fecha: string, cantidad: number, estatus: string) => {
    if (!concepto) return null;
    const paidStatus = isPaid(estatus);
    return (
      <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-100">{concepto}</td>
        <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{formatDate(fecha)}</td>
        <td className="py-3 px-4 text-gray-800 dark:text-gray-100 font-semibold">${cantidad.toLocaleString()}</td>
        <td className="py-3 px-4">
          {estatus
            ? <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded text-xs font-mono">{estatus}</span>
            : <span className="text-gray-400 dark:text-gray-500 text-xs italic">Sin registro</span>
          }
        </td>
        <td className="py-3 px-4 text-center">
          {paidStatus
            ? <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-800 px-2 py-1 rounded-full text-xs font-bold">✓ Pagado</span>
            : <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 px-2 py-1 rounded-full text-xs font-bold">✕ Adeudo</span>
          }
        </td>
      </tr>
    );
  };

  return (
    <div className="w-full font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-6 pb-8">

        {/* Header con buscador */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={onBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white font-bold transition-colors">
              <ArrowLeft size={20} /> Volver al Inicio
            </button>
            {onBackToAlumnos && (
              <>
                <div className="hidden sm:block w-px h-5 bg-gray-300 dark:bg-gray-700"></div>
                <button onClick={onBackToAlumnos}
                  className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-bold transition-colors shrink-0">
                  <User size={18} /> Regresar a Gestión
                </button>
              </>
            )}
          </div>
          {searchBarJSX}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Header del alumno — modernizado */}
          <div className="relative bg-gradient-to-br from-[#1a2f66] via-[#1e3a7a] to-[#2a4d9e] p-6 sm:p-8 text-white overflow-hidden">
            {/* Decoración de fondo */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute right-8 bottom-0 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl" />

            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              {/* Avatar + datos principales */}
              <div className="flex items-start gap-5">
                {/* Avatar circular con iniciales */}
                <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm flex items-center justify-center shadow-xl">
                  <span className="text-xl sm:text-2xl font-black text-white">
                    {selectedAlumno.nombre_completo.split(' ').slice(0, 2).map(n => n[0]).join('')}
                  </span>
                </div>

                <div className="min-w-0">
                  <h2 className="text-lg sm:text-2xl font-black text-white leading-tight">{selectedAlumno.nombre_completo}</h2>
                  {/* Status badge */}
                  <span className={`inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    selectedAlumno.estatus === 'BAJA' ? 'bg-red-900/60 border-red-600 text-red-200' :
                    selectedAlumno.estatus?.includes('EGRESADO') ? 'bg-amber-900/60 border-amber-600 text-amber-200' :
                    'bg-emerald-900/60 border-emerald-600 text-emerald-200'
                  }`}>
                    {selectedAlumno.estatus || 'ACTIVO'}
                  </span>
                  {/* Pills de información académica */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="bg-white/10 border border-white/20 backdrop-blur-sm text-white/90 text-xs px-2.5 py-1 rounded-lg font-medium">
                      {selectedAlumno.licenciatura}
                    </span>
                    <span className="bg-white/10 border border-white/20 backdrop-blur-sm text-white/90 text-xs px-2.5 py-1 rounded-lg font-medium">
                      {activePlan?.grado || selectedAlumno.grado_actual}
                    </span>
                    <span className="bg-white/10 border border-white/20 backdrop-blur-sm text-white/90 text-xs px-2.5 py-1 rounded-lg font-medium">
                      {activePlan?.turno || selectedAlumno.turno}
                    </span>
                    {selectedAlumno.beca_porcentaje && selectedAlumno.beca_porcentaje !== '0%' && (
                      <span className="bg-purple-900/60 border border-purple-600/50 text-purple-200 text-xs px-2.5 py-1 rounded-lg font-medium">
                        Beca {selectedAlumno.beca_porcentaje}
                      </span>
                    )}
                    {activePlan && (
                      <span className="bg-indigo-900/60 border border-indigo-600/50 text-indigo-200 text-xs px-2.5 py-1 rounded-lg font-medium">
                        Plan #{activePlan.no_plan_pagos}
                      </span>
                    )}
                    {/* — Badge Monedero: solo aparece si tiene saldo a favor — */}
                    {(selectedAlumno.saldo_a_favor ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-900/70 border border-emerald-500/70 text-emerald-200 text-xs px-2.5 py-1 rounded-lg font-bold shadow-lg shadow-emerald-900/40 animate-pulse-once">
                        <Wallet size={11} />
                        Monedero: ${(selectedAlumno.saldo_a_favor ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tarjeta resumen financiero */}
              {activePlan ? (
                <div className="md:ml-auto shrink-0 bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xl min-w-[200px]">
                  <p className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-3">{activePlan.ciclo_escolar}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-blue-200 font-medium mb-0.5">Pagado</p>
                      <p className="text-xl font-extrabold text-emerald-300">${calculateStudentTotals(activePlan, selectedAlumno.estatus).paid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-blue-200 font-medium mb-0.5">Adeudo</p>
                      <p className="text-xl font-extrabold text-rose-300">${calculateStudentTotals(activePlan, selectedAlumno.estatus).owed.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Barra de progreso pago */}
                  {(() => {
                    const t = calculateStudentTotals(activePlan, selectedAlumno.estatus);
                    const total = t.paid + t.owed;
                    return total > 0 ? (
                      <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all duration-700" style={{ width: `${(t.paid / total) * 100}%` }} />
                      </div>
                    ) : null;
                  })()}
                  {onGoToPlan && (
                    <button
                      onClick={() => onGoToPlan(selectedAlumno.id)}
                      className="mt-3 w-full py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 border border-white/30 text-xs shadow-sm"
                    >
                      <FileText size={13} /> Ver Plan de Pagos
                    </button>
                  )}
                </div>
              ) : (
                <div className="md:ml-auto shrink-0 bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl p-4 shadow-xl flex items-center gap-3">
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

          {/* Observaciones de Pago / Titulación */}
          {selectedAlumno.observaciones_pago_titulacion && (
            <div className="mx-8 mt-4 mb-0 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4 flex items-start gap-3">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </span>
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Observaciones de Pago / Titulación</p>
                <p className="text-sm text-amber-800 dark:text-amber-200">{selectedAlumno.observaciones_pago_titulacion}</p>
              </div>
            </div>
          )}

          {/* Tabla de pagos (si hay plan) */}
          <div className="p-8">
            {activePlan ? (
              <>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
                   <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg"><User size={18} /></span>
                   Desglose de Pagos
                </h3>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/80 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                          <th className="py-4 px-5 font-bold">Concepto</th>
                          <th className="py-4 px-5 font-bold">Fecha Límite</th>
                          <th className="py-4 px-5 font-bold">Monto</th>
                          <th className="py-4 px-5 font-bold">Recibo / Estatus</th>
                          <th className="py-4 px-5 font-bold text-center">Condición</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
                          const concepto = activePlan[`concepto_${i}` as keyof PaymentPlan] as string | undefined;
                          const fecha = activePlan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
                          const cantidad = activePlan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
                          const estatus = activePlan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
                          if (!concepto) return null;
                          return <React.Fragment key={i}>{renderPaymentRow(concepto, fecha || '', cantidad || 0, estatus || '')}</React.Fragment>;
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-full text-gray-400 mb-4 shadow-inner">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-1">Sin Registros Financieros</h3>
                <p className="text-gray-500 max-w-sm text-center text-sm">Este alumno no cuenta con un plan de pagos para el ciclo actualmente seleccionado. Ve a la sección de Alumnos para asignarle un plan.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
