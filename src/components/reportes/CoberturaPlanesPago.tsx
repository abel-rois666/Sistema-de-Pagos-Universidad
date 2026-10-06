import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, ArrowUpRight, Download, FileCheck2, FileWarning, Search, SlidersHorizontal, Users } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { MultiSelectFilter } from '../MultiSelectFilter';
import { buildPlanCoverage, countPlanObservations, filterPlanCoverage, PLAN_COVERAGE_COLUMNS, summarizeCoverage, type PlanCoverageColumn, type PlanCoverageEntry, type PlanCoverageFilters, type PlanCoverageIntegralFilter, type PlanCoverageStatus } from '../../utils/planCoverageUtils';
import { createPlanCoveragePdf } from '../../utils/planCoveragePdf';

const money = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const countStudents = (rows: PlanCoverageEntry[]) => new Set(rows.map(row => row.alumnoId)).size;
const PAGE_SIZE = 20;
type SortKey = PlanCoverageColumn;
const COLUMN_STORAGE_KEY = 'plan_coverage_visible_columns';
const defaultColumns = PLAN_COVERAGE_COLUMNS.map(column => column.key);
const readVisibleColumns = (): PlanCoverageColumn[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) {
      const valid = saved.filter((key): key is PlanCoverageColumn => defaultColumns.includes(key));
      return ['alumnoNombre', ...valid.filter(key => key !== 'alumnoNombre')];
    }
  } catch { /* Preferencias locales no disponibles. */ }
  return defaultColumns;
};
const compareEntries = (a: PlanCoverageEntry, b: PlanCoverageEntry, key: SortKey) => {
  if (key === 'conceptos' || key === 'monto') return a[key] - b[key];
  if (key === 'integral') return Number(a.integral) - Number(b.integral);
  const aValue = key === 'faltantes' || key === 'observaciones' ? a[key].join('; ') : key === 'tipo' ? `${a.tipo} ${a.folio}` : a[key];
  const bValue = key === 'faltantes' || key === 'observaciones' ? b[key].join('; ') : key === 'tipo' ? `${b.tipo} ${b.folio}` : b[key];
  return aValue.localeCompare(bValue, 'es', { sensitivity: 'base', numeric: true });
};

export default function CoberturaPlanesPago() {
  const navigate = useNavigate();
  const location = useLocation();
  const restoredFilters = (location.state as { coverageFilters?: Partial<PlanCoverageFilters> } | null)?.coverageFilters;
  const { ciclos, alumnos, plans, activeCicloId, setActiveCicloId } = useAppStore();
  const [cicloId, setCicloId] = useState(restoredFilters?.cicloId || activeCicloId || 'TODOS');
  const [selectedLicenciaturas, setSelectedLicenciaturas] = useState<string[]>(restoredFilters?.licenciaturas || []);
  const [selectedTipos, setSelectedTipos] = useState<string[]>(restoredFilters?.tipos || []);
  const [selectedObservaciones, setSelectedObservaciones] = useState<string[]>(restoredFilters?.observaciones || []);
  const [integral, setIntegral] = useState<PlanCoverageIntegralFilter>(restoredFilters?.integral === 'INTEGRAL' || restoredFilters?.integral === 'NO_INTEGRAL' ? restoredFilters.integral : 'TODOS');
  const [busqueda, setBusqueda] = useState(restoredFilters?.busqueda || '');
  const [estado, setEstado] = useState<PlanCoverageStatus | 'TODOS'>(restoredFilters?.estado === 'COMPLETO' || restoredFilters?.estado === 'INCOMPLETO' || restoredFilters?.estado === 'SIN_PLAN' ? restoredFilters.estado : 'TODOS');
  const [sortKey, setSortKey] = useState<SortKey>('alumnoNombre');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pages, setPages] = useState<Record<string, number>>({});
  const [visibleColumns, setVisibleColumns] = useState<PlanCoverageColumn[]>(readVisibleColumns);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const visibleColumnDefs = PLAN_COVERAGE_COLUMNS.filter(column => visibleColumns.includes(column.key));
  useEffect(() => {
    try { localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns)); } catch { /* Preferencias locales no disponibles. */ }
  }, [visibleColumns]);
  const toggleColumn = (key: PlanCoverageColumn) => {
    if (key === 'alumnoNombre') return;
    setVisibleColumns(current => current.includes(key) ? current.filter(column => column !== key) : [...current, key]);
    if (sortKey === key) setSortKey('alumnoNombre');
  };
  const changeSort = (key: SortKey) => {
    setSortDirection(current => sortKey === key && current === 'asc' ? 'desc' : 'asc');
    setSortKey(key);
    setPages({});
  };

  const report = useMemo(() => buildPlanCoverage(ciclos, alumnos, plans), [ciclos, alumnos, plans]);
  const availableLicenciaturas = useMemo(() => Array.from(new Set<string>(
    report.flatMap(ciclo => ciclo.entries.map(entry => entry.licenciatura))
  )).sort((a, b) => a.localeCompare(b, 'es')), [report]);
  const availableTipos = useMemo(() => Array.from(new Set<string>(
    report.flatMap(ciclo => ciclo.entries.filter(entry => entry.estado !== 'SIN_PLAN').map(entry => entry.tipo))
  )).sort((a, b) => a.localeCompare(b, 'es')), [report]);
  const availableObservaciones = useMemo(() => Array.from(new Set<string>(
    report.flatMap(ciclo => ciclo.entries.flatMap(entry => entry.observaciones))
  )).sort((a, b) => a.localeCompare(b, 'es')), [report]);

  const cycles = useMemo(() => filterPlanCoverage(report, {
    cicloId, licenciaturas: selectedLicenciaturas, tipos: selectedTipos,
    observaciones: selectedObservaciones, integral, busqueda, estado,
  }), [report, cicloId, selectedLicenciaturas, selectedTipos, selectedObservaciones, integral, busqueda, estado]);

  const rows = cycles.flatMap(ciclo => ciclo.entries);
  const summary = summarizeCoverage(cycles);

  const exportPDF = () => {
    const doc = createPlanCoveragePdf(cycles, {
      ciclo: cicloId === 'TODOS' ? 'Todos' : ciclos.find(ciclo => ciclo.id === cicloId)?.nombre || 'Sin nombre',
      licenciatura: selectedLicenciaturas.length === 0 || selectedLicenciaturas.length === availableLicenciaturas.length ? 'Todas' : selectedLicenciaturas.join(', '),
      tipo: selectedTipos.length === 0 || selectedTipos.length === availableTipos.length ? 'Todos' : selectedTipos.join(', '),
      observaciones: selectedObservaciones.length === 0 ? 'Todas' : selectedObservaciones.join(', '),
      integral: integral === 'TODOS' ? 'Todos' : integral === 'INTEGRAL' ? 'Solo integrales' : 'Sin integral',
      busqueda: busqueda.trim(),
      estado: estado === 'TODOS' ? 'Todos' : estado === 'SIN_PLAN' ? 'Sin plan' : estado === 'COMPLETO' ? 'Completos' : 'Incompletos',
    }, visibleColumnDefs.map(column => column.key));
    doc.save(`cobertura_planes_pago_${new Date().toLocaleDateString('sv-SE')}.pdf`);
  };
  const renderCell = (entry: PlanCoverageEntry, key: PlanCoverageColumn) => {
    switch (key) {
      case 'alumnoNombre': return <td key={key} className="p-3 align-top font-medium">
        <Link
          to={entry.planId ? '/plan-pagos' : '/ficha-alumno'}
          state={{
            alumnoId: entry.alumnoId,
            ...(entry.planId ? { initialPlanId: entry.planId } : {}),
            fromCoverageReport: true,
            coverageFilters: { cicloId, licenciaturas: selectedLicenciaturas, tipos: selectedTipos, observaciones: selectedObservaciones, integral, busqueda, estado },
          }}
          onClick={() => { if (entry.planId && activeCicloId !== entry.cicloId) setActiveCicloId(entry.cicloId); }}
          title={entry.planId ? `Abrir plan ${entry.folio} de ${entry.alumnoNombre}` : `Abrir ficha de ${entry.alumnoNombre}; sin plan en este ciclo`}
          className="inline-flex items-center gap-1 text-[#1456f0] dark:text-blue-400 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1456f0]"
        >
          {entry.alumnoNombre}<ArrowUpRight size={14} className="shrink-0" />
        </Link>
        {entry.matricula && <span className="block text-xs font-normal text-[#8e8e93]">{entry.matricula}</span>}
      </td>;
      case 'licenciatura': return <td key={key} className="p-3 align-top">{entry.licenciatura}</td>;
      case 'tipo': return <td key={key} className="p-3 align-top">{entry.tipo}<span className="block text-xs text-[#8e8e93]">{entry.folio}</span></td>;
      case 'integral': return <td key={key} className="p-3 align-top">
        {entry.estado === 'SIN_PLAN' ? '—' : <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${entry.integral ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>{entry.integral ? 'Integral' : 'No integral'}</span>}
      </td>;
      case 'observaciones': return <td key={key} className="p-3 align-top text-xs text-[#45515e] dark:text-gray-300 min-w-[180px] max-w-[260px]">
        {entry.observaciones.length ? <ul className="space-y-1">{entry.observaciones.map(observacion => <li key={observacion}>{observacion}</li>)}</ul> : '—'}
      </td>;
      case 'estado': return <td key={key} className="p-3 align-top"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${entry.estado === 'COMPLETO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : entry.estado === 'INCOMPLETO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100'}`}>{entry.estado === 'SIN_PLAN' ? 'Sin plan' : entry.estado === 'COMPLETO' ? 'Completo' : 'Incompleto'}</span></td>;
      case 'conceptos': return <td key={key} className="p-3 align-top text-right tabular-nums">{entry.conceptos || '—'}</td>;
      case 'monto': return <td key={key} className="p-3 align-top text-right tabular-nums">{entry.estado === 'SIN_PLAN' ? '—' : money(entry.monto)}</td>;
      case 'faltantes': return <td key={key} className="p-3 align-top text-xs text-[#45515e] dark:text-gray-400 max-w-[210px]">{entry.faltantes.length ? entry.faltantes.join('; ') : '—'}</td>;
    }
  };
  return (
    <main className="w-full max-w-7xl mx-auto pb-10 text-[#222222] dark:text-gray-100">
      <div className="rounded-[20px] border border-[#e5e7eb] dark:border-white/10 bg-white dark:bg-[#181e25] shadow-[var(--shadow-subtle)] overflow-hidden">
        <div className="px-4 sm:px-6 py-5 border-b border-[#e5e7eb] dark:border-white/10 bg-[#eef2ff] dark:bg-[#1c2228]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <button onClick={() => navigate('/')} aria-label="Volver a Consultas y Reportes" className="mt-0.5 p-2 rounded-lg hover:bg-white/80 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#1456f0]"><ArrowLeft size={20} /></button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1456f0] dark:text-blue-400">Coordinación Financiera</p>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1" style={{ fontFamily: 'var(--font-display)' }}>Cobertura de planes de pago</h1>
                <p className="text-sm text-[#45515e] dark:text-gray-400 mt-1">Consulta alumnos, tipos y planes completos por ciclo escolar.</p>
              </div>
            </div>
            <button onClick={exportPDF} disabled={rows.length === 0} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1456f0] hover:bg-[#1048cd] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1456f0]">
              <Download size={18} /> Descargar PDF
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <label className="text-xs font-semibold text-[#45515e] dark:text-gray-300">Ciclo escolar
              <select value={cicloId} onChange={event => { setCicloId(event.target.value); setPages({}); }} className="mt-1.5 w-full rounded-lg border border-[#d1d5db] dark:border-gray-700 bg-white dark:bg-[#1c2228] px-3 py-2.5 text-sm text-[#222222] dark:text-gray-100">
                <option value="TODOS">Todos los ciclos</option>
                {ciclos.map(ciclo => <option key={ciclo.id} value={ciclo.id}>{ciclo.nombre}</option>)}
              </select>
            </label>
            <div className="min-w-0 text-xs font-semibold text-[#45515e] dark:text-gray-300">
              <span className="block">Licenciatura</span>
              <div className="mt-1.5">
                <MultiSelectFilter
                  label={selectedLicenciaturas.length === 0 || selectedLicenciaturas.length === availableLicenciaturas.length ? 'Todas' : selectedLicenciaturas.length === 1 ? selectedLicenciaturas[0] : `${selectedLicenciaturas.length} licenciaturas`}
                  options={availableLicenciaturas}
                  selected={selectedLicenciaturas}
                  onChange={value => { setSelectedLicenciaturas(value); setPages({}); }}
                  fullWidth
                />
              </div>
            </div>
            <div className="min-w-0 text-xs font-semibold text-[#45515e] dark:text-gray-300">
              <span className="block">Tipo de plan</span>
              <div className="mt-1.5">
                <MultiSelectFilter
                  label={selectedTipos.length === 0 || selectedTipos.length === availableTipos.length ? 'Todos' : selectedTipos.length === 1 ? selectedTipos[0] : `${selectedTipos.length} tipos`}
                  options={availableTipos}
                  selected={selectedTipos}
                  onChange={value => { setSelectedTipos(value.length === availableTipos.length ? [] : value); setPages({}); }}
                  fullWidth
                />
              </div>
            </div>
            <label className="text-xs font-semibold text-[#45515e] dark:text-gray-300">Plan integral
              <select value={integral} onChange={event => { setIntegral(event.target.value as PlanCoverageIntegralFilter); setPages({}); }} className="mt-1.5 w-full rounded-lg border border-[#d1d5db] dark:border-gray-700 bg-white dark:bg-[#1c2228] px-3 py-2.5 text-sm text-[#222222] dark:text-gray-100">
                <option value="TODOS">Todos los planes</option>
                <option value="INTEGRAL">Solo integrales</option>
                <option value="NO_INTEGRAL">Planes no integrales</option>
              </select>
            </label>
            <div className="min-w-0 text-xs font-semibold text-[#45515e] dark:text-gray-300">
              <span className="block">Observaciones incluidas</span>
              <div className="mt-1.5">
                <MultiSelectFilter
                  label={selectedObservaciones.length === 0 ? 'Todas' : selectedObservaciones.length === 1 ? selectedObservaciones[0] : `${selectedObservaciones.length} observaciones`}
                  options={availableObservaciones}
                  selected={selectedObservaciones}
                  onChange={value => { setSelectedObservaciones(value); setPages({}); }}
                  fullWidth
                />
              </div>
            </div>
            <label className="text-xs font-semibold text-[#45515e] dark:text-gray-300">Situación del plan
              <select value={estado} onChange={event => { setEstado(event.target.value as PlanCoverageStatus | 'TODOS'); setPages({}); }} className="mt-1.5 w-full rounded-lg border border-[#d1d5db] dark:border-gray-700 bg-white dark:bg-[#1c2228] px-3 py-2.5 text-sm text-[#222222] dark:text-gray-100">
                <option value="TODOS">Todos</option>
                <option value="COMPLETO">Completos</option>
                <option value="INCOMPLETO">Incompletos</option>
                <option value="SIN_PLAN">Sin plan</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-[#45515e] dark:text-gray-300">Buscar alumno o plan
              <span className="mt-1.5 flex items-center gap-2 rounded-lg border border-[#d1d5db] dark:border-gray-700 bg-white dark:bg-[#1c2228] px-3">
                <Search size={16} className="text-[#8e8e93]" />
                <input value={busqueda} onChange={event => { setBusqueda(event.target.value); setPages({}); }} placeholder="Nombre, matrícula, folio…" className="min-w-0 w-full py-2.5 bg-transparent outline-none text-sm text-[#222222] dark:text-gray-100" />
              </span>
            </label>
          </div>

          <div>
            <button type="button" onClick={() => setShowColumnSettings(value => !value)} aria-expanded={showColumnSettings}
              className="inline-flex items-center gap-2 rounded-lg border border-[#d1d5db] px-3 py-2 text-sm font-semibold text-[#45515e] hover:bg-[#f8faff] focus-visible:outline-2 focus-visible:outline-[#1456f0] dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/10">
              <SlidersHorizontal size={16} /> Columnas visibles ({visibleColumnDefs.length}/{PLAN_COVERAGE_COLUMNS.length})
            </button>
            {showColumnSettings && <fieldset className="mt-3 rounded-xl border border-[#d1d5db] bg-[#f8faff] p-4 dark:border-gray-700 dark:bg-[#1c2228]">
              <legend className="sr-only">Elegir columnas del reporte y del PDF</legend>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-xs text-[#45515e] dark:text-gray-300">Elige las columnas de la tabla y del PDF. Alumno permanece visible para abrir su plan.</p>
                <button type="button" onClick={() => setVisibleColumns(defaultColumns)} className="text-xs font-semibold text-[#1456f0] hover:underline dark:text-blue-400">Mostrar todas</button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {PLAN_COVERAGE_COLUMNS.map(column => <label key={column.key} className="flex items-center gap-2 text-xs text-[#45515e] dark:text-gray-200">
                  <input type="checkbox" checked={visibleColumns.includes(column.key)} disabled={column.key === 'alumnoNombre'} onChange={() => toggleColumn(column.key)} className="h-4 w-4 rounded border-gray-300 text-[#1456f0] focus:ring-[#1456f0] disabled:opacity-60" />
                  {column.label}
                </label>)}
              </div>
            </fieldset>}
          </div>

          <p className="text-xs text-[#45515e] dark:text-gray-400">Un plan es completo cuando tiene al menos una fila con concepto, fecha y monto capturados; $0 es válido. Las filas sin concepto ni fecha con monto vacío o $0 de relleno no se evalúan. Un plan semestral o cuatrimestral es integral mientras tenga una o más observaciones guardadas; esta clasificación es independiente de completo o incompleto. Al seleccionar varias observaciones se muestran planes que contienen cualquiera de ellas. Se incluyen alumnos activos y egresados; los titulados solo aparecen en ciclos donde tienen plan. Los alumnos en baja quedan fuera. «Sin plan» se limita a la última asignación de grado. Los totales y el PDF respetan los filtros; el PDF incluye todas las filas filtradas.</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Alumnos por ciclo', value: summary.alumnos, icon: Users },
              { label: 'Alumnos con plan completo', value: summary.alumnosConCompleto, icon: FileCheck2 },
              { label: 'Alumnos sin plan completo', value: summary.alumnosSinCompleto, icon: FileWarning },
              { label: 'Planes completos', value: summary.planesCompletos, icon: FileCheck2 },
              { label: 'Planes incompletos', value: summary.planesIncompletos, icon: FileWarning },
              { label: 'Alumnos sin plan', value: summary.alumnosSinPlan, icon: Users },
              { label: 'Planes integrales', value: summary.planesIntegrales, icon: FileCheck2 },
              { label: 'Alumnos con plan integral', value: summary.alumnosConIntegral, icon: Users },
            ].map(card => <div key={card.label} className="rounded-xl border border-[#e5e7eb] dark:border-white/10 bg-[#f8faff] dark:bg-[#1c2228] p-4">
              <card.icon size={18} className="text-[#1456f0] dark:text-blue-400" />
              <strong className="block mt-3 text-2xl font-semibold tabular-nums">{card.value.toLocaleString('es-MX')}</strong>
              <span className="text-xs text-[#45515e] dark:text-gray-400">{card.label}</span>
            </div>)}
          </div>

          {cycles.map(ciclo => {
            const sortedEntries = [...ciclo.entries].sort((a, b) => (sortDirection === 'asc' ? 1 : -1) * (compareEntries(a, b, sortKey) || a.key.localeCompare(b.key, 'es')));
            const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));
            const page = Math.min(pages[ciclo.cicloId] || 1, totalPages);
            const pageEntries = sortedEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
            const types = new Map<string, number>();
            for (const entry of ciclo.entries) if (entry.estado !== 'SIN_PLAN') types.set(entry.tipo, (types.get(entry.tipo) || 0) + 1);
            const integralEntries = ciclo.entries.filter(entry => entry.integral);
            const observationCounts = countPlanObservations(ciclo.entries);
            return <section key={ciclo.cicloId} className="rounded-xl border border-[#e5e7eb] dark:border-white/10 overflow-hidden">
              <div className="px-4 py-3 bg-[#f8faff] dark:bg-[#1c2228] border-b border-[#e5e7eb] dark:border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{ciclo.cicloNombre}</h2>
                  <p className="text-xs text-[#45515e] dark:text-gray-400">{countStudents(ciclo.entries)} alumnos · {ciclo.entries.filter(entry => entry.estado !== 'SIN_PLAN').length} planes · {integralEntries.length} integrales · {countStudents(integralEntries)} alumnos con integral</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">{types.size ? Array.from(types, ([tipo, total]) => <span key={tipo} className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium">{tipo}: {total}</span>) : <span className="text-xs text-[#8e8e93]">Sin planes registrados</span>}</div>
                {observationCounts.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#45515e] dark:text-gray-300">
                  <span className="font-semibold">Observaciones en integrales:</span>
                  {observationCounts.map(item => <span key={item.nombre} className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 dark:border-indigo-800 dark:bg-gray-900">{item.nombre}: {item.planes}</span>)}
                  <span className="text-[#8e8e93]">Un plan puede figurar en varias.</span>
                </div>}
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead className="bg-[#f2f3f5] dark:bg-[#202831] text-[#45515e] dark:text-gray-300 text-xs uppercase tracking-wide">
                    <tr>{visibleColumnDefs.map(({ key, label }) => <th key={key} scope="col" aria-sort={sortKey === key ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} className={`p-3 ${key === 'conceptos' || key === 'monto' ? 'text-right' : 'text-left'}`}><button type="button" onClick={() => changeSort(key)} className={`inline-flex items-center gap-1 hover:text-[#1456f0] dark:hover:text-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1456f0] ${key === 'conceptos' || key === 'monto' ? 'justify-end w-full' : ''}`}>{label}<ArrowUpDown size={13} aria-hidden="true" /></button></th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] dark:divide-white/10">
                    {pageEntries.map(entry => <tr key={entry.key} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10">
                      {visibleColumnDefs.map(({ key }) => renderCell(entry, key))}
                    </tr>)}
                  </tbody>
                </table>
              </div>
              {sortedEntries.length > 0 && <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-[#e5e7eb] dark:border-white/10 text-xs text-[#45515e] dark:text-gray-400">
                <span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedEntries.length)} de {sortedEntries.length} filas</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={page === 1} onClick={() => setPages(current => ({ ...current, [ciclo.cicloId]: page - 1 }))} className="rounded-lg border border-[#d1d5db] dark:border-gray-700 px-3 py-1.5 disabled:opacity-40 hover:bg-[#eef2ff] dark:hover:bg-white/10">Anterior</button>
                  <span className="tabular-nums">Página {page} de {totalPages}</span>
                  <button type="button" disabled={page === totalPages} onClick={() => setPages(current => ({ ...current, [ciclo.cicloId]: page + 1 }))} className="rounded-lg border border-[#d1d5db] dark:border-gray-700 px-3 py-1.5 disabled:opacity-40 hover:bg-[#eef2ff] dark:hover:bg-white/10">Siguiente</button>
                </div>
              </div>}
            </section>;
          })}
          {rows.length === 0 && <div className="rounded-xl border border-dashed border-[#d1d5db] dark:border-gray-700 p-10 text-center text-[#45515e] dark:text-gray-400">No hay alumnos o planes que coincidan con estos filtros.</div>}
        </div>
      </div>
    </main>
  );
}
