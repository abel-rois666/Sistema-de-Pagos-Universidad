import React from 'react';
import { User, FileText } from 'lucide-react';
import type { PaymentPlan, Alumno } from '../../types';
import { isPaid, formatDate } from '../../utils';

interface TabPagosProps {
  alumno: Alumno;
  activePlan: PaymentPlan | null | undefined;
  onGoToPlan?: (id: string) => void;
}

const renderPaymentRow = (concepto: string, fecha: string, cantidad: number, estatus: string) => {
  if (!concepto) return null;
  const paidStatus = isPaid(estatus);
  return (
    <tr className="border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors">
      <td className="py-3 px-4 font-medium text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-ui)' }}>{concepto}</td>
      <td className="py-3 px-4 text-[#45515e] dark:text-gray-300">{formatDate(fecha)}</td>
      <td className="py-3 px-4 text-[#222222] dark:text-gray-100 font-semibold">${cantidad.toLocaleString()}</td>
      <td className="py-3 px-4">
        {estatus
          ? <span className="bg-[#eef2ff] dark:bg-[rgba(255,255,255,0.08)] text-[#45515e] dark:text-gray-300 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.12)] px-2 py-1 rounded-[4px] text-xs font-mono">{estatus}</span>
          : <span className="text-gray-400 dark:text-gray-500 text-xs italic">Sin registro</span>
        }
      </td>
      <td className="py-3 px-4 text-center">
        {paidStatus
          ? <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-800 px-2 py-1 rounded-[9999px] text-xs font-semibold">✓ Pagado</span>
          : <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 px-2 py-1 rounded-[9999px] text-xs font-semibold">✕ Adeudo</span>
        }
      </td>
    </tr>
  );
};

export default function TabPagos({ alumno, activePlan, onGoToPlan }: TabPagosProps) {
  /* Observaciones */
  const obsJSX = alumno.observaciones_pago_titulacion && (
    <div className="mx-0 mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-[13px] p-4 flex items-start gap-3">
      <span className="text-amber-500 mt-0.5 flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </span>
      <div>
        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Observaciones de Pago / Titulación</p>
        <p className="text-sm text-amber-800 dark:text-amber-200 leading-[1.50]">{alumno.observaciones_pago_titulacion}</p>
      </div>
    </div>
  );

  if (!activePlan) {
    return (
      <div className="p-6">
        {obsJSX}
        <div className="flex flex-col items-center justify-center py-16 bg-[#f2f3f5] dark:bg-[#1c2228] rounded-[20px] border border-dashed border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">
          <div className="bg-[#bfdbfe] dark:bg-[#1d4ed8]/30 p-4 rounded-[13px] text-[#1456f0] dark:text-[#60a5fa] mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <h3 className="text-xl font-semibold text-[#222222] dark:text-gray-300 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Sin Registros Financieros</h3>
          <p className="text-[#45515e] max-w-sm text-center text-sm leading-[1.50]">Este alumno no cuenta con un plan de pagos para el ciclo actualmente seleccionado. Ve a la sección de Alumnos para asignarle un plan.</p>
        </div>
      </div>
    );
  }


  return (
    <div className="p-6">
      {obsJSX}

      {/* Header: título + botón en la misma línea */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h3 className="text-[18px] font-semibold text-[#222222] dark:text-gray-100 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="bg-[#bfdbfe] dark:bg-[#1d4ed8]/30 text-[#1456f0] dark:text-[#60a5fa] p-1.5 rounded-[8px]"><User size={18} /></span>
          Desglose de Pagos
          <span className="text-xs text-[#8e8e93] font-normal ml-1">{activePlan.ciclo_escolar}</span>
        </h3>
        {onGoToPlan && (
          <button
            onClick={() => onGoToPlan(alumno.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1456f0] dark:text-[#60a5fa] bg-[#eef2ff] dark:bg-[#1d4ed8]/20 border border-[#bfdbfe] dark:border-[#1d4ed8]/50 rounded-[8px] hover:bg-[#dbeafe] dark:hover:bg-[#1d4ed8]/30 transition-colors"
          >
            <FileText size={15} /> Ver / Editar Plan de Pagos completo
          </button>
        )}
      </div>

      <div className="rounded-[13px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] overflow-hidden shadow-[var(--shadow-subtle)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ fontFamily: 'var(--font-data)' }}>
            <thead>
              <tr className="bg-[#eef2ff] dark:bg-[#1c2228] text-[#45515e] dark:text-[#8e8e93] text-xs uppercase tracking-wider border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">
                <th className="py-4 px-5 font-semibold">Concepto</th>
                <th className="py-4 px-5 font-semibold">Fecha Límite</th>
                <th className="py-4 px-5 font-semibold">Monto</th>
                <th className="py-4 px-5 font-semibold">Recibo / Estatus</th>
                <th className="py-4 px-5 font-semibold text-center">Condición</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f3f5] dark:divide-[rgba(255,255,255,0.06)] bg-white dark:bg-[#181e25]">
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => {
                const concepto = activePlan[`concepto_${i}` as keyof PaymentPlan] as string | undefined;
                const fecha    = activePlan[`fecha_${i}`    as keyof PaymentPlan] as string | undefined;
                const cantidad = activePlan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
                const estatus  = activePlan[`estatus_${i}`  as keyof PaymentPlan] as string | undefined;
                if (!concepto) return null;
                return <React.Fragment key={i}>{renderPaymentRow(concepto, fecha || '', cantidad || 0, estatus || '')}</React.Fragment>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
