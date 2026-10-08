interface Props {
  cantidad: number;
  modo: 'individual' | 'iguales';
  horas: string;
  deshabilitado: boolean;
  onModo: (modo: 'individual' | 'iguales') => void;
  onHoras: (horas: string) => void;
  onAplicar: () => void;
}

export default function RepartoHorasMixto({ cantidad, modo, horas, deshabilitado,
  onModo, onHoras, onAplicar }: Props) {
  if (!cantidad) return null;
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]">
    <h2 className="text-lg font-bold">Horas presenciales de grupos Mixtos</h2>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
      Define el reparto de las {cantidad} materias Mixtas incluidas. El resto de horas semanales quedará como trabajo asíncrono.
    </p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm">
      <label className="flex items-center gap-2"><input type="radio" name="modo-horas-mixto" checked={modo === 'individual'}
        disabled={deshabilitado} onChange={() => onModo('individual')}/> Una por una</label>
      <label className="flex items-center gap-2"><input type="radio" name="modo-horas-mixto" checked={modo === 'iguales'}
        disabled={deshabilitado} onChange={() => onModo('iguales')}/> Mismas horas para todas</label>
    </div>
    {modo === 'iguales' && <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold">Horas presenciales por materia
        <input type="number" min="0" max="8" step="1" value={horas} disabled={deshabilitado}
          onChange={evento => onHoras(evento.target.value)}
          className="mt-1 block w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"/>
      </label>
      <button type="button" onClick={onAplicar} disabled={deshabilitado}
        className="rounded-lg bg-[#1456f0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        Aplicar a {cantidad} materias
      </button>
      <p className="w-full text-xs text-slate-500 dark:text-slate-400">
        Se comprobará que ninguna materia exceda sus horas semanales ni el grupo supere ocho horas presenciales el sábado.
      </p>
    </div>}
  </section>;
}
