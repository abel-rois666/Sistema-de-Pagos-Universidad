import React, { useState, useMemo } from 'react';
import { ArrowLeft, Calendar, AlertTriangle, Search, CheckCircle, Inbox } from 'lucide-react';
import { PaymentPlan } from '../types';
import { isPaid } from '../utils';

interface DeudoresProps {
  plans: PaymentPlan[];
  onBack: () => void;
}

interface DebtRecord {
  id: string;
  alumno: string;
  licenciatura: string;
  concepto: string;
  monto: number;
  fecha_limite: string;
}

export default function Deudores({ plans, onBack }: DeudoresProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Since plans are already filtered by the active cycle in App.tsx, we can just use them directly.
  const filteredPlans = plans;

  const debtors = useMemo(() => {
    const records: DebtRecord[] = [];

    const checkDebt = (plan: PaymentPlan, concepto: string, cantidad: number, estatus: string, fecha: string) => {
      if (cantidad > 0 && !isPaid(estatus)) {
        records.push({
          id: `${plan.id}-${concepto}`,
          alumno: plan.nombre_alumno,
          licenciatura: plan.licenciatura,
          concepto: concepto,
          monto: Number(cantidad),
          fecha_limite: fecha
        });
      }
    };

    filteredPlans.forEach(plan => {
      for (let i = 1; i <= 9; i++) {
        const concepto = plan[`concepto_${i}` as keyof PaymentPlan] as string | undefined;
        const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
        const estatus = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha = plan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (concepto && cantidad && fecha) {
          checkDebt(plan, concepto, cantidad, estatus || '', fecha);
        }
      }
    });

    // Sort by student name
    return records.sort((a, b) => a.alumno.localeCompare(b.alumno));
  }, [filteredPlans]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [y, m, d] = dateString.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateString;
  };

  const filteredDebtors = debtors.filter(d => 
    d.alumno.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.concepto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDebt = filteredDebtors.reduce((sum, d) => sum + d.monto, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-black font-bold transition-colors"
          >
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
              Lista de Deudores <AlertTriangle className="text-red-500" size={28} />
            </h1>
            <p className="text-gray-500">Alumnos con pagos pendientes en el ciclo activo</p>
          </div>

          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
              placeholder="Buscar por alumno o concepto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          
          <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
            <span className="text-red-800 font-medium">
              Mostrando {filteredDebtors.length} registro(s) pendiente(s)
            </span>
            <span className="text-red-800 font-bold text-xl">
              Total Adeudado: ${totalDebt.toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                  <th className="py-4 px-6 font-semibold">Alumno</th>
                  <th className="py-4 px-6 font-semibold">Licenciatura</th>
                  <th className="py-4 px-6 font-semibold">Concepto Adeudado</th>
                  <th className="py-4 px-6 font-semibold">Fecha Límite</th>
                  <th className="py-4 px-6 font-semibold text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDebtors.length > 0 ? (
                  filteredDebtors.map((record) => (
                    <tr key={record.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-800">{record.alumno}</td>
                      <td className="py-4 px-6 text-gray-600 text-sm">{record.licenciatura}</td>
                      <td className="py-4 px-6 text-gray-800 font-medium">{record.concepto}</td>
                      <td className="py-4 px-6 text-gray-500 text-sm">{formatDate(record.fecha_limite)}</td>
                      <td className="py-4 px-6 text-right font-bold text-red-600">${record.monto.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        {searchTerm ? (
                          <>
                            <div className="bg-gray-100 text-gray-400 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                              <Search size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-1">Sin resultados</h3>
                            <p className="text-gray-500">No se encontraron deudores que coincidan con "{searchTerm}".</p>
                          </>
                        ) : (
                          <>
                            <div className="bg-green-100 text-green-500 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                              <CheckCircle size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">¡Todo al corriente!</h3>
                            <p className="text-gray-500 mb-6">No hay alumnos con pagos pendientes en este ciclo escolar.</p>
                            <button 
                              onClick={onBack} 
                              className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                              <ArrowLeft size={18} /> Volver al Inicio
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
