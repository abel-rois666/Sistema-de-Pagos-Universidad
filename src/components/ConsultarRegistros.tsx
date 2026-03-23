import React, { useState, useEffect, useRef } from 'react';
import { Search, Eye, XCircle, Receipt, RefreshCw, Printer, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import ReciboPlantillaPDF from './ReciboPlantillaPDF';
import type { Alumno, CicloEscolar, Recibo, ReciboDetalle, Catalogos } from '../types';
import { supabase, cancelarRecibo } from '../lib/supabase';

interface Props {
  alumnos: Alumno[];
  ciclos: CicloEscolar[];
  catalogos: Catalogos;
  initialSearchTerm?: string;
}

export default function ConsultarRegistros({ alumnos, ciclos, initialSearchTerm }: Props) {
  const [recibos, setRecibos] = useState<(Recibo & { recibos_detalles: ReciboDetalle[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [reciboSeleccionado, setReciboSeleccionado] = useState<(Recibo & { recibos_detalles: ReciboDetalle[] }) | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleImprimir = async () => {
    if (!printRef.current || !reciboSeleccionado) return;
    setIsGeneratingPDF(true);
    try {
      const dataUrl = await toPng(printRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 816,
        height: 1056,
        style: { transform: 'scale(1)', margin: '0' }
      });
      const pdf = new jsPDF('p', 'mm', 'letter');
      pdf.addImage(dataUrl, 'PNG', 0, 0, 215.9, 279.4);
      pdf.save(`Recibo_${reciboSeleccionado.folio}_${reciboSeleccionado.nombre_alumno.replace(/\s+/g, '_')}.pdf`);
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
      const { data, error } = await supabase
        .from('recibos')
        .select(`
          *,
          recibos_detalles (*)
        `)
        .order('folio', { ascending: false });

      if (error) throw error;
      
      // Mapear nombre del alumno
      const mapeados = (data || []).map(r => {
        const al = alumnos.find(a => a.id === r.alumno_id);
        const ci = ciclos.find(c => c.id === r.ciclo_id);
        return {
          ...r,
          nombre_alumno: al ? al.nombre_completo : 'Desconocido',
          licenciatura: al ? al.licenciatura : '',
          ciclo_escolar: ci ? ci.nombre : ''
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

  const recibosFiltrados = recibos.filter(r => 
    r.folio?.toString().includes(searchTerm) ||
    r.nombre_alumno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.fecha_recibo.includes(searchTerm)
  );

  return (
    <div className="flex h-full min-h-[600px]">
      
      {/* Lista lateral */}
      <div className="w-1/3 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col gap-3">
          <div className="flex justify-between items-center">
             <h2 className="font-bold text-gray-700">Historial</h2>
             <button onClick={cargarRecibos} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="Actualizar">
               <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
             </button>
          </div>
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
            recibosFiltrados.map(r => (
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
                         {d.concepto} 
                         {d.indice_concepto_plan && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">Plan #{d.indice_concepto_plan}</span>}
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
           />
         )}
      </div>
    </div>
  );
}
