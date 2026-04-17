import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, TrendingUp, AlertCircle, Inbox, BarChart2, Banknote, CreditCard, ListChecks } from 'lucide-react';
import type { PaymentPlan, Alumno, CicloEscolar } from '../types';
import { supabase } from '../lib/supabase';
import { extractMonth, isPaid, getRestanteFromEstatus , toTitleCase} from '../utils';
import LoadingSkeleton from './LoadingSkeleton';

interface EstadisticasProps {
  plans: PaymentPlan[];
  alumnos: Alumno[];
  activeCiclo?: CicloEscolar;
  ciclos: CicloEscolar[];
  onBack: () => void;
}

interface LibreRow {
  concepto: string;
  cantidad: number;
  costo_unitario: number;
  subtotal: number;
  fecha_recibo: string;
  alumno_id?: string;
  recibo_id?: string;
  recibo_total?: number;
  uso_saldo_a_favor?: number;
}

export default function Estadisticas({ plans, alumnos, activeCiclo, ciclos = [], onBack }: EstadisticasProps) {
  const [activeTab, setActiveTab] = useState<'planes' | 'libres'>('planes');
  
  // -- Filtros --
  const [filtroAnioTit, setFiltroAnioTit] = useState<string>(new Date().getFullYear().toString());

  const [libres, setLibres] = useState<LibreRow[]>([]);
  const [loadingLibres, setLoadingLibres] = useState(false);

  // ── Fetch pagos libres from DB ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeCiclo?.id) return;
    setLoadingLibres(true);
    supabase
      .from('recibos_detalles')
      .select('concepto, cantidad, costo_unitario, subtotal, recibos!inner(id, fecha_recibo, ciclo_id, total, alumno_id, estatus, uso_saldo_a_favor)')
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
            recibo_id: d.recibos?.id,
            recibo_total: Math.max(Number(d.recibos?.total) || 1, 0.01),
            uso_saldo_a_favor: d.recibos?.uso_saldo_a_favor || 0,
          })));
        }
        setLoadingLibres(false);
      });
  }, [activeCiclo?.id]);

  // ── Plan stats (existing logic) ────────────────────────────────────────────
  const stats = useMemo(() => {
    let totalPaid = 0;
    let totalOwed = 0;
    let totalTitPaid = 0;
    let totalTitOwed = 0;
    
    const monthsData: Record<string, { paid: number; owed: number }> = {};
    const titMonthsData: Record<string, { paid: number; owed: number }> = {};
    const licenciaturaData: Record<string, { paid: number; owed: number }> = {};
    const turnoData: Record<string, { paid: number; owed: number }> = {};

    const processPayment = (plan: PaymentPlan, cantidad: number, estatus: string, fecha: string, isBaja: boolean) => {
      if (!cantidad) return;
      const month = extractMonth(fecha);
      const isTit = plan.tipo_plan === 'Titulación';
      if (isTit && !titMonthsData[month]) titMonthsData[month] = { paid: 0, owed: 0 };
      if (!isTit && !monthsData[month]) monthsData[month] = { paid: 0, owed: 0 };
      
      const lic = plan.licenciatura?.trim() || 'Desconocida';
      if (!isTit && !licenciaturaData[lic]) licenciaturaData[lic] = { paid: 0, owed: 0 };
      
      let fallbackTurno = '';
      if (plan.grado_turno && plan.grado_turno.includes('/')) fallbackTurno = plan.grado_turno.split('/')[1].trim();
      const tur = plan.turno?.trim() || fallbackTurno || 'Desconocido';
      if (!isTit && !turnoData[tur]) turnoData[tur] = { paid: 0, owed: 0 };

      if (isPaid(estatus)) {
        if (isTit) {
          totalTitPaid += Number(cantidad);
          titMonthsData[month].paid += Number(cantidad);
        } else {
          totalPaid += Number(cantidad);
          monthsData[month].paid += Number(cantidad);
          licenciaturaData[lic].paid += Number(cantidad);
          turnoData[tur].paid += Number(cantidad);
        }
      } else {
        if (!isBaja) {
          const restante = getRestanteFromEstatus(estatus, Number(cantidad));
          const abonado = Number(cantidad) - restante;
          if (abonado > 0) {
            if (isTit) {
              totalTitPaid += abonado;
              titMonthsData[month].paid += abonado;
            } else {
              totalPaid += abonado;
              monthsData[month].paid += abonado;
              licenciaturaData[lic].paid += abonado;
              turnoData[tur].paid += abonado;
            }
          }
          if (isTit) {
            totalTitOwed += restante;
            titMonthsData[month].owed += restante;
          } else {
            totalOwed += restante;
            monthsData[month].owed += restante;
            licenciaturaData[lic].owed += restante;
            turnoData[tur].owed += restante;
          }
        }
      }
    };

    plans.forEach(plan => {
      const isTit = plan.tipo_plan === 'Titulación';
      
      // Filtro para planes Ordinarios (no titulación)
      if (!isTit) {
        if (activeCiclo && plan.ciclo_id !== activeCiclo.id) {
           return;
        }
      }

      const alumno = alumnos.find(a => a.id === plan.alumno_id || a.nombre_completo === plan.nombre_alumno);
      const isBaja = alumno?.estatus === 'BAJA';
      for (let i = 1; i <= 9; i++) {
        const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
        const estatus = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha = plan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (cantidad && fecha) {
           if (isTit) {
               const anioPago = extractMonth(fecha).split(' ')[1] || '';
               if (filtroAnioTit !== 'todo' && anioPago !== filtroAnioTit) continue;
           }
           processPayment(plan, cantidad, estatus || '', fecha, isBaja);
        }
      }
    });

    const monthOrder = ['AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'OTROS', 'DESCONOCIDO'];
    const getSortValue = (mon: string) => {
      const parts = mon.split(' ');
      const monthName = parts[0];
      const year = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      let mIndex = monthOrder.indexOf(monthName);
      if (mIndex === -1) mIndex = 99;
      return (year * 100) + mIndex;
    };

    const sortedMonths = Object.entries(monthsData).sort((a, b) => getSortValue(a[0]) - getSortValue(b[0]));
    const sortedTitMonths = Object.entries(titMonthsData).sort((a, b) => getSortValue(a[0]) - getSortValue(b[0]));
    const sortedLicenciaturas = Object.entries(licenciaturaData).sort((a, b) => b[1].paid + b[1].owed - (a[1].paid + a[1].owed));
    const sortedTurnos = Object.entries(turnoData).sort((a, b) => b[1].paid + b[1].owed - (a[1].paid + a[1].owed));
    return { totalPaid, totalOwed, totalTitPaid, totalTitOwed, sortedMonths, sortedTitMonths, sortedLicenciaturas, sortedTurnos };
  }, [plans, alumnos, activeCiclo?.id, filtroAnioTit, ciclos]);

  // ── Pagos libres stats ─────────────────────────────────────────────────────
  const libresStats = useMemo(() => {
    let totalLibres = 0;
    let totalMonederoLibres = 0;

    // By concept
    const byConcepto: Record<string, { monto: number; count: number }> = {};
    libres.forEach(r => {
      totalLibres += Number(r.subtotal);
      
      // Prorrateo exacto: Si el ticket costó $1000 y se usaron $500 de monedero (50%).
      // Y un detalle específico libre (ej. Examen) costó $200. (200 / 1000) * 500 = $100.
      if (r.uso_saldo_a_favor && r.uso_saldo_a_favor > 0 && r.recibo_total) {
        const proporcion = Number(r.subtotal) / Number(r.recibo_total);
        totalMonederoLibres += (Number(r.uso_saldo_a_favor) * proporcion);
      }

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
    const getSortValueLibres = (mon: string) => {
      const parts = mon.split(' ');
      const monthName = parts[0];
      const year = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      let mIndex = monthOrder.indexOf(monthName);
      if (mIndex === -1) mIndex = 99;
      return (year * 100) + mIndex;
    };
    const sortedMeses = Object.entries(byMes).sort((a, b) => getSortValueLibres(a[0]) - getSortValueLibres(b[0]));
    // Unique students
    const uniqueAlumnos = new Set(libres.map(r => r.alumno_id).filter(Boolean)).size;
    return { totalLibres, totalMonederoLibres, sortedConceptos, sortedMeses, uniqueAlumnos };
  }, [libres]);

  const totalGeneral = stats.totalPaid + stats.totalTitPaid + libresStats.totalLibres;

  return (
    <div className="w-full font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-8">
        {/* Back button */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-[#45515e] hover:text-[#222222] dark:text-gray-300 dark:hover:text-white font-medium transition-colors" style={{ fontFamily: 'var(--font-ui)' }}>
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
        </div>

        <div className="mb-6">
          <h1 className="text-[28px] font-semibold text-[#222222] dark:text-gray-100 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Estadísticas Generales</h1>
          <p className="text-[#45515e] dark:text-[#8e8e93] leading-[1.50]">Resumen financiero · {activeCiclo?.nombre || 'Ciclo activo'}</p>
        </div>

        {/* ── KPI CARDS ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {/* Ingresos Lic/Esp */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="card-interactive group relative flex flex-col bg-white dark:bg-[#1c2228] rounded-[20px] p-4 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1 transition-all duration-300"
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - r.top}px`); }}
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity duration-500 pointer-events-none" />
            <div className="w-9 h-9 rounded-[13px] bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white shadow-[var(--shadow-subtle)] mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <ListChecks size={18} />
            </div>
            <p className="text-[11px] font-semibold text-[#8e8e93] dark:text-gray-500 uppercase tracking-wider">Ingresos Plan (Lic/Esp)</p>
            <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-400 leading-tight mt-0.5" style={{ fontFamily: 'var(--font-data)' }}>${stats.totalPaid.toLocaleString()}</p>
            <p className="text-[10px] text-[#8e8e93] dark:text-gray-500 mt-1">cobrado de planes</p>
          </motion.div>

          {/* Adeudo Lic/Esp */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
            className="card-interactive group relative flex flex-col bg-white dark:bg-[#1c2228] rounded-[20px] p-4 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1 transition-all duration-300"
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - r.top}px`); }}
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-gradient-to-br from-rose-400 to-red-500 opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity duration-500 pointer-events-none" />
            <div className="w-9 h-9 rounded-[13px] bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white shadow-[var(--shadow-subtle)] mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <AlertCircle size={18} />
            </div>
            <p className="text-[11px] font-semibold text-[#8e8e93] dark:text-gray-500 uppercase tracking-wider">Adeudo Plan (Lic/Esp)</p>
            <p className="text-xl font-semibold text-rose-700 dark:text-rose-400 leading-tight mt-0.5" style={{ fontFamily: 'var(--font-data)' }}>${stats.totalOwed.toLocaleString()}</p>
            {(stats.totalPaid + stats.totalOwed) > 0 && (
              <div className="mt-2.5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  style={{ width: `${(stats.totalPaid / (stats.totalPaid + stats.totalOwed)) * 100}%` }} />
              </div>
            )}
            <p className="text-[10px] text-[#8e8e93] dark:text-gray-500 mt-1">pendiente de cobro</p>
          </motion.div>
          
          {/* Ingresos Titulación */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
            className="card-interactive group relative flex flex-col bg-white dark:bg-[#1c2228] rounded-[20px] p-4 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1 transition-all duration-300"
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - r.top}px`); }}
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-gradient-to-br from-teal-400 to-green-500 opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity duration-500 pointer-events-none" />
            <div className="w-9 h-9 rounded-[13px] bg-gradient-to-br from-teal-400 to-green-500 flex items-center justify-center text-white shadow-[var(--shadow-subtle)] mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <Banknote size={18} />
            </div>
            <p className="text-[11px] font-semibold text-[#8e8e93] dark:text-gray-500 uppercase tracking-wider">Ingresos Titulación</p>
            <p className="text-xl font-semibold text-teal-700 dark:text-teal-400 leading-tight mt-0.5" style={{ fontFamily: 'var(--font-data)' }}>${stats.totalTitPaid.toLocaleString()}</p>
            <p className="text-[10px] text-[#8e8e93] dark:text-gray-500 mt-1">cobrado en titulación</p>
          </motion.div>

          {/* Adeudo Titulación */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
            className="card-interactive group relative flex flex-col bg-white dark:bg-[#1c2228] rounded-[20px] p-4 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1 transition-all duration-300"
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - r.top}px`); }}
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity duration-500 pointer-events-none" />
            <div className="w-9 h-9 rounded-[13px] bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shadow-[var(--shadow-subtle)] mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <AlertCircle size={18} />
            </div>
            <p className="text-[11px] font-semibold text-[#8e8e93] dark:text-gray-500 uppercase tracking-wider">Adeudo Titulación</p>
            <p className="text-xl font-semibold text-orange-700 dark:text-orange-400 leading-tight mt-0.5" style={{ fontFamily: 'var(--font-data)' }}>${stats.totalTitOwed.toLocaleString()}</p>
            {(stats.totalTitPaid + stats.totalTitOwed) > 0 && (
              <div className="mt-2.5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-teal-400 to-green-500 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(20,184,166,0.5)]"
                  style={{ width: `${(stats.totalTitPaid / (stats.totalTitPaid + stats.totalTitOwed)) * 100}%` }} />
              </div>
            )}
            <p className="text-[10px] text-[#8e8e93] dark:text-gray-500 mt-1">pendiente en titulación</p>
          </motion.div>

          {/* Pagos Libres */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}
            className="card-interactive group relative flex flex-col bg-white dark:bg-[#1c2228] rounded-[20px] p-4 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-brand)] hover:-translate-y-1 transition-all duration-300"
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - r.top}px`); }}
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-gradient-to-br from-sky-400 to-blue-500 opacity-10 rounded-full blur-2xl group-hover:opacity-25 transition-opacity duration-500 pointer-events-none" />
            <div className="w-9 h-9 rounded-[13px] bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white shadow-[var(--shadow-subtle)] mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <CreditCard size={18} />
            </div>
            <p className="text-[11px] font-semibold text-[#8e8e93] dark:text-gray-500 uppercase tracking-wider">Pagos Libres</p>
            <p className="text-xl font-semibold text-sky-700 dark:text-sky-400 leading-tight mt-0.5" style={{ fontFamily: 'var(--font-data)' }}>${libresStats.totalLibres.toLocaleString()}</p>
            <p className="text-[10px] text-[#8e8e93] dark:text-gray-500 mt-1">cobros sin plan</p>
          </motion.div>

          {/* Total Caja */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}
            className="card-interactive group relative flex flex-col rounded-[20px] p-4 shadow-[var(--shadow-brand)] bg-[#1456f0] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-1 transition-all duration-300"
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - r.top}px`); }}
          >
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500 pointer-events-none" />
            <div className="w-9 h-9 rounded-[13px] bg-white/20 flex items-center justify-center text-white shadow-[var(--shadow-subtle)] mb-3 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <TrendingUp size={18} />
            </div>
            <p className="text-[11px] font-semibold text-blue-100 uppercase tracking-wider">Total Caja General</p>
            <p className="text-xl font-semibold text-white leading-tight mt-0.5" style={{ fontFamily: 'var(--font-data)' }}>${totalGeneral.toLocaleString()}</p>
            <p className="text-[10px] text-blue-200 mt-1">ingresos consolidados</p>
          </motion.div>
        </div>

        {/* ── TABS ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 p-1 bg-[#f0f0f0] dark:bg-[rgba(255,255,255,0.06)] rounded-[9999px] w-fit">
          <button
            onClick={() => setActiveTab('planes')}
            className={`flex items-center gap-2 px-5 py-2 rounded-[9999px] font-medium text-[14px] transition-all ${activeTab === 'planes' ? 'bg-white dark:bg-[#1c2228] text-[#1456f0] dark:text-[#60a5fa] shadow-[var(--shadow-subtle)]' : 'text-[#45515e] dark:text-gray-400 hover:text-[#222222] dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-[rgba(255,255,255,0.08)]'}`}
          >
            <BarChart2 size={16} /> Planes de Pago
          </button>
          <button
            onClick={() => setActiveTab('libres')}
            className={`flex items-center gap-2 px-5 py-2 rounded-[9999px] font-medium text-[14px] transition-all ${activeTab === 'libres' ? 'bg-white dark:bg-[#1c2228] text-[#1456f0] dark:text-[#60a5fa] shadow-[var(--shadow-subtle)]' : 'text-[#45515e] dark:text-gray-400 hover:text-[#222222] dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-[rgba(255,255,255,0.08)]'}`}
          >
            <CreditCard size={16} /> Pagos Libres
            {libresStats.totalLibres > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === 'libres' ? 'bg-[#1456f0] text-white' : 'bg-[#bfdbfe] text-[#1456f0]'}`}>
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
              className="bg-white dark:bg-[#181e25] rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden">
              <div className="p-6 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                <h2 className="text-[20px] font-semibold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>Desglose Mensual Ordinario</h2>
              </div>
              <div className="p-6">
                {stats.sortedMonths.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" style={{ fontFamily: 'var(--font-data)' }}>
                      <thead>
                        <tr className="bg-[#eef2ff] dark:bg-[#1c2228] text-[#45515e] dark:text-[#8e8e93] text-sm uppercase tracking-wider">
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
                            key={month} className="border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.03)]">
                            <td className="py-4 px-4 font-medium text-[#222222] dark:text-gray-200">{toTitleCase(month)}</td>
                            <td className="py-4 px-4 text-right font-semibold text-green-600 dark:text-green-400">${data.paid.toLocaleString()}</td>
                            <td className="py-4 px-4 text-right font-semibold text-red-600 dark:text-red-400">${data.owed.toLocaleString()}</td>
                            <td className="py-4 px-4 text-right font-semibold text-[#222222] dark:text-gray-100">${(data.paid + data.owed).toLocaleString()}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#f2f3f5] dark:bg-[#1c2228] font-semibold text-[#222222] dark:text-gray-100">
                          <td className="py-4 px-4 rounded-bl-lg">TOTAL</td>
                          <td className="py-4 px-4 text-right text-green-700 dark:text-green-400">${stats.totalPaid.toLocaleString()}</td>
                          <td className="py-4 px-4 text-right text-red-700 dark:text-red-400">${stats.totalOwed.toLocaleString()}</td>
                          <td className="py-4 px-4 text-right text-[#222222] dark:text-white rounded-br-lg">${(stats.totalPaid + stats.totalOwed).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-16 flex flex-col items-center">
                    <div className="bg-[#bfdbfe] dark:bg-[#1d4ed8]/30 text-[#1456f0] dark:text-[#60a5fa] w-20 h-20 rounded-[20px] flex items-center justify-center mb-4"><Inbox size={40} /></div>
                    <h3 className="text-xl font-semibold text-[#222222] dark:text-gray-200 mb-2" style={{ fontFamily: 'var(--font-display)' }}>No hay datos financieros</h3>
                    <p className="text-[#45515e] dark:text-[#8e8e93]">No se encontraron registros para este ciclo.</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Titulación rendering logic was here */}

            {/* By Licenciatura + Turno */}
            {stats.sortedLicenciaturas.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#181e25] rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden">
                  <div className="p-5 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                    <h2 className="text-[18px] font-semibold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>Por Licenciatura</h2>
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
                            <td className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={toTitleCase(lic)}>{toTitleCase(lic)}</td>
                            <td className="py-3 px-4 text-right font-semibold text-green-600">${data.paid.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-semibold text-red-500">${data.owed.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#181e25] rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden">
                  <div className="p-5 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                    <h2 className="text-[18px] font-semibold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>Por Turno</h2>
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
            {/* Monthly Breakdown Titulación */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.15 }}
              className="bg-white dark:bg-[#181e25] rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden mt-6">
              <div className="p-6 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-[20px] font-semibold text-teal-800 dark:text-teal-400" style={{ fontFamily: 'var(--font-display)' }}>Desglose Mensual (Titulación)</h2>
                <select 
                     value={filtroAnioTit} 
                     onChange={(e) => setFiltroAnioTit(e.target.value)}
                     className="bg-[#f2f3f5] dark:bg-[rgba(255,255,255,0.06)] border-none text-teal-800 dark:text-teal-200 text-sm font-semibold py-1.5 px-3 rounded-[8px] outline-none cursor-pointer focus:ring-2 focus:ring-teal-500/50"
                >
                     <option value="todo">Todos los años</option>
                     {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 8 + i).map(y => (
                         <option key={y} value={y.toString()}>Año {y}</option>
                     ))}
                </select>
              </div>
              <div className="p-6">
                {stats.sortedTitMonths.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" style={{ fontFamily: 'var(--font-data)' }}>
                      <thead>
                        <tr className="bg-[#eef2ff] dark:bg-[#1c2228] text-[#45515e] dark:text-[#8e8e93] text-sm uppercase tracking-wider">
                          <th className="py-3 px-4 font-semibold rounded-tl-lg">Mes / Periodo</th>
                          <th className="py-3 px-4 font-semibold text-right">Ingresos (Pagado)</th>
                          <th className="py-3 px-4 font-semibold text-right">Adeudo (Pendiente)</th>
                          <th className="py-3 px-4 font-semibold text-right rounded-tr-lg">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.sortedTitMonths.map(([month, data], idx) => (
                          <motion.tr
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + idx * 0.05, duration: 0.2 }}
                            key={month} className="border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)] hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.03)]">
                            <td className="py-4 px-4 font-medium text-[#222222] dark:text-gray-200">{toTitleCase(month)}</td>
                            <td className="py-4 px-4 text-right font-semibold text-teal-600 dark:text-teal-400">${data.paid.toLocaleString()}</td>
                            <td className="py-4 px-4 text-right font-semibold text-orange-500 dark:text-orange-400">${data.owed.toLocaleString()}</td>
                            <td className="py-4 px-4 text-right font-semibold text-[#222222] dark:text-gray-100">${(data.paid + data.owed).toLocaleString()}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#f2f3f5] dark:bg-[#1c2228] font-semibold text-teal-900 dark:text-teal-100">
                          <td className="py-4 px-4 rounded-bl-lg">TOTAL TITULACIÓN</td>
                          <td className="py-4 px-4 text-right text-teal-700 dark:text-teal-300">${stats.totalTitPaid.toLocaleString()}</td>
                          <td className="py-4 px-4 text-right text-orange-600 dark:text-orange-400">${stats.totalTitOwed.toLocaleString()}</td>
                          <td className="py-4 px-4 text-right text-[#222222] dark:text-white rounded-br-lg">${(stats.totalTitPaid + stats.totalTitOwed).toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No hay ingresos de titulación este año.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* ── TAB: PAGOS LIBRES ─────────────────────────────────────────────── */}
        {activeTab === 'libres' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
            {loadingLibres ? (
              <LoadingSkeleton type="table" text="Cargando pagos libres..." />
            ) : libres.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center bg-white dark:bg-[#181e25] rounded-[20px] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)]">
                <div className="bg-[#bfdbfe] dark:bg-[#1d4ed8]/30 text-[#1456f0] dark:text-[#60a5fa] w-20 h-20 rounded-[20px] flex items-center justify-center mb-4"><CreditCard size={36} /></div>
                <h3 className="text-xl font-semibold text-[#222222] dark:text-gray-100 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Sin pagos libres</h3>
                <p className="text-[#45515e] dark:text-[#8e8e93] text-sm">No hay cobros libres (sin plan) en este ciclo.</p>
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-[#1c2228] p-4 rounded-[20px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] flex flex-col justify-center">
                    <span className="text-[11px] font-semibold text-[#1456f0] uppercase tracking-wider mb-1">Total recaudado</span>
                    <span className="text-3xl font-semibold text-[#1456f0] dark:text-[#60a5fa] leading-none mb-1" style={{ fontFamily: 'var(--font-data)' }}>${libresStats.totalLibres.toLocaleString()}</span>
                    {libresStats.totalMonederoLibres > 0 && (
                      <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800/50 rounded flex items-center gap-1 w-fit px-1.5 py-0.5 border border-blue-200/50">
                        Vía Monedero: ${libresStats.totalMonederoLibres.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                  <div className="bg-white dark:bg-[#1c2228] p-4 rounded-[20px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] flex flex-col">
                    <span className="text-[11px] font-semibold text-[#45515e] uppercase tracking-wider mb-1">Registros</span>
                    <span className="text-3xl font-semibold text-[#222222] dark:text-gray-200" style={{ fontFamily: 'var(--font-data)' }}>{libres.length}</span>
                  </div>
                  <div className="bg-white dark:bg-[#1c2228] p-4 rounded-[20px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] flex flex-col">
                    <span className="text-[11px] font-semibold text-[#45515e] uppercase tracking-wider mb-1">Alumnos únicos</span>
                    <span className="text-3xl font-semibold text-[#222222] dark:text-gray-200" style={{ fontFamily: 'var(--font-data)' }}>{libresStats.uniqueAlumnos}</span>
                  </div>
                </div>

                {/* By concepto */}
                <div className="bg-white dark:bg-[#181e25] rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden">
                  <div className="p-5 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                    <h2 className="text-[18px] font-semibold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>Por Concepto</h2>
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
                  <div className="bg-white dark:bg-[#181e25] rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] overflow-hidden">
                    <div className="p-5 border-b border-[#f2f3f5] dark:border-[rgba(255,255,255,0.06)]">
                      <h2 className="text-[18px] font-semibold text-[#222222] dark:text-gray-100" style={{ fontFamily: 'var(--font-display)' }}>Por Mes</h2>
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
