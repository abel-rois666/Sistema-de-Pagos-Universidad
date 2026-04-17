import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, AlertTriangle, Search, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Printer, ChevronDown } from 'lucide-react';
import { PaymentPlan } from '../types';
import { isPaid, getRestanteFromEstatus , toTitleCase} from '../utils';
import { printElement } from '../lib/printUtils';
import { MultiSelectFilter } from './MultiSelectFilter';

interface DeudoresProps {
  plans: PaymentPlan[];
  alumnos: import('../types').Alumno[];
  onBack: () => void;
  onNavigateToAlumno: (alumnoId: string) => void;
}

interface DebtRecord {
  id: string;
  alumno_id: string;
  alumno: string;
  licenciatura: string;
  grado: string;
  turno: string;
  concepto: string;
  tipo_plan: string;
  monto: number;
  fecha_limite: string;
}

type SortKey = keyof DebtRecord;



// ── Helpers de fecha ────────────────────────────────────────────────────────
const parsePaymentDate = (dStr: string): Date | null => {
  if (!dStr) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
    const [d, m, y] = dStr.split('/');
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
    const [y, m, d] = dStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return null;
};

// ── Main Component ──────────────────────────────────────────────────────────
export default function Deudores({ plans, alumnos, onBack, onNavigateToAlumno }: DeudoresProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLicenciaturas, setFilterLicenciaturas] = useState<string[]>([]);
  const [filterGrados, setFilterGrados] = useState<string[]>([]);
  const [filterTurnos, setFilterTurnos] = useState<string[]>([]);
  const [filterConceptos, setFilterConceptos] = useState<string[]>([]);
  const [filterTiposPlan, setFilterTiposPlan] = useState<string[]>([]);
  const [filterFechas, setFilterFechas] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const printDeudoresRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = filterLicenciaturas.length > 0 || filterGrados.length > 0 || filterTurnos.length > 0 || filterConceptos.length > 0 || filterTiposPlan.length > 0 || filterFechas.length > 0;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig, itemsPerPage, filterLicenciaturas, filterGrados, filterTurnos, filterConceptos, filterTiposPlan, filterFechas]);

  // Filter out plans for students that are 'BAJA'
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const alumno = alumnos.find(a => a.id === p.alumno_id || a.nombre_completo === p.nombre_alumno);
      return alumno?.estatus !== 'BAJA';
    });
  }, [plans, alumnos]);

  const debtors = useMemo(() => {
    const records: DebtRecord[] = [];
    // Fecha de hoy al final del día (cualquier vencimiento <= hoy aplica)
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const checkDebt = (plan: PaymentPlan, alumnoId: string, concepto: string, cantidad: number, estatus: string, fecha: string) => {
      if (cantidad > 0 && !isPaid(estatus)) {
        // --- NUEVO: solo incluir si ya venció (fecha_limite <= hoy) ---
        const fechaDate = parsePaymentDate(fecha);
        if (!fechaDate || fechaDate > today) return;

        let fallbackGrado = '';
        let fallbackTurno = '';
        if (plan.grado_turno && plan.grado_turno.includes('/')) {
            const parts = plan.grado_turno.split('/');
            fallbackGrado = parts[0].trim();
            fallbackTurno = parts[1].trim();
        }

        // Usar el saldo real pendiente (no el monto original del concepto)
        const montoReal = getRestanteFromEstatus(estatus, Number(cantidad));

        records.push({
          id: `${plan.id}-${concepto}`,
          alumno_id: alumnoId,
          alumno: plan.nombre_alumno,
          licenciatura: plan.licenciatura || '',
          grado: plan.grado || fallbackGrado,
          turno: plan.turno || fallbackTurno,
          concepto: concepto,
          tipo_plan: plan.tipo_plan || 'Indefinido',
          monto: montoReal,
          fecha_limite: fecha
        });
      }
    };

    filteredPlans.forEach(plan => {
      const alumno = alumnos.find(a => a.id === plan.alumno_id || a.nombre_completo === plan.nombre_alumno);
      const alumnoId = alumno?.id || plan.alumno_id || '';
      for (let i = 1; i <= 15; i++) {
        const concepto = plan[`concepto_${i}` as keyof PaymentPlan] as string | undefined;
        const cantidad = plan[`cantidad_${i}` as keyof PaymentPlan] as number | undefined;
        const estatus = plan[`estatus_${i}` as keyof PaymentPlan] as string | undefined;
        const fecha = plan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (concepto && cantidad && fecha) {
          checkDebt(plan, alumnoId, concepto, cantidad, estatus || '', fecha);
        }
      }
    });

    // Sort by student name
    return records.sort((a, b) => a.alumno.localeCompare(b.alumno));
  }, [filteredPlans, alumnos]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [y, m, d] = dateString.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateString;
  };

  // Opciones únicas para cada filtro
  const licenciaturas = useMemo(() => Array.from(new Set(debtors.map(d => d.licenciatura).filter(Boolean))).sort(), [debtors]);
  const grados = useMemo(() => Array.from(new Set(debtors.map(d => d.grado).filter(Boolean))).sort(), [debtors]);
  const turnos = useMemo(() => Array.from(new Set(debtors.map(d => d.turno).filter(Boolean))).sort(), [debtors]);
  const tiposPlan = useMemo(() => Array.from(new Set(debtors.map(d => d.tipo_plan).filter(Boolean))).sort(), [debtors]);
  const conceptos = useMemo(() => Array.from(new Set(debtors.map(d => d.concepto).filter(Boolean))).sort(), [debtors]);
  const fechas = useMemo(() => Array.from(new Set(debtors.map(d => formatDate(d.fecha_limite)).filter(Boolean) as string[])).sort((a: string, b: string) => {
      const parseDate = (dStr: string) => {
         if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
             const [d, m, y] = dStr.split('/');
             return new Date(Number(y), Number(m)-1, Number(d)).getTime();
         }
         return new Date(dStr).getTime() || 0;
      };
      return parseDate(a) - parseDate(b);
  }), [debtors]);

  // Filtrado multiselección
  const filteredDebtors = debtors.filter(d => {
    const matchSearch = d.alumno.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        d.concepto.toLowerCase().includes(searchTerm.toLowerCase());
    const matchLic = filterLicenciaturas.length === 0 || filterLicenciaturas.includes(d.licenciatura);
    const matchGrado = filterGrados.length === 0 || filterGrados.includes(d.grado);
    const matchTurno = filterTurnos.length === 0 || filterTurnos.includes(d.turno);
    const matchTipoPlan = filterTiposPlan.length === 0 || filterTiposPlan.includes(d.tipo_plan);
    const matchConcepto = filterConceptos.length === 0 || filterConceptos.includes(d.concepto);
    const matchFecha = filterFechas.length === 0 || filterFechas.includes(formatDate(d.fecha_limite));
    return matchSearch && matchLic && matchGrado && matchTurno && matchTipoPlan && matchConcepto && matchFecha;
  });

  const sortedDebtors = useMemo(() => {
    let sortableItems = [...filteredDebtors];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'fecha_limite') {
          const parseDate = (dStr: string) => {
             if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
                 const [d, m, y] = dStr.split('/');
                 return new Date(Number(y), Number(m)-1, Number(d)).getTime();
             }
             return new Date(dStr).getTime() || 0;
          };
          const tA = parseDate(a.fecha_limite);
          const tB = parseDate(b.fecha_limite);
          return sortConfig.direction === 'asc' ? tA - tB : tB - tA;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredDebtors, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="text-[#8e8e93] opacity-50 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />;
  };

  const clearAllFilters = () => {
    setFilterLicenciaturas([]);
    setFilterGrados([]);
    setFilterTurnos([]);
    setFilterTiposPlan([]);
    setFilterConceptos([]);
    setFilterFechas([]);
  };

  const totalDebt = filteredDebtors.reduce((sum, d) => sum + d.monto, 0);

  const totalPages = Math.ceil(sortedDebtors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedDebtors.length);
  const paginatedDebtors = sortedDebtors.slice(startIndex, endIndex);

  // Resumen de filtros activos para mostrar en la barra
  const activeFilterSummary = [
    filterLicenciaturas.length > 0 && `Lic.: ${filterLicenciaturas.length}`,
    filterGrados.length > 0 && `Grado: ${filterGrados.length}`,
    filterTurnos.length > 0 && `Turno: ${filterTurnos.length}`,
    filterTiposPlan.length > 0 && `Tipo de Plan: ${filterTiposPlan.length}`,
    filterConceptos.length > 0 && `Concepto: ${filterConceptos.length}`,
    filterFechas.length > 0 && `Fecha: ${filterFechas.length}`,
  ].filter(Boolean) as string[];

  return (
    <div className="w-full font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8">
        
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-[#45515e] hover:text-black dark:text-gray-300 dark:hover:text-white font-bold transition-colors"
          >
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
          <button
            onClick={() => { if (printDeudoresRef.current) printElement(printDeudoresRef.current, { landscape: true }); }}
            className="flex items-center gap-2 bg-[#1c2228] hover:bg-gray-900 border border-[rgba(255,255,255,0.08)] text-white px-4 py-2 rounded-[8px] font-medium shadow-[var(--shadow-subtle)] transition-colors"
          >
            <Printer size={18} /> Imprimir PDF
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#222222] dark:text-gray-100 mb-1 flex items-center gap-3">
              Lista de Deudores <AlertTriangle className="text-red-500" size={24} />
            </h1>
            <p className="text-[#8e8e93] dark:text-[#8e8e93]">Alumnos con pagos vencidos a la fecha de hoy</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-[#8e8e93] dark:text-[#8e8e93]" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] leading-5 bg-white dark:bg-[#1c2228] dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-blue-500 sm:text-sm transition-all"
                placeholder="Buscar alumno o concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-[8px] font-medium border transition-colors ${showFilters || hasActiveFilters ? 'bg-indigo-50 border-indigo-200 text-[#1456f0] dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white border-gray-300 text-[#45515e] hover:bg-[#f2f3f5] dark:bg-[#1c2228] dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}
            >
              <Filter size={18} />
              Filtros
              {hasActiveFilters && (
                <span className="bg-[#1456f0] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {activeFilterSummary.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filtros activos — chips resumen siempre visibles */}
        {hasActiveFilters && !showFilters && (
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <span className="text-xs text-[#8e8e93] dark:text-[#8e8e93] font-semibold uppercase tracking-wider">Filtros:</span>
            {filterLicenciaturas.map(v => (
              <span key={v} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-[#1456f0] dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {v} <button onClick={() => setFilterLicenciaturas(p => p.filter(x => x !== v))}><X size={11} /></button>
              </span>
            ))}
            {filterGrados.map(v => (
              <span key={v} className="flex items-center gap-1 bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {v} <button onClick={() => setFilterGrados(p => p.filter(x => x !== v))}><X size={11} /></button>
              </span>
            ))}
            {filterTurnos.map(v => (
              <span key={v} className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {v} <button onClick={() => setFilterTurnos(p => p.filter(x => x !== v))}><X size={11} /></button>
              </span>
            ))}
            {filterTiposPlan.map(v => (
              <span key={v} className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {v} <button onClick={() => setFilterTiposPlan(p => p.filter(x => x !== v))}><X size={11} /></button>
              </span>
            ))}
            {filterConceptos.map(v => (
              <span key={v} className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {v} <button onClick={() => setFilterConceptos(p => p.filter(x => x !== v))}><X size={11} /></button>
              </span>
            ))}
            {filterFechas.map(v => (
              <span key={v} className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                {v} <button onClick={() => setFilterFechas(p => p.filter(x => x !== v))}><X size={11} /></button>
              </span>
            ))}
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:text-red-700 font-semibold ml-1"
            >
              <X size={13} /> Limpiar todo
            </button>
          </div>
        )}

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-visible mb-6"
            >
              <div className="bg-white dark:bg-[#1c2228] p-4 rounded-[13px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)]">
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="text-xs font-semibold text-[#8e8e93] dark:text-[#8e8e93] uppercase tracking-wider mr-1">Filtrar por:</span>

                  <MultiSelectFilter
                    label="Licenciatura"
                    options={licenciaturas}
                    selected={filterLicenciaturas}
                    onChange={setFilterLicenciaturas}
                  />
                  <MultiSelectFilter
                    label="Grado"
                    options={grados}
                    selected={filterGrados}
                    onChange={setFilterGrados}
                  />
                  <MultiSelectFilter
                    label="Turno"
                    options={turnos}
                    selected={filterTurnos}
                    onChange={setFilterTurnos}
                  />
                  <MultiSelectFilter
                    label="Tipo de Plan"
                    options={tiposPlan}
                    selected={filterTiposPlan}
                    onChange={setFilterTiposPlan}
                  />
                  <MultiSelectFilter
                    label="Concepto"
                    options={conceptos}
                    selected={filterConceptos}
                    onChange={setFilterConceptos}
                  />
                  <MultiSelectFilter
                    label="Fecha"
                    options={fechas}
                    selected={filterFechas}
                    onChange={setFilterFechas}
                  />

                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[8px] transition-colors ml-2"
                    >
                      <X size={15} /> Limpiar
                    </button>
                  )}
                </div>

                {/* Chips de selección activa */}
                {hasActiveFilters && (
                  <div className="mt-3 pt-3 border-t border-[#f2f3f5] dark:border-[rgba(255,255,255,0.08)] flex flex-wrap gap-2">
                    {filterLicenciaturas.map(v => (
                      <span key={v} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/40 text-[#1456f0] dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {v} <button onClick={() => setFilterLicenciaturas(p => p.filter(x => x !== v))}><X size={11} /></button>
                      </span>
                    ))}
                    {filterGrados.map(v => (
                      <span key={v} className="flex items-center gap-1 bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {v} <button onClick={() => setFilterGrados(p => p.filter(x => x !== v))}><X size={11} /></button>
                      </span>
                    ))}
                    {filterTurnos.map(v => (
                      <span key={v} className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {v} <button onClick={() => setFilterTurnos(p => p.filter(x => x !== v))}><X size={11} /></button>
                      </span>
                    ))}
                    {filterTiposPlan.map(v => (
                      <span key={v} className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {v} <button onClick={() => setFilterTiposPlan(p => p.filter(x => x !== v))}><X size={11} /></button>
                      </span>
                    ))}
                    {filterConceptos.map(v => (
                      <span key={v} className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {v} <button onClick={() => setFilterConceptos(p => p.filter(x => x !== v))}><X size={11} /></button>
                      </span>
                    ))}
                    {filterFechas.map(v => (
                      <span key={v} className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {v} <button onClick={() => setFilterFechas(p => p.filter(x => x !== v))}><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white dark:bg-[#1c2228] rounded-[20px] shadow-[var(--shadow-subtle)] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] overflow-hidden flex flex-col">
          
          {/* Resumen compacto */}
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-red-100 dark:border-red-900/30 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20">
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-[13px] px-4 py-3 border border-red-100 dark:border-red-900/40 shadow-[var(--shadow-subtle)] flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-[8px] flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider">Registros Pendientes</p>
                <p className="text-lg font-semibold text-red-800 dark:text-red-200 leading-none">{filteredDebtors.length.toLocaleString()}
                  {hasActiveFilters && <span className="ml-1.5 text-xs font-semibold text-red-500">(filtrado)</span>}</p>
              </div>
            </div>
            <div className="flex-1 bg-white dark:bg-gray-900 rounded-[13px] px-4 py-3 border border-rose-100 dark:border-rose-900/40 shadow-[var(--shadow-subtle)] flex items-center gap-3">
              <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/40 rounded-[8px] flex items-center justify-center">
                <span className="text-rose-600 dark:text-rose-400 font-black text-sm">$</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Total Adeudado</p>
                <p className="text-lg font-semibold text-rose-800 dark:text-rose-200 leading-none">${totalDebt.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#eef2ff] dark:bg-gray-900/50 text-[#45515e] dark:text-gray-300 text-sm uppercase tracking-wider border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-[#1c2228] transition-colors" onClick={() => requestSort('alumno')}>
                     <div className="flex items-center gap-2">Alumno {getSortIcon('alumno')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-[#1c2228] transition-colors" onClick={() => requestSort('licenciatura')}>
                     <div className="flex items-center gap-2">Licenciatura {getSortIcon('licenciatura')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-[#1c2228] transition-colors w-24" onClick={() => requestSort('grado')}>
                     <div className="flex items-center gap-2">Grado {getSortIcon('grado')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-[#1c2228] transition-colors w-24" onClick={() => requestSort('turno')}>
                     <div className="flex items-center gap-2">Turno {getSortIcon('turno')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-[#1c2228] transition-colors" onClick={() => requestSort('concepto')}>
                     <div className="flex items-center gap-2">Concepto Adeudado {getSortIcon('concepto')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-[#1c2228] transition-colors w-32" onClick={() => requestSort('tipo_plan')}>
                     <div className="flex items-center gap-2">Tipo Plan {getSortIcon('tipo_plan')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-[#1c2228] transition-colors" onClick={() => requestSort('fecha_limite')}>
                     <div className="flex items-center gap-2">Fecha Límite {getSortIcon('fecha_limite')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold text-right cursor-pointer group hover:bg-gray-100 dark:hover:bg-[#1c2228] transition-colors" onClick={() => requestSort('monto')}>
                     <div className="flex items-center justify-end gap-2">{getSortIcon('monto')} Monto</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedDebtors.length > 0 ? (
                  paginatedDebtors.map((record, idx) => (
                    <motion.tr 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: idx * 0.05, duration: 0.2 }}
                      key={record.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/20 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#222222] dark:text-gray-100">
                        {record.alumno_id ? (
                          <button
                            onClick={() => onNavigateToAlumno(record.alumno_id)}
                            className="text-left hover:text-blue-700 dark:hover:text-blue-400 hover:underline underline-offset-2 transition-colors"
                            title="Ver ficha del alumno"
                          >
                            {toTitleCase(record.alumno)}
                          </button>
                        ) : (
                          toTitleCase(record.alumno)
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#45515e] dark:text-[#8e8e93] text-sm max-w-[150px] truncate" title={toTitleCase(record.licenciatura)}>{toTitleCase(record.licenciatura)}</td>
                      <td className="py-3 px-4 text-[#1456f0] dark:text-indigo-400 font-medium text-sm">{record.grado}</td>
                      <td className="py-3 px-4 text-cyan-700 dark:text-cyan-400 font-medium text-sm">{record.turno}</td>
                      <td className="py-3 px-4 text-[#222222] dark:text-gray-200 font-medium">{record.concepto}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                          record.tipo_plan === 'Titulación' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                          record.tipo_plan === 'Especialidad Completa' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                          'bg-[#bfdbfe] text-[#1456f0] dark:bg-indigo-900/40 dark:text-indigo-300'
                        }`}>
                          {record.tipo_plan}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#8e8e93] dark:text-[#8e8e93] text-sm">{formatDate(record.fecha_limite)}</td>
                      <td className="py-3 px-4 text-right font-bold text-red-600 dark:text-red-400">${record.monto.toLocaleString()}</td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        {searchTerm || hasActiveFilters ? (
                          <>
                            <div className="bg-gray-100 dark:bg-gray-700 text-[#8e8e93] w-16 h-16 rounded-full flex items-center justify-center mb-4">
                              <Search size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-[#222222] dark:text-gray-100 mb-1">Sin resultados</h3>
                            <p className="text-[#8e8e93] dark:text-[#8e8e93]">No se encontraron deudores con los filtros actuales.</p>
                            {hasActiveFilters && (
                              <button onClick={clearAllFilters} className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#1456f0] dark:text-indigo-400 hover:underline">
                                <X size={14} /> Limpiar filtros
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="relative">
                              <div className="absolute inset-0 bg-green-500/20 dark:bg-green-400/20 rounded-full blur-xl animate-pulse" />
                              <div className="relative bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/20 text-green-600 dark:text-green-400 w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-[var(--shadow-subtle)] border border-green-200 dark:border-green-800/50">
                                <CheckCircle size={40} className="drop-shadow-[var(--shadow-subtle)]" />
                              </div>
                            </div>
                            <h3 className="text-xl font-bold text-[#222222] dark:text-gray-100 mb-2">¡Todo al corriente!</h3>
                            <p className="text-[#8e8e93] dark:text-[#8e8e93] mb-6">No hay alumnos con pagos pendientes en este ciclo escolar.</p>
                            <button 
                              onClick={onBack} 
                              className="bg-[#1c2228] dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white px-6 py-2 rounded-[8px] font-medium transition-colors flex items-center gap-2"
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

          {sortedDebtors.length > 0 && (
            <div className="p-4 border-t border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] bg-[#f2f3f5] dark:bg-gray-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#8e8e93] dark:text-[#8e8e93] font-medium">Mostrar</span>
                <select 
                  className="border border-gray-300 dark:border-gray-600 rounded-md text-sm p-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-[#3b82f6] font-medium cursor-pointer"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-[#8e8e93] dark:text-[#8e8e93] font-medium">deudores</span>
              </div>
              <div className="text-sm text-[#8e8e93] dark:text-[#8e8e93] font-medium bg-white dark:bg-gray-700 px-3 py-1.5 rounded-[8px] border border-[#e5e7eb] dark:border-gray-600 shadow-[var(--shadow-subtle)]">
                Mostrando <span className="text-gray-900 dark:text-white font-bold">{startIndex + 1}</span> a <span className="text-gray-900 dark:text-white font-bold">{endIndex}</span> de <span className="text-gray-900 dark:text-white font-bold">{sortedDebtors.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-[8px] disabled:opacity-40 hover:bg-white dark:hover:bg-gray-600 text-[#45515e] dark:text-gray-200 font-bold transition-all shadow-[var(--shadow-subtle)] hover:shadow active:scale-95"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#45515e] dark:text-gray-300 font-medium">Página</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages || 1}
                    value={currentPage || ''}
                    title="Ir a página"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') { setCurrentPage(val as any); return; }
                      let p = parseInt(val, 10);
                      if (isNaN(p)) return;
                      if (p > totalPages) p = totalPages;
                      if (p < 1) p = 1;
                      setCurrentPage(p);
                    }}
                    onBlur={() => { if (!currentPage || currentPage < 1) setCurrentPage(1); }}
                    className="w-16 border border-gray-300 dark:border-gray-600 rounded-md p-1.5 text-center text-sm font-bold bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#3b82f6] transition-all"
                  />
                  <span className="text-sm text-[#45515e] dark:text-gray-300 font-medium">de {totalPages || 1}</span>
                </div>
                <button 
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-[8px] disabled:opacity-40 hover:bg-white dark:hover:bg-gray-600 text-[#45515e] dark:text-gray-200 font-bold transition-all shadow-[var(--shadow-subtle)] hover:shadow active:scale-95"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- VERSIÓN IMPRESIÓN --- */}
        <div ref={printDeudoresRef} style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: '1020px', background: 'white', color: 'black', fontFamily: 'sans-serif', padding: '10px' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Reporte de Deudores</h1>
            <p style={{ color: '#4b5563', fontWeight: 500 }}>Documento generado el {new Date().toLocaleDateString('es-MX')}</p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', borderBottom: '2px solid #1f2937', paddingBottom: '8px' }}>
            <div>
               <p style={{ fontWeight: 600, fontSize: '11px' }}>Filtros aplicados:</p>
               <p style={{ fontSize: '10px', color: '#4b5563', marginTop: '4px', maxWidth: '350px' }}>
                  {!hasActiveFilters && !searchTerm ?
                    'Ninguno (Todos los resultados)' :
                    [
                       searchTerm && `Búsqueda: "${searchTerm}"`,
                       filterLicenciaturas.length > 0 && `Lic: ${filterLicenciaturas.join(', ')}`,
                       filterGrados.length > 0 && `Grado: ${filterGrados.join(', ')}`,
                       filterTurnos.length > 0 && `Turno: ${filterTurnos.join(', ')}`,
                       filterTiposPlan.length > 0 && `Tipo: ${filterTiposPlan.join(', ')}`,
                       filterConceptos.length > 0 && `Concepto: ${filterConceptos.join(', ')}`,
                       filterFechas.length > 0 && `Fecha Lím.: ${filterFechas.join(', ')}`
                    ].filter(Boolean).join(' • ')
                  }
               </p>
            </div>
            <div style={{ textAlign: 'right' }}>
               <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Total de Alumnos: {sortedDebtors.length}</div>
               <div style={{ fontWeight: 'bold', fontSize: '15px' }}>Monto Total: ${totalDebt.toLocaleString()}</div>
            </div>
          </div>

          {sortedDebtors.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', tableLayout: 'fixed' }}>
               <thead>
                  <tr style={{ borderBottom: '2px solid #1f2937', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                     <th style={{ padding: '4px 3px', fontWeight: 'bold', width: '22%', textAlign: 'left' }}>Alumno</th>
                     <th style={{ padding: '4px 3px', fontWeight: 'bold', width: '14%', textAlign: 'left' }}>Licenciatura</th>
                     <th style={{ padding: '4px 3px', fontWeight: 'bold', width: '6%', textAlign: 'center' }}>Grado</th>
                     <th style={{ padding: '4px 3px', fontWeight: 'bold', width: '5%', textAlign: 'center' }}>Trn</th>
                     <th style={{ padding: '4px 3px', fontWeight: 'bold', width: '18%', textAlign: 'left' }}>Concepto</th>
                     <th style={{ padding: '4px 3px', fontWeight: 'bold', width: '12%', textAlign: 'center' }}>Tipo Plan</th>
                     <th style={{ padding: '4px 3px', fontWeight: 'bold', width: '11%', textAlign: 'center' }}>Fecha Lím.</th>
                     <th style={{ padding: '4px 3px', fontWeight: 'bold', width: '12%', textAlign: 'right' }}>Monto</th>
                  </tr>
               </thead>
               <tbody>
                  {sortedDebtors.map(record => (
                     <tr key={record.id} style={{ borderBottom: '1px solid #d1d5db' }}>
                        <td style={{ padding: '3px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(record.alumno)}</td>
                        <td style={{ padding: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(record.licenciatura)}</td>
                        <td style={{ padding: '3px', textAlign: 'center' }}>{record.grado}</td>
                        <td style={{ padding: '3px', textAlign: 'center' }}>{record.turno.substring(0,3)}</td>
                        <td style={{ padding: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.concepto}</td>
                        <td style={{ padding: '3px', textAlign: 'center', fontSize: '8px' }}>{record.tipo_plan}</td>
                        <td style={{ padding: '3px', textAlign: 'center' }}>{formatDate(record.fecha_limite)}</td>
                        <td style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold', color: '#111827' }}>${record.monto.toLocaleString()}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0', fontWeight: 'bold', border: '1px dashed #d1d5db', marginTop: '32px', borderRadius: '8px' }}>
               No se encontraron registros para generar el reporte con los criterios actuales.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
