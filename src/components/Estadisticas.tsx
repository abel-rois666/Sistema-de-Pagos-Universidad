import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, TrendingUp, AlertCircle, Calendar, Inbox } from 'lucide-react';
import { PaymentPlan } from '../types';
import { extractMonth, isPaid } from '../utils';

interface EstadisticasProps {
  plans: PaymentPlan[];
  alumnos: import('../types').Alumno[];
  onBack: () => void;
}

export default function Estadisticas({ plans, alumnos, onBack }: EstadisticasProps) {
  // No longer filter out 'BAJA' entirely, we will handle them in the stats loop.
  const filteredPlans = useMemo(() => plans, [plans]);

  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalOwed = 0;
    
    // Initialize maps
    const monthsData: Record<string, { paid: number, owed: number }> = {};
    const licenciaturaData: Record<string, { paid: number, owed: number }> = {};
    const turnoData: Record<string, { paid: number, owed: number }> = {};
    
    const processPayment = (plan: PaymentPlan, cantidad: number, estatus: string, fecha: string, isBaja: boolean) => {
      if (!cantidad) return;
      
      const month = extractMonth(fecha);
      if (!monthsData[month]) {
        monthsData[month] = { paid: 0, owed: 0 };
      }

      const lic = plan.licenciatura?.trim() || 'Desconocida';
      if (!licenciaturaData[lic]) {
        licenciaturaData[lic] = { paid: 0, owed: 0 };
      }

      let fallbackTurno = '';
      if (plan.grado_turno && plan.grado_turno.includes('/')) {
         fallbackTurno = plan.grado_turno.split('/')[1].trim();
      }
      const tur = plan.turno?.trim() || fallbackTurno || 'Desconocido';
      if (!turnoData[tur]) {
        turnoData[tur] = { paid: 0, owed: 0 };
      }
      
      if (isPaid(estatus)) {
        totalPaid += Number(cantidad);
        monthsData[month].paid += Number(cantidad);
        licenciaturaData[lic].paid += Number(cantidad);
        turnoData[tur].paid += Number(cantidad);
      } else {
        if (!isBaja) {
          totalOwed += Number(cantidad);
          monthsData[month].owed += Number(cantidad);
          licenciaturaData[lic].owed += Number(cantidad);
          turnoData[tur].owed += Number(cantidad);
        }
      }
    };

    filteredPlans.forEach(plan => {
      const alumno = alumnos.find(a => a.id === plan.alumno_id || a.nombre_completo === plan.nombre_alumno);
      const isBaja = alumno?.estatus === 'BAJA';

      for (let i = 1; i <= 9; i++) {
        const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
        const estatus = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha = plan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (cantidad && fecha) {
          processPayment(plan, cantidad, estatus || '', fecha, isBaja);
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

    const sortedLicenciaturas = Object.entries(licenciaturaData).sort((a, b) => b[1].paid + b[1].owed - (a[1].paid + a[1].owed));
    const sortedTurnos = Object.entries(turnoData).sort((a, b) => b[1].paid + b[1].owed - (a[1].paid + a[1].owed));

    return { totalPaid, totalOwed, sortedMonths, sortedLicenciaturas, sortedTurnos };
  }, [filteredPlans]);

  return (
    <div className="w-full font-sans">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-black dark:text-gray-300 dark:hover:text-white font-bold transition-colors"
          >
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Estadísticas Generales</h1>
          <p className="text-gray-500 dark:text-gray-400">Resumen financiero del ciclo activo</p>
        </div>

        {/* Global Totals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-6">
            <div className="bg-green-100 dark:bg-green-900/40 p-4 rounded-full text-green-600 dark:text-green-400">
              <TrendingUp size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ingresos Totales (Pagado)</p>
              <p className="text-4xl font-bold text-gray-800 dark:text-gray-100">${stats.totalPaid.toLocaleString()}</p>
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-6">
            <div className="bg-red-100 dark:bg-red-900/40 p-4 rounded-full text-red-600 dark:text-red-400">
              <AlertCircle size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Deuda Total (Pendiente)</p>
              <p className="text-4xl font-bold text-gray-800 dark:text-gray-100">${stats.totalOwed.toLocaleString()}</p>
            </div>
          </motion.div>
        </div>

        {/* Monthly Breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Desglose Mensual</h2>
          </div>
          
          <div className="p-6">
            {stats.sortedMonths.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 text-sm uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold rounded-tl-lg">Mes / Periodo</th>
                      <th className="py-3 px-4 font-semibold text-right">Ingresos (Pagado)</th>
                      <th className="py-3 px-4 font-semibold text-right">Deuda (Pendiente)</th>
                      <th className="py-3 px-4 font-semibold text-right rounded-tr-lg">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.sortedMonths.map(([month, data], idx) => (
                      <motion.tr 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        transition={{ delay: 0.2 + idx * 0.05, duration: 0.2 }}
                        key={month} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="py-4 px-4 font-medium text-gray-800 dark:text-gray-200">{month}</td>
                        <td className="py-4 px-4 text-right font-semibold text-green-600 dark:text-green-400">
                          ${data.paid.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-red-600 dark:text-red-400">
                          ${data.owed.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-gray-800 dark:text-gray-100">
                          ${(data.paid + data.owed).toLocaleString()}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 font-bold text-gray-800 dark:text-gray-100">
                      <td className="py-4 px-4 rounded-bl-lg">TOTAL</td>
                      <td className="py-4 px-4 text-right text-green-700 dark:text-green-400">${stats.totalPaid.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-red-700 dark:text-red-400">${stats.totalOwed.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right text-gray-900 dark:text-white rounded-br-lg">${(stats.totalPaid + stats.totalOwed).toLocaleString()}</td>
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
        </motion.div>

        {/* Breakdown by Licenciatura and Turno side by side */}
        {stats.sortedLicenciaturas.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Desglose por Licenciatura</h2>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 text-xs">
                      <th className="py-3 px-4 font-semibold">Licenciatura</th>
                      <th className="py-3 px-4 font-semibold text-right text-green-600 dark:text-green-400">Pagado</th>
                      <th className="py-3 px-4 font-semibold text-right text-red-500 dark:text-red-400">Adeudo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.sortedLicenciaturas.map(([lic, data], idx) => (
                      <tr key={lic} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={lic}>{lic}</td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600 dark:text-green-400">${data.paid.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-semibold text-red-500 dark:text-red-400">${data.owed.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Desglose por Turno</h2>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 text-xs">
                      <th className="py-3 px-4 font-semibold">Turno</th>
                      <th className="py-3 px-4 font-semibold text-right text-green-600 dark:text-green-400">Pagado</th>
                      <th className="py-3 px-4 font-semibold text-right text-red-500 dark:text-red-400">Adeudo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.sortedTurnos.map(([tur, data], idx) => (
                      <tr key={tur} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/50">
                        <td className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300">{tur}</td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600 dark:text-green-400">${data.paid.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-semibold text-red-500 dark:text-red-400">${data.owed.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
