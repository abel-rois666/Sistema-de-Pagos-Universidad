import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, TrendingUp, AlertCircle, Inbox, BarChart2, Banknote, CreditCard, ListChecks } from 'lucide-react';
import type { PaymentPlan, Alumno, CicloEscolar } from '../types';
import { supabase } from '../lib/supabase';
import { extractMonth, isPaid, getRestanteFromEstatus } from '../utils';

interface EstadisticasProps {
  plans: PaymentPlan[];
  alumnos: Alumno[];
  activeCiclo?: CicloEscolar;
  onBack: () => void;
}

interface LibreRow {
  concepto: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  fecha_recibo: string;
  alumno_id?: string;
}

export default function Estadisticas({ plans, alumnos, activeCiclo, onBack }: EstadisticasProps) {
  const [activeTab, setActiveTab] = useState<'planes' | 'libres'>('planes');
  const [libres, setLibres] = useState<LibreRow[]>([]);
  const [loadingLibres, setLoadingLibres] = useState(false);

  // ── Fetch pagos libres from DB ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeCiclo?.id) return;
    setLoadingLibres(true);
    supabase
      .from('recibos_detalles')
      .select('concepto, cantidad, costo_unitario, subtotal, recibos!inner(fecha_recibo, ciclo_id, alumno_id, estatus)')
      .is('indice_concepto_plan', null)
      .eq('recibos.ciclo_id', activeCiclo.id)
      .neq('recibos.estatus', 'CANCELADO')
      .then(({ data }) => {
        if (data) {
          setLibres(data.map((d: any) => ({
            concepto: d.concepto,
            cantidad: d.cantidad,
            costo_unitario: d.costo_unitario,
            subtotal: d.subtotal,
            fecha_recibo: d.recibos?.fecha_recibo || '',
            alumno_id: d.recibos?.alumno_id,
          })));
        }
        setLoadingLibres(false);
      });
  }, [activeCiclo?.id]);

  // ── Plan stats (existing logic) ────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalOwed = 0;
    const monthsData: Record<string, { paid: number; owed: number }> = {};
    const licenciaturaData: Record<string, { paid: number; owed: number }> = {};
    const turnoData: Record<string, { paid: number; owed: number }> = {};

    const processPayment = (plan: PaymentPlan, cantidad: number, estatus: string, fecha: string, isBaja: boolean) => {
      if (!cantidad) return;
      const month = extractMonth(fecha);
      if (!monthsData[month]) monthsData[month] = { paid: 0, owed: 0 };
      const lic = plan.licenciatura?.trim() || 'Desconocida';
      if (!licenciaturaData[lic]) licenciaturaData[lic] = { paid: 0, owed: 0 };
      let fallbackTurno = '';
      if (plan.grado_turno && plan.grado_turno.includes('/')) fallbackTurno = plan.grado_turno.split('/')[1].trim();
      const tur = plan.turno?.trim() || fallbackTurno || 'Desconocido';
      if (!turnoData[tur]) turnoData[tur] = { paid: 0, owed: 0 };

      if (isPaid(estatus)) {
        totalPaid += Number(cantidad);
        monthsData[month].paid += Number(cantidad);
        licenciaturaData[lic].paid += Number(cantidad);
        turnoData[tur].paid += Number(cantidad);
      } else {
        if (!isBaja) {
          // Para abonos parciales: la parte abonada va a "paid", el restante a "owed"
          const restante = getRestanteFromEstatus(estatus, Number(cantidad));
          const abonado = Number(cantidad) - restante;
          if (abonado > 0) {
            totalPaid += abonado;
            monthsData[month].paid += abonado;
            licenciaturaData[lic].paid += abonado;
            turnoData[tur].paid += abonado;
          }
          totalOwed += restante;
          monthsData[month].owed += restante;
          licenciaturaData[lic].owed += restante;
          turnoData[tur].owed += restante;
        }
      }
    };

    plans.forEach(plan => {
      const alumno = alumnos.find(a => a.id === plan.alumno_id || a.nombre_completo === plan.nombre_alumno);
      const isBaja = alumno?.estatus === 'BAJA';
      for (let i = 1; i <= 9; i++) {
        const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
        const estatus = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha = plan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (cantidad && fecha) processPayment(plan, cantidad, estatus || '', fecha, isBaja);
      }
    });

    const monthOrder = ['AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'OTROS', 'DESCONOCIDO'];
    const sortedMonths = Object.entries(monthsData).sort((a, b) => {
      let ia = monthOrder.indexOf(a[0]); let ib = monthOrder.indexOf(b[0]);
      if (ia === -1) ia = 99; if (ib === -1) ib = 99;
      return ia - ib;
    });
    const sortedLicenciaturas = Object.entries(licenciaturaData).sort((a, b) => b[1].paid + b[1].owed - (a[1].paid + a[1].owed));
    const sortedTurnos = Object.entries(turnoData).sort((a, b) => b[1].paid + b[1].owed - (a[1].paid + a[1].owed));
    return { totalPaid, totalOwed, sortedMonths, sortedLicenciaturas, sortedTurnos };
  }, [plans, alumnos]);

  // ── Pagos libres stats ─────────────────────────────────────────────────────
  const libresStats = useMemo(() => {
    const totalLibres = libres.reduce((s, r) => s + Number(r.subtotal), 0);
    // By concept
    const byConcepto: Record<string, { monto: number; count: number }> = {};
    libres.forEach(r => {
      if (!byConcepto[r.concepto]) byConcepto[r.concepto] = { monto: 0, count: 0 };
      byConcepto[r.concepto].monto += Number(r.subtotal);
      byConcepto[r.concepto].count += 1;
    });
    const sortedConceptos = Object.entries(byConcepto).sort((a, b) => b[1].monto - a[1].monto);
    // By month
    const byMes: Record<string, number> = {};
    libres.forEach(r => {
      const m = extractMonth(r.fecha_recibo);
      byMes[m] = (byMes[m] || 0) + Number(r.subtotal);
    });
    const monthOrder = ['AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'OTROS', 'DESCONOCIDO'];
    const sortedMeses = Object.entries(byMes).sort((a, b) => {
      let ia = monthOrder.indexOf(a[0]); let ib = monthOrder.indexOf(b[0]);
      if (ia === -1) ia = 99; if (ib === -1) ib = 99;
      return ia - ib;
    });
    // Unique students
    const uniqueAlumnos = new Set(libres.map(r => r.alumno_id).filter(Boolean)).size;
    return { totalLibres, sortedConceptos, sortedMeses, uniqueAlumnos };
  }, [libres]);

  const totalGeneral = stats.totalPaid + libresStats.totalLibres;

  return (
    <div className="w-full font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Back button */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-black dark:text-gray-300 dark:hover:text-white font-bold transition-colors">
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-1">Estadísticas Generales</h1>
          <p className="text-gray-500 dark:text-gray-400">Resumen financiero · {activeCiclo?.nombre || 'Ciclo activo'}</p>
        </div>

        {/* ── ZONA FIJA: 3 tarjetas siempre visibles ─────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/40 p-3 rounded-xl text-green-600 dark:text-green-400">
              <ListChecks size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Ingresos Plan</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">${stats.totalPaid.toLocaleString()}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
            <div className="bg-red-100 dark:bg-red-900/40 p-3 rounded-xl text-red-600 dark:text-red-400">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Adeudo Plan</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">${stats.totalOwed.toLocaleString()}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-xl text-blue-600 dark:text-blue-400">
              <CreditCard size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Pagos Libres</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">${libresStats.totalLibres.toLocaleString()}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
            className="bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl p-5 shadow-md flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl text-white">
              <Banknote size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-100 mb-0.5">Total Caja</p>
              <p className="text-2xl font-bold text-white">${totalGeneral.toLocaleString()}</p>
            </div>
          </motion.div>
        </div>

        {/* ── TABS ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('planes')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'planes' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
          >
            <BarChart2 size={16} /> Planes de Pago
          </button>
          <button
            onClick={() => setActiveTab('libres')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'libres' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
          >
            <CreditCard size={16} /> Pagos Libres
            {libresStats.totalLibres > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'libres' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                {libres.length}
              </span>
            )}
          </button>
        </div>

        {/* ── TAB: PLANES ──────────────────────────────────────────────────── */}
        {activeTab === 'planes' && (
          <div className="space-y-6">
            {/* Monthly Breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + idx * 0.05, duration: 0.2 }}
                            key={month} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="py-4 px-4 font-medium text-gray-800 dark:text-gray-200">{month}</td>
                            <td className="py-4 px-4 text-right font-semibold text-green-600 dark:text-green-400">${data.paid.toLocaleString()}</td>
                            <td className="py-4 px-4 text-right font-semibold text-red-600 dark:text-red-400">${data.owed.toLocaleString()}</td>
                            <td className="py-4 px-4 text-right font-bold text-gray-800 dark:text-gray-100">${(data.paid + data.owed).toLocaleString()}</td>
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
                  <div className="text-center py-16 flex flex-col items-center">
                    <div className="bg-gray-100 text-gray-400 w-20 h-20 rounded-full flex items-center justify-center mb-4"><Inbox size={40} /></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">No hay datos financieros</h3>
                    <p className="text-gray-500">No se encontraron registros para este ciclo.</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* By Licenciatura + Turno */}
            {stats.sortedLicenciaturas.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Por Licenciatura</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 text-xs">
                          <th className="py-3 px-4 font-semibold">Licenciatura</th>
                          <th className="py-3 px-4 font-semibold text-right text-green-600">Pagado</th>
                          <th className="py-3 px-4 font-semibold text-right text-red-500">Adeudo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.sortedLicenciaturas.map(([lic, data]) => (
                          <tr key={lic} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50">
                            <td className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={lic}>{lic}</td>
                            <td className="py-3 px-4 text-right font-semibold text-green-600">${data.paid.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-semibold text-red-500">${data.owed.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Por Turno</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 text-xs">
                          <th className="py-3 px-4 font-semibold">Turno</th>
                          <th className="py-3 px-4 font-semibold text-right text-green-600">Pagado</th>
                          <th className="py-3 px-4 font-semibold text-right text-red-500">Adeudo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.sortedTurnos.map(([tur, data]) => (
                          <tr key={tur} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50/50">
                            <td className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300">{tur}</td>
                            <td className="py-3 px-4 text-right font-semibold text-green-600">${data.paid.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-semibold text-red-500">${data.owed.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PAGOS LIBRES ─────────────────────────────────────────────── */}
        {activeTab === 'libres' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
            {loadingLibres ? (
              <div className="text-center py-16 text-gray-400 font-semibold animate-pulse">Cargando pagos libres...</div>
            ) : libres.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="bg-blue-50 text-blue-300 w-20 h-20 rounded-full flex items-center justify-center mb-4"><CreditCard size={36} /></div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Sin pagos libres</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">No hay cobros libres (sin plan) en este ciclo.</p>
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex flex-col">
                    <span className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Total recaudado</span>
                    <span className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">${libresStats.totalLibres.toLocaleString()}</span>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex flex-col">
                    <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Registros</span>
                    <span className="text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">{libres.length}</span>
                  </div>
                  <div className="bg-violet-50 dark:bg-violet-900/30 p-4 rounded-2xl border border-violet-100 dark:border-violet-800 flex flex-col">
                    <span className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-1">Alumnos únicos</span>
                    <span className="text-3xl font-extrabold text-violet-700 dark:text-violet-300">{libresStats.uniqueAlumnos}</span>
                  </div>
                </div>

                {/* By concepto */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Por Concepto</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 text-xs">
                          <th className="py-3 px-4 font-semibold">Concepto</th>
                          <th className="py-3 px-4 font-semibold text-center">Registros</th>
                          <th className="py-3 px-4 font-semibold text-right">Monto Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {libresStats.sortedConceptos.map(([concepto, data]) => (
                          <tr key={concepto} className="border-b border-gray-50 dark:border-gray-700 hover:bg-blue-50/30">
                            <td className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-200">{concepto}</td>
                            <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400">{data.count}</td>
                            <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400">${data.monto.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* By month */}
                {libresStats.sortedMeses.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Por Mes</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 text-xs">
                            <th className="py-3 px-4 font-semibold">Mes</th>
                            <th className="py-3 px-4 font-semibold text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {libresStats.sortedMeses.map(([mes, monto]) => (
                            <tr key={mes} className="border-b border-gray-50 dark:border-gray-700 hover:bg-blue-50/30">
                              <td className="py-3 px-4 font-medium text-gray-700 dark:text-gray-200">{mes}</td>
                              <td className="py-3 px-4 text-right font-semibold text-blue-600 dark:text-blue-400">${Number(monto).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 dark:bg-gray-900/50 font-bold">
                            <td className="py-3 px-4 text-gray-800 dark:text-gray-100">TOTAL</td>
                            <td className="py-3 px-4 text-right text-blue-700 dark:text-blue-300">${libresStats.totalLibres.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

      </div>
    </div>
  );
}
