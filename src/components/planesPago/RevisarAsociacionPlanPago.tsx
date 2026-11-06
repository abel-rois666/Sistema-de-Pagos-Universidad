import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CicloEscolar, PaymentPlan } from '../../types';
import { revisarReasociacionPlanPago, revisarReasociacionSoloPlanPago, revisarReasociacionConRecibos, type RevisionReasociacionPlanPago } from '../../services/asociacionPlanPagoService';
import ModalConfirmacion from '../ui/ModalConfirmacion';

interface Props {
  plan: PaymentPlan;
  ciclos: readonly CicloEscolar[];
  cicloDestinoId: string;
  onClose: () => void;
  onApplied: () => Promise<void>;
  onViewReceipt?: (folio: string, alumnoId: string) => void;
}

export default function RevisarAsociacionPlanPago({ plan, ciclos, cicloDestinoId, onClose, onApplied, onViewReceipt }: Props) {
  const [revision, setRevision] = useState<RevisionReasociacionPlanPago | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [modo, setModo] = useState<'junto' | 'solo' | 'con_recibos'>('junto');
  const origen = ciclos.find(ciclo => ciclo.id === plan.ciclo_id);
  const destino = ciclos.find(ciclo => ciclo.id === cicloDestinoId);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setRevision(null);
    setError('');
    setModo('junto');
    void revisarReasociacionPlanPago(plan.id, cicloDestinoId)
      .then(async resultado => {
        if (!vigente) return;
        if (resultado.aplicable) { setRevision(resultado); return; }
        // Si la ruta conjunta se bloquea, ofrecer de inmediato la revisión
        // que conserva los recibos y acepta un programa único sin grupo.
        try {
          const alternativa = await revisarReasociacionConRecibos(plan.id, cicloDestinoId);
          if (vigente) { setRevision(alternativa); setModo('con_recibos'); }
        } catch {
          if (vigente) setRevision(resultado);
        }
      })
      .catch(fallo => { if (vigente) setError(fallo instanceof Error ? fallo.message : 'No se pudo revisar la asociación.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [plan.id, cicloDestinoId]);

  const revisarSoloPlan = async () => {
    setCargando(true);
    setError('');
    try {
      const resultado = await revisarReasociacionSoloPlanPago(plan.id, cicloDestinoId);
      setRevision(resultado);
      setModo('solo');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo revisar la opción de conservar recibos.');
    } finally {
      setCargando(false);
    }
  };

  const revisarConRecibos = async () => {
    setCargando(true);
    setError('');
    try {
      const resultado = await revisarReasociacionConRecibos(plan.id, cicloDestinoId);
      setRevision(resultado);
      setModo('con_recibos');
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo revisar la opción de conservar recibos.');
    } finally {
      setCargando(false);
    }
  };

  const aplicar = async () => {
    setConfirmar(false);
    setAplicando(true);
    try {
      const resultado = modo === 'solo'
        ? await revisarReasociacionSoloPlanPago(plan.id, cicloDestinoId, true)
        : modo === 'con_recibos'
          ? await revisarReasociacionConRecibos(plan.id, cicloDestinoId, true)
          : await revisarReasociacionPlanPago(plan.id, cicloDestinoId, true);
      if (!resultado.aplicado) throw new Error('El servidor no confirmó la corrección.');
      await onApplied();
      toast.success(modo === 'junto' ? 'Asociación corregida y registrada en auditoría.'
        : 'Plan reasociado; los recibos se conservaron en su ciclo anterior.');
      onClose();
    } catch (fallo) {
      const mensaje = fallo instanceof Error ? fallo.message : 'No se pudo corregir la asociación.';
      toast.error(mensaje);
      setError(mensaje);
    } finally {
      setAplicando(false);
    }
  };

  return <>
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="revision-plan-titulo">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#1c2228]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">Revisión financiera</p>
            <h2 id="revision-plan-titulo" className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Asociación del plan de pagos</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.nombre_alumno} · {plan.no_plan_pagos}</p>
          </div>
          <button type="button" onClick={onClose} disabled={aplicando} aria-label="Cerrar revisión" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={19} /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div><p className="text-[11px] font-bold uppercase text-slate-500">Registrado</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{origen?.nombre || 'Ciclo desconocido'}</p><p className="text-xs text-slate-500">{origen?.tipo_periodo || 'Sin tipo'} · {plan.tipo_plan}</p></div>
            <ArrowRight size={19} className="text-blue-600" />
            <div><p className="text-[11px] font-bold uppercase text-slate-500">Propuesto</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{destino?.nombre || 'Ciclo desconocido'}</p><p className="text-xs text-slate-500">{destino?.tipo_periodo || 'Sin tipo'}</p></div>
          </div>
          {cargando ? <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Loader2 size={16} className="animate-spin" /> Comprobando plan académico, grupo y recibos…</p>
            : error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{error}</p>
              : revision?.aplicable ? <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200"><CheckCircle2 size={18} /> Asociación comprobada</p>
                {revision.criterio_asociacion === 'PROGRAMA_VIGENTE' &&
                  <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">El alumno aún no tiene grupo en el destino. Su único programa de estudios vigente confirma la periodicidad; el grupo no se creará ni modificará.</p>}
                <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">Se cambiará el tipo y el ID del plan. {modo === 'solo'
                  ? `${revision.recibos_en_origen} recibo(s) permanecerán en el ciclo anterior: folios ${revision.folios.join(', ')}. Sus pagos no se atribuirán al plan corregido; revísalos por separado.`
                  : modo === 'con_recibos'
                    ? `${revision.recibos_en_origen} recibo(s) conservarán su ciclo, folio y estado fiscal. ${revision.detalles_pendientes_conciliar || 0} detalle(s) con índice legado y ${revision.estados_cobrados_conservados || 0} estado(s) cobrado(s) requieren revisión de sus vínculos. Los estados de pago del plan se conservarán.`
                  : revision.recibos_en_origen === 0 ? 'No hay recibos de este ciclo para mover.'
                    : `Se reasociarán ${revision.recibos_en_origen} recibo(s) vinculados: folios ${revision.folios.join(', ')}.`}</p>
              </div> : <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200"><AlertTriangle size={18} /> Revisión individual necesaria</p>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">{revision?.motivo}</p>
                {revision?.programas_vigentes !== undefined &&
                  <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                    Programas vigentes: {revision.programas_vigentes}. Planes académicos en grupos del destino: {revision.grupos_destino ?? 0}.
                  </p>}
                {!!revision?.folios.length && <div className="mt-3 flex flex-wrap gap-2">{revision.folios.map(folio =>
                  <button key={folio} type="button" disabled={!onViewReceipt} onClick={() => {
                    if (plan.alumno_id) { onClose(); onViewReceipt?.(String(folio), plan.alumno_id); }
                  }} className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-950 enabled:hover:bg-amber-100 disabled:cursor-default dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200">
                    Folio {folio}
                  </button>)}</div>}
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">El plan y sus recibos se conservan como están.</p>
                {modo === 'junto' && <div className="mt-3 flex flex-wrap gap-2">
                  {!!revision?.folios.length && <button type="button" onClick={() => void revisarSoloPlan()}
                    className="rounded-lg border border-amber-600 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-200">
                    Revisar opción de mover solo el plan
                  </button>}
                  <button type="button" onClick={() => void revisarConRecibos()}
                    className="rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100 dark:text-blue-200">
                    Revisar conservando recibos y pagos
                  </button>
                </div>}
                {modo === 'solo' && <button type="button" onClick={() => void revisarConRecibos()}
                  className="mt-3 rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-100 dark:text-blue-200">
                  Revisar conservando recibos y pagos
                </button>}
              </div>}
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Esta revisión no modifica importes, conceptos, folios, estados de pago ni detalles. Los recibos históricos de otros ciclos se conservan.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/40">
          <button type="button" onClick={onClose} disabled={aplicando} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Cerrar</button>
          <button type="button" onClick={() => setConfirmar(true)} disabled={!revision?.aplicable || cargando || aplicando} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{aplicando ? 'Corrigiendo…' : modo === 'junto' ? 'Corregir asociación' : 'Mover solo el plan'}</button>
        </div>
      </div>
    </div>
    <ModalConfirmacion isOpen={confirmar} title="Confirmar reasociación" type="warning"
      message={modo === 'solo'
        ? `Se moverá solo el plan al ciclo ${destino?.nombre} · ${destino?.tipo_periodo}. Los ${revision?.recibos_en_origen ?? 0} recibos quedarán en el ciclo anterior y sus pagos no se reflejarán en este plan. La función volverá a validar antes de aplicar.`
        : modo === 'con_recibos'
          ? `Se moverá solo el plan al ciclo ${destino?.nombre} · ${destino?.tipo_periodo}. Los recibos, la facturación y los estados de pago no cambiarán. Los vínculos legados requerirán conciliación explícita después. La función volverá a validar antes de aplicar.`
        : `Se registrará el cambio del plan al ciclo ${destino?.nombre} · ${destino?.tipo_periodo}${revision?.recibos_en_origen ? ` y de ${revision.recibos_en_origen} recibo(s) comprobados` : ''}. La función volverá a validar todos los datos antes de aplicar.`}
      confirmText="Confirmar corrección" onCancel={() => setConfirmar(false)} onConfirm={() => void aplicar()} />
  </>;
}
