import React, { useState, useEffect, useRef } from 'react';
import { Search, Eye, XCircle, Receipt, RefreshCw, Printer, Loader2 } from 'lucide-react';
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
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col gap-3">
          <div className="flex justify-between items-center">
             <h2 className="font-bold text-gray-700">Historial</h2>
             <div className="flex gap-2">
               <button onClick={() => setImportarVisible(true)} className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 text-xs font-bold" title="Importar desde CSV">
                 Importar
               </button>
               <button onClick={handleExportCSV} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200 text-xs font-bold" title="Exportar a Excel">
                 Exportar
               </button>
               {/* Botón SOS oculto temporalmente — descomentar para usar
               <button onClick={handleRepararHistoricos} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-red-200 text-xs font-bold shadow-sm" title="Reparar Historicos Corruptos">
                 SOS Reparar
               </button>
               */}
               <button onClick={cargarRecibos} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="Actualizar">
                 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
               </button>
             </div>
          </div>
          {repairProgress && (
             <div className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded border border-red-200 animate-pulse text-center">
               ⚙️ {repairProgress}
             </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar folio, alumno..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Detalle del recibo */}
      <div className="w-2/3 bg-white p-6 overflow-y-auto">
        {reciboSeleccionado ? (
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                  <Receipt className="text-blue-600" /> Detalle de Recibo
                </h2>
                <div className="text-gray-500 font-semibold mt-1">Folio: <span className="text-blue-600">#{reciboSeleccionado.folio}</span></div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleImprimir}
                  disabled={isGeneratingPDF}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {isGeneratingPDF ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                  Imprimir
                </button>
                {reciboSeleccionado.estatus === 'ACTIVO' && (
                  <button 
                    onClick={() => handleCancelar(reciboSeleccionado.id)}
                    className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-semibold transition-colors border border-red-200"
                  >
                    <XCircle size={16} /> Cancelar Recibo
                  </button>
                )}
              </div>
            </div>

            {reciboSeleccionado.estatus === 'CANCELADO' && (
               <div className="bg-red-100 text-red-800 p-3 rounded-lg font-bold mb-6 text-center border border-red-200">
                 ESTE RECIBO ESTÁ CANCELADO
               </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                 <div className="text-xs text-gray-500 font-bold uppercase mb-1">Alumno</div>
                 <div className="font-semibold text-gray-800">{reciboSeleccionado.nombre_alumno}</div>
                 <div className="text-sm text-gray-600">{reciboSeleccionado.licenciatura}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                 <div className="text-xs text-gray-500 font-bold uppercase mb-1">Información Pago</div>
                 <div className="text-sm text-gray-800"><span className="font-semibold">F. Recibo:</span> {reciboSeleccionado.fecha_recibo}</div>
                 <div className="text-sm text-gray-800"><span className="font-semibold">F. Pago:</span> {reciboSeleccionado.fecha_pago}</div>
                 <div className="text-sm text-gray-800 mt-2 font-semibold">{reciboSeleccionado.forma_pago} - {reciboSeleccionado.banco}</div>
              </div>
            </div>

            <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">Conceptos Cobrados</h3>
            <div className="bg-white border text-sm border-gray-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase border-b border-gray-200">
                  <tr>
                    <th className="p-3">Cant.</th>
                    <th className="p-3">Concepto</th>
                    <th className="p-3 text-right">P. Unitario</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {(reciboSeleccionado.recibos_detalles || []).map(d => (
                     <tr key={d.id} className="hover:bg-gray-50">
                       <td className="p-3 font-semibold">{d.cantidad}</td>
                       <td className="p-3 text-gray-800">
                         <div>{d.concepto}</div>
                         {d.observaciones && (
                           <div className="flex items-center gap-1 mt-0.5">
                             <span className="text-[10px] italic font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                               ⚠ {d.observaciones}
                             </span>
                           </div>
                         )}
                         {d.indice_concepto_plan ? (
                            <span className="ml-0 mt-1 inline-block text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-200">Plan #{d.indice_concepto_plan}</span>
                         ) : reciboSeleccionado.estatus === 'ACTIVO' ? (
                            <button onClick={() => setVincularDetalle(d)} className="mt-1 text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 border border-amber-200 rounded-full font-bold transition-colors shadow-sm">
                              + Vincular
                            </button>
                         ) : null}
                       </td>
                       <td className="p-3 text-right">${d.costo_unitario.toFixed(2)}</td>
                       <td className="p-3 text-right font-bold text-gray-700">${d.subtotal.toFixed(2)}</td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-gray-200 pt-4">
               <div className="text-right">
                  <div className="text-sm text-gray-500 font-bold uppercase mb-1">Total Pagado</div>
                  <div className="text-3xl font-black text-emerald-600">${reciboSeleccionado.total.toFixed(2)}</div>
               </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Eye size={48} className="mb-4 opacity-50" />
            <p className="font-semibold">Selecciona un recibo de la lista para ver sus detalles</p>
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
