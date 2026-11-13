import { ArrowLeft, Search, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { toTitleCase } from '../../utils';
import type { DebtRecord } from '../../finanzas/deudores';
type SortKey=keyof DebtRecord;
const columnas:readonly [SortKey,string][]=[['alumno','Alumno'],['licenciatura','Licenciatura'],['grado','Grado'],['turno','Turno'],['concepto','Concepto adeudado'],['tipo_plan','Tipo plan'],['fecha_limite','Fecha límite'],['monto','Monto']];
export default function TablaDeudores({paginatedDebtors,sortConfig,requestSort,formatDate,onNavigateToAlumno,hasActiveFilters,searchTerm,clearAllFilters,onBack}:{
  paginatedDebtors:readonly DebtRecord[];sortConfig:{key:SortKey;direction:'asc'|'desc'}|null;requestSort:(key:SortKey)=>void;
  formatDate:(fecha:string|undefined)=>string;onNavigateToAlumno:(id:string)=>void;hasActiveFilters:boolean;searchTerm:string;clearAllFilters:()=>void;onBack:()=>void;
}){
  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="cf-secundario" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="cf-total" /> : <ArrowDown size={14} className="cf-total" />;
  };

  if(!paginatedDebtors.length)return <div className="cf-vacio cf-deudores-vacio">                      <div className="flex flex-col items-center justify-center">
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
                            <h3 className="text-xl font-bold text-[#222222] dark:text-gray-100 mb-2">Sin adeudos vencidos</h3>
                            <p className="text-[#8e8e93] dark:text-[#8e8e93] mb-6">No se identificaron pagos vencidos en este ciclo. Puede haber importes aún en plazo o fechas por revisar.</p>
                            <button
                              onClick={onBack}
                              className="bg-[#1c2228] dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white px-6 py-2 rounded-[8px] font-medium transition-colors flex items-center gap-2"
                            >
                              <ArrowLeft size={18} /> Volver al Inicio
                            </button>
                          </>
                        )}
                      </div></div>;
  return (<div className="cf-tabla-desplazable" tabIndex={0} role="region" aria-label="Conceptos vencidos, tabla desplazable">
            <table className="cf-tabla cf-tabla-deudores">
              <thead><tr>{columnas.map(([campo,texto])=><th key={campo} scope="col" aria-sort={sortConfig?.key===campo?(sortConfig.direction==='asc'?'ascending':'descending'):'none'}>
                <button type="button" className="cf-orden-columna" onClick={()=>requestSort(campo)}>{texto}{getSortIcon(campo)}</button>
              </th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedDebtors.map(record => (
                    <tr key={record.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/20 transition-colors">
                      <td className="cf-alumno">
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
                      <td className="cf-secundario" title={toTitleCase(record.licenciatura)}>{toTitleCase(record.licenciatura)}</td>
                      <td className="cf-grado">{record.grado}</td>
                      <td className="cf-secundario">{record.turno}</td>
                      <td className="cf-concepto">{record.concepto}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                          record.tipo_plan === 'Titulación' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                          record.tipo_plan === 'Especialidad Completa' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                          'bg-[#bfdbfe] text-[#1456f0] dark:bg-indigo-900/40 dark:text-indigo-300'
                        }`}>
                          {record.tipo_plan}
                        </span>
                      </td>
                      <td className="cf-fecha-tabla">{formatDate(record.fecha_limite)}</td>
                      <td className="cf-numero cf-vencido">${record.monto.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>);
}
