import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import type { DestinoVinculado } from '../../services/consultaFinancieraService';

/** Solo presenta destinos explícitos; un índice legado nunca se anuncia como número de plan. */
export default function DestinosRecibo({ detalleIds, onVerPlan }: { key?: string; detalleIds: string[]; onVerPlan?: (id: string) => void }) {
  const ciclos = useAppStore(s => s.ciclos);
  const [destinos, setDestinos] = useState<DestinoVinculado[]>([]);
  const [error, setError] = useState(''); const [cargando, setCargando] = useState(false); const [revision, setRevision] = useState(0);
  const clave = detalleIds.join(',');
  useEffect(() => {
    const controller = new AbortController(); let vigente = true;
    setDestinos([]); setError('');
    if (!clave) return;
    setCargando(true);
    void supabase.from('planes_pago_vinculos_recibo').select('plan_id, indice_concepto, importe, plan:planes_pago(no_plan_pagos, ciclo_id, tipo_plan)')
      .in('recibo_detalle_id', clave.split(',')).is('anulado_en', null).order('creado_en').abortSignal(controller.signal)
      .then(({ data, error }) => { if (!vigente) return; if (error) setError(error.message); else setDestinos((data || []) as unknown as DestinoVinculado[]); setCargando(false); });
    return () => { vigente = false; controller.abort(); };
  }, [clave, revision]);
  if (cargando) return <p role="status" className="mb-4 text-sm text-gray-600 dark:text-gray-300">Consultando planes vinculados…</p>;
  if (error) return <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">No se pudieron consultar los destinos. <button onClick={() => setRevision(v=>v+1)} className="underline">Reintentar</button></p>;
  if (!destinos.length) return null;
  return <div className="mb-5 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"><strong>Aplicaciones a planes de pago</strong>
    {destinos.map((d,i) => <div key={i} className="flex flex-wrap items-center justify-between gap-2"><span>{ciclos.find(c=>c.id===d.plan?.ciclo_id)?.nombre || 'Sin periodo'} · {d.plan?.tipo_plan || 'Plan'} · {d.plan?.no_plan_pagos || 'Sin folio'} · Concepto {d.indice_concepto}: ${Number(d.importe).toFixed(2)}</span>
      {onVerPlan && <button className="font-semibold underline" onClick={() => onVerPlan(d.plan_id)}>Ver este plan</button>}
    </div>)}
  </div>;
}
