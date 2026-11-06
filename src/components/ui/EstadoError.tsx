interface Props { mensaje: string; onReintentar?: () => void }

/** Un fallo de consulta se distingue de una población vacía. */
export default function EstadoError({ mensaje, onReintentar }: Props) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
    <p className="font-semibold">No se pudo completar la consulta</p>
    <p className="mt-1">{mensaje}</p>
    {onReintentar && <button type="button" onClick={onReintentar} className="mt-3 rounded-lg border border-current px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">Reintentar</button>}
  </div>;
}
