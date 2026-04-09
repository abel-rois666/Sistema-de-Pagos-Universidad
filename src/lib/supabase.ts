/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import type { PaymentPlan, Alumno, CicloEscolar, Recibo, ReciboDetalle } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Mapper: PaymentPlan → planes_pago (excluye campos calculados por la vista) ──
export const toDBPlan = (plan: PaymentPlan) => ({
  id: plan.id,
  alumno_id: plan.alumno_id ?? null,
  ciclo_id: plan.ciclo_id ?? null,
  no_plan_pagos: plan.no_plan_pagos,
  fecha_plan: plan.fecha_plan,
  beca_porcentaje: plan.beca_porcentaje,
  beca_tipo: plan.beca_tipo,
  tipo_plan: plan.tipo_plan ?? 'Cuatrimestral',
  licenciatura: plan.licenciatura ?? null,
  grado_turno_inscrito: plan.grado_turno ?? null,
  grado: plan.grado ?? (plan.grado_turno?.split('/')[0]?.trim() ?? null),
  turno: plan.turno ?? (plan.grado_turno?.split('/')[1]?.trim() ?? null),
  concepto_1: plan.concepto_1 ?? null, fecha_1: plan.fecha_1 ?? null, cantidad_1: plan.cantidad_1 ?? null, estatus_1: plan.estatus_1 ?? null,
  concepto_2: plan.concepto_2 ?? null, fecha_2: plan.fecha_2 ?? null, cantidad_2: plan.cantidad_2 ?? null, estatus_2: plan.estatus_2 ?? null,
  concepto_3: plan.concepto_3 ?? null, fecha_3: plan.fecha_3 ?? null, cantidad_3: plan.cantidad_3 ?? null, estatus_3: plan.estatus_3 ?? null,
  concepto_4: plan.concepto_4 ?? null, fecha_4: plan.fecha_4 ?? null, cantidad_4: plan.cantidad_4 ?? null, estatus_4: plan.estatus_4 ?? null,
  concepto_5: plan.concepto_5 ?? null, fecha_5: plan.fecha_5 ?? null, cantidad_5: plan.cantidad_5 ?? null, estatus_5: plan.estatus_5 ?? null,
  concepto_6: plan.concepto_6 ?? null, fecha_6: plan.fecha_6 ?? null, cantidad_6: plan.cantidad_6 ?? null, estatus_6: plan.estatus_6 ?? null,
  concepto_7: plan.concepto_7 ?? null, fecha_7: plan.fecha_7 ?? null, cantidad_7: plan.cantidad_7 ?? null, estatus_7: plan.estatus_7 ?? null,
  concepto_8: plan.concepto_8 ?? null, fecha_8: plan.fecha_8 ?? null, cantidad_8: plan.cantidad_8 ?? null, estatus_8: plan.estatus_8 ?? null,
  concepto_9: plan.concepto_9 ?? null, fecha_9: plan.fecha_9 ?? null, cantidad_9: plan.cantidad_9 ?? null, estatus_9: plan.estatus_9 ?? null,
});

// ── CRUD Helpers ─────────────────────────────────────────────────────────────

/** Helper para hacer fetch iterativo y obtener todos los registros, evadiendo el límite de 1000 de PostgREST */
export const fetchAllSupabase = async (
  queryFn: () => any,
  limitPerQuery: number = 1000
) => {
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + limitPerQuery - 1;
    const { data, error } = await queryFn().range(from, to);
    if (error) return { data: null, error };
    
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < limitPerQuery) {
        hasMore = false;
      } else {
        from += limitPerQuery;
      }
    } else {
      hasMore = false;
    }
  }

  return { data: allData, error: null };
};

// Verifica si un string es un UUID válido de Postgres
const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/** Upsert de un plan de pagos individual */
export const savePlan = async (plan: PaymentPlan): Promise<string | null> => {
  if (plan.id && !isUUID(plan.id)) return null;
  const { error } = await supabase.from('planes_pago').upsert(toDBPlan(plan));
  if (error) { console.error('[savePlan]', error.message); return error.message; }
  return null;
};

/** Upsert de un alumno */
export const saveAlumno = async (alumno: Alumno): Promise<string | null> => {
  if (alumno.id && !isUUID(alumno.id)) return null;
  const { error } = await supabase.from('alumnos').upsert({
    id: alumno.id,
    nombre_completo: alumno.nombre_completo,
    licenciatura: alumno.licenciatura,
    grado_actual: alumno.grado_actual,
    turno: alumno.turno,
    estatus: alumno.estatus,
    beca_porcentaje: alumno.beca_porcentaje,
    beca_tipo: alumno.beca_tipo,
    observaciones_pago_titulacion: alumno.observaciones_pago_titulacion,
    ciclo_ultima_asignacion_grado: alumno.ciclo_ultima_asignacion_grado,
    saldo_a_favor: alumno.saldo_a_favor,
  });
  if (error) { console.error('[saveAlumno]', error.message); return error.message; }
  return null;
};

/** Upsert completo del array de ciclos (usado al activar/desactivar) */
export const saveCiclos = async (ciclos: CicloEscolar[]): Promise<string | null> => {
  const validCiclos = ciclos.filter(c => isUUID(c.id));
  if (validCiclos.length === 0) return null;
  const { error } = await supabase.from('ciclos_escolares').upsert(
    validCiclos.map(c => ({ id: c.id, nombre: c.nombre, meses_abarca: c.meses_abarca, anio: c.anio, activo: c.activo }))
  );
  if (error) { console.error('[saveCiclos]', error.message); return error.message; }
  return null;
};

/** Insert masivo de alumnos (importación CSV) */
export const bulkSaveAlumnos = async (alumnos: Alumno[]): Promise<string | null> => {
  const validAlumnos = alumnos.filter(a => isUUID(a.id));
  if (!validAlumnos.length) return null;
  
  // Deduplicate array by ID to prevent Postgres "cannot affect row a second time" error
  const uniqueMap = new Map<string, Alumno>();
  validAlumnos.forEach(a => uniqueMap.set(a.id, a));
  const uniqueAlumnos = Array.from(uniqueMap.values());

  const CHUNK_SIZE = 500;
  for (let i = 0; i < uniqueAlumnos.length; i += CHUNK_SIZE) {
    const chunk = uniqueAlumnos.slice(i, i + CHUNK_SIZE);
    const dbPayload = chunk.map(a => ({
        id: a.id,
        nombre_completo: a.nombre_completo,
        licenciatura: a.licenciatura,
        grado_actual: a.grado_actual,
        turno: a.turno,
        estatus: a.estatus || 'ACTIVO',
        beca_porcentaje: a.beca_porcentaje || '0%',
        beca_tipo: a.beca_tipo || 'NINGUNA',
        observaciones_pago_titulacion: a.observaciones_pago_titulacion || null,
        ciclo_ultima_asignacion_grado: a.ciclo_ultima_asignacion_grado || null,
        saldo_a_favor: a.saldo_a_favor
      }));

    const { error } = await supabase.from('alumnos').upsert(
      dbPayload,
      { onConflict: 'id' }
    );
    if (error) { 
       console.error('[bulkSaveAlumnos chunk]', error.message); 
       return error.message; 
    }
  }
  return null;
};

/** Insert masivo de planes (importación CSV) */
export const bulkSavePlanes = async (planes: PaymentPlan[]): Promise<string | null> => {
  const validPlanes = planes.filter(p => isUUID(p.id));
  if (!validPlanes.length) return null;
  
  // Deduplicate array by ID to prevent Postgres "cannot affect row a second time" error
  const uniqueMap = new Map<string, PaymentPlan>();
  validPlanes.forEach(p => uniqueMap.set(p.id, p));
  const uniquePlanes = Array.from(uniqueMap.values());

  const CHUNK_SIZE = 500;
  for (let i = 0; i < uniquePlanes.length; i += CHUNK_SIZE) {
    const chunk = uniquePlanes.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('planes_pago').upsert(
        chunk.map(toDBPlan),
        { onConflict: 'id' }
    );
    if (error) { 
        console.error('[bulkSavePlanes chunk]', error.message); 
        return error.message; 
    }
  }
  return null;
};

/** Upsert de una plantilla de plan */
export const savePlantilla = async (plantilla: any): Promise<string | null> => {
  if (plantilla.id && !isUUID(plantilla.id)) return null;
  const { error } = await supabase.from('plantillas_plan').upsert(plantilla);
  if (error) { console.error('[savePlantilla]', error.message); return error.message; }
  return null;
};

/** Eliminar una plantilla de plan */
export const deletePlantilla = async (id: string): Promise<string | null> => {
  if (!isUUID(id)) return null;
  const { error } = await supabase.from('plantillas_plan').delete().eq('id', id);
  if (error) { console.error('[deletePlantilla]', error.message); return error.message; }
  return null;
};

/** Eliminar un alumno */
export const deleteAlumno = async (id: string): Promise<string | null> => {
  if (!isUUID(id)) return null;
  const { error } = await supabase.from('alumnos').delete().eq('id', id);
  if (error) { console.error('[deleteAlumno]', error.message); return error.message; }
  return null;
};

/** Upsert individual de ciclo escolar */
export const saveCiclo = async (ciclo: CicloEscolar): Promise<string | null> => {
  if (ciclo.id && !isUUID(ciclo.id)) return null;
  const { error } = await supabase.from('ciclos_escolares').upsert(
    { id: ciclo.id, nombre: ciclo.nombre, meses_abarca: ciclo.meses_abarca, anio: ciclo.anio, activo: ciclo.activo }
  );
  if (error) { console.error('[saveCiclo]', error.message); return error.message; }
  return null;
};

/** Eliminar un ciclo escolar */
export const deleteCiclo = async (id: string): Promise<string | null> => {
  if (!isUUID(id)) return null;
  const { error } = await supabase.from('ciclos_escolares').delete().eq('id', id);
  if (error) { console.error('[deleteCiclo]', error.message); return error.message; }
  return null;
};

/** Upsert de un item de catalogo */
export const saveCatalogoItem = async (item: any): Promise<string | null> => {
  if (item.id && !isUUID(item.id)) return null;
  const { error } = await supabase.from('catalogos').upsert(item);
  if (error) { console.error('[saveCatalogoItem]', error.message); return error.message; }
  return null;
};

/** Eliminar un item de catalogo */
export const deleteCatalogoItem = async (id: string): Promise<string | null> => {
  if (!isUUID(id)) return null;
  const { error } = await supabase.from('catalogos').delete().eq('id', id);
  if (error) { console.error('[deleteCatalogoItem]', error.message); return error.message; }
  return null;
};

/** Registrar un nuevo pago (recibo + detalles) y actualizar estatus del plan si aplica */
export const saveReciboCompleto = async (
  recibo: Omit<Recibo, 'id' | 'folio' | 'created_at' | 'estatus'> & { estatus?: string; folio?: number; uso_saldo_a_favor?: number },
  detalles: Omit<ReciboDetalle, 'id' | 'recibo_id'>[],
  planUpdates?: { planId: string, updates: Partial<PaymentPlan> },
  saldoAfavorUpdate?: { alumnoId: string, delta: number }
): Promise<{ error: string | null; folio?: number }> => {
  try {
    const payload: any = {
      fecha_recibo: recibo.fecha_recibo,
      fecha_pago: recibo.fecha_pago,
      alumno_id: recibo.alumno_id,
      ciclo_id: recibo.ciclo_id,
      total: recibo.total,
      forma_pago: recibo.forma_pago,
      banco: recibo.banco,
      estatus: recibo.estatus || 'ACTIVO',
      requiere_factura: recibo.requiere_factura || false,
      estatus_factura: recibo.requiere_factura ? 'PENDIENTE' : 'NO APLICA'
    };
    if (recibo.uso_saldo_a_favor !== undefined) {
      payload.uso_saldo_a_favor = recibo.uso_saldo_a_favor;
    }
    if (recibo.folio !== undefined) {
      payload.folio = recibo.folio;
    }

    // 1. Insertar el recibo (Omitirmos el ID para que Postgres genere el UUID y el folio serial, a menos que se haya forzado)
    const { data: reciboData, error: reciboError } = await supabase
      .from('recibos')
      .insert(payload)
      .select('id, folio')
      .single();

    if (reciboError) throw new Error(`Error insertando recibo: ${reciboError.message}`);

    const newReciboId = reciboData.id;
    const newFolio = reciboData.folio;

    // 2. Insertar detalles
    const detallesToInsert = detalles.map(d => ({
      ...d,
      recibo_id: newReciboId
    }));

    const { error: detallesError } = await supabase
      .from('recibos_detalles')
      .insert(detallesToInsert);

    if (detallesError) throw new Error(`Error insertando detalles: ${detallesError.message}`);

    // 3. Actualizar Plan de Pagos (si hubo afectación a conceptos)
    if (planUpdates) {
      const finalUpdates: any = {};
      for (const [k, v] of Object.entries(planUpdates.updates)) {
        if (typeof v === 'string') {
          finalUpdates[k] = v.replace('{{FOLIO}}', String(newFolio));
        } else {
          finalUpdates[k] = v;
        }
      }

      const { error: planError } = await supabase
        .from('planes_pago')
        .update(finalUpdates)
        .eq('id', planUpdates.planId);
      
      if (planError) throw new Error(`Error actualizando el plan de pagos: ${planError.message}`);
    }

    // 4. Actualizar Saldo a Favor del alumno (Monedero)
    if (saldoAfavorUpdate && saldoAfavorUpdate.delta !== 0) {
       const { data: al, error: alErr } = await supabase
         .from('alumnos')
         .select('saldo_a_favor')
         .eq('id', saldoAfavorUpdate.alumnoId)
         .single();
         
       if (!alErr && al) {
         const current = Number(al.saldo_a_favor) || 0;
         const newBalance = current + saldoAfavorUpdate.delta;
         await supabase.from('alumnos').update({ saldo_a_favor: newBalance }).eq('id', saldoAfavorUpdate.alumnoId);
       }
    }

    return { error: null, folio: newFolio };
  } catch (err: any) {
    console.error('[saveReciboCompleto]', err.message);
    return { error: err.message || 'Error desconocido' };
  }
};

/** Asentar número de factura a un recibo */
export const updateReciboFactura = async (reciboId: string, folioFiscal: string): Promise<string | null> => {
  if (!isUUID(reciboId)) return null;
  try {
    const { data: recibo } = await supabase
        .from('recibos')
        .select('*, recibos_detalles(*)')
        .eq('id', reciboId)
        .single();

    const { error } = await supabase
      .from('recibos')
      .update({ estatus_factura: 'FACTURADO', folio_fiscal: folioFiscal })
      .eq('id', reciboId);
    if (error) throw new Error(error.message);

    // Actualizar texto en Plan de Pagos si hay conceptos
    if (recibo && recibo.alumno_id && recibo.ciclo_id) {
        const detallesConPlan = (recibo.recibos_detalles || []).filter((d: any) => d.indice_concepto_plan != null);
        if (detallesConPlan.length > 0) {
           const { data: planes } = await supabase.from('planes_pago').select('*')
               .eq('alumno_id', recibo.alumno_id)
               .eq('ciclo_id', recibo.ciclo_id);
           if (planes && planes.length > 0) {
               const planId = planes[0].id;
               const updates: Record<string, string> = {};
               for (const d of detallesConPlan) {
                   const idx = d.indice_concepto_plan;
                   const txt = planes[0][`estatus_${idx}`] as string || '';
                   // Reemplaza de forma segura (ej. no afecta R-120 si el folio es R-12)
                   const regex = new RegExp(`R-${recibo.folio}\\b`, 'g');
                   if (regex.test(txt)) {
                       updates[`estatus_${idx}`] = txt.replace(regex, `F-${folioFiscal}`);
                   }
               }
               if (Object.keys(updates).length > 0) {
                   await supabase.from('planes_pago').update(updates).eq('id', planId);
               }
           }
        }
    }

    return null;
  } catch (err: any) {
    console.error('[updateReciboFactura]', err.message);
    return err.message;
  }
};

/** Cancelar un recibo y revertir el estatus del plan si aplica */
export const cancelarRecibo = async (reciboId: string): Promise<string | null> => {
   if (!isUUID(reciboId)) return null;
   try {
     // 1. Obtener el recibo y sus detalles
     const { data: recibo, error: rErr } = await supabase
       .from('recibos')
       .select('*, recibos_detalles(*)')
       .eq('id', reciboId)
       .single();
     if (rErr || !recibo) throw new Error(rErr?.message || 'Recibo no encontrado');

     // 2. Marcar como CANCELADO
     const { error: cancelErr } = await supabase
       .from('recibos')
       .update({ estatus: 'CANCELADO' })
       .eq('id', reciboId);
     if (cancelErr) throw new Error(cancelErr.message);

     // 3. Revertir conceptos del plan que fueron afectados
     const detallesConPlan = (recibo.recibos_detalles || []).filter(
       (d: any) => d.indice_concepto_plan != null
     );

     if (detallesConPlan.length > 0 && recibo.alumno_id && recibo.ciclo_id) {
       // Buscar el plan del alumno para ese ciclo
       const { data: planes } = await supabase
         .from('planes_pago')
         .select('id')
         .eq('alumno_id', recibo.alumno_id)
         .eq('ciclo_id', recibo.ciclo_id);

       if (planes && planes.length > 0) {
         const planId = planes[0].id;
         const updates: Record<string, string> = {};
         for (const det of detallesConPlan) {
           updates[`estatus_${det.indice_concepto_plan}`] = 'PENDIENTE';
         }
         const { error: planErr } = await supabase
           .from('planes_pago')
           .update(updates)
           .eq('id', planId);
         if (planErr) console.error('[cancelarRecibo] Error revirtiendo plan:', planErr.message);
       }
     }

     return null;
   } catch (err: any) {
     console.error('[cancelarRecibo]', err.message);
     return err.message || 'Error desconocido';
   }
};

/** Obtener configuración de la App */
export const getAppConfig = async (): Promise<{ title: string; logoUrl: string }> => {
  const { data, error } = await supabase.from('configuracion_app').select('*');
  if (error || !data) return { title: 'Sistema de Control de Pagos', logoUrl: '' };
  
  const config = { title: 'Sistema de Control de Pagos', logoUrl: '' };
  data.forEach(item => {
    if (item.id === 'app_title') config.title = item.valor;
    if (item.id === 'app_logo') config.logoUrl = item.valor;
  });
  return config;
};

/** Actualizar configuración de la App */
export const updateAppConfig = async (title: string, logoUrl: string): Promise<string | null> => {
  const { error: err1 } = await supabase.from('configuracion_app').upsert({ id: 'app_title', valor: title });
  if (err1) return err1.message;
  
  const { error: err2 } = await supabase.from('configuracion_app').upsert({ id: 'app_logo', valor: logoUrl });
  if (err2) return err2.message;
  
  return null;
};

/** Vincular manualmente un detalle de recibo a un concepto del plan */
export const vincularReciboDetalleAPlan = async (
  detalleId: string,
  planId: string,
  indiceConcepto: number
): Promise<string | null> => {
  try {
    // 1. Actualizar el detalle del recibo
    const { error: errDetalle } = await supabase
      .from('recibos_detalles')
      .update({ indice_concepto_plan: indiceConcepto })
      .eq('id', detalleId);
    
    if (errDetalle) throw new Error(`Error vinculando detalle: ${errDetalle.message}`);

    // 2. Actualizar el estatus del plan a PAGADO
    const updatePayload: Record<string, string> = {};
    updatePayload[`estatus_${indiceConcepto}`] = 'PAGADO';
    
    const { error: errPlan } = await supabase
      .from('planes_pago')
      .update(updatePayload)
      .eq('id', planId);

    if (errPlan) throw new Error(`Error actualizando el plan: ${errPlan.message}`);

    return null;
  } catch (err: any) {
    console.error('[vincularReciboDetalleAPlan]', err.message);
    return err.message || 'Error desconocido al vincular';
  }
};

/** Vincular un detalle de recibo a MÚLTIPLES conceptos del plan (folio R-XXX concatenado) */
export const vincularReciboDetalleAMultiplesPlan = async (
  detalleId: string,
  reciboFolio: number,
  seleccion: { planId: string; idx: number }[]
): Promise<string | null> => {
  if (seleccion.length === 0) return 'No se seleccionó ningún concepto';
  try {
    // 0. Obtener el monto del detalle
    const { data: detData, error: errFetchDet } = await supabase.from('recibos_detalles').select('subtotal').eq('id', detalleId).single();
    if (errFetchDet || !detData) throw new Error('No se pudo leer el detalle: ' + errFetchDet?.message);
    const abonoInicialDelRecibo = Number(detData.subtotal);

    // 1. Marcar el detalle con el primer índice seleccionado (retrocompatibilidad con columna única)
    const { error: errDetalle } = await supabase
      .from('recibos_detalles')
      .update({ indice_concepto_plan: seleccion[0].idx })
      .eq('id', detalleId);
    if (errDetalle) throw new Error(`Error vinculando detalle: ${errDetalle.message}`);

    // 2. Agrupar los índices por planId (puede haber selecciones de distintos planes)
    const porPlan: Record<string, number[]> = {};
    for (const s of seleccion) {
      if (!porPlan[s.planId]) porPlan[s.planId] = [];
      porPlan[s.planId].push(s.idx);
    }

    let saldoDistribucion = abonoInicialDelRecibo;
    let observacionesAbiertas: string[] = [];
    let alumnoIdForWallet: string | null = null;

    // 3. Para cada plan, leer el estado actual y construir el nuevo estatus con folio concatenado
    for (const [planId, indices] of Object.entries(porPlan)) {
      const { data: planData, error: fetchErr } = await supabase
        .from('planes_pago')
        .select('*')
        .eq('id', planId)
        .single();
      if (fetchErr || !planData) throw new Error('No se pudo leer el plan: ' + fetchErr?.message);

      const updatePayload: Record<string, string> = {};
      
      for (const idx of indices) {
        if (saldoDistribucion <= 0) break; // Ya nos quedamos sin dinero para abonar a más conceptos
        
        const estatusPrevio = (planData[`estatus_${idx}`] || 'PENDIENTE') as string;
        const montoPlaneado = (planData[`cantidad_${idx}`] || 0) as number;

        // -- Algoritmo de extracción de Restante --
        const getRestanteDe = (estatusText: string, totalOriginal: number): number => {
            if (!estatusText || estatusText === 'PENDIENTE') return totalOriginal;
            const m = estatusText.match(/Resta\s*\$([0-9,]+(?:\.\d{2})?)/);
            if (m) return parseFloat(m[1].replace(',', ''));
            if (estatusText.toUpperCase().includes('PAGADO')) return 0;
            return totalOriginal;
        };

        const restanteAnterior = getRestanteDe(estatusPrevio, montoPlaneado);
        if (restanteAnterior <= 0) continue; // Si por error seleccionó algo ya pagado

        // ¿Cuánto abonamos a ESTE concepto? Lo que deba, o lo que quede del recibo
        const abonoAEstablecer = Math.min(saldoDistribucion, restanteAnterior);
        saldoDistribucion -= abonoAEstablecer;

        const restaFinal = restanteAnterior - abonoAEstablecer;
        const totalPagadoAcumulado = (montoPlaneado - restanteAnterior) + abonoAEstablecer;

        // Recoger folios anteriores del texto (ej. "R-101; ")
        let foliosPrevios = '';
        const foliosMatch = estatusPrevio.match(/R-\d+/g);
        if (foliosMatch && foliosMatch.length > 0) {
          foliosPrevios = foliosMatch.join('; ') + '; ';
        }

        let nuevoEstatus = '';
        if (restaFinal <= 0.005) {
            nuevoEstatus = `${foliosPrevios}R-${reciboFolio} (Pagado $${totalPagadoAcumulado.toFixed(2)})`;
            if (abonoInicialDelRecibo < montoPlaneado - 0.005 || estatusPrevio.includes('Abono')) {
                 observacionesAbiertas.push(`Abono final liquidado`);
            }
        } else {
            nuevoEstatus = `${foliosPrevios}R-${reciboFolio} (Abono $${totalPagadoAcumulado.toFixed(2)}, Resta $${restaFinal.toFixed(2)})`;
            observacionesAbiertas.push(`Abono $${abonoAEstablecer.toFixed(2)} — Restante: $${restaFinal.toFixed(2)}`);
        }

        updatePayload[`estatus_${idx}`] = nuevoEstatus;
      }

      const { error: errPlan } = await supabase
        .from('planes_pago')
        .update(updatePayload)
        .eq('id', planId);
      if (errPlan) throw new Error(`Error actualizando plan ${planId}: ${errPlan.message}`);
    }

    if (saldoDistribucion > 0.005 && alumnoIdForWallet) {
        // Hubo excedente al vincular!
        observacionesAbiertas.push(`✓ Excedente de $${saldoDistribucion.toFixed(2)} depositado en Monedero`);
        const { data: al, error: alErr } = await supabase.from('alumnos').select('saldo_a_favor').eq('id', alumnoIdForWallet).single();
        if (!alErr && al) {
            const current = Number(al.saldo_a_favor) || 0;
            await supabase.from('alumnos').update({ saldo_a_favor: current + saldoDistribucion }).eq('id', alumnoIdForWallet);
        }
    }

    // 4. Actualizar observaciones en el detalle si hubo lógica de abono
    if (observacionesAbiertas.length > 0) {
       await supabase.from('recibos_detalles').update({ observaciones: observacionesAbiertas.join(' | ') }).eq('id', detalleId);
    }

    return null;
  } catch (err: any) {
    console.error('[vincularReciboDetalleAMultiplesPlan]', err.message);
    return err.message || 'Error desconocido al vincular múltiple';
  }
};


/** Actualizar preferencias de sesión del usuario (tema y ciclo) **/
export const updateUserPreferences = async (userId: string, updates: { preferencia_tema?: string, ultimo_ciclo_id?: string }): Promise<string | null> => {
  if (!isUUID(userId)) return null;
  try {
    const { error } = await supabase.from('usuarios').update(updates).eq('id', userId);
    if (error) { console.error('[updateUserPreferences]', error.message); return error.message; }
    return null;
  } catch(err: any) {
    console.error("Local error updating prefs", err);
    return err.message;
  }
};
