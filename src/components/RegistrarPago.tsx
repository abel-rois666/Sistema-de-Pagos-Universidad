import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, AlertCircle, Info, Printer, X, FileDown, Loader2 } from 'lucide-react';
import type { Alumno, CicloEscolar, PaymentPlan, Catalogos, CatalogoItem, Usuario, Recibo, ReciboDetalle, AppConfig } from '../types';
import { saveReciboCompleto, saveCatalogoItem } from '../lib/supabase';
import { ReciboPlantillaPDF } from './ReciboPlantillaPDF';
import { printElement, downloadElementAsPDF } from '../lib/printUtils';

interface ConceptoRow {
  localId: string;
  cantidad: number | '';
  concepto: string;
  costo_unitario: number | '';
  indice_concepto_plan: number | null;
  searchConceptoTerm: string;
  showConceptoSuggestions: boolean;
  plan_id?: string;
}

interface Props {
  alumnos: Alumno[];
  activeCiclo?: CicloEscolar;
  plans: PaymentPlan[];
  catalogos: Catalogos;
  appConfig?: AppConfig;
  initialAlumnoId?: string;
  initialConceptIndex?: number;
  initialPlanId?: string;
  currentUser?: Usuario;
  onPaymentSaved?: () => void;
  onCatalogoAdded?: (item: CatalogoItem) => void;
}

// Bancos disponibles
const BANCOS = ['BBVA 1', 'BBVA 2', 'MIFEL', 'BANORTE', 'NO APLICA'];
const FORMAS_PAGO = ['Depósito Bancario', 'Transferencia bancaria', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'Efectivo'];

export default function RegistrarPago({ alumnos, activeCiclo, plans, catalogos, appConfig, initialAlumnoId, initialConceptIndex, initialPlanId, currentUser, onPaymentSaved, onCatalogoAdded }: Props) {
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<string>(initialAlumnoId || '');
  const [searchAlumnoTerm, setSearchAlumnoTerm] = useState('');
  const [showAlumnoSuggestions, setShowAlumnoSuggestions] = useState(false);
  const [fechaPago, setFechaPago] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formaPago, setFormaPago] = useState<string>('Efectivo');
  const [banco, setBanco] = useState<string>('NO APLICA');
  const [usarMonedero, setUsarMonedero] = useState(false);
  
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

  const [filas, setFilas] = useState<ConceptoRow[]>([{
    localId: Date.now().toString(),
    cantidad: 1,
    concepto: '',
    costo_unitario: '',
    indice_concepto_plan: null,
    searchConceptoTerm: '',
    showConceptoSuggestions: false,
  }]);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  // Print modal state — holds the just-saved recibo for preview
  const [reciboGuardado, setReciboGuardado] = useState<{
    recibo: Recibo;
    detalles: ReciboDetalle[];
    alumno: Alumno | undefined;
  } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Quick-add concepto state (admin only)
  const [showAddConceptoModal, setShowAddConceptoModal] = useState(false);
  const [newConceptoName, setNewConceptoName] = useState('');
  const [savingConcepto, setSavingConcepto] = useState(false);
  const [addConceptoRowId, setAddConceptoRowId] = useState<string>('');

  const [requiereFactura, setRequiereFactura] = useState(false);

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

  const alumnoData = useMemo(() => alumnos.find(a => a.id === alumnoSeleccionado), [alumnos, alumnoSeleccionado]);

  // Si venimos navegados con un initialPlanId específico, forzamos usar solo ese plan.
  // De lo contrario, usamos TODOS los planes activos del ciclo para el alumno.
  const pupilPlans = useMemo(() => {
    if (initialPlanId) {
      const explicitPlan = plans.find(p => p.id === initialPlanId && p.alumno_id === alumnoSeleccionado);
      if (explicitPlan) return [explicitPlan];
    }
    return plans.filter(p => p.alumno_id === alumnoSeleccionado && p.ciclo_id === activeCiclo?.id);
  }, [plans, alumnoSeleccionado, activeCiclo, initialPlanId]);

  // Generar opciones de conceptos combinando los pendientes de TODOS los planes y los del catálogo
  const opcionesConceptos = useMemo(() => {
    const opciones: { value: string, label: string, index?: number, sugerido?: number, planId?: string }[] = [];
    
    // 1. Conceptos de los planes actuales (solamente los que tengan cantidad y no digan 'PAGADO')
    pupilPlans.forEach(planActual => {
      for (let i = 1; i <= 15; i++) {
        const conceptoName = planActual[`concepto_${i}` as keyof PaymentPlan] as string;
        const cantidad = planActual[`cantidad_${i}` as keyof PaymentPlan] as number;
        const estatus = planActual[`estatus_${i}` as keyof PaymentPlan] as string;
        
        if (conceptoName && cantidad > 0 && !(estatus || '').toUpperCase().includes('PAGADO')) {
          let montoSugerido = cantidad;
          let etiquetaResta = `$${cantidad.toFixed(2)}`;

          if (estatus) {
            const restaMatch = estatus.match(/Resta\s*\$([0-9,]+(?:\.\d{2})?)/);
            if (restaMatch) {
              montoSugerido = parseFloat(restaMatch[1].replace(',', ''));
              etiquetaResta = `$${montoSugerido.toFixed(2)} (abono parcial)`;
            }
          }

          opciones.push({
            value: `PLAN_${planActual.id}_${i}_${conceptoName}`,
            label: `[${planActual.tipo_plan || 'Plan'}] ${conceptoName} — Resta: ${etiquetaResta}`,
            index: i,
            planId: planActual.id,
            sugerido: montoSugerido
          });
        }
      }
    });

    // 2. Conceptos genéricos del catálogo
    catalogos.conceptos.forEach(c => {
      opciones.push({ value: `CAT_${c}`, label: c });
    });

    return opciones;
  }, [pupilPlans, catalogos.conceptos]);

  const hasInitialized = React.useRef(false);
  useEffect(() => {
    // Cuando viene desde PlanPagos y traemos un planId + concepto index
    if (initialConceptIndex && initialPlanId && pupilPlans.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      const idx = initialConceptIndex;
      const targetPlan = pupilPlans.find(p => p.id === initialPlanId);
      if (targetPlan) {
        const conceptoRef = targetPlan[`concepto_${idx}` as keyof PaymentPlan] as string;
        const targetValue = `PLAN_${initialPlanId}_${idx}_${conceptoRef}`;
        const op = opcionesConceptos.find(o => o.value === targetValue);
        if (op) {
          setFilas([{
            localId: Date.now().toString(),
            cantidad: 1,
            concepto: conceptoRef,
            costo_unitario: op.sugerido || '',
            indice_concepto_plan: idx,
            searchConceptoTerm: conceptoRef,
            showConceptoSuggestions: false,
            plan_id: initialPlanId,
          }]);
        }
      }
    }
  }, [initialConceptIndex, initialPlanId, pupilPlans, opcionesConceptos]);

  const agregarFila = () => {
    setFilas([...filas, {
      localId: Date.now().toString(),
      cantidad: 1,
      concepto: '',
      costo_unitario: '',
      indice_concepto_plan: null,
      searchConceptoTerm: '',
      showConceptoSuggestions: false,
    }]);
  };

  const eliminarFila = (id: string) => {
    if (filas.length === 1) return;
    setFilas(filas.filter(f => f.localId !== id));
  };

  const selectConcepto = (filaId: string, opValue: string) => {
    setFilas(filas.map(f => {
      if (f.localId !== filaId) return f;
      if (opValue.startsWith('PLAN_')) {
        const parts = opValue.split('_'); // PLAN_planId_idx_refName
        const pId = parts[1];
        const idx = parseInt(parts[2], 10);
        const refName = parts.slice(3).join('_');
        const op = opcionesConceptos.find(o => o.value === opValue);
        return { ...f, concepto: refName, indice_concepto_plan: idx, plan_id: pId, costo_unitario: op?.sugerido || '', searchConceptoTerm: refName, showConceptoSuggestions: false };
      } else if (opValue.startsWith('CAT_')) {
        const name = opValue.replace('CAT_', '');
        return { ...f, concepto: name, indice_concepto_plan: null, plan_id: undefined, costo_unitario: '', searchConceptoTerm: name, showConceptoSuggestions: false };
      }
      return { ...f, showConceptoSuggestions: false };
    }));
  };

  const updateFila = (id: string, campo: keyof ConceptoRow, valor: any) => {
    setFilas(filas.map(f => {
      if (f.localId === id) {
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
    
    const saldoDisponible = alumnoData?.saldo_a_favor || 0;
    const montoMonederoAplicado = usarMonedero ? Math.min(saldoDisponible, totales) : 0;
    const totalACobrar = totales - montoMonederoAplicado;

    // Validar filas
    const validas = filas.filter(f => f.concepto && Number(f.cantidad) > 0 && Number(f.costo_unitario) >= 0);
    if (validas.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Debes agregar al menos un concepto válido.' });
      return;
    }

    // Validar que no haya conceptos de distintos planes en el mismo recibo
    const planIdsInvolved = Array.from(new Set(validas.filter(f => f.plan_id).map(f => f.plan_id as string)));
    if (planIdsInvolved.length > 1) {
      setMensaje({ tipo: 'error', texto: 'No puedes cobrar conceptos de distintos planes en un mismo recibo. Por favor, hazlos en recibos separados.' });
      return;
    }

    const unicoPlanIdInvolucrado = planIdsInvolved.length === 1 ? planIdsInvolved[0] : null;
    const planActual = unicoPlanIdInvolucrado ? pupilPlans.find(p => p.id === unicoPlanIdInvolucrado) : undefined;

    setGuardando(true);
    setMensaje(null);

    // Preparar el Recibo
    const recibo = {
      fecha_recibo: fechaReciboIso,
      fecha_pago: fechaPago,
      alumno_id: alumnoSeleccionado,
      ciclo_id: activeCiclo.id,
      total: totales,
      uso_saldo_a_favor: montoMonederoAplicado,
      forma_pago: totalACobrar === 0 ? 'NO APLICA' : formaPago,
      banco: totalACobrar === 0 ? 'NO APLICA' : banco,
      requiere_factura: requiereFactura
    };

    let excedenteGeneradoGlobal = 0;

    // Helper: extrae el monto restante del campo estatus
    // Soporta formatos: "R-101 (Abono $500.00, Resta $1000.00)" → 1000
    // Si no hay "Resta", devuelve la cantidad original (primer pago o pago completo previo)
    const getRestanteDe = (estatusPrevio: string, cantidadOriginal: number): number => {
      if (!estatusPrevio) return cantidadOriginal;
      const m = estatusPrevio.match(/Resta\s*\$([0-9,]+(?:\.\d{2})?)/);
      if (m) return parseFloat(m[1].replace(',', ''));
      // Si ya está pagado (no hay Resta) devolvemos 0
      if (estatusPrevio.toUpperCase().includes('PAGADO')) return 0;
      return cantidadOriginal;
    };

    // Pre-calcular observaciones de abono parcial por índice de concepto
    const observacionesPorIndice: Record<number, string> = {};
    if (planActual) {
      const abonosPorIndice: Record<number, number> = {};
      validas.forEach(f => {
        if (f.indice_concepto_plan) {
          abonosPorIndice[f.indice_concepto_plan] = (abonosPorIndice[f.indice_concepto_plan] || 0) + (Number(f.cantidad) * Number(f.costo_unitario));
        }
      });

      for (const idxStr of Object.keys(abonosPorIndice)) {
        const idx = parseInt(idxStr, 10);
        const abonoActual = abonosPorIndice[idx];
        const cantidadOriginal = planActual[`cantidad_${idx}` as keyof PaymentPlan] as number || 0;
        const estatusPrevio = (planActual[`estatus_${idx}` as keyof PaymentPlan] as string) || '';

        const restanteAnterior = getRestanteDe(estatusPrevio, cantidadOriginal);
        const resta = restanteAnterior - abonoActual;
        // Total acumulado = lo que ya se había pagado antes + este abono
        const totalAcumulado = (cantidadOriginal - restanteAnterior) + abonoActual;

        if (resta < -0.005) {
          const excedenteAqui = Math.abs(resta);
          excedenteGeneradoGlobal += excedenteAqui;
          observacionesPorIndice[idx] = `Concepto liquidado ✓ (Excedente de $${excedenteAqui.toFixed(2)} depositado en Monedero)`;
        } else if (resta > 0.005) {
          // Pago parcial: mostrar abono y restante
          observacionesPorIndice[idx] = `Abono $${abonoActual.toFixed(2)} — Restante: $${resta.toFixed(2)}`;
        } else if (totalAcumulado < cantidadOriginal - 0.005 || estatusPrevio.includes('Abono')) {
          // Último abono de una serie: indicar que se liquidó y mostrar total acumulado
          observacionesPorIndice[idx] = `Abono final — Concepto liquidado ✓ (Total pagado: $${totalAcumulado.toFixed(2)})`;
        }
        // Si fue pago completo de una sola vez, sin abonos previos y sin excedentes: sin observación
      }
    }

    // Preparar Detalles (con observaciones calculadas)
    const detalles = validas.map(f => ({
      cantidad: Number(f.cantidad),
      concepto: f.concepto,
      costo_unitario: Number(f.costo_unitario),
      subtotal: Number(f.cantidad) * Number(f.costo_unitario),
      indice_concepto_plan: f.indice_concepto_plan,
      observaciones: f.indice_concepto_plan && observacionesPorIndice[f.indice_concepto_plan]
        ? observacionesPorIndice[f.indice_concepto_plan]
        : null
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
          const abonoActual = abonosPorIndice[idx];
          const cantidadOriginal = planActual[`cantidad_${idx}` as keyof PaymentPlan] as number || 0;
          const estatusPrevio = (planActual[`estatus_${idx}` as keyof PaymentPlan] as string) || '';

          // Extraer folios anteriores para concatenar al nuevo estatus
          const folios = (estatusPrevio.match(/R-\d+/g) || []);
          const folioTextoPrevio = folios.length > 0 ? folios.join('; ') + '; ' : '';

          // Calcular resta y total acumulado
          const restanteAnterior = getRestanteDe(estatusPrevio, cantidadOriginal);
          const resta = restanteAnterior - abonoActual;
          // Total acumulado = pagado previamente + este abono
          const totalAcumulado = (cantidadOriginal - restanteAnterior) + abonoActual;

          let nuevoEstatus = '';
          if (resta <= 0.005) {
            // Pagado: tope matemático en cantidadOriginal para no arruinar el plan con sobreprecios
            const topePagado = Math.min(totalAcumulado, cantidadOriginal);
            nuevoEstatus = `${folioTextoPrevio}R-{{FOLIO}} (Pagado $${topePagado.toFixed(2)})`;
          } else {
            nuevoEstatus = `${folioTextoPrevio}R-{{FOLIO}} (Abono $${totalAcumulado.toFixed(2)}, Resta $${resta.toFixed(2)})`;
          }

          (updates as any)[`estatus_${idx}`] = nuevoEstatus;
        }
        planUpdates = { planId: planActual.id, updates };
      }
    }

    const deltaMonedero = excedenteGeneradoGlobal - montoMonederoAplicado;
    const saldoAfavorUpdate = deltaMonedero !== 0 ? { alumnoId: alumnoSeleccionado, delta: deltaMonedero } : undefined;

    const { error, folio } = await saveReciboCompleto(recibo, detalles, planUpdates, saldoAfavorUpdate);

    setGuardando(false);
    if (error) {
      setMensaje({ tipo: 'error', texto: `Hubo un error al guardar: ${error}` });
    } else {
      // Build the preview object for the print modal
      const reciboCompleto: Recibo = {
        id: '',
        folio: folio!,
        fecha_recibo: recibo.fecha_recibo,
        fecha_pago: recibo.fecha_pago,
        alumno_id: recibo.alumno_id,
        ciclo_id: recibo.ciclo_id,
        total: recibo.total,
        forma_pago: recibo.forma_pago,
        banco: recibo.banco,
        estatus: 'ACTIVO',
      };
      const detallesCompletos: ReciboDetalle[] = detalles.map((d, i) => ({
        id: `tmp_${i}`,
        recibo_id: '',
        cantidad: d.cantidad,
        concepto: d.concepto,
        costo_unitario: d.costo_unitario,
        subtotal: d.subtotal,
        indice_concepto_plan: d.indice_concepto_plan ?? null,
        observaciones: d.observaciones ?? null,
      }));
      onPaymentSaved?.();
      setReciboGuardado({ recibo: reciboCompleto, detalles: detallesCompletos, alumno: alumnoData });
    }
  };


  const handleCerrarModal = () => {
    setReciboGuardado(null);
    setMensaje(null);
    setFilas([{ localId: Date.now().toString(), cantidad: 1, concepto: '', costo_unitario: '', indice_concepto_plan: null, searchConceptoTerm: '', showConceptoSuggestions: false }]);
    setAlumnoSeleccionado('');
    setFormaPago('Efectivo');
    setBanco('NO APLICA');
    setUsarMonedero(false);
    setRequiereFactura(false);
  };

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
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3 font-semibold bg-red-100 text-red-800">
          <AlertCircle />
          {mensaje.texto}
        </div>
      )}

      {/* Banner: sin plan activo */}
      {alumnoSeleccionado && pupilPlans.length === 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-blue-800 text-sm">
          <Info size={18} className="shrink-0 mt-0.5 text-blue-500" />
          <span>
            <strong>Sin plan en el ciclo activo.</strong> Este alumno no tiene plan de pagos registrado para <em>{activeCiclo?.nombre || 'este ciclo'}</em>. El recibo se guardará suelto (no afectará ningún plan).
          </span>
        </div>
      )}

      {/* Banner: múltiples planes detectados (informativo si no está bloqueado por initialPlanId) */}
      {alumnoSeleccionado && pupilPlans.length > 1 && !initialPlanId && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 text-green-800 text-sm">
          <Info size={18} className="shrink-0 mt-0.5 text-green-600" />
          <span>
            <strong>Múltiples planes detectados.</strong> Este alumno tiene {pupilPlans.length} planes activos en este ciclo escolar. Se han agregado todos los conceptos al catálogo de busqueda. <em>Nota: Haz recibos separados si vas a pagar conceptos de diferentes planes.</em>
          </span>
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
          <div className="md:w-1/2 p-2 border-r border-gray-900 relative">
            <input
              type="text"
              className="w-full bg-transparent outline-none font-semibold text-gray-800 p-1"
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
              <div className="absolute top-2 right-2 bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded flex items-center gap-1 font-black shadow-sm border border-emerald-300 pointer-events-none">
                💰 Monedero: ${(alumnoData.saldo_a_favor || 0).toFixed(2)}
              </div>
            )}
            {showAlumnoSuggestions && (
              <div className="absolute top-full left-0 w-full z-10 bg-white border border-gray-900 shadow-2xl max-h-60 overflow-y-auto">
                {filteredAlumnos.map(a => (
                  <div
                    key={a.id}
                    className="p-3 border-b border-gray-200 text-sm cursor-pointer hover:bg-blue-50 text-gray-800 font-medium transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setAlumnoSeleccionado(a.id);
                      setSearchAlumnoTerm(a.nombre_completo);
                      setShowAlumnoSuggestions(false);
                    }}
                  >
                    <span>{a.nombre_completo}</span>
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
                  <div className="p-3 text-sm text-gray-500 text-center italic">No se encontraron coincidencias</div>
                )}
                {filteredAlumnos.length >= 50 && (
                  <div className="p-2 text-xs text-center text-gray-500 bg-gray-50 font-semibold border-t">Sigue escribiendo para ver más...</div>
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
                  <div className="absolute top-full left-0 w-72 z-20 bg-white border border-gray-300 shadow-xl rounded-lg max-h-56 overflow-y-auto">
                    {opcionesConceptos
                      .filter(op => !fila.searchConceptoTerm || op.label.toLowerCase().includes(fila.searchConceptoTerm.toLowerCase()))
                      .slice(0, 30)
                      .map(op => (
                        <div
                          key={op.value}
                          className={`px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 border-b border-gray-100 ${
                            op.value.startsWith('PLAN_') ? 'text-indigo-700 font-semibold' : 'text-gray-800'
                          }`}
                          onMouseDown={(e) => { e.preventDefault(); selectConcepto(fila.localId, op.value); }}
                        >
                          {op.label}
                        </div>
                      ))
                    }
                    {opcionesConceptos.filter(op => !fila.searchConceptoTerm || op.label.toLowerCase().includes(fila.searchConceptoTerm.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400 italic">Sin resultados</div>
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
            <div className="flex border-b border-gray-900 bg-gray-50">
              <div className="w-1/2 p-2 bg-gray-200 font-bold flex items-center justify-center text-sm border-r border-gray-900 text-center">SUBTOTAL</div>
              <div className="w-1/2 p-2 flex items-center justify-end font-bold text-lg text-gray-800">
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
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${usarMonedero ? 'left-5' : 'left-0.5'}`} />
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
                      className="w-full text-xs font-semibold bg-gray-50 p-1 outline-none border border-gray-300 rounded disabled:opacity-50"
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
                      className="w-full text-xs font-semibold bg-gray-50 p-1 outline-none border border-gray-300 rounded disabled:opacity-50"
                      disabled={formaPago === 'Efectivo' || (totales - (usarMonedero ? Math.min(alumnoData?.saldo_a_favor || 0, totales) : 0)) === 0}
                    >
                     {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                   </select>
                </div>
            </div>

            {/* Toggle Requiere Factura */}
            <div className="flex border-t-2 border-gray-900 bg-gray-50">
              <div
                className="w-full p-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors px-4 group"
                onClick={() => setRequiereFactura(!requiereFactura)}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-black text-gray-800 leading-tight tracking-wide group-hover:text-amber-700 transition-colors">¿REQUIERE FACTURA?</span>
                  <span className="text-[10px] text-gray-500 font-bold">Marcar para el área de Contabilidad</span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 shadow-inner ${requiereFactura ? 'bg-amber-500' : 'bg-gray-300'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 shadow-sm transition-all ${requiereFactura ? 'left-6' : 'left-1'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Print Receipt Modal ---- */}
      {reciboGuardado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-full">
                  <Printer className="text-emerald-600" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Recibo R-{reciboGuardado.recibo.folio} guardado</h2>
                  <p className="text-xs text-emerald-700 font-medium">El pago fue registrado correctamente. Puedes imprimir el comprobante o cerrar.</p>
                </div>
              </div>
              <button onClick={handleCerrarModal} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
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
                    licenciaturasMetadata={catalogos.licenciaturasMetadata}
                  />
                </div>
              </div>
            </div>
            {/* Modal footer */}
            <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-white gap-3">
              <button
                onClick={handleCerrarModal}
                className="px-5 py-2.5 border border-gray-300 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                Nuevo Pago
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleDescargarPDF}
                  disabled={generandoPDF}
                  title="Descarga el recibo directamente como archivo PDF"
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold transition-colors shadow-sm text-sm"
                >
                  {generandoPDF ? <><Loader2 size={17} className="animate-spin" /> Generando...</> : <><FileDown size={17} /> Descargar PDF</>}
                </button>
                <button
                  onClick={handleImprimir}
                  disabled={generandoPDF}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-bold transition-colors shadow-sm text-sm"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-800">Nuevo Concepto</h3>
                <p className="text-xs text-gray-400 mt-0.5">Se guardará en el catálogo global de conceptos</p>
              </div>
              <button onClick={() => setShowAddConceptoModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del concepto</label>
              <input
                type="text"
                autoFocus
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                placeholder="Ej. TITULACIÓN"
                value={newConceptoName}
                onChange={(e) => setNewConceptoName(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
            </div>
            <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAddConceptoModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
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
                  await saveCatalogoItem(newItem);
                  onCatalogoAdded?.(newItem);
                  // auto-select in the current row
                  if (addConceptoRowId) {
                    updateFila(addConceptoRowId, 'concepto', `CAT_${name}`);
                  }
                  setSavingConcepto(false);
                  setShowAddConceptoModal(false);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-40"
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
