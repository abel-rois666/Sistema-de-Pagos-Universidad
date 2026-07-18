import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Alumno } from '../../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  FileText, 
  Printer, 
  Download, 
  Filter, 
  Eye, 
  EyeOff,
  User,
  GraduationCap,
  Clock
} from 'lucide-react';

export const ReportesControlEscolar: React.FC = () => {
  const { alumnos, ciclos, catalogos, activeCicloId, plans } = useAppStore();

  // Estados de Filtros
  const [selectedCiclo, setSelectedCiclo] = useState<string>('TODOS');
  const [selectedLicenciatura, setSelectedLicenciatura] = useState<string>('TODAS');
  const [selectedTurno, setSelectedTurno] = useState<string>('TODOS');
  
  // Estado para mostrar correo
  const [showEmail, setShowEmail] = useState<boolean>(true);

  // Alumnos filtrados
  const filteredAlumnos = useMemo(() => {
    return alumnos.filter(a => {
      // Filtrar por ciclo usando el plan de pagos o el campo directo
      if (selectedCiclo !== 'TODOS') {
        const hasPlanInCiclo = plans.some(p => p.alumno_id === a.id && p.ciclo_id === selectedCiclo);
        if (!hasPlanInCiclo && a.ciclo_ultima_asignacion_grado !== selectedCiclo) return false;
      }
      
      // Filtrar por licenciatura
      if (selectedLicenciatura !== 'TODAS' && a.licenciatura !== selectedLicenciatura) return false;
      
      // Filtrar por turno
      if (selectedTurno !== 'TODOS' && a.turno !== selectedTurno) return false;
      
      return true;
    }).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
  }, [alumnos, selectedCiclo, selectedLicenciatura, selectedTurno, plans]);

  const nombreCicloSeleccionado = ciclos.find(c => c.id === selectedCiclo)?.nombre || 'Todos los Ciclos';

  // Exportar a CSV
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Cabeceras
    const headers = ["Nombre Completo", "Licenciatura", "Turno", "Teléfonos"];
    if (showEmail) headers.push("Correo Electrónico");
    csvContent += headers.join(",") + "\n";

    // Filas
    filteredAlumnos.forEach(a => {
      const telefonos = [a.telefono, a.celular].filter(Boolean).join(" / ");
      const row = [
        `"${a.nombre_completo}"`,
        `"${a.licenciatura}"`,
        `"${a.turno}"`,
        `"${telefonos}"`
      ];
      if (showEmail) row.push(`"${a.email || ''}"`);
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Alumnos_${nombreCicloSeleccionado}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar a PDF (Imprimir o Descargar)
  const handleExportPDF = (action: 'download' | 'print') => {
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(16);
    doc.text(`Reporte de Alumnos - Control Escolar`, 14, 15);
    
    doc.setFontSize(11);
    doc.text(`Ciclo: ${nombreCicloSeleccionado}`, 14, 23);
    doc.text(`Licenciatura: ${selectedLicenciatura === 'TODAS' ? 'Todas' : selectedLicenciatura}`, 14, 29);
    doc.text(`Turno: ${selectedTurno === 'TODOS' ? 'Todos' : selectedTurno}`, 14, 35);
    
    // Columnas
    const head = [['Nombre Completo', 'Licenciatura', 'Turno', 'Teléfonos']];
    if (showEmail) head[0].push('Correo Electrónico');
    
    // Datos
    const data = filteredAlumnos.map(a => {
      const telefonos = [a.telefono, a.celular].filter(Boolean).join(" / ");
      const row = [a.nombre_completo, a.licenciatura, a.turno, telefonos];
      if (showEmail) row.push(a.email || '');
      return row;
    });

    // Generar tabla usando el tipado genérico any para bypassear el warning de autotable si ocurre
    (doc as any).autoTable({
      startY: 40,
      head: head,
      body: data,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 86, 240] }, // Color primario de la app
    });

    if (action === 'download') {
      doc.save(`Reporte_Alumnos_${nombreCicloSeleccionado}.pdf`);
    } else {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1c2228] p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
          <FileText className="text-blue-600 dark:text-blue-400" size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-display">Reportes de Control Escolar</h2>
          <p className="text-gray-500 dark:text-gray-400">Generador de listados y reportes académicos</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6 bg-gray-50 dark:bg-[#252d36] p-4 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
            <Clock size={16}/> Ciclo Escolar
          </label>
          <select 
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100"
            value={selectedCiclo}
            onChange={(e) => setSelectedCiclo(e.target.value)}
          >
            <option value="TODOS">Todos los Ciclos</option>
            {ciclos.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} {c.tipo_periodo ? `(${c.tipo_periodo})` : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
            <GraduationCap size={16}/> Licenciatura
          </label>
          <select 
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100"
            value={selectedLicenciatura}
            onChange={(e) => setSelectedLicenciatura(e.target.value)}
          >
            <option value="TODAS">Todas las Licenciaturas</option>
            {catalogos.licenciaturas.map(lic => (
              <option key={lic} value={lic}>{lic}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
            <User size={16}/> Turno
          </label>
          <select 
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100"
            value={selectedTurno}
            onChange={(e) => setSelectedTurno(e.target.value)}
          >
            <option value="TODOS">Todos los Turnos</option>
            {catalogos.turnos.map(turno => (
              <option key={turno} value={turno}>{turno}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
            {filteredAlumnos.length} Alumnos Encontrados
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
              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Nombre Completo</th>
              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Licenciatura</th>
              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Turno</th>
              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Teléfonos</th>
              {showEmail && <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">Correo Electrónico</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-transparent">
            {filteredAlumnos.length > 0 ? (
              filteredAlumnos.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-3 text-sm text-gray-900 dark:text-gray-100 font-medium">{a.nombre_completo}</td>
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{a.licenciatura}</td>
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{a.turno}</td>
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                    {[a.telefono, a.celular].filter(Boolean).join(" / ") || '-'}
                  </td>
                  {showEmail && <td className="p-3 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{a.email || '-'}</td>}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showEmail ? 5 : 4} className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Filter size={32} className="mx-auto mb-2 opacity-50" />
                  No se encontraron alumnos con los filtros seleccionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
