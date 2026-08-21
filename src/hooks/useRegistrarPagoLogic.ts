import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { pagosService } from '../services/pagosService';
import type { PaymentPlan, Recibo, ReciboDetalle, Alumno } from '../types';

export interface ConceptoRow {
  localId: string;
  cantidad: number | '';
  concepto: string;
  costo_unitario: number | '';
  indice_concepto_plan: number | null;
  searchConceptoTerm: string;
  showConceptoSuggestions: boolean;
  plan_id?: string;
}

export function useRegistrarPagoLogic(
  initialAlumnoId?: string,
  initialConceptIndex?: number,
  initialPlanId?: string
) {
  const { alumnos, ciclos, activeCicloId, plans, catalogos, refreshAfterPayment } = useAppStore();
  const activeCiclo = ciclos.find(c => c.id === activeCicloId);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<string>(initialAlumnoId || '');
  const [fechaPago, setFechaPago] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formaPago, setFormaPago] = useState<string>('Efectivo');
  const [banco, setBanco] = useState<string>('NO APLICA');
  const [usarMonedero, setUsarMonedero] = useState(false);
  const [requiereFactura, setRequiereFactura] = useState(false);

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

  const [reciboGuardado, setReciboGuardado] = useState<{
    recibo: Recibo;
    detalles: ReciboDetalle[];
    alumno: Alumno | undefined;
  } | null>(null);

  const fechaRecibo = useMemo(() => {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }, []);
  const fechaReciboIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (formaPago === 'Efectivo') {
      setBanco('NO APLICA');
    }
  }, [formaPago]);

  const alumnoData = useMemo(() => alumnos.find(a => a.id === alumnoSeleccionado), [alumnos, alumnoSeleccionado]);

  const pupilPlans = useMemo(() => {
    if (initialPlanId) {
      const explicitPlan = plans.find(p => p.id === initialPlanId && p.alumno_id === alumnoSeleccionado);
      if (explicitPlan) return [explicitPlan];
    }
    return plans.filter(p => p.alumno_id === alumnoSeleccionado && (p.ciclo_id === activeCiclo?.id || p.ciclo_escolar === activeCiclo?.nombre));
  }, [plans, alumnoSeleccionado, activeCiclo, initialPlanId]);

  const opcionesConceptos = useMemo(() => {
    const opciones: { value: string, label: string, index?: number, sugerido?: number, planId?: string }[] = [];
    
    pupilPlans.forEach(planActual => {
      if (planActual.detalles && planActual.detalles.length > 0) {
        planActual.detalles.forEach(d => {
          if (d.concepto && d.cantidad > 0 && !(d.estatus || '').toUpperCase().includes('PAGADO')) {
            let montoSugerido = d.cantidad;
            let etiquetaResta = `$${d.cantidad.toFixed(2)}`;

            if (d.estatus) {
              const restaMatch = d.estatus.match(/Resta\s*\$([0-9,]+(?:\.\d{2})?)/);
              if (restaMatch) {
                montoSugerido = parseFloat(restaMatch[1].replace(',', ''));
                etiquetaResta = `$${montoSugerido.toFixed(2)} (abono parcial)`;
              }
            }

            opciones.push({
              value: `PLAN_${planActual.id}_${d.indice_concepto}_${d.concepto}`,
              label: `[${planActual.tipo_plan || 'Plan'}] ${d.concepto} — Resta: ${etiquetaResta}`,
              index: d.indice_concepto,
              planId: planActual.id,
              sugerido: montoSugerido
            });
          }
        });
        return;
      }

      for (let i = 1; i <= 18; i++) {
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

    catalogos.conceptos.forEach(c => {
      opciones.push({ value: `CAT_${c}`, label: c });
    });

    return opciones;
  }, [pupilPlans, catalogos.conceptos]);

  const hasInitialized = useRef(false);
  useEffect(() => {
    if (initialConceptIndex && initialPlanId && pupilPlans.length > 0 && !hasInitialized.current) {
      hasInitialized.current = true;
      const idx = initialConceptIndex;
      const targetPlan = pupilPlans.find(p => p.id === initialPlanId);
      if (targetPlan) {
        let conceptoRef = '';
        if (targetPlan.detalles && targetPlan.detalles.length > 0) {
           const d = targetPlan.detalles.find(x => x.indice_concepto === idx);
           if (d) conceptoRef = d.concepto;
        } else {
           conceptoRef = targetPlan[`concepto_${idx}` as keyof PaymentPlan] as string;
        }
        
        const targetValue = `PLAN_${initialPlanId}_${idx}_${conceptoRef}`;
        const op = opcionesConceptos.find(o => o.value === targetValue);
        if (op) {
          const plan = pupilPlans.find(p => p.id === initialPlanId);
          let enrichedName = conceptoRef;
          if (plan) {
            const tipoPlan = plan.tipo_plan ? `Plan ${plan.tipo_plan}` : 'Plan Cuatrimestral';
            enrichedName = `${conceptoRef} (${tipoPlan} - ${plan.ciclo_escolar})`;
          }

          setFilas([{
            localId: Date.now().toString(),
            cantidad: 1,
            concepto: enrichedName,
            costo_unitario: op.sugerido || '',
            indice_concepto_plan: idx,
            searchConceptoTerm: enrichedName,
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
        const parts = opValue.split('_');
        const pId = parts[1];
        const idx = parseInt(parts[2], 10);
        const refName = parts.slice(3).join('_');
        const op = opcionesConceptos.find(o => o.value === opValue);
        
        const plan = pupilPlans.find(p => p.id === pId);
        let enrichedName = refName;
        if (plan) {
          const tipoPlan = plan.tipo_plan ? `Plan ${plan.tipo_plan}` : 'Plan Cuatrimestral';
          enrichedName = `${refName} (${tipoPlan} - ${plan.ciclo_escolar})`;
        }

        return { ...f, concepto: enrichedName, indice_concepto_plan: idx, plan_id: pId, costo_unitario: op?.sugerido || '', searchConceptoTerm: enrichedName, showConceptoSuggestions: false };
      } else if (opValue.startsWith('CAT_')) {
        const name = opValue.replace('CAT_', '');
        return { ...f, concepto: name, indice_concepto_plan: null, plan_id: undefined, costo_unitario: '', searchConceptoTerm: name, showConceptoSuggestions: false };
      }
      return { ...f, showConceptoSuggestions: false };
    }));
  };

  const updateFila = (id: string, campo: keyof ConceptoRow, valor: any) => {
    setFilas(filas.map(f => f.localId === id ? { ...f, [campo]: valor } : f));
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

    const validas = filas.filter(f => f.concepto && Number(f.cantidad) > 0 && Number(f.costo_unitario) >= 0);
    if (validas.length === 0) {
      setMensaje({ tipo: 'error', texto: 'Debes agregar al menos un concepto válido.' });
      return;
    }

    const planIdsInvolved = Array.from(new Set(validas.filter(f => f.plan_id).map(f => f.plan_id as string)));
    if (planIdsInvolved.length > 1) {
      setMensaje({ tipo: 'error', texto: 'No puedes cobrar conceptos de distintos planes en un mismo recibo. Por favor, hazlos en recibos separados.' });
      return;
    }

    const unicoPlanIdInvolucrado = planIdsInvolved.length === 1 ? planIdsInvolved[0] : null;
    const planActual = unicoPlanIdInvolucrado ? pupilPlans.find(p => p.id === unicoPlanIdInvolucrado) : undefined;

    setGuardando(true);
    setMensaje(null);

    const recibo = {
      fecha_recibo: fechaReciboIso,
      fecha_pago: fechaPago,
      alumno_id: alumnoSeleccionado,
      ciclo_id: planActual ? (planActual.ciclo_id ?? activeCiclo.id) : activeCiclo.id,
      total: totales,
      uso_saldo_a_favor: montoMonederoAplicado,
      forma_pago: totalACobrar === 0 ? 'NO APLICA' : formaPago,
      banco: totalACobrar === 0 ? 'NO APLICA' : banco,
      requiere_factura: requiereFactura
    };

    let excedenteGeneradoGlobal = 0;

    const getRestanteDe = (estatusPrevio: string, cantidadOriginal: number): number => {
      if (!estatusPrevio) return cantidadOriginal;
      const m = estatusPrevio.match(/Resta\s*\$([0-9,]+(?:\.\d{2})?)/);
      if (m) return parseFloat(m[1].replace(',', ''));
      if (estatusPrevio.toUpperCase().includes('PAGADO')) return 0;
      return cantidadOriginal;
    };

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
        let cantidadOriginal = planActual[`cantidad_${idx}` as keyof PaymentPlan] as number || 0;
        let estatusPrevio = (planActual[`estatus_${idx}` as keyof PaymentPlan] as string) || '';

        if (planActual.detalles && planActual.detalles.length > 0) {
          const d = planActual.detalles.find(x => x.indice_concepto === idx);
          if (d) {
            cantidadOriginal = d.cantidad;
            estatusPrevio = d.estatus || '';
          }
        }

        const restanteAnterior = getRestanteDe(estatusPrevio, cantidadOriginal);
        const resta = restanteAnterior - abonoActual;
        const totalAcumulado = (cantidadOriginal - restanteAnterior) + abonoActual;

        if (resta < -0.005) {
          const excedenteAqui = Math.abs(resta);
          excedenteGeneradoGlobal += excedenteAqui;
          observacionesPorIndice[idx] = `Concepto liquidado ✓ (Excedente de $${excedenteAqui.toFixed(2)} depositado en Monedero)`;
        } else if (resta > 0.005) {
          observacionesPorIndice[idx] = `Abono $${abonoActual.toFixed(2)} — Restante: $${resta.toFixed(2)}`;
        } else if (totalAcumulado < cantidadOriginal - 0.005 || estatusPrevio.includes('Abono')) {
          observacionesPorIndice[idx] = `Abono final — Concepto liquidado ✓ (Total pagado: $${totalAcumulado.toFixed(2)})`;
        }
      }
    }

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
          let cantidadOriginal = planActual[`cantidad_${idx}` as keyof PaymentPlan] as number || 0;
          let estatusPrevio = (planActual[`estatus_${idx}` as keyof PaymentPlan] as string) || '';

          if (planActual.detalles && planActual.detalles.length > 0) {
            const d = planActual.detalles.find(x => x.indice_concepto === idx);
            if (d) {
              cantidadOriginal = d.cantidad;
              estatusPrevio = d.estatus || '';
            }
          }

          const folios = (estatusPrevio.match(/R-\d+/g) || []);
          const folioTextoPrevio = folios.length > 0 ? folios.join('; ') + '; ' : '';

          const restanteAnterior = getRestanteDe(estatusPrevio, cantidadOriginal);
          const resta = restanteAnterior - abonoActual;
          const totalAcumulado = (cantidadOriginal - restanteAnterior) + abonoActual;

          let nuevoEstatus = '';
          if (resta <= 0.005) {
            const topePagado = cantidadOriginal > 0 ? Math.min(totalAcumulado, cantidadOriginal) : totalAcumulado;
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

    const res = await pagosService.registrarPagoTransaccional(
      recibo,
      detalles,
      planUpdates?.planId,
      planUpdates?.updates,
      saldoAfavorUpdate?.alumnoId,
      saldoAfavorUpdate?.delta
    );

    setGuardando(false);
    if (!res.success) {
      setMensaje({ tipo: 'error', texto: `Hubo un error al guardar: ${res.error?.message}` });
    } else {
      const folio = res.data.folio;
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
      refreshAfterPayment();
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

  return {
    // State
    alumnoSeleccionado, setAlumnoSeleccionado,
    fechaPago, setFechaPago,
    formaPago, setFormaPago,
    banco, setBanco,
    usarMonedero, setUsarMonedero,
    requiereFactura, setRequiereFactura,
    filas, setFilas,
    guardando,
    mensaje,
    reciboGuardado, setReciboGuardado,
    // Computed
    alumnoData,
    pupilPlans,
    opcionesConceptos,
    totales,
    fechaRecibo,
    // Actions
    agregarFila,
    eliminarFila,
    selectConcepto,
    updateFila,
    guardar,
    handleCerrarModal
  };
}
