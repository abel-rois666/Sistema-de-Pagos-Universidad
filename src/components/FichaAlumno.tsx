import React, { useState } from 'react';
import { X, ArrowLeft, CheckCircle2, XCircle, User } from 'lucide-react';
import { PaymentPlan } from '../types';
import { calculateStudentTotals, isPaid } from '../utils';

interface FichaAlumnoProps {
  plans: PaymentPlan[];
  onBack: () => void;
}

export default function FichaAlumno({ plans, onBack }: FichaAlumnoProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState<string>(plans[0]?.nombre_alumno || '');
  const [showSuggestions, setShowSuggestions] = useState(false);

  if (plans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="bg-indigo-50 text-indigo-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <User size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Sin Alumnos</h2>
          <p className="text-gray-500 mb-8">No hay fichas de alumnos disponibles para este ciclo escolar.</p>
          <button 
            onClick={onBack} 
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 mx-auto w-full justify-center"
          >
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];

  const filteredPlans = plans.filter(p => 
    p.nombre_alumno.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (plan: PaymentPlan) => {
    setSelectedPlanId(plan.id);
    setSearchTerm(plan.nombre_alumno);
    setShowSuggestions(false);
  };

  const { paid, owed } = calculateStudentTotals(selectedPlan);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [y, m, d] = dateString.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateString;
  };

  const renderPaymentRow = (concepto: string, fecha: string, cantidad: number, estatus: string) => {
    if (!concepto) return null;
    const paidStatus = isPaid(estatus);
    
    return (
      <tr className="border-b border-gray-200 hover:bg-gray-50">
        <td className="py-3 px-4 font-medium text-gray-800">{concepto}</td>
        <td className="py-3 px-4 text-gray-600">{formatDate(fecha)}</td>
        <td className="py-3 px-4 text-gray-800 font-semibold">${cantidad.toLocaleString()}</td>
        <td className="py-3 px-4">
          {estatus ? (
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono">{estatus}</span>
          ) : (
            <span className="text-gray-400 text-xs italic">Sin registro</span>
          )}
        </td>
        <td className="py-3 px-4 text-center">
          {paidStatus ? (
            <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-bold">
              <CheckCircle2 size={14} /> Pagado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-bold">
              <XCircle size={14} /> Adeudo
            </span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors"
          >
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
          
          <div className="relative w-72">
            <div className="bg-white border border-gray-300 rounded-lg p-2 relative flex items-center shadow-sm">
              <input 
                type="text"
                className="w-full bg-transparent outline-none text-sm pr-6"
                value={searchTerm}
                onChange={handleSearchChange}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setShowSuggestions(false)}
                placeholder="Buscar alumno..."
              />
              {searchTerm && (
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchTerm('');
                    setShowSuggestions(true);
                  }}
                  className="absolute right-2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {showSuggestions && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 max-h-60 overflow-y-auto shadow-xl rounded-lg">
                {filteredPlans.length > 0 ? (
                  filteredPlans.map(p => (
                    <div 
                      key={p.id} 
                      className="p-3 text-sm hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-b border-gray-100 last:border-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick(p);
                      }}
                    >
                      {p.nombre_alumno}
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-sm text-gray-500 text-center">No hay coincidencias</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">{selectedPlan.nombre_alumno}</h1>
            <div className="flex flex-wrap gap-4 text-blue-100 text-sm">
              <span className="bg-blue-900/50 px-3 py-1 rounded-full">Licenciatura: {selectedPlan.licenciatura}</span>
              <span className="bg-blue-900/50 px-3 py-1 rounded-full">Grado/Turno: {selectedPlan.grado_turno}</span>
              <span className="bg-blue-900/50 px-3 py-1 rounded-full">No. Plan: {selectedPlan.no_plan_pagos}</span>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-8 bg-gray-50 border-b border-gray-200">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-1">Ciclo Escolar</p>
              <p className="text-2xl font-bold text-gray-800">{selectedPlan.ciclo_escolar}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 font-medium mb-1">Beca Asignada</p>
              <p className="text-2xl font-bold text-gray-800">{selectedPlan.beca_porcentaje}</p>
              <p className="text-xs text-gray-400 mt-1">{selectedPlan.beca_tipo}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
              <p className="text-sm text-green-600 font-medium mb-1">Total Pagado</p>
              <p className="text-2xl font-bold text-green-700">${paid.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
              <p className="text-sm text-red-600 font-medium mb-1">Total Adeudo</p>
              <p className="text-2xl font-bold text-red-700">${owed.toLocaleString()}</p>
            </div>
          </div>

          {/* Compact Table */}
          <div className="p-8">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Desglose de Pagos</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold rounded-tl-lg">Concepto</th>
                    <th className="py-3 px-4 font-semibold">Fecha Límite</th>
                    <th className="py-3 px-4 font-semibold">Monto</th>
                    <th className="py-3 px-4 font-semibold">Recibo / Estatus</th>
                    <th className="py-3 px-4 font-semibold text-center rounded-tr-lg">Condición</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
                    const concepto = selectedPlan[`concepto_${i}` as keyof PaymentPlan] as string | undefined;
                    const fecha = selectedPlan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
                    const cantidad = selectedPlan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
                    const estatus = selectedPlan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
                    
                    if (!concepto) return null;
                    return <React.Fragment key={i}>{renderPaymentRow(concepto, fecha || '', cantidad || 0, estatus || '')}</React.Fragment>;
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
