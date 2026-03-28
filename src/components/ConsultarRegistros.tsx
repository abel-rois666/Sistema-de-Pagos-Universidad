import React, { useState, useEffect, useRef } from 'react';
import { Search, Eye, XCircle, Receipt, RefreshCw, Printer, Loader2, Upload, Download } from 'lucide-react';
import { downloadElementAsPDF } from '../lib/printUtils';
import ReciboPlantillaPDF from './ReciboPlantillaPDF';
import type { Alumno, CicloEscolar, Recibo, ReciboDetalle, Catalogos, PaymentPlan, AppConfig } from '../types';
import { supabase, cancelarRecibo, vincularReciboDetalleAMultiplesPlan, fetchAllSupabase } from '../lib/supabase';
import { CSV_HEADERS_RECIBOS, generateCSV, downloadCSV } from '../utils';
import ImportarRegistrosCSV from './ImportarRegistrosCSV';

interface Props {
  alumnos: Alumno[];
  activeCiclo?: CicloEscolar;
  ciclos: CicloEscolar[];
  catalogos: Catalogos;
  appConfig?: AppConfig;
  initialSearchTerm?: string;
}

export default function ConsultarRegistros({ alumnos, activeCiclo, ciclos, catalogos, appConfig, initialSearchTerm }: Props) {
  const [recibos, setRecibos] = useState<(Recibo & { recibos_detalles: ReciboDetalle[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [reciboSeleccionado, setReciboSeleccionado] = useState<(Recibo & { recibos_detalles: ReciboDetalle[] }) | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [importarVisible, setImportarVisible] = useState(false);
  const [repairProgress, setRepairProgress] = useState('');
  
  // Vincular Modal State
  const [vincularDetalle, setVincularDetalle] = useState<ReciboDetalle | null>(null);
  const [planesAlumno, setPlanesAlumno] = useState<PaymentPlan[]>([]);
  const [linking, setLinking] = useState(false);
  const [vincularSeleccion, setVincularSeleccion] = useState<{ planId: string; idx: number }[]>([]);

  useEffect(() => {
    if (vincularDetalle && reciboSeleccionado) {
       supabase.from('planes_pago').select('*')
         .eq('alumno_id', reciboSeleccionado.alumno_id)
         .eq('ciclo_id', reciboSeleccionado.ciclo_id)
         .then(({ data }) => setPlanesAlumno((data || []) as PaymentPlan[]));
    } else {
       setPlanesAlumno([]);
       setVincularSeleccion([]);
    }
  }, [vincularDetalle, reciboSeleccionado]);

  const toggleSeleccion = (planId: string, idx: number) => {
    setVincularSeleccion(prev => {
      const key = `${planId}-${idx}`;
      const exists = prev.some(s => `${s.planId}-${s.idx}` === key);
      return exists ? prev.filter(s => `${s.planId}-${s.idx}` !== key) : [...prev, { planId, idx }];
    });
  };

  const handleConfirmarVinculacion = async () => {
    if (!vincularDetalle || !reciboSeleccionado || vincularSeleccion.length === 0) return;
    setLinking(true);
    const err = await vincularReciboDetalleAMultiplesPlan(
      vincularDetalle.id,
      reciboSeleccionado.folio,
      vincularSeleccion
    );
    setLinking(false);
    if (err) {
      alert('Error vinculando: ' + err);
    } else {
      setVincularDetalle(null);
      setVincularSeleccion([]);
      cargarRecibos();
      // Actualizar la vista local del recibo seleccionado
      const firstIdx = vincularSeleccion[0].idx;
      const updatedDetails = reciboSeleccionado.recibos_detalles.map(d =>
        d.id === vincularDetalle.id ? { ...d, indice_concepto_plan: firstIdx } : d
      );
      setReciboSeleccionado({ ...reciboSeleccionado, recibos_detalles: updatedDetails });
    }
  };

  const handleExportCSV = () => {
    const rows: string[][] = recibosFiltrados.map(r => {
      const cols = [
        r.nombre_alumno || '',
        r.folio?.toString() || '',
        r.fecha_recibo || '',
        r.total?.toString() || '0',
        r.fecha_pago || '',
        r.estatus || ''
      ];
      const dets = r.recibos_detalles || [];
      for (let i = 0; i < 5; i++) {
        const d = dets[i];
        if (d) {
           cols.push(d.cantidad?.toString() || '');
           cols.push(d.concepto || '');
           cols.push(d.costo_unitario?.toString() || '');
           cols.push(d.subtotal?.toString() || '');
           cols.push(r.forma_pago || '');
           cols.push(r.banco || '');
        } else {
           cols.push('', '', '', '', '', '');
        }
      }
      return cols;
    });
    const csvContent = generateCSV(CSV_HEADERS_RECIBOS, rows);
    downloadCSV(csvContent, `recibos_historial.csv`);
  };

  const handleImprimir = async () => {
    if (!printRef.current || !reciboSeleccionado) return;
    setIsGeneratingPDF(true);
    try {
      const fileName = `Recibo_${reciboSeleccionado.folio}_${reciboSeleccionado.nombre_alumno.replace(/\s+/g, '_')}.pdf`;
      await downloadElementAsPDF(printRef.current, fileName);
    } catch (err) {
      console.error('Error generando PDF', err);
      alert('Error generando PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const cargarRecibos = async () => {
    setLoading(true);
    try {
      // Descargar recibos sin JOIN para evitar timeout por tablas grandes
      const { data: recData, error: recError } = await fetchAllSupabase(() => supabase
        .from('recibos')
        .select('*')
        .order('folio', { ascending: false }));

      if (recError) throw recError;

      // Descargar detalles por separado
      const { data: detData, error: detError } = await fetchAllSupabase(() => supabase
        .from('recibos_detalles')
        .select('*'));

      if (detError) throw detError;

      // Unir en memoria
      const detallesMap: Record<string, any[]> = {};
      (detData || []).forEach(d => {
        if (!detallesMap[d.recibo_id]) detallesMap[d.recibo_id] = [];
        detallesMap[d.recibo_id].push(d);
      });

      // Mapear nombre del alumno y ciclo
      const mapeados = (recData || []).map(r => {
        const al = alumnos.find(a => a.id === r.alumno_id);
        const ci = ciclos.find(c => c.id === r.ciclo_id);
        return {
          ...r,
          nombre_alumno: al ? al.nombre_completo : 'Desconocido',
          licenciatura: al ? al.licenciatura : '',
          ciclo_escolar: ci ? ci.nombre : '',
          recibos_detalles: detallesMap[r.id] || []
        };
      });

      setRecibos(mapeados);
    } catch (err) {
      console.error('Error al cargar recibos', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarRecibos();
  }, [alumnos]);

  const handleCancelar = async (id: string) => {
    if (!window.confirm('¿Estás seguro de cancelar este recibo? El estatus del Plan de Pagos NO se revertirá automáticamente.')) return;
    const err = await cancelarRecibo(id);
    if (!err) {
      cargarRecibos();
      if (reciboSeleccionado?.id === id) {
        setReciboSeleccionado(prev => prev ? { ...prev, estatus: 'CANCELADO' } : null);
      }
    } else {
      alert('Error cancelando recibo: ' + err);
    }
  };

  const handleRepararHistoricos = async () => {
    if (!window.confirm('¿Estás seguro de ejecutar la reparación masiva? Esto reasignará los recibos mal vinculados a sus ciclos históricos empleando cercanía de fechas.')) return;
    
    setLoading(true);
    setRepairProgress('Obteniendo planes de pago...');
    try {
      // Fetch planes_pago
      const { data: planes, error: planesErr } = await fetchAllSupabase(() => supabase.from('planes_pago').select('*'));
      if (planesErr) throw planesErr;
      const planesMutables = JSON.parse(JSON.stringify(planes || []));

      // Fetch recibos safely with pagination NO JOINS to avoid timeout
      setRepairProgress('Descargando recibos (fase 1/2)...');
      let allRecibos: any[] = [];
      let fetchMoreR = true;
      let fromR = 0;
      const stepR = 2000;
      
      while (fetchMoreR) {
         setRepairProgress(`Descargando recibos... (${allRecibos.length})`);
         const { data: chunk, error: err } = await supabase
            .from('recibos')
            .select('*')
            .range(fromR, fromR + stepR - 1);
            
         if (err) throw err;
         if (chunk && chunk.length > 0) {
            allRecibos = [...allRecibos, ...chunk];
            fromR += stepR;
         } else {
            fetchMoreR = false;
         }
      }

      setRepairProgress('Descargando detalles (fase 2/2)...');
      let allDetalles: any[] = [];
      let fetchMoreD = true;
      let fromD = 0;
      const stepD = 5000;
      
      while (fetchMoreD) {
         setRepairProgress(`Descargando detalles... (${allDetalles.length})`);
         const { data: chunk, error: err } = await supabase
            .from('recibos_detalles')
            .select('*')
            .range(fromD, fromD + stepD - 1);
            
         if (err) throw err;
         if (chunk && chunk.length > 0) {
            allDetalles = [...allDetalles, ...chunk];
            fromD += stepD;
         } else {
            fetchMoreD = false;
         }
      }

      setRepairProgress('Uniendo datos en memoria...');
      const detallesMap: Record<string, any[]> = {};
      allDetalles.forEach(d => {
         if (!detallesMap[d.recibo_id]) detallesMap[d.recibo_id] = [];
         detallesMap[d.recibo_id].push(d);
      });

      const joinedRecibos = allRecibos.map(r => ({
          ...r,
          recibos_detalles: detallesMap[r.id] || []
      }));

      setRepairProgress('Analizando mejores coincidencias temporales...');

      const parseDateToMs = (dStr: string) => {
        if (!dStr) return 0;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return new Date(dStr).getTime() || 0;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dStr)) {
            const [d, m, y] = dStr.split('/');
            return new Date(Number(y), Number(m)-1, Number(d)).getTime() || 0;
        }
        return new Date(dStr).getTime() || 0;
      };

      const planesToUpdate: Record<string, any> = {};
      const recibosToUpdate: any[] = [];
      const detallesToUpdate: any[] = [];

      for (const r of joinedRecibos) {
         if (r.estatus !== 'ACTIVO') continue;

         const studentPlanes = planesMutables.filter((p: any) => p.alumno_id === r.alumno_id);
         if (studentPlanes.length === 0) continue;

         let changedCiclo = false;
         let newCicloId = r.ciclo_id;

         r.recibos_detalles.forEach((d: any) => {
             let bestMatch: any = null;
             const fechaReciboMs = new Date(r.fecha_pago).getTime();

             studentPlanes.forEach((plan: any) => {
                 for(let j=1; j<=9; j++) {
                     const conc = plan[`concepto_${j}`];
                     if (conc && conc.toUpperCase() === d.concepto.toUpperCase()) {
                         const fpMs = parseDateToMs(plan[`fecha_${j}`]);
                         const diff = fpMs === 0 ? 9999999999999 : Math.abs(fechaReciboMs - fpMs);
                         if (!bestMatch || diff < bestMatch.diff) {
                             bestMatch = { planId: plan.id, index: j, diff };
                         }
                     }
                 }
             });

             if (bestMatch) {
                 const oldPlanId = planesMutables.find((p:any) => p.ciclo_id === r.ciclo_id)?.id;
                 const oldIndex = d.indice_concepto_plan;

                 if (oldPlanId !== bestMatch.planId || oldIndex !== bestMatch.index) {
                     if (oldPlanId && oldIndex) {
                         if (!planesToUpdate[oldPlanId]) planesToUpdate[oldPlanId] = {};
                         planesToUpdate[oldPlanId][`estatus_${oldIndex}`] = 'PENDIENTE';
                         const oldP = planesMutables.find((p:any) => p.id === oldPlanId);
                         if (oldP) oldP[`estatus_${oldIndex}`] = 'PENDIENTE';
                     }

                     if (!planesToUpdate[bestMatch.planId]) planesToUpdate[bestMatch.planId] = {};
                     planesToUpdate[bestMatch.planId][`estatus_${bestMatch.index}`] = 'PAGADO';
                     const newP = planesMutables.find((p:any) => p.id === bestMatch.planId);
                     if (newP) newP[`estatus_${bestMatch.index}`] = 'PAGADO';

                     detallesToUpdate.push({ id: d.id, indice_concepto_plan: bestMatch.index });
                     if (newP && newCicloId !== newP.ciclo_id) {
                         newCicloId = newP.ciclo_id;
                         changedCiclo = true;
                     }
                 }
             }
         });

         if (changedCiclo) recibosToUpdate.push({ id: r.id, ciclo_id: newCicloId });
      }

      setRepairProgress(`Procesando actualizaciones...`);
      
      const UPDATE_CHUNK = 20; // 20 concurrent updates max to prevent connection pool exhaustion
      const planIds = Object.keys(planesToUpdate);
      
      for (let k = 0; k < planIds.length; k += UPDATE_CHUNK) {
         setRepairProgress(`Actualizando planes... ${k}/${planIds.length}`);
         await Promise.all(planIds.slice(k, k + UPDATE_CHUNK).map(id => supabase.from('planes_pago').update(planesToUpdate[id]).eq('id', id)));
      }
      
      for (let k = 0; k < detallesToUpdate.length; k += UPDATE_CHUNK) {
         setRepairProgress(`Actualizando detalles... ${k}/${detallesToUpdate.length}`);
         await Promise.all(detallesToUpdate.slice(k, k + UPDATE_CHUNK).map(d => supabase.from('recibos_detalles').update({ indice_concepto_plan: d.indice_concepto_plan }).eq('id', d.id)));
      }
      
      for (let k = 0; k < recibosToUpdate.length; k += UPDATE_CHUNK) {
         setRepairProgress(`Actualizando recibos... ${k}/${recibosToUpdate.length}`);
         await Promise.all(recibosToUpdate.slice(k, k + UPDATE_CHUNK).map(r => supabase.from('recibos').update({ ciclo_id: r.ciclo_id }).eq('id', r.id)));
      }

      setRepairProgress('');
      alert('¡Reparación completada con éxito!');
      cargarRecibos();
    } catch (e: any) {
      console.error(e);
      alert('Error en reparación: ' + e.message);
      setRepairProgress('');
    } finally {
      setLoading(false);
    }
  };

  const recibosFiltrados = recibos.filter(r => 
    r.folio?.toString().includes(searchTerm) ||
    r.nombre_alumno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.fecha_recibo.includes(searchTerm)
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const totalPages = Math.ceil(recibosFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, recibosFiltrados.length);
  const paginatedRecibos = recibosFiltrados.slice(startIndex, endIndex);

  return (
    <div className="flex h-full min-h-[600px]">
      
      {/* Lista lateral */}
      <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-white flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-gray-700 text-sm shrink-0">Historial</h2>
            <div className="flex gap-1.5 items-center shrink-0">
              <button
                onClick={() => setImportarVisible(true)}
                className="flex items-center gap-1.5 text-blue-600 hover:bg-blue-50 px-2 py-1.5 rounded-lg transition-colors border border-blue-200 text-xs font-bold"
                title="Importar desde CSV"
              >
                <Upload size={14} className="shrink-0" />
                <span className="hidden md:inline">Importar</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-emerald-600 hover:bg-emerald-50 px-2 py-1.5 rounded-lg transition-colors border border-emerald-200 text-xs font-bold"
                title="Exportar a Excel"
              >
                <Download size={14} className="shrink-0" />
                <span className="hidden md:inline">Exportar</span>
              </button>
              {/* Botón SOS oculto temporalmente — descomentar para usar
              <button onClick={handleRepararHistoricos} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-red-200 text-xs font-bold shadow-sm" title="Reparar Historicos Corruptos">
                SOS Reparar
              </button>
              */}
              <button onClick={cargarRecibos} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Actualizar">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          {repairProgress && (
             <div className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-200 animate-pulse text-center">
               ⚙️ {repairProgress}
             </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-center p-4 text-gray-500 text-sm">Cargando recibos...</div>
          ) : recibosFiltrados.length === 0 ? (
            <div className="text-center p-4 text-gray-500 text-sm">No se encontraron recibos.</div>
          ) : (
            paginatedRecibos.map(r => (
              <div 
                key={r.id} 
                onClick={() => setReciboSeleccionado(r)}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-white rounded-lg transition-colors mb-1 ${reciboSeleccionado?.id === r.id ? 'bg-white shadow-sm border-blue-200 ring-1 ring-blue-500' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-blue-700">Folio: {r.folio}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${r.estatus === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {r.estatus}
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-800 line-clamp-1">{r.nombre_alumno}</div>
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                  <span>{r.fecha_recibo}</span>
                  <span className="font-bold text-gray-700">${r.total.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {recibosFiltrados.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-white flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
              <span>{startIndex + 1}-{endIndex} de {recibosFiltrados.length}</span>
              <select 
                className="border border-gray-300 rounded p-1 outline-none focus:border-blue-500 bg-gray-50 cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                <option value={10}>10/pág</option>
                <option value={20}>20/pág</option>
                <option value={50}>50/pág</option>
                <option value={100}>100/pág</option>
              </select>
            </div>
            <div className="flex justify-between items-center gap-1">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="flex-1 py-1.5 border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-40 text-xs font-bold text-gray-700 transition-colors shadow-sm active:scale-95"
              >
                Anterior
              </button>
              <button 
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage(p => p + 1)}
                className="flex-1 py-1.5 border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-40 text-xs font-bold text-gray-700 transition-colors shadow-sm active:scale-95"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detalle del recibo — Digital Receipt */}
      <div className="w-2/3 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
        {reciboSeleccionado ? (
          <div className="max-w-2xl mx-auto p-6">
            {/* Cabecera del recibo */}
            <div className="bg-gradient-to-br from-[#1a2f66] to-[#2a4d9e] rounded-2xl p-5 text-white mb-5 shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
              <div className="relative flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 opacity-70">
                    <Receipt size={14} />
                    <span className="text-xs font-semibold uppercase tracking-widest">Recibo Digital</span>
                  </div>
                  <p className="text-3xl font-black tracking-tight">#{reciboSeleccionado.folio}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${reciboSeleccionado.estatus === 'ACTIVO' ? 'bg-emerald-500/30 border-emerald-400/50 text-emerald-200' : 'bg-red-500/30 border-red-400/50 text-red-200'}`}>
                      {reciboSeleccionado.estatus}
                    </span>
                    <span className="text-blue-200 text-xs">{reciboSeleccionado.fecha_recibo}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={handleImprimir}
                    disabled={isGeneratingPDF}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-white/30 shadow-sm disabled:opacity-50"
                  >
                    {isGeneratingPDF ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                    Imprimir
                  </button>
                  {reciboSeleccionado.estatus === 'ACTIVO' && (
                    <button
                      onClick={() => handleCancelar(reciboSeleccionado.id)}
                      className="flex items-center gap-2 bg-red-500/30 hover:bg-red-500/50 text-red-100 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border border-red-400/50"
                    >
                      <XCircle size={15} /> Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {reciboSeleccionado.estatus === 'CANCELADO' && (
              <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-xl font-bold mb-5 text-center border border-red-200 dark:border-red-800 text-sm">
                ⚠️ ESTE RECIBO ESTÁ CANCELADO
              </div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Alumno</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{reciboSeleccionado.nombre_alumno}</p>
                {reciboSeleccionado.licenciatura && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{reciboSeleccionado.licenciatura}</p>
                )}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Información de Pago</p>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Fecha Recibo:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{reciboSeleccionado.fecha_recibo}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Fecha Pago:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{reciboSeleccionado.fecha_pago}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Forma de Pago:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{reciboSeleccionado.forma_pago}</span>
                  </div>
                  {reciboSeleccionado.banco && reciboSeleccionado.banco !== 'NO APLICA' && (
                    <div className="flex items-center justify-between">
                      <span>Banco:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{reciboSeleccionado.banco}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de conceptos */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm mb-5">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Conceptos Cobrados</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {(reciboSeleccionado.recibos_detalles || []).map(d => (
                  <div key={d.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">{d.cantidad}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{d.concepto}</p>
                      {d.observaciones && (
                        <span className="text-[10px] italic font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full px-2 py-0.5 mt-0.5 inline-block">
                          ⚠ {d.observaciones}
                        </span>
                      )}
                      {d.indice_concepto_plan ? (
                        <span className="mt-0.5 inline-block text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full font-semibold border border-blue-200 dark:border-blue-800">
                          Plan #{d.indice_concepto_plan}
                        </span>
                      ) : reciboSeleccionado.estatus === 'ACTIVO' ? (
                        <button onClick={() => setVincularDetalle(d)} className="mt-0.5 text-[10px] text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 px-2 py-0.5 border border-amber-200 dark:border-amber-800 rounded-full font-bold transition-colors shadow-sm">
                          + Vincular
                        </button>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-gray-400">${d.costo_unitario.toFixed(2)}</p>
                      <p className="text-sm font-extrabold text-gray-800 dark:text-white">${d.subtotal.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Total Pagado</p>
                <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">{(reciboSeleccionado.recibos_detalles || []).length} concepto(s)</p>
              </div>
              <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">${reciboSeleccionado.total.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 min-h-96">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
              <Eye size={28} className="opacity-50" />
            </div>
            <p className="font-semibold text-sm">Selecciona un recibo</p>
            <p className="text-xs text-gray-400 mt-1">para ver sus detalles aquí</p>
          </div>
        )}
      </div>

      {/* Hidden PDF container */}
      <div className="absolute left-[-9999px] top-0">
         {reciboSeleccionado && (
           <ReciboPlantillaPDF 
             ref={printRef}
             recibo={reciboSeleccionado}
             detalles={reciboSeleccionado.recibos_detalles || []}
             alumno={alumnos.find(a => a.id === reciboSeleccionado.alumno_id)}
             logoUrl={appConfig?.logoUrl}
             licenciaturasMetadata={catalogos?.licenciaturasMetadata}
           />
         )}
      </div>

      {importarVisible && (
        <ImportarRegistrosCSV
          alumnos={alumnos}
          activeCiclo={activeCiclo}
          ciclos={ciclos}
          onImport={() => {
            setImportarVisible(false);
            cargarRecibos();
          }}
          onClose={() => setImportarVisible(false)}
        />
      )}

      {/* Modal Vincular Múltiple */}
      {vincularDetalle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800">Vincular a Plan de Pagos</h3>
              <button onClick={() => { setVincularDetalle(null); setVincularSeleccion([]); }} className="p-1 hover:bg-gray-200 rounded-lg"><XCircle size={18} className="text-gray-500" /></button>
            </div>

            {/* Cabecera informativa */}
            <div className="px-6 pt-5 pb-3">
              <p className="text-sm text-gray-600 mb-1">
                Concepto del recibo: <strong className="text-gray-800">{vincularDetalle.concepto}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Monto: <strong className="text-emerald-700">${vincularDetalle.subtotal.toFixed(2)}</strong>
              </p>
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3">
                Selecciona uno o más conceptos del plan a liquidar con este recibo.
              </p>
            </div>

            <div className="px-6 pb-4 overflow-y-auto max-h-72">
              {planesAlumno.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-800 text-center">
                  El alumno no tiene un plan de pagos activo en este ciclo escolar.
                </div>
              ) : (
                <div className="space-y-4">
                  {planesAlumno.map(plan => {
                    const pendientes = [];
                    for (let i = 1; i <= 9; i++) {
                      const c = (plan as any)[`concepto_${i}`];
                      const e = (plan as any)[`estatus_${i}`];
                      if (c && e === 'PENDIENTE') {
                        pendientes.push({ idx: i, concepto: c });
                      }
                    }
                    return (
                      <div key={plan.id}>
                        <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Plan: {plan.no_plan_pagos}</div>
                        {pendientes.length === 0 ? (
                          <div className="text-sm text-gray-400 italic">No hay conceptos PENDIENTES.</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {pendientes.map(p => {
                              const isSelected = vincularSeleccion.some(s => s.planId === plan.id && s.idx === p.idx);
                              return (
                                <label
                                  key={p.idx}
                                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
                                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                                    checked={isSelected}
                                    onChange={() => toggleSeleccion(plan.id, p.idx)}
                                  />
                                  <span className="font-semibold text-gray-700 text-sm">{p.idx}. {p.concepto}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                disabled={linking}
                onClick={() => { setVincularDetalle(null); setVincularSeleccion([]); }}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                disabled={linking || vincularSeleccion.length === 0}
                onClick={handleConfirmarVinculacion}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {linking ? <Loader2 size={15} className="animate-spin" /> : null}
                {linking
                  ? 'Vinculando...'
                  : vincularSeleccion.length === 0
                  ? 'Selecciona conceptos'
                  : `Vincular ${vincularSeleccion.length} concepto${vincularSeleccion.length > 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
