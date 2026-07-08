import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Printer, Download, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Alumno, PaymentPlan } from '../../types';
import { calculateStudentTotals, toTitleCase, generateCSV, downloadCSV, extractMonth } from '../../utils';
import { formatGrado } from '../../utils/formatUtils';
import { printElement } from '../../lib/printUtils';

interface ModalReporteAlumnosProps {
  alumnos: Alumno[];
  activeCyclePlans: PaymentPlan[];
  cicloNombre: string;
  onClose: () => void;
}

interface ReportRecord {
  id: string;
  nombre: string;
  licenciatura: string;
  grado: string;
  estatus: string;
  tienePlan: boolean;
  pagado: number;
  adeuda: number;
}

export default function ModalReporteAlumnos({ alumnos, activeCyclePlans, cicloNombre, onClose }: ModalReporteAlumnosProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [omitirSinPlan, setOmitirSinPlan] = useState(false);
  const [mesFiltro, setMesFiltro] = useState<string>('Todos');
  const [tipoPlanFiltro, setTipoPlanFiltro] = useState<string>('Todos');

  const mesesDisponibles = useMemo(() => {
    const meses = new Set<string>();
    activeCyclePlans.forEach(plan => {
      for (let i = 1; i <= 15; i++) {
        const fecha = plan[`fecha_${i}` as keyof PaymentPlan] as string | undefined;
        if (fecha) {
          const m = extractMonth(fecha);
          if (m && m !== 'DESCONOCIDO' && m !== 'OTROS') {
            meses.add(m);
          }
        }
      }
    });
    // Podríamos ordenarlos si tuvieran formato Date, pero al ser "ENERO 2024", lo dejamos como sale o con un sort básico
    return Array.from(meses).sort();
  }, [activeCyclePlans]);

  const reportData: ReportRecord[] = useMemo(() => {
    return alumnos.map(alumno => {
      const studentPlans = activeCyclePlans.filter(p => p.alumno_id === alumno.id || p.nombre_alumno === alumno.nombre_completo);
      let totalPagado = 0;
      let totalAdeuda = 0;

      const filteredPlans = studentPlans.filter(p => {
        if (tipoPlanFiltro === 'Todos') return true;
        if (tipoPlanFiltro === 'Ordinario') return p.tipo_plan !== 'Titulación';
        if (tipoPlanFiltro === 'Titulación') return p.tipo_plan === 'Titulación';
        return true;
      });

      filteredPlans.forEach(plan => {
        const { paid, owed } = calculateStudentTotals(
          plan, 
          alumno.estatus, 
          mesFiltro === 'Todos' ? undefined : mesFiltro
        );
        totalPagado += paid;
        totalAdeuda += owed;
      });

      return {
        id: alumno.id,
        nombre: alumno.nombre_completo,
        licenciatura: alumno.licenciatura || '',
        grado: alumno.grado_actual || '',
        estatus: alumno.estatus || 'ACTIVO',
        tienePlan: filteredPlans.length > 0,
        pagado: totalPagado,
        adeuda: totalAdeuda
      };
    }).filter(record => {
      if (omitirSinPlan && !record.tienePlan) return false;
      return true;
    });
  }, [alumnos, activeCyclePlans, omitirSinPlan, mesFiltro, tipoPlanFiltro]);

  const totalGlobalPagado = reportData.reduce((sum, r) => sum + r.pagado, 0);
  const totalGlobalAdeudado = reportData.reduce((sum, r) => sum + r.adeuda, 0);

  const handleExportCSV = () => {
    const headers = ['ALUMNO', 'LICENCIATURA', 'GRADO', 'ESTATUS', 'TIENE_PLAN', 'HA_PAGADO', 'ADEUDA'];
    const rows = reportData.map(r => [
      toTitleCase(r.nombre),
      toTitleCase(r.licenciatura),
      formatGrado(r.grado),
      r.estatus,
      r.tienePlan ? 'SÍ' : 'NO',
      r.pagado.toString(),
      r.adeuda.toString()
    ]);
    const csvContent = generateCSV(headers, rows);
    downloadCSV(csvContent, `reporte_financiero_alumnos_${cicloNombre.replace(/\s+/g, '_')}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#f2f3f5] dark:bg-gray-950 w-full max-w-6xl max-h-[90vh] rounded-[24px] shadow-[var(--shadow-elevated)] flex flex-col border border-white/20 dark:border-gray-800 overflow-hidden"
      >
        {/* HEADER */}
        <div className="bg-white dark:bg-[#1c2228] p-6 border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-[#222222] dark:text-gray-100 flex items-center gap-3">
              <FileText className="text-[#1456f0]" /> Reporte Financiero de Alumnos
            </h2>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <p className="text-[#8e8e93] text-sm">Ciclo Activo: <strong>{cicloNombre}</strong></p>
              
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tipo:</span>
                <select 
                  value={tipoPlanFiltro}
                  onChange={e => setTipoPlanFiltro(e.target.value)}
                  className="bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full outline-none border border-transparent focus:border-[#1456f0] transition-colors cursor-pointer"
                >
                  <option value="Todos">Todos</option>
                  <option value="Ordinario">Ordinario (Lic/Esp)</option>
                  <option value="Titulación">Titulación</option>
                </select>
              </div>

              <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Mes:</span>
                <select 
                  value={mesFiltro}
                  onChange={e => setMesFiltro(e.target.value)}
                  className="bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full outline-none border border-transparent focus:border-[#1456f0] transition-colors cursor-pointer"
                >
                  <option value="Todos">Todos</option>
                  {mesesDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block"></div>

              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300 font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full transition-colors hover:bg-gray-200 dark:hover:bg-gray-700">
                <input 
                  type="checkbox" 
                  checked={omitirSinPlan}
                  onChange={(e) => setOmitirSinPlan(e.target.checked)}
                  className="w-4 h-4 text-[#1456f0] border-gray-300 rounded focus:ring-[#1456f0] dark:focus:ring-[#1456f0] dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
                />
                Omitir alumnos sin plan asignado
              </label>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO (Scrollable) */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {/* Tarjetas Totales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 shrink-0">
            <div className="bg-white dark:bg-[#1c2228] rounded-[16px] p-5 border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Alumnos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.length}</p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-[#1c2228] rounded-[16px] p-5 border border-emerald-100 dark:border-emerald-900/30 shadow-[var(--shadow-subtle)] flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <span className="font-bold text-xl">$</span>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Total Pagado</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">${totalGlobalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1c2228] rounded-[16px] p-5 border border-rose-100 dark:border-rose-900/30 shadow-[var(--shadow-subtle)] flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/30 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400">
                <span className="font-bold text-xl">$</span>
              </div>
              <div>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-500 uppercase tracking-wider">Total Adeudo</p>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">${totalGlobalAdeudado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Tabla de Resultados */}
          <div className="bg-white dark:bg-[#1c2228] rounded-[16px] border border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] shadow-[var(--shadow-subtle)] overflow-hidden flex-1 flex flex-col min-h-[300px]">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-[#eef2ff] dark:bg-gray-900/50 text-[#45515e] dark:text-gray-300 text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="py-3 px-4 font-semibold border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">Alumno</th>
                    <th className="py-3 px-4 font-semibold border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">Licenciatura</th>
                    <th className="py-3 px-4 font-semibold border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">Grado</th>
                    <th className="py-3 px-4 font-semibold border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)]">Estatus</th>
                    <th className="py-3 px-4 font-semibold border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] text-center">Plan</th>
                    <th className="py-3 px-4 font-semibold border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] text-right">Pagado</th>
                    <th className="py-3 px-4 font-semibold border-b border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] text-right">Adeuda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {reportData.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{toTitleCase(record.nombre)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{toTitleCase(record.licenciatura)}</td>
                      <td className="py-3 px-4 text-sm font-medium text-[#1456f0] dark:text-indigo-400">{formatGrado(record.grado)}</td>
                      <td className="py-3 px-4 text-xs">
                        <span className={`px-2 py-0.5 rounded uppercase font-bold border ${record.estatus === 'BAJA' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50' : record.estatus?.includes('EGRESADO') ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50'}`}>
                          {record.estatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {record.tienePlan ? <CheckCircle size={16} className="text-emerald-500 mx-auto" /> : <XCircle size={16} className="text-gray-300 dark:text-gray-600 mx-auto" />}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-emerald-600 dark:text-emerald-400">${record.pagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-rose-600 dark:text-rose-400">${record.adeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">No hay datos para mostrar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-white dark:bg-[#1c2228] p-4 border-t border-[#e5e7eb] dark:border-[rgba(255,255,255,0.08)] flex justify-end gap-3 shrink-0">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-[8px] shadow-[var(--shadow-subtle)] transition-colors"
          >
            <Download size={16} /> Exportar CSV
          </button>
          <button 
            onClick={() => { if (printRef.current) printElement(printRef.current, { landscape: true }); }}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#1456f0] hover:bg-[#1d4ed8] text-white rounded-[8px] shadow-[var(--shadow-subtle)] transition-colors"
          >
            <Printer size={16} /> Imprimir PDF
          </button>
        </div>
      </motion.div>

      {/* VERSIÓN IMPRESIÓN (Oculta) */}
      <div ref={printRef} style={{ position: 'fixed', top: '-10000px', left: '-10000px', width: '1020px', background: 'white', color: 'black', fontFamily: 'sans-serif', padding: '10px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Reporte Financiero de Alumnos</h1>
          <p style={{ color: '#4b5563', fontWeight: 500 }}>
            Ciclo: {cicloNombre} {tipoPlanFiltro !== 'Todos' ? `| Tipo: ${tipoPlanFiltro} ` : ''}{mesFiltro !== 'Todos' ? `| Mes: ${mesFiltro} ` : ''}| Generado el {new Date().toLocaleDateString('es-MX')}
          </p>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', borderBottom: '2px solid #1f2937', paddingBottom: '8px' }}>
          <div style={{ fontWeight: 600, fontSize: '12px' }}>Total de Alumnos: {reportData.length}</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#059669', marginBottom: '4px' }}>Total Pagado: ${totalGlobalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#e11d48' }}>Total Adeudado: ${totalGlobalAdeudado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        {reportData.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #1f2937', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '6px 4px', fontWeight: 'bold', width: '25%', textAlign: 'left' }}>Alumno</th>
                <th style={{ padding: '6px 4px', fontWeight: 'bold', width: '20%', textAlign: 'left' }}>Licenciatura</th>
                <th style={{ padding: '6px 4px', fontWeight: 'bold', width: '10%', textAlign: 'center' }}>Grado</th>
                <th style={{ padding: '6px 4px', fontWeight: 'bold', width: '10%', textAlign: 'center' }}>Estatus</th>
                <th style={{ padding: '6px 4px', fontWeight: 'bold', width: '5%', textAlign: 'center' }}>Plan</th>
                <th style={{ padding: '6px 4px', fontWeight: 'bold', width: '15%', textAlign: 'right' }}>Pagado</th>
                <th style={{ padding: '6px 4px', fontWeight: 'bold', width: '15%', textAlign: 'right' }}>Adeuda</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(record => (
                <tr key={record.id} style={{ borderBottom: '1px solid #d1d5db' }}>
                  <td style={{ padding: '4px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(record.nombre)}</td>
                  <td style={{ padding: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toTitleCase(record.licenciatura)}</td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>{record.grado}</td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>{record.estatus}</td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>{record.tienePlan ? 'SÍ' : 'NO'}</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>${record.pagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold', color: '#e11d48' }}>${record.adeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0', fontWeight: 'bold', border: '1px dashed #d1d5db', marginTop: '32px', borderRadius: '8px' }}>
             No hay datos para generar el reporte.
          </div>
        )}
      </div>
    </div>
  );
}
