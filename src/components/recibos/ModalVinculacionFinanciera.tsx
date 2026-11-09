import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { PaymentPlan, ReciboDetalle } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { conceptosFinancieros, describirPlan, filtrarPeriodoPlanes, periodosFinancieros, saldoConcepto, TODOS_PERIODOS } from '../../finanzas/consulta';
import { consultarDestinosDetalle, consultarPlanesAlumno, consultarRecibosAlumno, refrescarPlanFinanciero, refrescarSaldoAlumno, revisarVinculacionFinanciera, type DestinoVinculado, type ReciboConDetalles } from '../../services/consultaFinancieraService';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorPeriodoFinanciero from '../planesPago/SelectorPeriodoFinanciero';
import RespaldoConciliacionEntrePeriodos from './RespaldoConciliacionEntrePeriodos';
import { contextoEntrePeriodos, MOTIVOS_CONCILIACION, validarRespaldoConciliacion, type RespaldoConciliacion } from '../../finanzas/conciliacionEntrePeriodos';

interface Props {
  plan?: PaymentPlan; indice?: number;
  recibo?: ReciboConDetalles; detalle?: ReciboDetalle;
  onClose: () => void;
  onApplied?: (reciboId: string) => void | Promise<void>;
  onManual?: () => void;
  onVerPlan?: (planId: string) => void;
}
const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const campo = 'h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

/** Mismo recorrido y validación desde el plan o desde el recibo; el servidor decide cada aplicación. */
export default function ModalVinculacionFinanciera({ plan, indice, recibo, detalle, onClose, onApplied, onManual, onVerPlan }: Props) {
  const { ciclos, currentUser, alumnos } = useAppStore();
  const alumnoId = plan?.alumno_id || recibo?.alumno_id || '';
  const historicos = ['ADMINISTRADOR', 'COORDINADOR FINANCIERO'].includes(currentUser?.rol || '');
  const [modo, setModo] = useState<'historico' | 'aplicar'>(historicos ? 'historico' : 'aplicar');
  const [periodo, setPeriodo] = useState(() => ciclos.find(c => c.id === (plan?.ciclo_id || recibo?.ciclo_id))?.nombre || TODOS_PERIODOS);
  const [respaldo, setRespaldo] = useState<RespaldoConciliacion>({ motivo: '', evidencia: '' });
  const [planes, setPlanes] = useState<PaymentPlan[]>(plan ? [plan] : []);
  const [recibos, setRecibos] = useState<ReciboConDetalles[]>(recibo ? [recibo] : []);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [revisionConsulta, setRevisionConsulta] = useState(0);
  const [folio, setFolio] = useState('');
  const [detalleElegido, setDetalleElegido] = useState(detalle?.id || '');
  const [seleccion, setSeleccion] = useState<{ planId: string; idx: number }[]>(plan && indice ? [{ planId: plan.id, idx: indice }] : []);
  const [importe, setImporte] = useState(detalle ? String(detalle.subtotal) : '');
  const [revisado, setRevisado] = useState<Awaited<ReturnType<typeof revisarVinculacionFinanciera>> | null>(null);
  const [aceptado, setAceptado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [destinosActuales, setDestinosActuales] = useState<DestinoVinculado[]>([]);
  const [errorDestinos, setErrorDestinos] = useState('');
  const [cargandoDestinos, setCargandoDestinos] = useState(false);
  const aplicando = useRef(false);
  const cerrarProtegido = useProteccionCaptura(Boolean(detalleElegido && seleccion.length || respaldo.motivo || respaldo.evidencia), guardando);
  const seleccionRef = useRef('');
  const firma = JSON.stringify([detalleElegido, seleccion, importe, modo, respaldo]);
  seleccionRef.current = firma;
  useEffect(() => { setRevisado(null); setAceptado(false); }, [firma]);
  useEffect(() => {
    const controller = new AbortController(); let vigente = true;
    setDestinosActuales([]); setErrorDestinos('');
    if (!detalleElegido) { setCargandoDestinos(false); return; }
    setCargandoDestinos(true);
    void consultarDestinosDetalle(detalleElegido, controller.signal).then(d => { if (vigente) setDestinosActuales(d); })
      .catch(e => { if (vigente) setErrorDestinos(e.message); }).finally(() => { if (vigente) setCargandoDestinos(false); });
    return () => { vigente = false; controller.abort(); };
  }, [detalleElegido, revisionConsulta]);
  useEffect(() => {
    const controller = new AbortController(); let vigente = true;
    setCargando(true); setError('');
    const carga = recibo ? consultarPlanesAlumno(alumnoId, controller.signal).then(data => { if (vigente) setPlanes(data); })
      : consultarRecibosAlumno(alumnoId, pagina, periodo === TODOS_PERIODOS ? null : ciclos.filter(c => c.nombre === periodo).map(c => c.id), controller.signal, folio)
        .then(data => { if (vigente) { setRecibos(data.recibos); setTotal(data.total); } });
    void carga.catch(e => { if (vigente) setError(e.message); }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; controller.abort(); };
  }, [alumnoId, Boolean(recibo), pagina, periodo, folio, revisionConsulta]);
  const reciboOrigen = recibo || recibos.find(r => r.recibos_detalles.some(d => d.id === detalleElegido));
  const detalleOrigen = detalle || reciboOrigen?.recibos_detalles.find(d => d.id === detalleElegido);
  const planesVisibles = plan ? [plan] : filtrarPeriodoPlanes(planes, ciclos, periodo);
  const contexto = contextoEntrePeriodos(reciboOrigen?.ciclo_id, seleccion.map(s => planes.find(p => p.id === s.planId)?.ciclo_id), ciclos);
  const entrePeriodos = contexto === 'entre_periodos';
  const bloqueoConciliacion = entrePeriodos ? !historicos ? 'La conciliación entre periodos requiere Administración o Coordinación Financiera.'
    : seleccion.length !== 1 ? 'Selecciona un solo concepto para conciliar entre periodos. Puedes repetir el flujo para otros pagos.'
    : validarRespaldoConciliacion(respaldo) : null;
  const destinos = seleccion.map(s => ({ ...s, importe: modo === 'historico' ? Number(importe) : undefined }));
  const confirmar = async () => {
    if (aplicando.current || !detalleOrigen || !seleccion.length) return;
    if (contexto === 'incompleto') throw new Error('No se pudo identificar el ciclo del recibo o del plan. Revisa su registro antes de vincular.');
    if (bloqueoConciliacion) throw new Error(bloqueoConciliacion);
    const firmaAlIniciar = firma;
    if (modo === 'historico' && (!Number.isFinite(Number(importe)) || Number(importe) <= 0 || seleccion.length !== 1)) throw new Error('Elige un concepto y un importe histórico positivo.');
    if (revisado && !aceptado) throw new Error('Confirma que revisaste el origen, destino y tratamiento del monedero.');
    aplicando.current = true; setGuardando(true);
    try {
      const resultado = await revisarVinculacionFinanciera(detalleOrigen.id, destinos, modo, Boolean(revisado), revisado?.revision, entrePeriodos ? respaldo : undefined);
      if (!resultado.aplicable) throw new Error(resultado.motivo || 'La operación requiere revisión financiera.');
      if (seleccionRef.current !== firmaAlIniciar) throw new Error('La selección cambió. Revisa nuevamente antes de confirmar.');
      if (!revisado) { setRevisado(resultado); return; }
      if (!resultado.aplicado) throw new Error('No se confirmó la aplicación.');
      // Ya está confirmado: un fallo de actualización no invita a aplicar de nuevo.
      try {
        await Promise.all([...new Set<string>(seleccion.map(s => s.planId))].map(id => refrescarPlanFinanciero(id, true)));
        if (modo === 'aplicar') await refrescarSaldoAlumno(alumnoId);
        await onApplied?.(reciboOrigen!.id);
      } catch { toast('El vínculo se guardó. Actualiza la consulta para comprobar su presentación.'); }
      toast.success(modo === 'historico' ? 'Vínculo histórico registrado; recibo y monedero conservados.' : `Abono aplicado.${resultado.remanente > 0 ? ` Excedente nuevo: ${dinero(resultado.remanente)}.` : ''}`);
      onClose();
    } catch (e) { setRevisado(null); setAceptado(false); throw e; }
    finally { aplicando.current = false; setGuardando(false); }
  };
  return <ModalConfirmacion isOpen wide type="info" title="Vincular recibo y plan de pagos"
    busy={guardando} confirmDisabled={cargando || cargandoDestinos || Boolean(error || errorDestinos || bloqueoConciliacion) || !detalleOrigen || !seleccion.length || contexto === 'incompleto' || Boolean(revisado && !aceptado)}
    confirmText={revisado ? 'Confirmar vínculo' : 'Revisar vínculo'} onConfirm={confirmar}
    onCancel={() => cerrarProtegido(onClose)} message={<div className="space-y-4 text-left text-sm text-gray-800 dark:text-gray-200">
      <p className="font-semibold">{alumnos.find(a => a.id === alumnoId)?.nombre_completo || plan?.nombre_alumno || recibo?.nombre_alumno}</p>
      {onManual && <button type="button" disabled={guardando} className="text-blue-700 underline dark:text-blue-300" onClick={() => cerrarProtegido(onManual)}>Volver a editar la observación</button>}
      <fieldset disabled={guardando} className="space-y-4 disabled:opacity-70">
        <SelectorPeriodoFinanciero value={periodo} periodos={periodosFinancieros(ciclos, planes)} onChange={p => { setPeriodo(p); setPagina(0); if (!plan) setSeleccion([]); if (!recibo) { setDetalleElegido(''); setRecibos([]); } }} etiqueta={recibo ? 'Periodo de los planes' : 'Periodo de los recibos'} />
        {periodo !== TODOS_PERIODOS && <button type="button" className="text-blue-700 underline dark:text-blue-300" onClick={() => { setPeriodo(TODOS_PERIODOS); setPagina(0); if (!recibo) { setDetalleElegido(''); setRecibos([]); } }}>Buscar en otros periodos</button>}
        {!recibo && <label className="block max-w-xs space-y-1 font-semibold">Buscar folio del recibo<input className={campo} value={folio} placeholder="Ej. 40200" onChange={e => { setFolio(e.target.value.replace(/[^0-9]/g, '')); setPagina(0); setDetalleElegido(''); }} /></label>}
        {cargando ? <p role="status">Consultando…</p> : error ? <div role="alert" className="rounded-lg border border-red-300 p-3 text-red-800 dark:text-red-200">{error}<button className="ml-3 underline" onClick={() => setRevisionConsulta(v => v+1)}>Reintentar</button></div> : <>
          {!recibo && <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-300 p-2 dark:border-gray-600">
            {!recibos.length && <p>No hay recibos en esta consulta. Puedes elegir todos los periodos.</p>}
            {recibos.map(r => <div key={r.id} className="space-y-1 border-b border-gray-200 pb-2 dark:border-gray-700">
              <p className="font-semibold">R-{r.folio} · {ciclos.find(c => c.id === r.ciclo_id)?.nombre || 'Sin ciclo'} · {ciclos.find(c => c.id === r.ciclo_id)?.tipo_periodo} · {r.estatus}</p>
              {r.recibos_detalles.map(d => <label key={d.id} className="flex items-start gap-2 rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                <input type="radio" name="detalle-financiero" aria-label={`Recibo R-${r.folio}: ${d.concepto}, ${dinero(Number(d.subtotal))}`} disabled={r.estatus !== 'ACTIVO'} checked={d.id === detalleElegido} onChange={() => { setDetalleElegido(d.id); setImporte(String(d.subtotal)); }} />
                <span>{d.concepto} · {dinero(Number(d.subtotal))}{d.indice_concepto_plan != null && <small className="block">Referencia histórica de concepto {d.indice_concepto_plan}; el servidor comprobará sus vínculos.</small>}</span>
              </label>)}
            </div>)}
          </div>}
          {!recibo && <div className="flex flex-wrap items-center justify-between gap-2"><button className="min-h-10 rounded-lg border border-gray-300 px-3 disabled:text-gray-500 dark:border-gray-600 dark:disabled:text-gray-400" disabled={!pagina} onClick={() => { setPagina(v => v-1); setDetalleElegido(''); }}>Anterior</button><span aria-label={`Página ${pagina+1} de ${Math.max(1,Math.ceil(total/20))}; ${total} recibos`}>{pagina+1}/{Math.max(1,Math.ceil(total/20))} · {total} {total===1?'recibo':'recibos'}</span><button className="min-h-10 rounded-lg border border-gray-300 px-3 disabled:text-gray-500 dark:border-gray-600 dark:disabled:text-gray-400" disabled={(pagina+1)*20 >= total} onClick={() => { setPagina(v => v+1); setDetalleElegido(''); }}>Siguiente</button></div>}
          {reciboOrigen && detalleOrigen && <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:bg-blue-950"><strong>Origen: R-{reciboOrigen.folio}</strong><p>{ciclos.find(c => c.id === reciboOrigen.ciclo_id)?.nombre || 'Sin ciclo'} · {ciclos.find(c => c.id === reciboOrigen.ciclo_id)?.tipo_periodo} · {detalleOrigen.concepto} · {dinero(Number(detalleOrigen.subtotal))}</p></div>}
          {cargandoDestinos && <p role="status">Comprobando vínculos existentes…</p>}
          {errorDestinos && <p role="alert">No se pudieron comprobar los vínculos: {errorDestinos} <button className="underline" onClick={() => setRevisionConsulta(v => v+1)}>Reintentar</button></p>}
          {destinosActuales.length > 0 && <div className="rounded-lg border border-gray-300 p-3 dark:border-gray-600"><strong>Ya aplicado a:</strong>{destinosActuales.map((d,i) => <p key={i}>{ciclos.find(c=>c.id===d.plan?.ciclo_id)?.nombre || 'Sin periodo'} · {d.plan?.tipo_plan || 'Plan'} · {d.plan?.no_plan_pagos || 'Sin folio'} · Concepto {d.indice_concepto}: {dinero(Number(d.importe))}</p>)}</div>}
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {!planesVisibles.length && <p>No hay planes en este periodo. Cambia el filtro para consultar el historial.</p>}
            {planesVisibles.map(p => <div key={p.id} className="space-y-2 rounded-lg border border-gray-300 p-3 dark:border-gray-600">
              <p className="font-semibold">{describirPlan(p, ciclos)}</p>
              {p.licenciatura && <p>{p.licenciatura} · {p.grado_turno || p.grado || ''}</p>}
              {onVerPlan && <button className="text-blue-700 underline dark:text-blue-300" onClick={() => cerrarProtegido(() => onVerPlan(p.id))}>Ver este plan</button>}
              {conceptosFinancieros(p).filter(c => !plan || c.indice === indice).map(c => {
                const saldo = saldoConcepto(c.cantidad, c.estatus);
                return <label key={c.indice} className="flex items-start gap-2 rounded border border-gray-200 p-2 dark:border-gray-700">
                  <input type={modo === 'historico' ? 'radio' : 'checkbox'} name="concepto-destino" aria-label={`${describirPlan(p, ciclos)}: ${c.indice}. ${c.concepto}`} checked={seleccion.some(s => s.planId === p.id && s.idx === c.indice)}
                    disabled={Boolean(plan)} onChange={() => setSeleccion(prev => modo === 'historico' ? [{ planId:p.id, idx:c.indice }] : prev.some(s => s.planId===p.id && s.idx===c.indice) ? prev.filter(s=>s.planId!==p.id || s.idx!==c.indice) : [...prev, { planId:p.id, idx:c.indice }])} />
                  <span>{c.indice}. {c.concepto}<small className="block">Importe {dinero(c.cantidad)} · {saldo.estado === 'revisar' ? 'Saldo por revisar' : `Pendiente según observación: ${dinero(saldo.pendiente)}`} · {c.estatus}</small></span>
                </label>;
              })}
            </div>)}
          </div>
        </>}
        <label className="block space-y-1 font-semibold">Operación<select className={campo} value={modo} onChange={e => { setModo(e.target.value as typeof modo); setSeleccion(prev => prev.slice(0,1)); }}>
          {historicos && <option value="historico">Registrar vínculo histórico, sin mover monedero</option>}
          <option value="aplicar">{entrePeriodos ? 'Aplicar anticipo disponible y excedente nuevo al monedero' : 'Aplicar importe disponible y excedente nuevo al monedero'}</option>
        </select></label>
        <p className="text-xs text-gray-600 dark:text-gray-300">El ciclo contable, la factura y el importe del recibo se conservan. Entre periodos distintos, Administración o Finanzas debe indicar motivo y respaldo, y revisar el resultado antes de confirmar.</p>
        <p className="text-xs text-gray-600 dark:text-gray-300">Registrar el vínculo histórico reconoce un pago ya realizado. Aplicar un anticipo exige que el importe no se haya utilizado ni abonado al monedero. La revisión final considera los vínculos registrados, además de la observación.</p>
        {modo === 'historico' && <label className="block max-w-xs space-y-1 font-semibold">Importe histórico a vincular<input className={campo} type="number" min="0.01" step="0.01" value={importe} onChange={e => setImporte(e.target.value)} /></label>}
        {entrePeriodos && historicos && <RespaldoConciliacionEntrePeriodos value={respaldo} onChange={setRespaldo} />}
        {bloqueoConciliacion && <p role="status" className="text-sm text-amber-800 dark:text-amber-200">{bloqueoConciliacion}</p>}
        {detalleOrigen && seleccion.length > 0 && contexto === 'incompleto' && <p role="status">Falta identificar un ciclo del recibo o del plan. Corrige su registro antes de vincular.</p>}
      </fieldset>
      {revisado && <div className="space-y-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
        <strong>Revisión antes de guardar</strong>
        {reciboOrigen && <p>Origen: R-{reciboOrigen.folio} · {ciclos.find(c => c.id === reciboOrigen.ciclo_id)?.nombre} (conserva este ciclo).</p>}
        {revisado.destinos.map(d => <p key={`${d.plan_id}/${d.indice}`}>{describirPlan(planes.find(p => p.id===d.plan_id)!, ciclos)} · Concepto {d.indice}: {dinero(d.importe)}</p>)}
        {revisado.disponible_origen !== undefined && <p>Importe del recibo sin vínculo ni excedente registrado: {dinero(revisado.disponible_origen)}. Ya vinculado: {dinero(revisado.aplicado_previamente || 0)}. Excedente previo: {dinero(revisado.excedente_previo || 0)}.</p>}
        {revisado.motivo_conciliacion && <p>Motivo: {MOTIVOS_CONCILIACION.find(m => m.valor === revisado.motivo_conciliacion)?.etiqueta}. Respaldo: {revisado.evidencia}</p>}
        <p>{modo === 'historico' ? `Monedero sin cambios. Remanente histórico no aplicado: ${dinero(revisado.remanente)}.` : `Excedente nuevo al monedero: ${dinero(revisado.remanente)}.`}</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={aceptado} onChange={e => setAceptado(e.target.checked)} />Revisé origen, destino e importes.{modo === 'aplicar' && ' Confirmo que este importe no fue aplicado ni acreditado previamente.'}</label>
      </div>}
    </div>} />;
}
