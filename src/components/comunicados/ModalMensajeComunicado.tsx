import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { componerMensajeConIngles } from '../../comunicados/preparacion';

export default function ModalMensajeComunicado({ nombre, textoInicial, enlace, avisoIngles,
  inglesRegistrado, materiasIngles, cerrar }: {
  nombre: string;
  textoInicial: string;
  enlace: string;
  avisoIngles: string;
  inglesRegistrado: boolean;
  materiasIngles: string[];
  cerrar: () => void;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [incluirIngles, setIncluirIngles] = useState(inglesRegistrado && Boolean(avisoIngles.trim()));
  const [aviso, setAviso] = useState(avisoIngles);
  const textoFinal = incluirIngles ? componerMensajeConIngles(texto, aviso, enlace) : texto;
  const copiar = async () => {
    if (textoFinal.split(enlace).length !== 2) {
      toast.error('Conserva el enlace individual exactamente una vez en el mensaje.');
      return;
    }
    if (incluirIngles && !aviso.trim()) {
      toast.error('Escribe el aviso de Inglés o desactívalo.');
      return;
    }
    try {
      await navigator.clipboard.writeText(textoFinal.trim());
      toast.success('Mensaje copiado. Pégalo en el chat individual de Telegram.');
      cerrar();
    } catch { toast.error('No se pudo copiar el mensaje.'); }
  };
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-mensaje-comunicado"
      className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#1c2228]">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="titulo-mensaje-comunicado" className="text-lg font-bold">Mensaje para {nombre}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Puedes ajustar este mensaje sin modificar la plantilla compartida.</p></div>
        <button type="button" onClick={cerrar} aria-label="Cerrar mensaje" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20}/></button>
      </div>
      <label className="mt-4 block text-xs font-semibold">Mensaje base
        <textarea value={texto} onChange={evento => setTexto(evento.target.value)} rows={10}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
      </label>
      <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={incluirIngles} onChange={evento => setIncluirIngles(evento.target.checked)} />
          Incluir aviso de Inglés en este mensaje
        </label>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {inglesRegistrado ? `Inscripción del ciclo: ${materiasIngles.join(', ')}.`
            : 'Sin inscripción de Inglés registrada en este ciclo. Puedes incluir el aviso manualmente si corresponde; esto no cambia la inscripción.'}
        </p>
        {incluirIngles && <label className="mt-3 block text-xs font-semibold">Aviso para este alumno
          <textarea value={aviso} onChange={evento => setAviso(evento.target.value)} rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
        </label>}
      </div>
      <div className="mt-3 text-xs"><p className="font-semibold">Vista previa del mensaje completo</p>
        <p className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">{textoFinal}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={cerrar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">Cancelar</button>
        <button type="button" onClick={() => void copiar()} className="inline-flex items-center gap-2 rounded-lg bg-[#1456f0] px-4 py-2 text-sm font-bold text-white"><Copy size={16}/>Copiar mensaje</button>
      </div>
    </div>
  </div>;
}
