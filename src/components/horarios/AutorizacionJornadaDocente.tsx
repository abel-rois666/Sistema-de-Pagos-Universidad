import { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import type { AutorizacionJornadaDocente } from '../../horarios/autorizacionesJornada';
import { NOMBRES_DIAS, type DiaHorario } from '../../horarios/types';

interface Props {
  docente: string;
  dia: DiaHorario;
  autorizacion?: AutorizacionJornadaDocente;
  bloqueado: boolean;
  onAutorizar: (motivo: string) => void;
  onRetirar: () => void;
}

export default function AutorizacionJornadaDocente({ docente, dia, autorizacion, bloqueado,
  onAutorizar, onRetirar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const valido = motivo.trim().length >= 10;
  return <div className="mt-3 border-t border-amber-300/60 pt-3 dark:border-amber-800">
    {autorizacion ? <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-800 dark:text-emerald-300">
      <p className="inline-flex items-center gap-1.5 font-semibold"><CheckCircle2 size={16}/> Excepción autorizada para {NOMBRES_DIAS[dia]}</p>
      <button type="button" disabled={bloqueado} onClick={onRetirar}
        className="rounded-md border border-emerald-500 px-2 py-1 text-xs font-semibold disabled:opacity-40">Retirar</button>
      <p className="w-full text-xs">Motivo: {autorizacion.motivo}</p>
    </div> : <>
      {!abierto ? <button type="button" disabled={bloqueado} onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-600 px-3 py-1.5 text-xs font-bold disabled:opacity-40">
        <ShieldCheck size={15}/> Autorizar esta jornada de una hora
      </button> : <div className="space-y-2">
        <label className="block text-xs font-semibold" htmlFor={`motivo-jornada-${docente}-${dia}`}>
          Motivo de la excepción · {docente}, {NOMBRES_DIAS[dia]}
        </label>
        <textarea id={`motivo-jornada-${docente}-${dia}`} value={motivo} onChange={evento => setMotivo(evento.target.value)}
          maxLength={500} rows={2} placeholder="Explica por qué se acepta esta jornada de una hora"
          className="block w-full rounded-md border border-amber-400 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-amber-700 dark:bg-slate-900 dark:text-white"/>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!valido || bloqueado} onClick={() => { onAutorizar(motivo.trim()); setMotivo(''); setAbierto(false); }}
            className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">Confirmar excepción</button>
          <button type="button" onClick={() => setAbierto(false)} className="text-xs font-semibold underline">Cancelar</button>
          {!valido && <span className="text-xs">Escribe al menos 10 caracteres.</span>}
        </div>
      </div>}
    </>}
  </div>;
}
