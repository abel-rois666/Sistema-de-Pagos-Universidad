import EstadoError from '../ui/EstadoError';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MultiSelectFilter } from '../MultiSelectFilter';
import { useAppStore } from '../../store/useAppStore';
import useDatosReporteEgresados from '../../hooks/useDatosReporteEgresados';
import { pesoCicloEgresado as getCicloWeight } from '../../reportes/consultaEgresados';
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
import ConsultaAlumnoReporte, { type DestinoAlumnoReporte } from './ConsultaAlumnoReporte';
import CeldaSeguimientoAlumno from './CeldaSeguimientoAlumno';
import { textoCertificaciones, textoPagosTitulacion } from '../../certificacion/seguimiento';
import ExportarListadoCSV from './ExportarListadoCSV';
import { columnasEgresadosCSV, tituloEgresadosCSV as toTitleCase } from '../../reportes/exportacionEgresados';
import { fechaActualListado } from '../../reportes/listadoGeneral';

interface Props {
  onBack: () => void;
}

type SortKey = 'nombre' | 'licenciatura' | 'estatus' | 'ciclo' | 'email' | 'pagoTitulacion' | 'pagoCertificado' | 'certificacion';

export const ReporteEgresados: React.FC<Props> = ({ onBack }) => {
  const navigate = useNavigate();
  const { alumnos, ciclos, catalogos, plans, refreshAlumnos } = useAppStore();
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [recargandoAlumnos, setRecargandoAlumnos] = useState(false);
  const [errorRecarga, setErrorRecarga] = useState('');

  const [destino, setDestino] = useState<DestinoAlumnoReporte | null>(null);
  const [exportacionCSV, setExportacionCSV] = useState(false);
  
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
    pagoCertificado: false,
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
    return alumnos.filter(a => a.estatus === 'EGRESADO' || a.estatus === 'TITULADO' || a.estatus === 'EGRESADO TITULADO');
  }, [alumnos]);

  const egresadosIds = useMemo(() => egresadosBase.map(a => a.id), [egresadosBase]);
  const consulta = useDatosReporteEgresados(egresadosIds, ciclos, refreshTrigger);
  const { ciclosEgresoMap, tieneKardexMap, certificacionMap, certificaciones, fetchProgress } = consulta;
  const pagoCertificadoMap = useMemo(()=>Object.fromEntries(egresadosIds.map(id=>[id,textoCertificaciones(certificaciones,id,'pagoCertificado')])),[certificaciones,egresadosIds]);
  const loading = consulta.loading || recargandoAlumnos;
  const errorConsulta = errorRecarga || consulta.errorConsulta;
  const recargarReporte = async () => {
    if (recargandoAlumnos) return;
    setRecargandoAlumnos(true); setErrorRecarga('');
    try { await refreshAlumnos(); setRefreshTrigger(t => t + 1); }
    catch { setErrorRecarga('No se pudo actualizar el padrón de alumnos. Reintenta antes de consultar o exportar el reporte.'); }
    finally { setRecargandoAlumnos(false); }
  };

  // 3. Evaluar Pago de Titulación
  const pagoTitulacionMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!plans) return map;
    
    egresadosBase.forEach(a => {
      map[a.id] = textoPagosTitulacion(plans,a.id);
    });
    return map;
  }, [egresadosBase, plans]);

  // 4. Filtrar y ordenar egresados
  const filteredEgresados = useMemo(() => {
    let result = egresadosBase.filter(a => {
      if (selectedLicenciaturas.length > 0 && !selectedLicenciaturas.includes(a.licenciatura)) return false;
      if (selectedSegmento === 'TITULADOS' && a.estatus !== 'TITULADO' && a.estatus !== 'EGRESADO TITULADO') return false;
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
        const cicloA = ciclosEgresoMap[a.id] || (tieneKardexMap[a.id] ? 'Ciclo Desconocido' : 'Sin Kardex');
        const cicloB = ciclosEgresoMap[b.id] || (tieneKardexMap[b.id] ? 'Ciclo Desconocido' : 'Sin Kardex');
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
          valA = ciclosEgresoMap[a.id] || (tieneKardexMap[a.id] ? 'Ciclo Desconocido' : 'Sin Kardex');
          valB = ciclosEgresoMap[b.id] || (tieneKardexMap[b.id] ? 'Ciclo Desconocido' : 'Sin Kardex');
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
        case 'pagoCertificado':
          valA = pagoCertificadoMap[a.id] || 'Sin registro';
          valB = pagoCertificadoMap[b.id] || 'Sin registro';
          break;
      }
      const cmp = valA.localeCompare(valB);
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [egresadosBase, selectedCicloEgreso, selectedLicenciaturas, selectedSegmento, ciclosEgresoMap, tieneKardexMap, pagoTitulacionMap, pagoCertificadoMap, certificacionMap, sortConfig, groupByCiclo]);

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

  const columnasCSV = useMemo(() => columnasEgresadosCSV(visibleCols, {
    ciclosEgresoMap, tieneKardexMap, pagoTitulacionMap, pagoCertificadoMap, certificacionMap
  }), [visibleCols, ciclosEgresoMap, tieneKardexMap, pagoTitulacionMap, pagoCertificadoMap, certificacionMap]);

  const handleExportCSV = () => {
    if (loading || errorConsulta || !filteredEgresados.length) return;
    setExportacionCSV(true);
  };

  // Exportar a PDF
  const handleExportPDF = (action: 'download' | 'print') => {
    if (loading || errorConsulta) return;
    const doc = new jsPDF({orientation:'landscape'});
    
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
    if (visibleCols.pagoCertificado) head.push('Pago del certificado');
    if (visibleCols.certificacion) head.push('Trámite de certificación');
    
    const tableData: any[] = [];
    let currentCiclo: string | null = null;

    filteredEgresados.forEach(a => {
      const cicloEgresoNombre = ciclosEgresoMap[a.id] || (tieneKardexMap[a.id] ? 'Ciclo Desconocido' : 'Sin Kardex');
      
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
      if (visibleCols.pagoCertificado) row.push(pagoCertificadoMap[a.id] || 'Sin registro');
      if (visibleCols.certificacion) row.push(certificacionMap[a.id] || 'Sin registro');
      
      tableData.push(row);
    });

    autoTable(doc, {
      startY: 40,
      head: [head],
      body: tableData,
      theme: 'grid',
      rowPageBreak: 'avoid',
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
    <>
      {exportacionCSV && <ExportarListadoCSV tipoReporte="egresados" alumnos={filteredEgresados} planes={plans} ciclos={ciclos}
        columnas={columnasCSV} fecha={fechaActualListado()} periodo={nombreCicloSeleccionado}
        descripcionConsulta={`Ciclo de egreso: ${nombreCicloSeleccionado}. Licenciatura: ${selectedLicenciaturas.length ? selectedLicenciaturas.join(', ') : 'Todas'}. Segmento: ${selectedSegmento === 'TITULADOS' ? 'Solo titulados' : selectedSegmento === 'NO_TITULADOS' ? 'Egresados no titulados' : 'Todos'}.`}
        onCerrar={() => setExportacionCSV(false)}/>}
      {destino && <ConsultaAlumnoReporte destino={destino} onCerrar={()=>setDestino(null)} onActualizado={()=>setRefreshTrigger(n=>n+1)}/>}
    <div className="flex flex-col min-w-0 h-full bg-white dark:bg-[#1c2228] p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="text-gray-500 dark:text-gray-400" size={24} />
        </button>
        <div className="hidden sm:block shrink-0 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
          <GraduationCap className="text-purple-600 dark:text-purple-400" size={28} />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 font-display">Reporte de Egresados</h2>
          <p className="text-gray-500 dark:text-gray-400">Segmentación de egresados y titulados por ciclo de egreso</p>
        </div>
      </div>

      {errorConsulta ? <EstadoError mensaje={errorConsulta} onReintentar={() => { if (errorRecarga) void recargarReporte(); else setRefreshTrigger(n => n + 1); }} /> : loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
          <p role="status" className="text-gray-600 dark:text-gray-300 font-medium">Consultando historial académico y certificación…</p>
          {fetchProgress > 0 && (
            <div className="w-64 mt-4">
              <div role="progressbar" aria-label="Carga del reporte" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fetchProgress} className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-600 dark:bg-purple-500 transition-all duration-300" 
                  style={{ width: `${fetchProgress}%` }}
                />
              </div>
              <p className="text-xs text-center text-gray-600 dark:text-gray-300 mt-2">{fetchProgress}% de la consulta completado</p>
            </div>
          )}
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

            <div className="flex-1 min-w-0 z-20">
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

            <div className="flex-1 min-w-0">
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

          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-800/30">
                {filteredEgresados.length} Egresados
              </span>
              
              <button 
                onClick={() => void recargarReporte()}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                title="Volver a generar reporte y recargar datos"
              >
                <Loader2 size={16} className={loading ? "animate-spin" : ""} />
                Recargar Datos
              </button>
              
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
                      pagoCertificado: 'Pago del certificado',
                      certificacion: 'Trámite de certificación'
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
            
            <div className="flex flex-wrap gap-2">
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
                disabled={!filteredEgresados.length}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-800/50 text-green-700 dark:text-green-400 rounded-lg transition-colors font-medium text-sm border border-green-200 dark:border-green-800/50 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
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
                  {visibleCols.pagoCertificado && <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"><button type="button" onClick={()=>handleSort('pagoCertificado')}>Pago del certificado <SortIcon columnKey="pagoCertificado"/></button></th>}
                  {visibleCols.certificacion && (
                    <th 
                      className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => handleSort('certificacion')}
                    >
                      Trámite de certificación <SortIcon columnKey="certificacion" />
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {paginatedEgresados.length > 0 ? (
                  paginatedEgresados.map((a, idx) => {
                    const esTitulado = a.estatus === 'TITULADO' || a.estatus === 'EGRESADO TITULADO';
                    const cicloEgresoNombre = ciclosEgresoMap[a.id] || (tieneKardexMap[a.id] ? 'Ciclo Desconocido' : 'Sin Kardex');
                    const rowNumber = startIndex + idx + 1;
                    
                    const globalIdx = startIndex + idx;
                    const prevCiclo = globalIdx > 0 ? (ciclosEgresoMap[filteredEgresados[globalIdx - 1].id] || (tieneKardexMap[filteredEgresados[globalIdx - 1].id] ? 'Ciclo Desconocido' : 'Sin Kardex')) : null;
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
                              <button type="button"
                                onClick={() => setDestino({alumnoId:a.id,vista:'datos_generales'})}
                                className="text-left text-blue-700 dark:text-blue-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
                                title="Ver ficha del alumno"
                              >
                                {toTitleCase(a.nombre_completo)}
                              </button>
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
                              <CeldaSeguimientoAlumno alumnoId={a.id} campo="pagoTitulacion" certificaciones={certificaciones} planes={plans} onAbrir={setDestino}/>
                            </td>
                          )}
                          {visibleCols.pagoCertificado && <td className="p-3 text-sm"><CeldaSeguimientoAlumno alumnoId={a.id} campo="pagoCertificado" certificaciones={certificaciones} planes={plans} onAbrir={setDestino}/></td>}
                          {visibleCols.certificacion && (
                            <td className="p-3 text-sm">
                              <CeldaSeguimientoAlumno alumnoId={a.id} campo="certificacion" certificaciones={certificaciones} planes={plans} onAbrir={setDestino}/>
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
              <div className="flex flex-wrap justify-center items-center gap-2">
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
    </>
  );
};
