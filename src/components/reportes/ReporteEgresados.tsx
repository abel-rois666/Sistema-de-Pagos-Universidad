import React, { useState, useMemo, useEffect } from 'react';
import { MultiSelectFilter } from '../MultiSelectFilter';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  GraduationCap, 
  Printer, 
  Download, 
  Filter, 
  Eye, 
  EyeOff,
  Clock,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface Props {
  onBack: () => void;
}

const PAGE_SIZE = 50;

// Función auxiliar para determinar el peso del ciclo (mayor es más reciente)
const getCicloWeight = (cicloNombre?: string): number => {
  if (!cicloNombre) return -1;
  const parts = cicloNombre.match(/(\d+)[-/](\d+)/);
  if (parts) {
    let year = parseInt(parts[1], 10);
    if (year < 100) year += 2000;
    const period = parseInt(parts[2], 10);
    return year * 10 + period;
  }
  return -1;
};

export const ReporteEgresados: React.FC<Props> = ({ onBack }) => {
  const { alumnos, ciclos, catalogos } = useAppStore();
  
  const [loading, setLoading] = useState(true);
  const [ciclosEgresoMap, setCiclosEgresoMap] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Estados de Filtros
  const [selectedCicloEgreso, setSelectedCicloEgreso] = useState<string>('TODOS');
  const [selectedLicenciaturas, setSelectedLicenciaturas] = useState<string[]>([]);
  const [selectedSegmento, setSelectedSegmento] = useState<string>('TODOS');
  
  // Estado para mostrar correo
  const [showEmail, setShowEmail] = useState<boolean>(true);

  // 1. Filtrar los egresados base de la lista global
  const egresadosBase = useMemo(() => {
    return alumnos.filter(a => a.estatus === 'EGRESADO' || a.estatus === 'EGRESADO TITULADO');
  }, [alumnos]);

  // 2. Fetch PAGINADO de inscripciones_academicas para superar el límite de 1000 filas de Supabase
  useEffect(() => {
    const fetchCiclosEgreso = async () => {
      setLoading(true);
      try {
        const egresadosIds = egresadosBase.map(a => a.id);
        
        if (egresadosIds.length === 0) {
          setCiclosEgresoMap({});
          setLoading(false);
          return;
        }

        // Crear un Set para lookup rápido
        const egresadosSet = new Set(egresadosIds);

        const ciclosMap = ciclos.reduce((acc, c) => {
          acc[c.id] = c.nombre;
          return acc;
        }, {} as Record<string, string>);

        const ultimosCiclos: Record<string, { nombre: string, maxPeriodo: number, weight: number }> = {};

        // Fetch paginado: traer en bloques de 5000 hasta agotar resultados
        const BATCH_SIZE = 5000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('inscripciones_academicas')
            .select('alumno_id, ciclo_id, ciclo_legado, asignaturas(numero_periodo)')
            .range(offset, offset + BATCH_SIZE - 1);

          if (error) throw error;

          if (!data || data.length === 0) {
            hasMore = false;
            break;
          }

          data.forEach((ins: any) => {
            if (!egresadosSet.has(ins.alumno_id)) return;
            
            // Priorizar ciclo_legado (viene del Kardex GES), fallback a ciclo_id
            let nombreCiclo = ins.ciclo_legado;
            if (!nombreCiclo && ins.ciclo_id) {
              nombreCiclo = ciclosMap[ins.ciclo_id];
            }
            
            if (!nombreCiclo) return;
            
            const weight = getCicloWeight(nombreCiclo);
            const numPeriodo = ins.asignaturas?.numero_periodo || 1;

            if (!ultimosCiclos[ins.alumno_id]) {
              ultimosCiclos[ins.alumno_id] = { nombre: nombreCiclo, maxPeriodo: numPeriodo, weight };
            } else {
              const prev = ultimosCiclos[ins.alumno_id];
              // El periodo más alto gana; si empatan, el ciclo más reciente gana
              if (numPeriodo > prev.maxPeriodo || 
                 (numPeriodo === prev.maxPeriodo && weight > prev.weight)) {
                ultimosCiclos[ins.alumno_id] = { nombre: nombreCiclo, maxPeriodo: numPeriodo, weight };
              }
            }
          });

          if (data.length < BATCH_SIZE) {
            hasMore = false;
          } else {
            offset += BATCH_SIZE;
          }
        }

        const finalMap: Record<string, string> = {};
        Object.keys(ultimosCiclos).forEach(alumnoId => {
          finalMap[alumnoId] = ultimosCiclos[alumnoId].nombre;
        });

        setCiclosEgresoMap(finalMap);
      } catch (err) {
        console.error("Error al obtener ciclos de egreso:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCiclosEgreso();
  }, [egresadosBase, ciclos]);

  // 3. Filtrar egresados
  const filteredEgresados = useMemo(() => {
    return egresadosBase.filter(a => {
      if (selectedLicenciaturas.length > 0 && !selectedLicenciaturas.includes(a.licenciatura)) return false;
      
      if (selectedSegmento === 'TITULADOS' && a.estatus !== 'EGRESADO TITULADO') return false;
      if (selectedSegmento === 'NO_TITULADOS' && a.estatus !== 'EGRESADO') return false;
      
      const cicloEgresoDelAlumno = ciclosEgresoMap[a.id];
      if (selectedCicloEgreso !== 'TODOS') {
        if (cicloEgresoDelAlumno !== selectedCicloEgreso) return false;
      }
      
      return true;
    }).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
  }, [egresadosBase, selectedCicloEgreso, selectedLicenciaturas, selectedSegmento, ciclosEgresoMap]);

  // Reset de página al cambiar filtros
  useEffect(() => { setCurrentPage(1); }, [selectedCicloEgreso, selectedLicenciaturas, selectedSegmento]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredEgresados.length / PAGE_SIZE));
  const paginatedEgresados = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEgresados.slice(start, start + PAGE_SIZE);
  }, [filteredEgresados, currentPage]);

  const ciclosEgresoOptions = useMemo(() => {
    const nombres = new Set<string>(Object.values(ciclosEgresoMap));
    return Array.from(nombres).sort((a, b) => b.localeCompare(a)); 
  }, [ciclosEgresoMap]);

  const nombreCicloSeleccionado = selectedCicloEgreso === 'TODOS' ? 'Todos los Ciclos' : selectedCicloEgreso;

  // Exportar a CSV (exporta TODOS los filtrados, no solo la página actual)
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    const headers = ["Nombre Completo", "Licenciatura", "Estatus", "Ciclo de Egreso", "Teléfonos"];
    if (showEmail) headers.push("Correo Electrónico");
    csvContent += headers.join(",") + "\n";

    filteredEgresados.forEach(a => {
      const telefonos = [a.telefono, a.celular].filter(Boolean).join(" / ");
      const cicloEgresoNombre = ciclosEgresoMap[a.id] || 'Desconocido';
      const row = [
        `"${a.nombre_completo}"`,
        `"${a.licenciatura}"`,
        `"${a.estatus}"`,
        `"${cicloEgresoNombre}"`,
        `"${telefonos}"`
      ];
      if (showEmail) row.push(`"${a.email || ''}"`);
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_egresados_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar a PDF (exporta TODOS los filtrados)
  const handleExportPDF = (action: 'download' | 'print') => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Reporte de Egresados y Titulados', 14, 15);
    
    doc.setFontSize(11);
    doc.text(`Ciclo de Egreso: ${nombreCicloSeleccionado}`, 14, 23);
    doc.text(`Licenciatura: ${selectedLicenciaturas.length === 0 ? 'Todas' : selectedLicenciaturas.join(', ')}`, 14, 29);
    
    let segmentoText = 'Todos los Egresados';
    if (selectedSegmento === 'TITULADOS') segmentoText = 'Solo Titulados';
    if (selectedSegmento === 'NO_TITULADOS') segmentoText = 'Egresados No Titulados';
    doc.text(`Segmento: ${segmentoText}`, 14, 35);
    
    const head = [['Nombre Completo', 'Licenciatura', 'Estatus', 'Ciclo Egreso', 'Teléfonos']];
    if (showEmail) head[0].push('Correo');
    
    const data = filteredEgresados.map(a => {
      const telefonos = [a.telefono, a.celular].filter(Boolean).join(" / ");
      const cicloEgresoNombre = ciclosEgresoMap[a.id] || 'Desconocido';
      const row = [a.nombre_completo, a.licenciatura, a.estatus || '', cicloEgresoNombre, telefonos];
      if (showEmail) row.push(a.email || '');
      return row;
    });

    autoTable(doc, {
      startY: 40,
      head: head,
      body: data,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [147, 51, 234] },
    });

    if (action === 'download') {
      doc.save(`reporte_egresados_${new Date().toISOString().split('T')[0]}.pdf`);
    } else {
      window.open(doc.output('bloburl'), '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1c2228] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="text-gray-500 dark:text-gray-400" size={24} />
        </button>
        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
          <GraduationCap className="text-purple-600 dark:text-purple-400" size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-display">Reporte de Egresados</h2>
          <p className="text-gray-500 dark:text-gray-400">Segmentación de egresados y titulados por ciclo de egreso</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
          <p className="text-gray-500">Calculando ciclos de egreso desde el historial académico...</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4 mb-6 bg-gray-50 dark:bg-[#252d36] p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Clock size={16}/> Ciclo de Egreso
              </label>
              <select 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 h-[42px]"
                value={selectedCicloEgreso}
                onChange={(e) => setSelectedCicloEgreso(e.target.value)}
              >
                <option value="TODOS">Todos los Ciclos</option>
                {ciclosEgresoOptions.map(nombre => (
                  <option key={nombre} value={nombre}>{nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px] z-20">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <GraduationCap size={16}/> Licenciatura
              </label>
              <div className="w-full h-[42px]">
                <MultiSelectFilter 
                  label={selectedLicenciaturas.length === 0 ? "Todas" : "Varias seleccionadas"}
                  options={catalogos.licenciaturas}
                  selected={selectedLicenciaturas}
                  onChange={setSelectedLicenciaturas}
                />
              </div>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                <Filter size={16}/> Segmento
              </label>
              <select 
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 h-[42px]"
                value={selectedSegmento}
                onChange={(e) => setSelectedSegmento(e.target.value)}
              >
                <option value="TODOS">Todos (Titulados y No Titulados)</option>
                <option value="TITULADOS">Solo Titulados</option>
                <option value="NO_TITULADOS">Egresados (No Titulados)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-800/30">
                {filteredEgresados.length} Egresados Encontrados
              </span>
              <button 
                onClick={() => setShowEmail(!showEmail)}
                className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full transition-colors ${showEmail ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
              >
                {showEmail ? <EyeOff size={16}/> : <Eye size={16}/>}
                {showEmail ? 'Ocultar Correo' : 'Mostrar Correo'}
              </button>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => handleExportPDF('print')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg transition-colors font-medium text-sm"
              >
                <Printer size={18} /> Imprimir
              </button>
              <button 
                onClick={() => handleExportPDF('download')}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-600 dark:text-red-400 rounded-lg transition-colors font-medium text-sm border border-red-200 dark:border-red-800/50"
              >
                <Download size={18} /> PDF
              </button>
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 rounded-lg transition-colors font-medium text-sm border border-green-200 dark:border-green-800/50"
              >
                <Download size={18} /> CSV
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-[#2a3441] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">#</th>
                  <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Nombre Completo</th>
                  <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Licenciatura</th>
                  <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Estatus</th>
                  <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Ciclo Egreso</th>
                  <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Teléfonos</th>
                  {showEmail && <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Correo Electrónico</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-transparent">
                {paginatedEgresados.length > 0 ? (
                  paginatedEgresados.map((a, idx) => {
                    const esTitulado = a.estatus === 'EGRESADO TITULADO';
                    const cicloEgresoNombre = ciclosEgresoMap[a.id] || 'Sin Kardex';
                    const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-3 text-xs text-gray-400 dark:text-gray-500 tabular-nums">{rowNumber}</td>
                        <td className="p-3 text-sm text-gray-900 dark:text-gray-100 font-medium">{a.nombre_completo}</td>
                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{a.licenciatura}</td>
                        <td className="p-3 text-sm">
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            esTitulado 
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {a.estatus}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400 font-semibold">{cicloEgresoNombre}</td>
                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                          {[a.telefono, a.celular].filter(Boolean).join(" / ") || '-'}
                        </td>
                        {showEmail && <td className="p-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{a.email || '-'}</td>}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={showEmail ? 7 : 6} className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <Filter size={32} className="mx-auto mb-2 opacity-50" />
                      No se encontraron egresados con los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando {((currentPage - 1) * PAGE_SIZE) + 1} – {Math.min(currentPage * PAGE_SIZE, filteredEgresados.length)} de {filteredEgresados.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum 
                          ? 'bg-purple-600 text-white shadow-sm' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
