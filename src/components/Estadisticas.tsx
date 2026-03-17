import React, { useState, useMemo } from 'react';
import { ArrowLeft, TrendingUp, AlertCircle, Calendar, Inbox } from 'lucide-react';
import { PaymentPlan } from '../types';
import { extractMonth, isPaid } from '../utils';

interface EstadisticasProps {
  plans: PaymentPlan[];
  onBack: () => void;
}

export default function Estadisticas({ plans, onBack }: EstadisticasProps) {
  // Since plans are already filtered by the active cycle in App.tsx, we can just use them directly.
  const filteredPlans = plans;

  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalOwed = 0;
    
    // Initialize months map
    const monthsData: Record<string, { paid: number, owed: number }> = {};
    
    const processPayment = (cantidad: number, estatus: string, fecha: string) => {
      if (!cantidad) return;
      
      const month = extractMonth(fecha);
      if (!monthsData[month]) {
        monthsData[month] = { paid: 0, owed: 0 };
      }
      
      if (isPaid(estatus)) {
        totalPaid += Number(cantidad);
        monthsData[month].paid += Number(cantidad);
      } else {
        totalOwed += Number(cantidad);
        monthsData[month].owed += Number(cantidad);
      }
    };

    filteredPlans.forEach(plan => {
      for (let i = 1; i <= 9; i++) {
        const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
        const estatus = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha = plan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (cantidad && fecha) {
          processPayment(cantidad, estatus || '', fecha);
        }
      }
    });

    // Sort months chronologically (rough approximation based on typical school year)
    const monthOrder = ['AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'OTROS', 'DESCONOCIDO'];
    
    const sortedMonths = Object.entries(monthsData).sort((a, b) => {
      let idxA = monthOrder.indexOf(a[0]);
      let idxB = monthOrder.indexOf(b[0]);
      if (idxA === -1) idxA = 99;
      if (idxB === -1) idxB = 99;
      return idxA - idxB;
    });

    return { totalPaid, totalOwed, sortedMonths };
  }, [filteredPlans]);

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
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Estadísticas Generales</h1>
          <p className="text-gray-500">Resumen financiero del ciclo activo</p>
        </div>

        {/* Global Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center gap-6">
            <div className="bg-green-100 p-4 rounded-full text-green-600">
              <TrendingUp size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Ingresos Totales (Pagado)</p>
              <p className="text-4xl font-bold text-gray-800">${stats.totalPaid.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center gap-6">
            <div className="bg-red-100 p-4 rounded-full text-red-600">
              <AlertCircle size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Deuda Total (Pendiente)</p>
              <p className="text-4xl font-bold text-gray-800">${stats.totalOwed.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800">Desglose Mensual</h2>
          </div>
          
          <div className="p-6">
            {stats.sortedMonths.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold rounded-tl-lg">Mes / Periodo</th>
                      <th className="py-3 px-4 font-semibold text-right">Ingresos (Pagado)</th>
                      <th className="py-3 px-4 font-semibold text-right">Deuda (Pendiente)</th>
                      <th className="py-3 px-4 font-semibold text-right rounded-tr-lg">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.sortedMonths.map(([month, data], idx) => (
                      <tr key={month} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 font-medium text-gray-800">{month}</td>
                        <td className="py-4 px-4 text-right font-semibold text-green-600">
                          ${data.paid.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-red-600">
                          ${data.owed.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-gray-800">
                          ${(data.paid + data.owed).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold text-gray-800">
                      <td className="py-4 px-4 rounded-bl-lg">TOTAL</td>
                      <td className="py-4 px-4 text-right text-green-700">${stats.totalPaid.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-red-700">${stats.totalOwed.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-gray-900 rounded-br-lg">${(stats.totalPaid + stats.totalOwed).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 px-6 flex flex-col items-center">
                <div className="bg-gray-100 text-gray-400 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                  <Inbox size={40} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No hay datos financieros</h3>
                <p className="text-gray-500 max-w-md mb-6">No se encontraron registros de pagos ni deudas para este ciclo escolar.</p>
                <button 
                  onClick={onBack} 
                  className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <ArrowLeft size={18} /> Volver al Inicio
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
