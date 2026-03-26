import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, AlertTriangle, Search, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Printer } from 'lucide-react';
import { PaymentPlan } from '../types';
import { isPaid } from '../utils';

interface DeudoresProps {
  plans: PaymentPlan[];
  alumnos: import('../types').Alumno[];
  onBack: () => void;
}

interface DebtRecord {
  id: string;
  alumno: string;
  licenciatura: string;
  grado: string;
  turno: string;
  concepto: string;
  monto: number;
  fecha_limite: string;
}

type SortKey = keyof DebtRecord;

export default function Deudores({ plans, alumnos, onBack }: DeudoresProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLicenciatura, setFilterLicenciatura] = useState('');
  const [filterGrado, setFilterGrado] = useState('');
  const [filterTurno, setFilterTurno] = useState('');
  const [filterConcepto, setFilterConcepto] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig, itemsPerPage, filterLicenciatura, filterGrado, filterTurno, filterConcepto, filterFecha]);

  // Filter out plans for students that are 'BAJA'
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const alumno = alumnos.find(a => a.id === p.alumno_id || a.nombre_completo === p.nombre_alumno);
      return alumno?.estatus !== 'BAJA';
    });
  }, [plans, alumnos]);

  const debtors = useMemo(() => {
    const records: DebtRecord[] = [];

    const checkDebt = (plan: PaymentPlan, concepto: string, cantidad: number, estatus: string, fecha: string) => {
      if (cantidad > 0 && !isPaid(estatus)) {
        let fallbackGrado = '';
        let fallbackTurno = '';
        if (plan.grado_turno && plan.grado_turno.includes('/')) {
            const parts = plan.grado_turno.split('/');
            fallbackGrado = parts[0].trim();
            fallbackTurno = parts[1].trim();
        }

        records.push({
          id: `${plan.id}-${concepto}`,
          alumno: plan.nombre_alumno,
          licenciatura: plan.licenciatura || '',
          grado: plan.grado || fallbackGrado,
          turno: plan.turno || fallbackTurno,
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

  const licenciaturas = useMemo(() => Array.from(new Set(debtors.map(d => d.licenciatura).filter(Boolean))).sort(), [debtors]);
  const grados = useMemo(() => Array.from(new Set(debtors.map(d => d.grado).filter(Boolean))).sort(), [debtors]);
  const turnos = useMemo(() => Array.from(new Set(debtors.map(d => d.turno).filter(Boolean))).sort(), [debtors]);
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

  const filteredDebtors = debtors.filter(d => {
    const matchSearch = d.alumno.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        d.concepto.toLowerCase().includes(searchTerm.toLowerCase());
    const matchLic = filterLicenciatura ? d.licenciatura === filterLicenciatura : true;
    const matchGrado = filterGrado ? d.grado === filterGrado : true;
    const matchTurno = filterTurno ? d.turno === filterTurno : true;
    const matchConcepto = filterConcepto ? d.concepto === filterConcepto : true;
    const matchFecha = filterFecha ? formatDate(d.fecha_limite) === filterFecha : true;
    return matchSearch && matchLic && matchGrado && matchTurno && matchConcepto && matchFecha;
  });

  const sortedDebtors = useMemo(() => {
    let sortableItems = [...filteredDebtors];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'fecha_limite') {
          // Intentar parsear fecha dd/mm/yyyy o yyyy-mm-dd
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
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 opacity-50 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />;
  };

  const totalDebt = filteredDebtors.reduce((sum, d) => sum + d.monto, 0);

  const totalPages = Math.ceil(sortedDebtors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedDebtors.length);
  const paginatedDebtors = sortedDebtors.slice(startIndex, endIndex);

  return (
    <div className="w-full font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center justify-between mb-8 print:hidden">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-black dark:text-gray-300 dark:hover:text-white font-bold transition-colors"
          >
            <ArrowLeft size={20} /> Volver al Inicio
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
          >
            <Printer size={18} /> Imprimir PDF
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-3">
              Lista de Deudores <AlertTriangle className="text-red-500" size={28} />
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Alumnos con pagos pendientes en el ciclo activo</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg leading-5 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                placeholder="Buscar alumno o concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium border transition-colors ${showFilters || filterLicenciatura || filterGrado || filterTurno || filterConcepto || filterFecha ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}
            >
              <Filter size={18} />
              Filtros {(filterLicenciatura || filterGrado || filterTurno || filterConcepto || filterFecha) && <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Licenciatura</label>
                  <select value={filterLicenciatura} onChange={e => setFilterLicenciatura(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Todas</option>
                    {licenciaturas.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-32">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Grado</label>
                  <select value={filterGrado} onChange={e => setFilterGrado(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Todos</option>
                    {grados.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-32">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Turno</label>
                  <select value={filterTurno} onChange={e => setFilterTurno(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Todos</option>
                    {turnos.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Concepto</label>
                  <select value={filterConcepto} onChange={e => setFilterConcepto(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Todos</option>
                    {conceptos.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-40">
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Fecha</label>
                  <select value={filterFecha} onChange={e => setFilterFecha(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Todas</option>
                    {fechas.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                {(filterLicenciatura || filterGrado || filterTurno || filterConcepto || filterFecha) && (
                  <button
                    onClick={() => { setFilterLicenciatura(''); setFilterGrado(''); setFilterTurno(''); setFilterConcepto(''); setFilterFecha(''); }}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <X size={16} /> Limpiar
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col print:hidden">
          
          <div className="bg-red-50 dark:bg-red-900/40 p-4 border-b border-red-100 dark:border-red-900/50 flex justify-between items-center">
            <span className="text-red-800 dark:text-red-300 font-medium">
              Mostrando {filteredDebtors.length} registro(s) pendiente(s)
            </span>
            <span className="text-red-800 dark:text-red-300 font-bold text-xl">
              Total Adeudado: ${totalDebt.toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-300 text-sm uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => requestSort('alumno')}>
                     <div className="flex items-center gap-2">Alumno {getSortIcon('alumno')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => requestSort('licenciatura')}>
                     <div className="flex items-center gap-2">Licenciatura {getSortIcon('licenciatura')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-24" onClick={() => requestSort('grado')}>
                     <div className="flex items-center gap-2">Grado {getSortIcon('grado')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-24" onClick={() => requestSort('turno')}>
                     <div className="flex items-center gap-2">Turno {getSortIcon('turno')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => requestSort('concepto')}>
                     <div className="flex items-center gap-2">Concepto Adeudado {getSortIcon('concepto')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => requestSort('fecha_limite')}>
                     <div className="flex items-center gap-2">Fecha Límite {getSortIcon('fecha_limite')}</div>
                  </th>
                  <th className="py-4 px-4 font-semibold text-right cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" onClick={() => requestSort('monto')}>
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
                      <td className="py-3 px-4 font-bold text-gray-800 dark:text-gray-100">{record.alumno}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm max-w-[150px] truncate" title={record.licenciatura}>{record.licenciatura}</td>
                      <td className="py-3 px-4 text-indigo-700 dark:text-indigo-400 font-medium text-sm">{record.grado}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-sm">{record.turno}</td>
                      <td className="py-3 px-4 text-gray-800 dark:text-gray-200 font-medium">{record.concepto}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{formatDate(record.fecha_limite)}</td>
                      <td className="py-3 px-4 text-right font-bold text-red-600 dark:text-red-400">${record.monto.toLocaleString()}</td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        {searchTerm ? (
                          <>
                            <div className="bg-gray-100 dark:bg-gray-700 text-gray-400 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                              <Search size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Sin resultados</h3>
                            <p className="text-gray-500 dark:text-gray-400">No se encontraron deudores que coincidan con "{searchTerm}".</p>
                          </>
                        ) : (
                          <>
                            <div className="bg-green-100 dark:bg-green-900/30 text-green-500 dark:text-green-400 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                              <CheckCircle size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">¡Todo al corriente!</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">No hay alumnos con pagos pendientes en este ciclo escolar.</p>
                            <button 
                              onClick={onBack} 
                              className="bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
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
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Mostrar</span>
                <select 
                  className="border border-gray-300 dark:border-gray-600 rounded-md text-sm p-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">deudores</span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium bg-white dark:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                Mostrando <span className="text-gray-900 dark:text-white font-bold">{startIndex + 1}</span> a <span className="text-gray-900 dark:text-white font-bold">{endIndex}</span> de <span className="text-gray-900 dark:text-white font-bold">{sortedDebtors.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-white dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold transition-all shadow-sm hover:shadow active:scale-95"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Página</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages || 1}
                    value={currentPage || ''}
                    title="Ir a página"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setCurrentPage(val as any);
                        return;
                      }
                      let p = parseInt(val, 10);
                      if (isNaN(p)) return;
                      if (p > totalPages) p = totalPages;
                      if (p < 1) p = 1;
                      setCurrentPage(p);
                    }}
                    onBlur={() => {
                        if (!currentPage || currentPage < 1) setCurrentPage(1);
                    }}
                    className="w-16 border border-gray-300 dark:border-gray-600 rounded-md p-1.5 text-center text-sm font-bold bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">de {totalPages || 1}</span>
                </div>
                <button 
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-white dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold transition-all shadow-sm hover:shadow active:scale-95"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- VERSIÓN IMPRESIÓN (visible sólo al imprimir) --- */}
        <div className="hidden print:block font-sans text-black">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold uppercase mb-1">Reporte de Deudores</h1>
            <p className="text-gray-600 font-medium">Documento generado el {new Date().toLocaleDateString('es-MX')}</p>
          </div>
          
          <div className="flex justify-between items-end mb-4 border-b-2 border-gray-800 pb-2">
            <div>
               <p className="font-semibold text-sm">Filtros aplicados:</p>
               <p className="text-xs text-gray-600 mt-1 max-w-sm">
                  {(!filterLicenciatura && !filterGrado && !filterTurno && !filterConcepto && !filterFecha && !searchTerm) ? 
                    'Ninguno (Todos los resultados)' : 
                    [
                       searchTerm && `Búsqueda: "${searchTerm}"`,
                       filterLicenciatura && `Lic: ${filterLicenciatura}`,
                       filterGrado && `Grado: ${filterGrado}`,
                       filterTurno && `Turno: ${filterTurno}`,
                       filterConcepto && `Concepto: ${filterConcepto}`,
                       filterFecha && `Fecha Lím.: ${filterFecha}`
                    ].filter(Boolean).join(' • ')
                  }
               </p>
            </div>
            <div className="text-right">
               <div className="font-semibold text-sm mb-1">Total de Alumnos: {sortedDebtors.length}</div>
               <div className="font-bold text-lg">Monto Total: ${totalDebt.toLocaleString()}</div>
            </div>
          </div>

          {sortedDebtors.length > 0 ? (
            <table className="w-full text-left text-[11px] border-collapse">
               <thead>
                  <tr className="border-b-2 border-gray-800 uppercase tracking-wide">
                     <th className="py-2 px-1 font-bold">Alumno</th>
                     <th className="py-2 px-1 font-bold max-w-[120px]">Licenciatura</th>
                     <th className="py-2 px-1 font-bold">Grado</th>
                     <th className="py-2 px-1 font-bold">Trn</th>
                     <th className="py-2 px-1 font-bold">Concepto</th>
                     <th className="py-2 px-1 font-bold text-center">Fecha Lím.</th>
                     <th className="py-2 px-1 font-bold text-right w-20">Monto</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-300">
                  {sortedDebtors.map(record => (
                     <tr key={record.id} className="break-inside-avoid">
                        <td className="py-1.5 px-1 truncate font-semibold">{record.alumno}</td>
                        <td className="py-1.5 px-1 truncate max-w-[120px]">{record.licenciatura}</td>
                        <td className="py-1.5 px-1">{record.grado}</td>
                        <td className="py-1.5 px-1">{record.turno.substring(0,3)}</td>
                        <td className="py-1.5 px-1 truncate max-w-[150px]">{record.concepto}</td>
                        <td className="py-1.5 px-1 text-center">{formatDate(record.fecha_limite)}</td>
                        <td className="py-1.5 px-1 text-right font-bold text-gray-900">${record.monto.toLocaleString()}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-10 font-bold border border-dashed border-gray-300 mt-8 rounded-lg">
               No se encontraron registros para generar el reporte con los criterios actuales.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
