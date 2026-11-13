import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, AlertTriangle, Search, Filter, X, Printer, ChevronDown } from 'lucide-react';
import { toTitleCase} from '../utils';
import { printElement } from '../lib/printUtils';
import { useAppStore } from '../store/useAppStore';
import { useCicloModulo } from '../hooks/useCicloModulo';
import { MultiSelectFilter } from './MultiSelectFilter';
import SelectorCicloModulo from './ui/SelectorCicloModulo';
import { saldosPorVencimiento } from '../finanzas/vencimientos';
import { useFechaFinanciera } from '../hooks/useFechaFinanciera';
import { construirDeudasVencidas, type DebtRecord } from '../finanzas/deudores';
import CabeceraConsultaFinanciera from './reportes/CabeceraConsultaFinanciera';
import TablaDeudores from './reportes/TablaDeudores';
import './reportes/consultasFinancieras.css';

interface DeudoresProps {
  onBack: () => void;
  onNavigateToAlumno: (alumnoId: string) => void;
}

type SortKey = keyof DebtRecord;



// ── Main Component ──────────────────────────────────────────────────────────
export default function Deudores({ onBack, onNavigateToAlumno }: DeudoresProps) {
  const { plans: allPlans, alumnos, activeCicloId: cicloGlobalId, ciclos, currentUser } = useAppStore();
  const [activeCicloId, setCicloModuloId] = useCicloModulo('deudores', ciclos, cicloGlobalId, currentUser?.id);
  const fechaConsulta = useFechaFinanciera();
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const plans = allPlans.filter(p => p.ciclo_id === activeCicloId);
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

  const debtors = useMemo(() => construirDeudasVencidas(filteredPlans, alumnos, fechaConsulta), [filteredPlans, alumnos, fechaConsulta]);
  const saldoSinFecha = useMemo(() => filteredPlans.reduce((total, plan) => total + saldosPorVencimiento(plan, undefined, 'Todos', fechaConsulta).revisarFecha, 0), [filteredPlans, fechaConsulta]);

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
    <div className="consulta-financiera paleta-dashboard cf-deudores">
      <div className="cf-deudores-contenido">
        <button type="button" onClick={onBack} className="cf-volver"><ArrowLeft size={17}/>Volver al Inicio</button>
        <section className="cf-panel">
          <CabeceraConsultaFinanciera titulo="Lista de Deudores" descripcion="Saldo pendiente de conceptos cuya fecha límite ya pasó. Lo que vence hoy sigue en plazo." icono={<AlertTriangle size={23}/>}
            acciones={<button type="button" onClick={()=>{if(printDeudoresRef.current)printElement(printDeudoresRef.current,{landscape:true});}} className="cf-boton cf-primario"><Printer size={16}/>Imprimir PDF</button>}>
            <div className="cf-controles-deudores">
              <SelectorCicloModulo ciclos={ciclos} cicloId={activeCicloId||''} label="Ciclo de deudores" onChange={id=>{setCicloModuloId(id);setCurrentPage(1);}}/>
              <label htmlFor="deudores-busqueda" className="cf-busqueda">Buscar alumno o concepto<span><Search size={17} aria-hidden="true"/>
                <input id="deudores-busqueda" type="text" placeholder="Buscar alumno o concepto..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
              </span></label>
              <button type="button" onClick={()=>setShowFilters(!showFilters)} className="cf-boton" aria-expanded={showFilters} aria-controls="cf-deudores-filtros">
                <Filter size={16}/>Filtros{hasActiveFilters&&<span className="cf-contador">{activeFilterSummary.length}</span>}
              </button>
            </div>
            <p className="cf-nota cf-fecha-deudores">Fecha de consulta: {fechaConsulta.split('-').reverse().join('/')} · Hora de Ciudad de México.</p>
          </CabeceraConsultaFinanciera>
        </section>
        {saldoSinFecha > 0 && <p role="status" className="cf-aviso">En este ciclo hay ${saldoSinFecha.toLocaleString('es-MX', {minimumFractionDigits:2})} pendientes con fecha ausente o inválida. No se clasifican como vencidos. Revisa las fechas en los planes de pago.</p>}
        {/* Filtros activos — chips resumen siempre visibles */}
        {hasActiveFilters && !showFilters && (
          <div className="cf-chips flex flex-wrap gap-2 items-center">
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
              id="cf-deudores-filtros" className="overflow-visible"
            >
              <div className="cf-panel cf-filtros-panel">
                <div className="cf-filtros">
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

        <div className="cf-tabla-panel">
          
          <div className="cf-deudores-resumen" aria-label="Resumen de deudores">
            <div><span className="cf-icono" aria-hidden="true"><AlertTriangle size={19}/></span><div><p>Conceptos vencidos{hasActiveFilters&&<span> (filtrado)</span>}</p><strong>{filteredDebtors.length.toLocaleString()}</strong></div></div>
            <div><span className="cf-icono" aria-hidden="true">$</span><div><p>Vencido por pagar</p><strong className="cf-vencido">${totalDebt.toLocaleString()}</strong></div></div>
          </div>
          <p className="cf-ayuda-tabla">Desplaza la tabla para consultar todas las columnas. El alumno permanece visible.</p>
          <TablaDeudores paginatedDebtors={paginatedDebtors} sortConfig={sortConfig} requestSort={requestSort} formatDate={formatDate}
            onNavigateToAlumno={onNavigateToAlumno} hasActiveFilters={hasActiveFilters} searchTerm={searchTerm} clearAllFilters={clearAllFilters} onBack={onBack}/>

          {sortedDebtors.length > 0 && (
            <div className="cf-paginacion">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#8e8e93] dark:text-[#8e8e93] font-medium">Mostrar</span>
                <select 
                  className="border border-gray-300 dark:border-gray-600 rounded-md text-sm p-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-[#3b82f6] font-medium cursor-pointer"
                  aria-label="Conceptos por página"
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
              <div className="cf-paginacion-cuenta">
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
                    aria-label="Ir a página"
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
            <p style={{ color: '#4b5563', fontWeight: 500 }}>Consulta al {fechaConsulta.split('-').reverse().join('/')} (Ciudad de México) · Ciclo: {activeCiclo?.nombre} · {activeCiclo?.tipo_periodo}</p>
            <p style={{fontSize:10,marginTop:5}}>Solo saldos cuya fecha límite ya pasó. Lo que vence hoy permanece en plazo.</p>
          </div>
          {saldoSinFecha>0&&<p style={{fontSize:10,border:'1px solid #92400e',padding:8,marginBottom:12}}>En el ciclo hay ${saldoSinFecha.toLocaleString('es-MX',{minimumFractionDigits:2})} pendientes con fecha ausente o inválida, no incluidos como vencidos.</p>}
          
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
               <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '4px' }}>Conceptos vencidos: {sortedDebtors.length}</div>
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
