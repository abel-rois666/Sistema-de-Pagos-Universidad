import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Clock,
  ArrowLeft,
  Loader2,
  ChevronUp,
  ChevronDown,
  Layers,
  Columns
} from 'lucide-react';

interface Props {
  onBack: () => void;
}

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

// Función auxiliar para Altas y Bajas (Title Case)
const toTitleCase = (str: string) => {
  if (!str) return '';
  const lowers = ['de', 'la', 'del', 'las', 'los', 'y', 'en', 'el', 'a', 'por', 'para', 'con'];
  return str.split(' ').map((word, index) => {
    const lowerWord = word.toLowerCase();
    if (index !== 0 && lowers.includes(lowerWord)) {
      return lowerWord;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};

type SortKey = 'nombre' | 'licenciatura' | 'estatus' | 'ciclo' | 'email' | 'pagoTitulacion' | 'certificacion';

export const ReporteEgresados: React.FC<Props> = ({ onBack }) => {
  const navigate = useNavigate();
  const { alumnos, ciclos, catalogos, plans } = useAppStore();
  
  const [loading, setLoading] = useState(true);
  const [ciclosEgresoMap, setCiclosEgresoMap] = useState<Record<string, string>>({});
  const [certificacionMap, setCertificacionMap] = useState<Record<string, string>>({});
  
  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

  // Estados de Filtros y Ordenamiento
  const [selectedCicloEgreso, setSelectedCicloEgreso] = useState<string>('TODOS');
  const [selectedLicenciaturas, setSelectedLicenciaturas] = useState<string[]>([]);
  const [selectedSegmento, setSelectedSegmento] = useState<string>('TODOS');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'nombre', direction: 'asc' });
  const [groupByCiclo, setGroupByCiclo] = useState<boolean>(false);
  
  // Configuración de columnas
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const [visibleCols, setVisibleCols] = useState({
    nombre: true,
    licenciatura: true,
    estatus: true,
    ciclo: true,
    telefonos: true,
    email: false,
    pagoTitulacion: true,
    certificacion: true
  });

  // Cerrar menú de columnas al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) {
        setShowColMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Filtrar los egresados base de la lista global
  const egresadosBase = useMemo(() => {
    return alumnos.filter(a => a.estatus === 'EGRESADO' || a.estatus === 'EGRESADO TITULADO');
  }, [alumnos]);

  // 2. Fetch de inscripciones_academicas y fichas de certificacion SOLO para egresados, en lotes
  useEffect(() => {
    const fetchDatosExternos = async () => {
      setLoading(true);
      try {
        const egresadosIds = egresadosBase.map(a => a.id);
        
        if (egresadosIds.length === 0) {
          setCiclosEgresoMap({});
          setCertificacionMap({});
          setLoading(false);
          return;
        }

        const ciclosMap = ciclos.reduce((acc, c) => {
          acc[c.id] = c.nombre;
          return acc;
        }, {} as Record<string, string>);

        const ultimosCiclos: Record<string, { nombre: string, maxPeriodo: number, weight: number }> = {};
        const certMap: Record<string, string> = {};
        const BATCH = 200;

        // 1. Fetch de Fichas de Certificación (En paralelo para todos los lotes)
        const certPromises = [];
        for (let i = 0; i < egresadosIds.length; i += 500) {
          certPromises.push(
            supabase.from('ficha_certificacion')
              .select('alumno_id, tramite_completado')
              .in('alumno_id', egresadosIds.slice(i, i + 500))
          );
        }

        // 2. Fetch de Inscripciones Académicas (En paralelo para todos los lotes)
        const insPromises = [];
        for (let i = 0; i < egresadosIds.length; i += BATCH) {
          const batch = egresadosIds.slice(i, i + BATCH);
          insPromises.push((async () => {
            let offset = 0;
            let hasMore = true;
            const BATCH_ROWS = 1000;
            
            while (hasMore) {
              const { data, error } = await supabase
                .from('inscripciones_academicas')
                .select('alumno_id, ciclo_id, ciclo_legado, asignatura_id, asignaturas(numero_periodo)')
                .in('alumno_id', batch)
                .range(offset, offset + BATCH_ROWS - 1);

              if (error || !data || data.length === 0) {
                if (error) console.error('Error fetching inscripciones:', error);
                hasMore = false;
                break;
              }

              data.forEach((ins: any) => {
                let nombreCiclo = ins.ciclo_legado;
                if (!nombreCiclo && ins.ciclo_id) nombreCiclo = ciclosMap[ins.ciclo_id];
                if (!nombreCiclo) return;

                const weight = getCicloWeight(nombreCiclo);
                const numPeriodo = ins.asignaturas?.numero_periodo || 1;

                if (!ultimosCiclos[ins.alumno_id]) {
                  ultimosCiclos[ins.alumno_id] = { nombre: nombreCiclo, maxPeriodo: numPeriodo, weight };
                } else {
                  const prev = ultimosCiclos[ins.alumno_id];
                  if (numPeriodo > prev.maxPeriodo || (numPeriodo === prev.maxPeriodo && weight > prev.weight)) {
                    ultimosCiclos[ins.alumno_id] = { nombre: nombreCiclo, maxPeriodo: numPeriodo, weight };
                  }
                }
              });

              if (data.length < BATCH_ROWS) hasMore = false;
              else offset += BATCH_ROWS;
            }
          })());
        }

        // Ejecutar todas las peticiones concurrentemente
        const certResults = await Promise.all(certPromises);
        await Promise.all(insPromises);

        certResults.forEach(res => {
          if (!res.error && res.data) {
            res.data.forEach((c: any) => {
              certMap[c.alumno_id] = c.tramite_completado ? 'Completado' : 'En curso';
            });
          }
        });

        const finalCiclosMap: Record<string, string> = {};
        Object.keys(ultimosCiclos).forEach(alumnoId => {
          finalCiclosMap[alumnoId] = ultimosCiclos[alumnoId].nombre;
        });

        egresadosIds.forEach(id => {
          if (!certMap[id]) certMap[id] = 'Sin iniciar';
        });

        setCiclosEgresoMap(finalCiclosMap);
        setCertificacionMap(certMap);
      } catch (err) {
        console.error("Error al obtener datos externos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDatosExternos();
  }, [egresadosBase, ciclos]);

  // 3. Evaluar Pago de Titulación
  const pagoTitulacionMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!plans) return map;
    
    egresadosBase.forEach(a => {
      const planTitulacion = plans.find(p => p.alumno_id === a.id && p.tipo_plan === 'Titulación');
      if (!planTitulacion) {
        map[a.id] = 'Sin plan';
      } else {
        let isPagado = true;
        let hasConcepts = false;
        
        if (planTitulacion.detalles && planTitulacion.detalles.length > 0) {
          hasConcepts = true;
          for (const d of planTitulacion.detalles) {
             const est = d.estatus || '';
             const upper = est.toUpperCase();
             const pagado = upper.includes('PAGADO') || (est.trim().length > 0 && !upper.includes('RESTA'));
             if (!pagado) {
               isPagado = false;
               break;
             }
          }
        } else {
          for (let i = 1; i <= 15; i++) {
            const concepto = (planTitulacion as any)[`concepto_${i}`];
            const est = (planTitulacion as any)[`estatus_${i}`] || '';
            if (concepto && concepto.trim().length > 0) {
              hasConcepts = true;
              const upper = est.toUpperCase();
              const pagado = upper.includes('PAGADO') || (est.trim().length > 0 && !upper.includes('RESTA'));
              if (!pagado) {
                isPagado = false;
                break;
              }
            }
          }
        }
        
        if (!hasConcepts) {
          map[a.id] = 'Sin plan';
        } else {
          map[a.id] = isPagado ? 'Pago completo' : 'Pago en curso';
        }
      }
    });
    return map;
  }, [egresadosBase, plans]);

  // 4. Filtrar y ordenar egresados
  const filteredEgresados = useMemo(() => {
    let result = egresadosBase.filter(a => {
      if (selectedLicenciaturas.length > 0 && !selectedLicenciaturas.includes(a.licenciatura)) return false;
      if (selectedSegmento === 'TITULADOS' && a.estatus !== 'EGRESADO TITULADO') return false;
      if (selectedSegmento === 'NO_TITULADOS' && a.estatus !== 'EGRESADO') return false;
      
      const cicloEgresoDelAlumno = ciclosEgresoMap[a.id];
      if (selectedCicloEgreso !== 'TODOS') {
        if (cicloEgresoDelAlumno !== selectedCicloEgreso) return false;
      }
      
      return true;
    });

    result.sort((a, b) => {
      // Si se agrupa por ciclo, ordenar primero por ciclo descendente
      if (groupByCiclo) {
        const cicloA = ciclosEgresoMap[a.id] || 'Sin Kardex';
        const cicloB = ciclosEgresoMap[b.id] || 'Sin Kardex';
        const weightA = getCicloWeight(cicloA);
        const weightB = getCicloWeight(cicloB);
        if (weightA !== weightB) return weightB - weightA;
        if (cicloA !== cicloB) return cicloA.localeCompare(cicloB);
      }
      
      let valA = '';
      let valB = '';
      switch (sortConfig.key) {
        case 'nombre':
          valA = a.nombre_completo || '';
          valB = b.nombre_completo || '';
          break;
        case 'licenciatura':
          valA = a.licenciatura || '';
          valB = b.licenciatura || '';
          break;
        case 'estatus':
          valA = a.estatus || '';
          valB = b.estatus || '';
          break;
        case 'ciclo':
          valA = ciclosEgresoMap[a.id] || 'Sin Kardex';
          valB = ciclosEgresoMap[b.id] || 'Sin Kardex';
          break;
        case 'email':
          valA = a.email || '';
          valB = b.email || '';
          break;
        case 'pagoTitulacion':
          valA = pagoTitulacionMap[a.id] || 'Sin plan';
          valB = pagoTitulacionMap[b.id] || 'Sin plan';
          break;
        case 'certificacion':
          valA = certificacionMap[a.id] || 'Sin iniciar';
          valB = certificacionMap[b.id] || 'Sin iniciar';
          break;
      }
      const cmp = valA.localeCompare(valB);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [egresadosBase, selectedCicloEgreso, selectedLicenciaturas, selectedSegmento, ciclosEgresoMap, pagoTitulacionMap, certificacionMap, sortConfig, groupByCiclo]);

  // Reset de página al cambiar filtros
  useEffect(() => { setCurrentPage(1); }, [selectedCicloEgreso, selectedLicenciaturas, selectedSegmento, itemsPerPage, sortConfig, groupByCiclo]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredEgresados.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredEgresados.length);
  const paginatedEgresados = useMemo(() => {
    return filteredEgresados.slice(startIndex, endIndex);
  }, [filteredEgresados, startIndex, endIndex]);

  const ciclosEgresoOptions = useMemo(() => {
    const nombres = new Set<string>(Object.values(ciclosEgresoMap));
    return Array.from(nombres).sort((a, b) => b.localeCompare(a)); 
  }, [ciclosEgresoMap]);

  const nombreCicloSeleccionado = selectedCicloEgreso === 'TODOS' ? 'Todos los Ciclos' : selectedCicloEgreso;

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 inline" /> : <ChevronDown size={14} className="ml-1 inline" />;
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    const headers = [];
    if (visibleCols.nombre) headers.push("Nombre Completo");
    if (visibleCols.licenciatura) headers.push("Licenciatura");
    if (visibleCols.estatus) headers.push("Estatus");
    if (visibleCols.ciclo) headers.push("Ciclo de Egreso");
    if (visibleCols.telefonos) headers.push("Teléfonos");
    if (visibleCols.email) headers.push("Correo Electrónico");
    if (visibleCols.pagoTitulacion) headers.push("Pago Titulación");
    if (visibleCols.certificacion) headers.push("Certificación");
    
    csvContent += headers.join(",") + "\n";

    filteredEgresados.forEach(a => {
      const row = [];
      if (visibleCols.nombre) row.push(`"${toTitleCase(a.nombre_completo)}"`);
      if (visibleCols.licenciatura) row.push(`"${toTitleCase(a.licenciatura)}"`);
      if (visibleCols.estatus) row.push(`"${toTitleCase(a.estatus || '')}"`);
      if (visibleCols.ciclo) row.push(`"${ciclosEgresoMap[a.id] || 'Sin Kardex'}"`);
      if (visibleCols.telefonos) {
        const telefonos = [a.telefono, a.celular].filter(Boolean).join(" / ");
        row.push(`"${telefonos}"`);
      }
      if (visibleCols.email) row.push(`"${(a.email || '').toLowerCase()}"`);
      if (visibleCols.pagoTitulacion) row.push(`"${pagoTitulacionMap[a.id] || 'Sin plan'}"`);
      if (visibleCols.certificacion) row.push(`"${certificacionMap[a.id] || 'Sin iniciar'}"`);
      
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

  // Exportar a PDF
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
    
    const head = [];
    if (visibleCols.nombre) head.push('Nombre Completo');
    if (visibleCols.licenciatura) head.push('Licenciatura');
    if (visibleCols.estatus) head.push('Estatus');
    if (visibleCols.ciclo) head.push('Ciclo Egreso');
    if (visibleCols.telefonos) head.push('Teléfonos');
    if (visibleCols.email) head.push('Correo');
    if (visibleCols.pagoTitulacion) head.push('Pago Titulación');
    if (visibleCols.certificacion) head.push('Certificación');
    
    const tableData: any[] = [];
    let currentCiclo: string | null = null;

    filteredEgresados.forEach(a => {
      const cicloEgresoNombre = ciclosEgresoMap[a.id] || 'Sin Kardex';
      
      // Insertar fila de agrupador si corresponde
      if (groupByCiclo && cicloEgresoNombre !== currentCiclo) {
        currentCiclo = cicloEgresoNombre;
        tableData.push([{ 
          content: `Ciclo de Egreso: ${currentCiclo}`, 
          colSpan: head.length, 
          styles: { fillColor: [243, 232, 255], textColor: [107, 33, 168], fontStyle: 'bold', halign: 'center' } 
        }]);
      }

      const row = [];
      if (visibleCols.nombre) row.push(toTitleCase(a.nombre_completo));
      if (visibleCols.licenciatura) row.push(toTitleCase(a.licenciatura));
      if (visibleCols.estatus) row.push(toTitleCase(a.estatus || ''));
      if (visibleCols.ciclo) row.push(cicloEgresoNombre);
      if (visibleCols.telefonos) {
        row.push([a.telefono, a.celular].filter(Boolean).join(" / "));
      }
      if (visibleCols.email) row.push((a.email || '').toLowerCase());
      if (visibleCols.pagoTitulacion) row.push(pagoTitulacionMap[a.id] || 'Sin plan');
      if (visibleCols.certificacion) row.push(certificacionMap[a.id] || 'Sin iniciar');
      
      tableData.push(row);
    });

    autoTable(doc, {
      startY: 40,
      head: [head],
      body: tableData,
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

  const visibleColCount = Object.values(visibleCols).filter(Boolean).length + 1; // +1 for the "#" column

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
          <p className="text-gray-500">Analizando ciclos, titulaciones y certificaciones de alumnos...</p>
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
                onChange={(e) => {
                  setSelectedCicloEgreso(e.target.value);
                  if (e.target.value !== 'TODOS') setGroupByCiclo(false);
                }}
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
                {filteredEgresados.length} Egresados
              </span>
              
              <button 
                onClick={() => setGroupByCiclo(!groupByCiclo)}
                disabled={selectedCicloEgreso !== 'TODOS'}
                className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${groupByCiclo ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600'}`}
                title={selectedCicloEgreso !== 'TODOS' ? "Solo disponible al ver todos los ciclos" : "Agrupar lista por ciclo de egreso"}
              >
                <Layers size={16}/>
                {groupByCiclo ? 'Agrupado por Ciclo' : 'Agrupar por Ciclo'}
              </button>

              <div className="relative" ref={colMenuRef}>
                <button 
                  onClick={() => setShowColMenu(!showColMenu)}
                  className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full transition-colors bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600"
                >
                  <Columns size={16}/> Columnas
                </button>
                {showColMenu && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-[#252d36] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-2 py-3 flex flex-col gap-1.5">
                    {Object.entries({
                      nombre: 'Nombre Completo',
                      licenciatura: 'Licenciatura',
                      estatus: 'Estatus',
                      ciclo: 'Ciclo Egreso',
                      telefonos: 'Teléfonos',
                      email: 'Correo Electrónico',
                      pagoTitulacion: 'Pago de Titulación',
                      certificacion: 'Certificación DGAIR'
                    }).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors text-sm font-medium text-gray-700 dark:text-gray-300">
                        <input 
                          type="checkbox"
                          checked={visibleCols[key as keyof typeof visibleCols]}
                          onChange={() => setVisibleCols(prev => ({ ...prev, [key]: !prev[key as keyof typeof visibleCols] }))}
                          className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 bg-white dark:bg-[#1c2228] w-4 h-4 cursor-pointer"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
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

          <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-transparent">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-[#2a3441] sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">#</th>
                  {visibleCols.nombre && (
                    <th 
                      className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('nombre')}
                    >
                      Nombre Completo <SortIcon columnKey="nombre" />
                    </th>
                  )}
                  {visibleCols.licenciatura && (
                    <th 
                      className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('licenciatura')}
                    >
                      Licenciatura <SortIcon columnKey="licenciatura" />
                    </th>
                  )}
                  {visibleCols.estatus && (
                    <th 
                      className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('estatus')}
                    >
                      Estatus <SortIcon columnKey="estatus" />
                    </th>
                  )}
                  {visibleCols.ciclo && (
                    <th 
                      className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('ciclo')}
                    >
                      Ciclo Egreso <SortIcon columnKey="ciclo" />
                    </th>
                  )}
                  {visibleCols.telefonos && (
                    <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Teléfonos</th>
                  )}
                  {visibleCols.email && (
                    <th 
                      className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('email')}
                    >
                      Correo Electrónico <SortIcon columnKey="email" />
                    </th>
                  )}
                  {visibleCols.pagoTitulacion && (
                    <th 
                      className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('pagoTitulacion')}
                    >
                      Pago Titulación <SortIcon columnKey="pagoTitulacion" />
                    </th>
                  )}
                  {visibleCols.certificacion && (
                    <th 
                      className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('certificacion')}
                    >
                      Certificación <SortIcon columnKey="certificacion" />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {paginatedEgresados.length > 0 ? (
                  paginatedEgresados.map((a, idx) => {
                    const esTitulado = a.estatus === 'EGRESADO TITULADO';
                    const cicloEgresoNombre = ciclosEgresoMap[a.id] || 'Sin Kardex';
                    const pagoTitulacion = pagoTitulacionMap[a.id] || 'Sin plan';
                    const certificacionStatus = certificacionMap[a.id] || 'Sin iniciar';
                    const rowNumber = startIndex + idx + 1;
                    
                    const globalIdx = startIndex + idx;
                    const prevCiclo = globalIdx > 0 ? (ciclosEgresoMap[filteredEgresados[globalIdx - 1].id] || 'Sin Kardex') : null;
                    const showGroupHeader = groupByCiclo && cicloEgresoNombre !== prevCiclo;
                    
                    return (
                      <React.Fragment key={a.id}>
                        {showGroupHeader && (
                          <tr className="bg-purple-50 dark:bg-purple-900/20">
                            <td colSpan={visibleColCount} className="p-3 text-sm font-bold text-purple-800 dark:text-purple-300 border-y border-purple-100 dark:border-purple-800/50">
                              Ciclo de Egreso: {cicloEgresoNombre}
                            </td>
                          </tr>
                        )}
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="p-3 text-xs text-gray-400 dark:text-gray-500 tabular-nums">{rowNumber}</td>
                          {visibleCols.nombre && (
                            <td className="p-3 text-sm text-gray-900 dark:text-gray-100 font-medium">
                              <span 
                                onClick={() => navigate('/ficha-alumno', { state: { alumnoId: a.id, fromAlumnos: true } })}
                                className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                                title="Ver ficha del alumno"
                              >
                                {toTitleCase(a.nombre_completo)}
                              </span>
                            </td>
                          )}
                          {visibleCols.licenciatura && (
                            <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{toTitleCase(a.licenciatura)}</td>
                          )}
                          {visibleCols.estatus && (
                            <td className="p-3 text-sm">
                              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                esTitulado 
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {toTitleCase(a.estatus || '')}
                              </span>
                            </td>
                          )}
                          {visibleCols.ciclo && (
                            <td className="p-3 text-sm text-gray-600 dark:text-gray-400 font-semibold">{cicloEgresoNombre}</td>
                          )}
                          {visibleCols.telefonos && (
                            <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                              {[a.telefono, a.celular].filter(Boolean).join(" / ") || '-'}
                            </td>
                          )}
                          {visibleCols.email && (
                            <td className="p-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{(a.email || '').toLowerCase() || '-'}</td>
                          )}
                          {visibleCols.pagoTitulacion && (
                            <td className="p-3 text-sm">
                              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                pagoTitulacion === 'Pago completo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                pagoTitulacion === 'Pago en curso' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                {pagoTitulacion}
                              </span>
                            </td>
                          )}
                          {visibleCols.certificacion && (
                            <td className="p-3 text-sm">
                              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                certificacionStatus === 'Completado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                certificacionStatus === 'En curso' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
                                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                {certificacionStatus}
                              </span>
                            </td>
                          )}
                        </tr>
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={visibleColCount} className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <Filter size={32} className="mx-auto mb-2 opacity-50" />
                      No se encontraron egresados con los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {filteredEgresados.length > 0 && (
            <div className="p-4 border-t border-[#f2f3f5] dark:border-gray-800 bg-[#f2f3f5] dark:bg-gray-800/50 flex flex-col md:flex-row items-center justify-between gap-4 rounded-b-xl mt-0">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#8e8e93] dark:text-[#8e8e93] font-medium">Mostrar</span>
                <select
                  className="border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-md text-sm p-1.5 bg-white dark:bg-[#1c2228] text-[#222222] dark:text-gray-200 outline-none focus:ring-2 focus:ring-[#3b82f6] font-medium cursor-pointer"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-[#8e8e93] dark:text-[#8e8e93] font-medium">alumnos</span>
              </div>
              <div className="text-sm text-[#8e8e93] dark:text-[#8e8e93] font-medium bg-white dark:bg-[#1c2228] px-3 py-1.5 rounded-[8px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)]">
                Mostrando <span className="text-gray-900 dark:text-gray-100 font-bold">{startIndex + 1}</span> a <span className="text-gray-900 dark:text-gray-100 font-bold">{endIndex}</span> de <span className="text-gray-900 dark:text-gray-100 font-bold">{filteredEgresados.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-4 py-1.5 text-sm border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] disabled:opacity-40 hover:bg-white dark:hover:bg-gray-700 text-[#45515e] dark:text-gray-300 font-bold transition-all shadow-[var(--shadow-subtle)] hover:shadow active:scale-95"
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
                    className="w-16 border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-md p-1.5 text-center text-sm font-bold bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-[#3b82f6] transition-all"
                  />
                  <span className="text-sm text-[#45515e] dark:text-gray-300 font-medium">de {totalPages || 1}</span>
                </div>
                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-4 py-1.5 text-sm border border-gray-300 dark:border-[rgba(255,255,255,0.08)] rounded-[8px] disabled:opacity-40 hover:bg-white dark:hover:bg-gray-700 text-[#45515e] dark:text-gray-300 font-bold transition-all shadow-[var(--shadow-subtle)] hover:shadow active:scale-95"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
