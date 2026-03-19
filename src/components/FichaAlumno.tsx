import React, { useState } from 'react';
import { ArrowLeft, Search, User } from 'lucide-react';
import { PaymentPlan, Alumno } from '../types';
import { calculateStudentTotals, isPaid, formatDate } from '../utils';

interface FichaAlumnoProps {
  plans: PaymentPlan[];
  alumnos?: Alumno[];
  initialAlumnoId?: string | null;
  onBack: () => void;
}

export default function FichaAlumno({ plans, alumnos = [], initialAlumnoId, onBack }: FichaAlumnoProps) {
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
      <div className="bg-white border-2 border-gray-300 rounded-xl p-3 flex items-center gap-3 shadow-sm focus-within:border-blue-400 transition-colors">
        <Search size={20} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          className="w-full bg-transparent outline-none text-base"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Buscar alumno por nombre..."
        />
        {searchTerm && (
          <button
            onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >✕</button>
        )}
      </div>
      {showSuggestions && searchTerm && (
        <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 max-h-64 overflow-y-auto shadow-xl rounded-xl">
          {filteredAlumnos.length > 0 ? filteredAlumnos.map(a => (
            <div
              key={a.id}
              className="p-3 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-b border-gray-100 last:border-0"
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
      <div className="min-h-screen bg-gray-50 font-sans">
        <div className="max-w-5xl mx-auto px-8 pt-8">
          <button onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors mb-12">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>

          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-blue-50 p-5 rounded-full text-blue-400 mb-6">
              <User size={48} />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Ficha del Alumno</h1>
            <p className="text-gray-500 mb-8 text-center max-w-sm">
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
      <tr className="border-b border-gray-200 hover:bg-gray-50">
        <td className="py-3 px-4 font-medium text-gray-800">{concepto}</td>
        <td className="py-3 px-4 text-gray-600">{formatDate(fecha)}</td>
        <td className="py-3 px-4 text-gray-800 font-semibold">${cantidad.toLocaleString()}</td>
        <td className="py-3 px-4">
          {estatus
            ? <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono">{estatus}</span>
            : <span className="text-gray-400 text-xs italic">Sin registro</span>
          }
        </td>
        <td className="py-3 px-4 text-center">
          {paidStatus
            ? <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-bold">✓ Pagado</span>
            : <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-bold">✕ Adeudo</span>
          }
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Header con buscador */}
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <button onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
          {searchBarJSX}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header del alumno */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold mb-3">{selectedAlumno.nombre_completo}</h1>
              <div className="flex flex-wrap gap-2 text-blue-100 text-sm">
                <span className="bg-blue-900/60 px-3 py-1 rounded-full border border-blue-700/50 shadow-sm backdrop-blur-sm">Licenciatura: {selectedAlumno.licenciatura}</span>
                <span className="bg-blue-900/60 px-3 py-1 rounded-full border border-blue-700/50 shadow-sm backdrop-blur-sm">Grado: {selectedAlumno.grado_actual}</span>
                <span className="bg-blue-900/60 px-3 py-1 rounded-full border border-blue-700/50 shadow-sm backdrop-blur-sm">Turno: {selectedAlumno.turno}</span>
                <span className={`px-3 py-1 rounded-full border shadow-sm backdrop-blur-sm font-semibold
                  ${selectedAlumno.estatus === 'BAJA' ? 'bg-red-900/60 border-red-700 text-red-100' : 
                    selectedAlumno.estatus === 'EGRESADO' ? 'bg-amber-900/60 border-amber-700 text-amber-100' : 
                    'bg-emerald-900/60 border-emerald-700 text-emerald-100'}`}>
                  Estatus: {selectedAlumno.estatus || 'ACTIVO'}
                </span>
                {selectedAlumno.beca_porcentaje && selectedAlumno.beca_porcentaje !== '0%' && (
                  <span className="bg-purple-900/60 px-3 py-1 rounded-full border border-purple-700/50 shadow-sm backdrop-blur-sm text-purple-100">
                    Beca: {selectedAlumno.beca_porcentaje} ({selectedAlumno.beca_tipo})
                  </span>
                )}
                {activePlan && (
                   <span className="bg-indigo-900/60 text-indigo-100 px-3 py-1 rounded-full border border-indigo-700/50 shadow-sm backdrop-blur-sm">No. Plan: {activePlan.no_plan_pagos}</span>
                )}
              </div>
            </div>
            
            {activePlan ? (
              <div className="bg-white/10 p-5 rounded-2xl border border-white/20 backdrop-blur-md shrink-0 flex items-center justify-between md:flex-col gap-4 shadow-xl">
                 <div className="text-center">
                    <p className="text-blue-100 text-sm font-medium mb-1 drop-shadow">Ciclo Escolar</p>
                    <p className="text-xl font-bold tracking-tight">{activePlan.ciclo_escolar}</p>
                 </div>
                 <div className="w-px h-10 bg-white/20 md:w-full md:h-px"></div>
                 <div className="flex gap-6">
                    <div className="text-center">
                       <p className="text-blue-100 text-sm font-medium mb-1 drop-shadow">Pagado</p>
                       <p className="text-xl font-bold text-emerald-300 drop-shadow-sm">${calculateStudentTotals(activePlan, selectedAlumno.estatus).paid.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                       <p className="text-blue-100 text-sm font-medium mb-1 drop-shadow">Adeudo</p>
                       <p className="text-xl font-bold text-red-300 drop-shadow-sm">${calculateStudentTotals(activePlan, selectedAlumno.estatus).owed.toLocaleString()}</p>
                    </div>
                 </div>
              </div>
            ) : (
              <div className="bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm shrink-0 flex items-center gap-3">
                 <div className="bg-amber-400/20 text-amber-200 p-2 rounded-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                 </div>
                 <div>
                    <p className="font-bold text-lg leading-tight">Sin Plan Activo</p>
                    <p className="text-sm text-blue-100 opacity-90">El alumno no está inscrito en el ciclo.</p>
                 </div>
              </div>
            )}
          </div>

          {/* Tabla de pagos (si hay plan) */}
          <div className="p-8">
            {activePlan ? (
              <>
                <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
                   <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg"><User size={18} /></span>
                   Desglose de Pagos
                </h3>
                <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                          <th className="py-4 px-5 font-bold">Concepto</th>
                          <th className="py-4 px-5 font-bold">Fecha Límite</th>
                          <th className="py-4 px-5 font-bold">Monto</th>
                          <th className="py-4 px-5 font-bold">Recibo / Estatus</th>
                          <th className="py-4 px-5 font-bold text-center">Condición</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
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
              <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <div className="bg-gray-200 p-4 rounded-full text-gray-400 mb-4 shadow-inner">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-1">Sin Registros Financieros</h3>
                <p className="text-gray-500 max-w-sm text-center text-sm">Este alumno no cuenta con un plan de pagos para el ciclo actualmente seleccionado. Ve a la sección de Alumnos para asignarle un plan.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
