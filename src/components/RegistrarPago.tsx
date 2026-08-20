import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, AlertCircle, Info, Printer, X, FileDown, Loader2 } from 'lucide-react';
import type { PaymentPlan, CatalogoItem, Recibo, ReciboDetalle, Alumno } from '../types';
import { catalogosService } from '../services/catalogosService';
import { pagosService } from '../services/pagosService';
import { useAppStore } from '../store/useAppStore';
import { ReciboPlantillaPDF } from './ReciboPlantillaPDF';
import { printElement, downloadElementAsPDF } from '../lib/printUtils';
import { toTitleCase } from '../utils';

import { useRegistrarPagoLogic, type ConceptoRow } from '../hooks/useRegistrarPagoLogic';

interface Props {
  initialAlumnoId?: string;
  initialConceptIndex?: number;
  initialPlanId?: string;
}

// Bancos disponibles
const BANCOS = ['BBVA 1', 'BBVA 2', 'MIFEL', 'BANORTE', 'NO APLICA'];
const FORMAS_PAGO = ['Depósito Bancario', 'Transferencia bancaria', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'Efectivo'];

export default function RegistrarPago({ initialAlumnoId, initialConceptIndex, initialPlanId }: Props) {
  const { alumnos, ciclos, activeCicloId, plans, catalogos, catalogoItems, appConfig, currentUser, refreshAfterPayment, setCatalogoItems, carreras } = useAppStore();
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const [searchAlumnoTerm, setSearchAlumnoTerm] = useState('');
  const [showAlumnoSuggestions, setShowAlumnoSuggestions] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [showAddConceptoModal, setShowAddConceptoModal] = useState(false);
  const [newConceptoName, setNewConceptoName] = useState('');
  const [savingConcepto, setSavingConcepto] = useState(false);
  const [addConceptoRowId, setAddConceptoRowId] = useState<string>('');

  const {
    alumnoSeleccionado, setAlumnoSeleccionado,
    fechaPago, setFechaPago,
    formaPago, setFormaPago,
    banco, setBanco,
    usarMonedero, setUsarMonedero,
    requiereFactura, setRequiereFactura,
    filas, setFilas,
    guardando,
    mensaje,
    reciboGuardado,
    alumnoData,
    pupilPlans,
    opcionesConceptos,
    totales,
    fechaRecibo,
    agregarFila,
    eliminarFila,
    selectConcepto,
    updateFila,
    guardar,
    handleCerrarModal
  } = useRegistrarPagoLogic(initialAlumnoId, initialConceptIndex, initialPlanId);

  useEffect(() => {
    const alumno = alumnos.find(a => a.id === alumnoSeleccionado);
    if (alumno) setSearchAlumnoTerm(alumno.nombre_completo);
    else setSearchAlumnoTerm('');
  }, [alumnoSeleccionado, alumnos]);

  const filteredAlumnos = useMemo(() => {
    const lower = searchAlumnoTerm.toLowerCase();
    if (!searchAlumnoTerm) return alumnos.slice(0, 50);
    const perfectMatch = alumnos.find(a => a.nombre_completo.toLowerCase() === lower);
    if (perfectMatch && alumnoSeleccionado === perfectMatch.id) return alumnos.slice(0, 50);
    return alumnos.filter(a => a.nombre_completo.toLowerCase().includes(lower)).slice(0, 50);
  }, [alumnos, searchAlumnoTerm, alumnoSeleccionado]);

  const isAdmin = currentUser?.rol === 'ADMINISTRADOR';

  const handleImprimir = () => {
    if (!printRef.current) return;
    printElement(printRef.current);
  };

  const handleDescargarPDF = async () => {
    if (!printRef.current) return;
    setGenerandoPDF(true);
    try {
      const folio = reciboGuardado?.recibo.folio ?? 'recibo';
      const alumnoNombre = reciboGuardado?.alumno?.nombre_completo?.replace(/\s+/g, '_') ?? 'alumno';
      await downloadElementAsPDF(printRef.current, `Recibo_R-${folio}_${alumnoNombre}.pdf`);
    } catch (err) {
      console.error('Error generando PDF:', err);
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div className="p-8">
      {mensaje && mensaje.tipo === 'error' && (
        <div className="mb-6 p-4 rounded-[13px] flex items-center gap-3 font-semibold bg-red-100 text-red-800">
          <AlertCircle />
          {mensaje.texto}
        </div>
      )}

      {/* Banner: sin plan activo */}
      {alumnoSeleccionado && pupilPlans.length === 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-[13px] flex items-start gap-3 text-blue-800 text-sm">
          <Info size={18} className="shrink-0 mt-0.5 text-blue-500" />
          <span>
            <strong>Sin plan en el ciclo activo.</strong> Este alumno no tiene plan de pagos registrado para <em>{activeCiclo?.nombre || 'este ciclo'}</em>. El recibo se guardará suelto (no afectará ningún plan).
          </span>
        </div>
      )}

      {/* Banner: múltiples planes detectados (informativo si no está bloqueado por initialPlanId) */}
      {alumnoSeleccionado && pupilPlans.length > 1 && !initialPlanId && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-[13px] flex items-start gap-3 text-green-800 text-sm">
          <Info size={18} className="shrink-0 mt-0.5 text-green-600" />
          <span>
            <strong>Múltiples planes detectados.</strong> Este alumno tiene {pupilPlans.length} planes activos en este ciclo escolar. Se han agregado todos los conceptos al catálogo de busqueda. <em>Nota: Haz recibos separados si vas a pagar conceptos de diferentes planes.</em>
          </span>
        </div>
      )}

      {/* Recibo Header */}
      <div className="border border-gray-900 rounded-[8px] overflow-hidden bg-white shadow-[var(--shadow-subtle)] font-sans mb-8">
        
        {/* Fila 1: Centro Universitario y Folio/Fecha */}
        <div className="flex flex-col md:flex-row border-b border-gray-900">
          <div className="md:w-3/4 p-4 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-900 bg-[#f2f3f5]">
            <h2 className="text-xl md:text-2xl font-black text-center tracking-wide uppercase text-[#222222]">
              Centro Universitario Oriente de México
            </h2>
          </div>
          <div className="md:w-1/4 flex flex-col">
            <div className="flex border-b border-gray-900">
              <div className="w-1/2 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-r border-gray-900">N Folio</div>
              <div className="w-1/2 p-2 flex items-center justify-center font-bold text-red-600 text-lg">---</div>
            </div>
            <div className="flex">
              <div className="w-1/2 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-r border-gray-900">Fecha:</div>
              <div className="w-1/2 p-2 flex items-center justify-center font-semibold text-[#45515e]">{fechaRecibo}</div>
            </div>
          </div>
        </div>

        {/* Fila 2: Alumno Seleccionado */}
        <div className="flex flex-col md:flex-row border-b border-gray-900">
          <div className="md:w-1/6 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-b md:border-b-0 border-r border-gray-900">RECIBIMOS DE</div>
          <div className="md:w-1/2 p-2 border-r border-gray-900 relative">
            <input
              type="text"
              className="w-full bg-transparent outline-none font-semibold text-[#222222] p-1"
              placeholder="🔍 Buscar alumno por nombre..."
              value={searchAlumnoTerm}
              onChange={(e) => {
                setSearchAlumnoTerm(e.target.value);
                setShowAlumnoSuggestions(true);
                if (!e.target.value) setAlumnoSeleccionado('');
              }}
              onFocus={() => setShowAlumnoSuggestions(true)}
              onBlur={() => setTimeout(() => setShowAlumnoSuggestions(false), 200)}
            />
            {alumnoData && (alumnoData.saldo_a_favor || 0) > 0 && (
              <div className="absolute top-2 right-2 bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded flex items-center gap-1 font-black shadow-[var(--shadow-subtle)] border border-emerald-300 pointer-events-none">
                💰 Monedero: ${(alumnoData.saldo_a_favor || 0).toFixed(2)}
              </div>
            )}
            {showAlumnoSuggestions && (
              <div className="absolute top-full left-0 w-full z-10 bg-white border border-gray-900 shadow-[var(--shadow-brand)] max-h-60 overflow-y-auto">
                {filteredAlumnos.map(a => (
                  <div
                    key={a.id}
                    className="p-3 border-b border-[#e5e7eb] text-sm cursor-pointer hover:bg-[rgba(0,0,0,0.03)] text-[#222222] font-medium transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setAlumnoSeleccionado(a.id);
                      setSearchAlumnoTerm(a.nombre_completo);
                      setShowAlumnoSuggestions(false);
                    }}
                  >
                    <span>{toTitleCase(a.nombre_completo)}</span>
                    {a.estatus && a.estatus !== 'ACTIVO' && (
                      <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${
                        a.estatus === 'EGRESADO' || a.estatus === 'EGRESADO TITULADO'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-red-100 text-red-700'
                      }`}>{a.estatus}</span>
                    )}
                  </div>
                ))}
                {filteredAlumnos.length === 0 && (
                  <div className="p-3 text-sm text-[#8e8e93] text-center italic">No se encontraron coincidencias</div>
                )}
                {filteredAlumnos.length >= 50 && (
                  <div className="p-2 text-xs text-center text-[#8e8e93] bg-[#eef2ff] font-semibold border-t">Sigue escribiendo para ver más...</div>
                )}
              </div>
            )}
          </div>
          <div className="md:w-1/6 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm text-center border-r border-gray-900">FECHA DE PAGO</div>
          <div className="md:w-1/6 p-2 flex items-center justify-center">
            <input 
              type="date" 
              value={fechaPago} 
              onChange={(e) => setFechaPago(e.target.value)}
              className="w-full text-center bg-blue-50 border border-blue-200 rounded p-1 text-sm font-semibold outline-none" 
            />
          </div>
        </div>

        {/* Fila 3: Licenciatura y Grado */}
        <div className="flex flex-col md:flex-row border-b border-gray-900">
          <div className="md:w-1/6 p-2 bg-gray-200 font-bold flex flex-col items-center justify-center text-xs text-center border-b md:border-b-0 border-r border-gray-900">
            <span>ALUMNO (A)</span>
            <span>DEL</span>
          </div>
          <div className="md:w-1/3 p-2 flex items-center justify-center border-r border-gray-900 font-semibold text-[#45515e]">
             {alumnoData ? `${alumnoData.grado_actual || ''}` : ''}
          </div>
          <div className="md:w-1/6 p-2 bg-gray-200 font-bold flex flex-col items-center justify-center text-xs text-center border-r border-gray-900">
            <span>DE LA</span>
            <span>LICENCIATURA/ESPECIALIDAD EN</span>
          </div>
          <div className="md:w-1/3 p-2 flex items-center justify-center font-bold text-[#222222]">
            {alumnoData?.licenciatura || ''}
          </div>
        </div>

        {/* Fila 4: Turno */}
        <div className="flex border-b border-gray-900">
          <div className="w-1/6 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-r border-gray-900">TURNO</div>
          <div className="w-5/6 p-2 flex items-center justify-center font-semibold text-[#45515e]">
             {alumnoData?.turno || ''}
          </div>
        </div>

        {/* Cabecera Tabla Conceptos */}
        <div className="flex border-b border-gray-900 bg-gray-200 font-bold text-xs md:text-sm text-center">
          <div className="w-1/12 p-2 border-r border-gray-900 flex items-center justify-center">CANTIDAD</div>
          <div className="w-4/12 p-2 border-r border-gray-900 flex items-center justify-center">CONCEPTO</div>
          <div className="w-2/12 p-2 border-r border-gray-900 flex items-center justify-center">COSTO UNIT.</div>
          <div className="w-2/12 p-2 border-r border-gray-900 flex items-center justify-center">TOTAL</div>
          <div className="w-1/12 p-2 border-r border-gray-900 flex items-center justify-center"><Trash2 size={16} /></div>
        </div>

        {/* Filas de Conceptos */}
        {filas.map((fila, i) => (
          <div key={fila.localId} className="flex border-b border-gray-900 text-sm">
            <div className="w-1/12 p-1 border-r border-gray-900 flex items-center justify-center">
              <input 
                type="number" 
                min="1"
                value={fila.cantidad} 
                onChange={(e) => updateFila(fila.localId, 'cantidad', e.target.value ? parseInt(e.target.value) : '')}
                className="w-full text-center bg-transparent outline-none" 
              />
            </div>
            <div className="w-4/12 p-1 border-r border-gray-900 flex items-center gap-1">
              {/* Searchable concept autocomplete */}
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  className="w-full bg-transparent outline-none text-sm truncate"
                  placeholder="Buscar concepto..."
                  value={fila.searchConceptoTerm}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilas(prev => prev.map(f => f.localId === fila.localId
                      ? { ...f, searchConceptoTerm: val, showConceptoSuggestions: true, concepto: val ? f.concepto : '', indice_concepto_plan: val ? f.indice_concepto_plan : null }
                      : f));
                  }}
                  onFocus={() => setFilas(prev => prev.map(f => f.localId === fila.localId ? { ...f, showConceptoSuggestions: true } : f))}
                  onBlur={() => setTimeout(() => setFilas(prev => prev.map(f => f.localId === fila.localId ? { ...f, showConceptoSuggestions: false } : f)), 200)}
                />
                {fila.showConceptoSuggestions && (
                  <div className="absolute top-full left-0 w-72 z-20 bg-white border border-gray-300 shadow-xl rounded-[8px] max-h-56 overflow-y-auto">
                    {opcionesConceptos
                      .filter(op => !fila.searchConceptoTerm || op.label.toLowerCase().includes(fila.searchConceptoTerm.toLowerCase()))
                      .slice(0, 30)
                      .map(op => (
                        <div
                          key={op.value}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-[rgba(0,0,0,0.03)] border-b border-[#f2f3f5] ${
                            op.value.startsWith('PLAN_') ? 'text-[#1456f0] font-semibold' : 'text-[#222222]'
                          }`}
                          onMouseDown={(e) => { e.preventDefault(); selectConcepto(fila.localId, op.value); }}
                        >
                          {op.label}
                        </div>
                      ))
                    }
                    {opcionesConceptos.filter(op => !fila.searchConceptoTerm || op.label.toLowerCase().includes(fila.searchConceptoTerm.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-xs text-[#8e8e93] italic">Sin resultados</div>
                    )}
                  </div>
                )}
              </div>
              {/* Admin-only: quick add concept */}
              {isAdmin && (
                <button
                  type="button"
                  title="Agregar nuevo concepto al catálogo"
                  onClick={() => { setAddConceptoRowId(fila.localId); setNewConceptoName(''); setShowAddConceptoModal(true); }}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded p-1 transition-colors shrink-0 border border-blue-200"
                >
                  <Plus size={13} />
                </button>
              )}
            </div>
            <div className="w-2/12 p-1 border-r border-gray-900 flex items-center justify-center relative">
              <span className="absolute left-2 text-[#8e8e93]">$</span>
              <input 
                type="number" 
                min="0"
                step="0.01"
                value={fila.costo_unitario} 
                onChange={(e) => updateFila(fila.localId, 'costo_unitario', e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full text-right pr-2 bg-transparent outline-none pl-6" 
              />
            </div>
            <div className="w-2/12 p-2 border-r border-gray-900 flex items-center justify-end font-semibold">
              ${((Number(fila.cantidad) || 0) * (Number(fila.costo_unitario) || 0)).toFixed(2)}
            </div>
            <div className="w-1/12 p-1 flex items-center justify-center">
              <button 
                onClick={() => eliminarFila(fila.localId)} 
                className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors disabled:opacity-30"
                disabled={filas.length === 1}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {/* Botón Agregar Fila */}
        <div className="flex border-b border-gray-900">
           <div className="w-full p-0">
             <button 
               onClick={agregarFila}
               className="w-full py-2 bg-[#eef2ff] hover:bg-gray-100 flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 transition-colors"
             >
               <Plus size={16} /> Agregar Fila
             </button>
           </div>
        </div>

        {/* Fila Final (Firma y Totales + Metodos) */}
        <div className="flex flex-col md:flex-row">
          
          <div className="flex flex-col w-full md:w-1/2 border-r border-gray-900 md:order-1 order-2">
             <div className="h-full min-h-[80px] flex items-end justify-center p-2 text-sm font-bold pb-2">
                 FIRMA CAJERO
             </div>
          </div>

          <div className="w-full md:w-1/2 flex flex-col md:order-2 order-1 border-b md:border-b-0 border-gray-900">
            <div className="flex border-b border-gray-900 bg-[#f2f3f5]">
              <div className="w-1/2 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-r border-gray-900 text-center">SUBTOTAL</div>
              <div className="w-1/2 p-2 flex items-center justify-end font-bold text-lg text-[#222222]">
                 ${totales.toFixed(2)}
              </div>
            </div>

            {alumnoData && (alumnoData.saldo_a_favor || 0) > 0 && (
              <div className="flex border-b border-gray-900 bg-emerald-50/30">
                <div 
                  className="w-1/2 p-2 flex items-center justify-between border-r border-gray-900 cursor-pointer hover:bg-emerald-50 transition-colors px-4" 
                  onClick={() => setUsarMonedero(!usarMonedero)}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-emerald-700 leading-tight tracking-wide">USAR MONEDERO</span>
                    <span className="text-[10px] text-emerald-600/80 font-bold">Disp: ${(alumnoData.saldo_a_favor || 0).toFixed(2)}</span>
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 shadow-inner ${usarMonedero ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 shadow-[var(--shadow-subtle)] transition-all ${usarMonedero ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </div>
                <div className="w-1/2 p-2 flex items-center justify-end font-bold text-lg text-emerald-600">
                   {usarMonedero ? `-$${Math.min(alumnoData.saldo_a_favor || 0, totales).toFixed(2)}` : '$0.00'}
                </div>
              </div>
            )}

            <div className="flex border-b border-gray-900 bg-emerald-50">
              <div className="w-1/2 p-2 bg-emerald-200/50 font-black flex items-center justify-center text-sm border-r border-gray-900 text-center tracking-wide text-emerald-900">
                TOTAL A PAGAR
              </div>
              <div className="w-1/2 p-2 flex items-center justify-end font-black text-xl text-emerald-700">
                 ${(totales - (usarMonedero ? Math.min(alumnoData?.saldo_a_favor || 0, totales) : 0)).toFixed(2)}
              </div>
            </div>

            <div className="flex border-b border-gray-900">
                <div className="w-1/2 p-2 bg-gray-200 font-bold flex items-center justify-center text-xs text-center border-r border-gray-900">FORMA DE PAGO</div>
                <div className="w-1/2 p-2 flex items-center justify-center">
                   <select 
                      value={formaPago} 
                      onChange={(e) => setFormaPago(e.target.value)}
                      className="w-full text-xs font-semibold bg-[#f2f3f5] p-1 outline-none border border-gray-300 rounded disabled:opacity-50"
                      disabled={(totales - (usarMonedero ? Math.min(alumnoData?.saldo_a_favor || 0, totales) : 0)) === 0}
                    >
                     {FORMAS_PAGO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                   </select>
                </div>
            </div>

            <div className="flex border-b md:border-b-0 border-gray-900">
                <div className="w-1/2 p-2 bg-gray-200 font-bold flex items-center justify-center text-xs text-center border-r border-gray-900">BANCO</div>
                <div className="w-1/2 p-2 flex items-center justify-center">
                   <select 
                      value={banco} 
                      onChange={(e) => setBanco(e.target.value)}
                      className="w-full text-xs font-semibold bg-[#f2f3f5] p-1 outline-none border border-gray-300 rounded disabled:opacity-50"
                      disabled={formaPago === 'Efectivo' || (totales - (usarMonedero ? Math.min(alumnoData?.saldo_a_favor || 0, totales) : 0)) === 0}
                    >
                     {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                   </select>
                </div>
            </div>

            {/* Toggle Requiere Factura */}
            <div className="flex border-t-2 border-gray-900 bg-[#f2f3f5]">
              <div
                className="w-full p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors px-4 group"
                onClick={() => setRequiereFactura(!requiereFactura)}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-black text-[#222222] leading-tight tracking-wide group-hover:text-amber-700 transition-colors">¿REQUIERE FACTURA?</span>
                  <span className="text-[10px] text-[#8e8e93] font-bold">Marcar para el área de Contabilidad</span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 shadow-inner ${requiereFactura ? 'bg-amber-500' : 'bg-gray-300'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 shadow-[var(--shadow-subtle)] transition-all ${requiereFactura ? 'left-6' : 'left-1'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Print Receipt Modal ---- */}
      {reciboGuardado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-[20px] shadow-[var(--shadow-brand)] w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-[#f2f3f5] bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-full">
                  <Printer className="text-emerald-600" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#222222]">Recibo R-{reciboGuardado.recibo.folio} guardado</h2>
                  <p className="text-xs text-emerald-700 font-medium">El pago fue registrado correctamente. Puedes imprimir el comprobante o cerrar.</p>
                </div>
              </div>
              <button onClick={handleCerrarModal} className="p-2 hover:bg-gray-100 rounded-full text-[#8e8e93] hover:text-[#45515e] transition-colors">
                <X size={20} />
              </button>
            </div>
            {/* Receipt preview — wrapped for modal scroll; print-receipt class used by @media print */}
            <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center">
              <div style={{ transform: 'scale(0.82)', transformOrigin: 'top center', marginBottom: '-160px' }}>
                <div ref={printRef} className="print-receipt">
                  <ReciboPlantillaPDF
                    recibo={reciboGuardado.recibo}
                    detalles={reciboGuardado.detalles}
                    alumno={reciboGuardado.alumno}
                    logoUrl={appConfig?.logoUrl}
                    licenciaturasMetadata={catalogos?.licenciaturasMetadata}
                  />
                </div>
              </div>
            </div>
            {/* Modal footer */}
            <div className="p-4 border-t border-[#f2f3f5] flex justify-between items-center bg-white gap-3">
              <button
                onClick={handleCerrarModal}
                className="px-5 py-2.5 border border-gray-300 rounded-[13px] font-semibold text-[#45515e] hover:bg-[#f2f3f5] transition-colors text-sm"
              >
                Nuevo Pago
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleDescargarPDF}
                  disabled={generandoPDF}
                  title="Descarga el recibo directamente como archivo PDF"
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-[13px] font-bold transition-colors shadow-[var(--shadow-subtle)] text-sm"
                >
                  {generandoPDF ? <><Loader2 size={17} className="animate-spin" /> Generando...</> : <><FileDown size={17} /> Descargar PDF</>}
                </button>
                <button
                  onClick={handleImprimir}
                  disabled={generandoPDF}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-[13px] font-bold transition-colors shadow-[var(--shadow-subtle)] text-sm"
                >
                  <Printer size={17} /> Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddConceptoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[13px] shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-[#f2f3f5]">
              <div>
                <h3 className="text-base font-bold text-[#222222]">Nuevo Concepto</h3>
                <p className="text-xs text-[#8e8e93] mt-0.5">Se guardará en el catálogo global de conceptos</p>
              </div>
              <button onClick={() => setShowAddConceptoModal(false)} className="text-[#8e8e93] hover:text-[#45515e]">
                ✕
              </button>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-[#45515e] mb-2">Nombre del concepto</label>
              <input
                type="text"
                autoFocus
                className="w-full border border-gray-300 rounded-[8px] p-3 outline-none focus:ring-2 focus:ring-[#3b82f6] uppercase"
                placeholder="Ej. TITULACIÓN"
                value={newConceptoName}
                onChange={(e) => setNewConceptoName(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
            </div>
            <div className="p-5 bg-[#f2f3f5] border-t border-[#f2f3f5] flex justify-end gap-3">
              <button
                onClick={() => setShowAddConceptoModal(false)}
                className="px-4 py-2 text-[#45515e] hover:bg-gray-200 rounded-[8px] font-medium transition-colors"
              >Cancelar</button>
              <button
                disabled={!newConceptoName.trim() || savingConcepto}
                onClick={async () => {
                  const name = newConceptoName.trim();
                  if (!name) return;
                  setSavingConcepto(true);
                  const newItem: CatalogoItem = {
                    id: crypto.randomUUID(),
                    tipo: 'concepto',
                    valor: name,
                    orden: 999,
                    activo: true,
                  };
                  const res = await catalogosService.saveCatalogoItem(newItem);
                  if (res.success) {
                    setCatalogoItems([...catalogoItems.filter(c => c.id !== newItem.id), newItem as CatalogoItem]);
                    setShowAddConceptoModal(false);
                    selectConcepto(addConceptoRowId, `CAT_${newConceptoName.toUpperCase().trim()}`);
                  } else {
                    alert('Error al guardar concepto: ' + res.error?.message);
                  }
                  setSavingConcepto(false);
                  setShowAddConceptoModal(false);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[8px] font-semibold transition-colors flex items-center gap-2 disabled:opacity-40"
              >
                {savingConcepto ? 'Guardando...' : <><Plus size={15} /> Guardar Concepto</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button 
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-[13px] font-bold transition-colors shadow-[var(--shadow-subtle)] disabled:opacity-50"
        >
          {guardando ? (
            <span className="animate-pulse">Guardando...</span>
          ) : (
            <><Save size={20} /> Guardar Recibo</>
          )}
        </button>
      </div>

    </div>
  );
}
