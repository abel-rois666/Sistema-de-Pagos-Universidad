import { formatGrado, normalizeGrado } from '../../utils/formatUtils';
import type { AlumnoNuevoGrupo } from '../../utils/nuevoGrupoUtils';

interface Props {
  grados: number[];
  inicio: number | null;
  fin: number | null;
  alumnosSugeridos: AlumnoNuevoGrupo[];
  onChange: (inicio: number | null, fin: number | null) => void;
}

const campo = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1456f0] focus:ring-2 focus:ring-[#1456f0]/15 dark:border-slate-600 dark:bg-slate-800 dark:text-white';

export default function SelectorRangoMultigrado({ grados, inicio, fin, alumnosSugeridos, onChange }: Props) {
  const rangoValido = inicio !== null && fin !== null && inicio <= fin;
  const conteos = new Map<number, number>();
  for (const alumno of alumnosSugeridos) {
    const grado = Number(normalizeGrado(alumno.grado_actual));
    conteos.set(grado, (conteos.get(grado) || 0) + 1);
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="grupo-grado-inicio" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Grado inicial *</label>
          <select id="grupo-grado-inicio" value={inicio ?? ''} onChange={event => onChange(event.target.value ? Number(event.target.value) : null, fin)} className={campo}>
            <option value="">Selecciona...</option>
            {grados.map(numero => <option key={numero} value={numero}>{formatGrado(numero)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="grupo-grado-fin" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Grado final *</label>
          <select id="grupo-grado-fin" value={fin ?? ''} onChange={event => onChange(inicio, event.target.value ? Number(event.target.value) : null)} className={campo}>
            <option value="">Selecciona...</option>
            {grados.map(numero => <option key={numero} value={numero}>{formatGrado(numero)}</option>)}
          </select>
        </div>
      </div>
      {inicio !== null && fin !== null && !rangoValido && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">El grado final debe ser igual o posterior al inicial.</p>}
      {rangoValido && <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Alumnos sugeridos por grado">
        {grados.filter(numero => numero >= inicio && numero <= fin).map(numero =>
          <span key={numero} className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
            {formatGrado(numero)}: {conteos.get(numero) || 0}
          </span>)}
      </div>}
    </div>
  );
}
