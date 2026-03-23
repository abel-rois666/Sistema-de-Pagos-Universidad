import React, { useState, useMemo, useEffect } from 'react';
import { Save, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import type { Alumno, CicloEscolar, PaymentPlan, Catalogos, ReciboDetalle } from '../types';
import { saveReciboCompleto } from '../lib/supabase';

interface ConceptoRow {
  localId: string;
  cantidad: number | '';
  concepto: string;
  costo_unitario: number | '';
  indice_concepto_plan: number | null;
}

interface Props {
  alumnos: Alumno[];
  activeCiclo?: CicloEscolar;
  plans: PaymentPlan[];
  catalogos: Catalogos;
  initialAlumnoId?: string;
  initialConceptIndex?: number;
  onPaymentSaved?: () => void;
}

// Bancos disponibles
const BANCOS = ['BBVA 1', 'BBVA 2', 'MIFEL', 'BANORTE', 'NO APLICA'];
const FORMAS_PAGO = ['Depósito Bancario', 'Transferencia bancaria', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'Efectivo'];

export default function RegistrarPago({ alumnos, activeCiclo, plans, catalogos, initialAlumnoId, initialConceptIndex, onPaymentSaved }: Props) {
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<string>(initialAlumnoId || '');
  const [fechaPago, setFechaPago] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formaPago, setFormaPago] = useState<string>('Efectivo');
  const [banco, setBanco] = useState<string>('NO APLICA');
  
  const [filas, setFilas] = useState<ConceptoRow[]>([{
    localId: Date.now().toString(),
    cantidad: 1,
    concepto: '',
    costo_unitario: '',
    indice_concepto_plan: null
  }]);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  // Fecha del recibo (hoy)
  const fechaRecibo = useMemo(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }, []);
  const fechaReciboIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Set default bank rule
  useEffect(() => {
    if (formaPago === 'Efectivo') {
      setBanco('NO APLICA');
    }
  }, [formaPago]);

  const alumnoData = alumnos.find(a => a.id === alumnoSeleccionado);
  const planActual = plans.find(p => p.alumno_id === alumnoSeleccionado && p.ciclo_id === activeCiclo?.id);

  // Generar opciones de conceptos combinando los pendientes del plan y los del catálogo
  const opcionesConceptos = useMemo(() => {
    const opciones: { value: string, label: string, index?: number, sugerido?: number }[] = [];
    
    // 1. Conceptos del plan actual del alumno (solamente los que tengan cantidad y no digan 'PAGADO')
    if (planActual) {
      for (let i = 1; i <= 9; i++) {
        const conceptoName = planActual[`concepto_${i}` as keyof PaymentPlan] as string;
        const cantidad = planActual[`cantidad_${i}` as keyof PaymentPlan] as number;
        const estatus = planActual[`estatus_${i}` as keyof PaymentPlan] as string;
        
        if (conceptoName && cantidad > 0 && !(estatus || '').toUpperCase().includes('PAGADO')) {
          opciones.push({
            value: `PLAN_${i}_${conceptoName}`,
            label: `[Plan] ${conceptoName} (Resta $${cantidad}) - Estatus: ${estatus || 'PENDIENTE'}`,
            index: i,
            sugerido: cantidad
          });
        }
      }
    }

    // 2. Conceptos genéricos del catálogo
    catalogos.conceptos.forEach(c => {
      opciones.push({ value: `CAT_${c}`, label: c });
    });

    return opciones;
  }, [planActual, catalogos.conceptos]);
  const hasInitialized = React.useRef(false);
  useEffect(() => {
    if (initialConceptIndex && planActual && opcionesConceptos.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      const idx = initialConceptIndex;
      const conceptoRef = planActual[`concepto_${idx}` as keyof PaymentPlan] as string;
      const targetValue = `PLAN_${idx}_${conceptoRef}`;
      const op = opcionesConceptos.find(o => o.value === targetValue);
      if (op) {
        setFilas([{
          localId: Date.now().toString(),
          cantidad: 1,
          concepto: conceptoRef,
          costo_unitario: op.sugerido || '',
          indice_concepto_plan: idx
        }]);
      }
    }
  }, [initialConceptIndex, planActual, opcionesConceptos]);

  const agregarFila = () => {
    setFilas([...filas, { localId: Date.now().toString(), cantidad: 1, concepto: '', costo_unitario: '', indice_concepto_plan: null }]);
  };

  const eliminarFila = (id: string) => {
    if (filas.length === 1) return;
    setFilas(filas.filter(f => f.localId !== id));
  };

  const updateFila = (id: string, campo: keyof ConceptoRow, valor: any) => {
    setFilas(filas.map(f => {
      if (f.localId === id) {
        if (campo === 'concepto') {
          // Extra logic to handle predefined concepts from plan
          if (valor.startsWith('PLAN_')) {
            const parts = valor.split('_');
            const idx = parseInt(parts[1], 10);
            const refName = parts.slice(2).join('_');
            const op = opcionesConceptos.find(o => o.value === valor);
            return { ...f, concepto: refName, indice_concepto_plan: idx, costo_unitario: op?.sugerido || '' };
          } else if (valor.startsWith('CAT_')) {
            return { ...f, concepto: valor.replace('CAT_', ''), indice_concepto_plan: null };
          }
        }
        return { ...f, [campo]: valor };
      }
      return f;
    }));
  };

  const totales = useMemo(() => {
    let total = 0;
    filas.forEach(f => {
      const cant = Number(f.cantidad) || 0;
      const costo = Number(f.costo_unitario) || 0;
      total += cant * costo;
    });
    return total;
  }, [filas]);

  const guardar = async () => {
    if (!alumnoSeleccionado) {
      setMensaje({ tipo: 'error', texto: 'Debes seleccionar un alumno.' });
      return;
    }
    if (!activeCiclo?.id) {
      setMensaje({ tipo: 'error', texto: 'No hay ciclo activo.' });
      return;
    }
    if (totales <= 0) {
      setMensaje({ tipo: 'error', texto: 'El recibo debe tener un total mayor a 0.' });
      return;
    }
    
    // Validar filas
    const validas = filas.filter(f => f.concepto && Number(f.cantidad) > 0 && Number(f.costo_unitario) >= 0);
    if (validas.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Debes agregar al menos un concepto válido.' });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    // Preparar el Recibo
    const recibo = {
      fecha_recibo: fechaReciboIso,
      fecha_pago: fechaPago,
      alumno_id: alumnoSeleccionado,
      ciclo_id: activeCiclo.id,
      total: totales,
      forma_pago: formaPago,
      banco: banco
    };

    // Preparar Detalles
    const detalles = validas.map(f => ({
      cantidad: Number(f.cantidad),
      concepto: f.concepto,
      costo_unitario: Number(f.costo_unitario),
      subtotal: Number(f.cantidad) * Number(f.costo_unitario),
      indice_concepto_plan: f.indice_concepto_plan
    }));

    // Determinar actualizaciones al plan
    let planUpdates: { planId: string; updates: Partial<PaymentPlan> } | undefined = undefined;
    
    if (planActual) {
      const abonosPorIndice: Record<number, number> = {};
      detalles.forEach(d => {
        if (d.indice_concepto_plan) {
          abonosPorIndice[d.indice_concepto_plan] = (abonosPorIndice[d.indice_concepto_plan] || 0) + d.subtotal;
        }
      });

      if (Object.keys(abonosPorIndice).length > 0) {
        const updates: Partial<PaymentPlan> = {};
        for (const idxStr of Object.keys(abonosPorIndice)) {
          const idx = parseInt(idxStr, 10);
          const abono = abonosPorIndice[idx];
          const cantidadAdeudada = planActual[`cantidad_${idx}` as keyof PaymentPlan] as number || 0;
          const estatusPrevio = (planActual[`estatus_${idx}` as keyof PaymentPlan] as string) || '';
          
          let nuevoEstatus = '';
          // Si el total que abona cubre la cantidad adeudada, es Pagado
          // En caso contrario es parcial, añadimos un placeholder de recibo
          if (abono >= cantidadAdeudada) {
            nuevoEstatus = `R-{{FOLIO}} (Pagado $${abono})`;
          } else {
             const resta = cantidadAdeudada - abono;
             nuevoEstatus = `R-{{FOLIO}} (Abono $${abono}, Resta $${resta})`;
          }
          (updates as any)[`estatus_${idx}`] = nuevoEstatus;
        }
        planUpdates = { planId: planActual.id, updates };
      }
    }

    const { error, folio } = await saveReciboCompleto(recibo, detalles, planUpdates);

    setGuardando(false);
    if (error) {
      setMensaje({ tipo: 'error', texto: `Hubo un error al guardar: ${error}` });
    } else {
      setMensaje({ tipo: 'success', texto: `Pago registrado con éxito. Folio: ${folio}` });
      // Refrescar datos del plan en la app
      onPaymentSaved?.();
      // Resetear forma
      setFilas([{ localId: Date.now().toString(), cantidad: 1, concepto: '', costo_unitario: '', indice_concepto_plan: null }]);
      setAlumnoSeleccionado('');
      setFormaPago('Efectivo');
      setBanco('NO APLICA');
    }
  };

  return (
    <div className="p-8">
      {mensaje && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 font-semibold ${mensaje.tipo === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
          {mensaje.tipo === 'success' ? <CheckCircle /> : <AlertCircle />}
          {mensaje.texto}
        </div>
      )}

      {/* Recibo Header */}
      <div className="border border-gray-900 rounded-lg overflow-hidden bg-white shadow-sm font-sans mb-8">
        
        {/* Fila 1: Centro Universitario y Folio/Fecha */}
        <div className="flex flex-col md:flex-row border-b border-gray-900">
          <div className="md:w-3/4 p-4 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-900 bg-gray-50">
            <h2 className="text-xl md:text-2xl font-black text-center tracking-wide uppercase text-gray-800">
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
              <div className="w-1/2 p-2 flex items-center justify-center font-semibold text-gray-700">{fechaRecibo}</div>
            </div>
          </div>
        </div>

        {/* Fila 2: Alumno Seleccionado */}
        <div className="flex flex-col md:flex-row border-b border-gray-900">
          <div className="md:w-1/6 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-b md:border-b-0 border-r border-gray-900">RECIBIMOS DE</div>
          <div className="md:w-1/2 p-2 border-r border-gray-900">
            <select 
              value={alumnoSeleccionado} 
              onChange={e => setAlumnoSeleccionado(e.target.value)}
              className="w-full bg-transparent outline-none font-semibold text-gray-800 cursor-pointer p-1"
            >
              <option value="">-- Seleccionar Alumno --</option>
              {alumnos.map(a => (
                <option key={a.id} value={a.id}>{a.nombre_completo}</option>
              ))}
            </select>
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
          <div className="md:w-1/3 p-2 flex items-center justify-center border-r border-gray-900 font-semibold text-gray-700">
             {alumnoData ? `${alumnoData.grado_actual || ''}` : ''}
          </div>
          <div className="md:w-1/6 p-2 bg-gray-200 font-bold flex flex-col items-center justify-center text-xs text-center border-r border-gray-900">
            <span>DE LA</span>
            <span>LICENCIATURA/ESPECIALIDAD EN</span>
          </div>
          <div className="md:w-1/3 p-2 flex items-center justify-center font-bold text-gray-800">
            {alumnoData?.licenciatura || ''}
          </div>
        </div>

        {/* Fila 4: Turno */}
        <div className="flex border-b border-gray-900">
          <div className="w-1/6 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-r border-gray-900">TURNO</div>
          <div className="w-5/6 p-2 flex items-center justify-center font-semibold text-gray-700">
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
            <div className="w-4/12 p-1 border-r border-gray-900 flex items-center">
              <select
                value={fila.indice_concepto_plan ? `PLAN_${fila.indice_concepto_plan}_${fila.concepto}` : fila.concepto ? `CAT_${fila.concepto}` : ''}
                onChange={(e) => updateFila(fila.localId, 'concepto', e.target.value)}
                className="w-full bg-transparent outline-none cursor-pointer truncate"
              >
                <option value="">-- Concepto --</option>
                {opcionesConceptos.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
            <div className="w-2/12 p-1 border-r border-gray-900 flex items-center justify-center relative">
              <span className="absolute left-2 text-gray-500">$</span>
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
               className="w-full py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 transition-colors"
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
            <div className="flex border-b border-gray-900">
              <div className="w-1/2 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-r border-gray-900 text-center">TOTAL</div>
              <div className="w-1/2 p-2 flex items-center justify-end font-bold text-lg text-emerald-700">
                 ${totales.toFixed(2)}
              </div>
            </div>

            <div className="flex border-b border-gray-900">
                <div className="w-1/2 p-2 bg-gray-200 font-bold flex items-center justify-center text-xs text-center border-r border-gray-900">FORMA DE PAGO</div>
                <div className="w-1/2 p-2 flex items-center justify-center">
                   <select 
                      value={formaPago} 
                      onChange={(e) => setFormaPago(e.target.value)}
                      className="w-full text-xs font-semibold bg-gray-50 p-1 outline-none border border-gray-300 rounded"
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
                      className="w-full text-xs font-semibold bg-gray-50 p-1 outline-none border border-gray-300 rounded"
                      disabled={formaPago === 'Efectivo'}
                    >
                     {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                   </select>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button 
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50"
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
