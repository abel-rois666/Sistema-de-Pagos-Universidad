import { CheckCircle2 } from 'lucide-react';
import type { FichaTitulacion } from '../../types';

type Datos = Pick<FichaTitulacion, 'libro' | 'foja' | 'fecha_inicio_tramite' | 'fecha_estimada_culminacion'>;

interface Props {
  id: string;
  datos: Datos;
  editing: boolean;
  ocupado: boolean;
  diasRestantes: number | null;
  fechaActa: string | null | undefined;
  etiquetaFecha: string;
  folioVisible: string;
  folioPropuesto: string | null;
  ayudaFolio: string;
  pendiente: string | null;
  onFechaInicio: (valor: string) => void;
  onFechaFin: (valor: string) => void;
  onFechaActa: (valor: string) => void;
  onNumero: (campo: 'libro' | 'foja', valor: string) => void;
  onFolio: (valor: string) => void;
  onEditar: () => void;
  onCompletar: () => void;
}

const etiquetaCampo = 'block text-sm font-medium text-gray-800 dark:text-gray-200';
const control = 'block min-h-11 w-full min-w-0 rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-500 dark:bg-[#1c2228] dark:text-gray-100';
const ayuda = 'text-xs text-gray-600 dark:text-gray-300';
const seccion = 'space-y-3 px-4 py-4 sm:px-5';

function valorFecha(fecha?: string | null) {
  if (!fecha) return null;
  const local = new Date(`${fecha}T12:00:00`);
  return Number.isFinite(local.getTime()) ? local.toLocaleDateString('es-MX', { dateStyle: 'medium' }) : fecha;
}

export default function DatosActaTitulacion(p: Props) {
  const camposSeguimiento = [
    { id: `${p.id}-inicio`, nombre: 'Fecha de inicio del trámite', valor: p.datos.fecha_inicio_tramite, onChange: p.onFechaInicio },
    { id: `${p.id}-fin`, nombre: 'Fecha estimada de culminación', valor: p.datos.fecha_estimada_culminacion, onChange: p.onFechaFin, ayuda: 'Se propone a 90 días hábiles del inicio.' },
  ];
  const camposNumericos = [
    { campo: 'libro' as const, nombre: 'Libro Oficial', ejemplo: '001', digitos: 3 },
    { campo: 'foja' as const, nombre: 'Foja Oficial', ejemplo: '0040', digitos: 4 },
  ];

  return <>
    <section className={seccion} aria-labelledby={`${p.id}-seguimiento`}>
      <h4 id={`${p.id}-seguimiento`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">Seguimiento</h4>
      <div className="titulacion-campos">
        {camposSeguimiento.map(campo => <div key={campo.id} className="min-w-0 space-y-1">
          {p.editing ? <>
            <label htmlFor={campo.id} className={etiquetaCampo}>{campo.nombre}</label>
            <input id={campo.id} type="date" className={control} value={campo.valor ?? ''} onChange={e => campo.onChange(e.target.value)} aria-describedby={campo.ayuda ? `${campo.id}-ayuda` : undefined} />
            {campo.ayuda && <p id={`${campo.id}-ayuda`} className={ayuda}>{campo.ayuda}</p>}
          </> : <>
            <p className={etiquetaCampo}>{campo.nombre}</p>
            <p className="break-words text-sm text-gray-700 dark:text-gray-200">{valorFecha(campo.valor) ?? 'Sin fecha registrada'}</p>
          </>}
        </div>)}
      </div>
      {p.diasRestantes !== null && (
        <p className={`text-sm font-medium ${p.diasRestantes > 15 ? 'text-gray-600 dark:text-gray-300' : 'text-amber-800 dark:text-amber-200'}`}>
          {p.diasRestantes <= 0 ? 'Fecha de culminación vencida' : `${p.diasRestantes} días hábiles restantes`}
        </p>
      )}
    </section>

    <section className={`${seccion} border-t border-gray-200 dark:border-gray-700`} aria-labelledby={`${p.id}-oficiales`}>
      <h4 id={`${p.id}-oficiales`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">Datos del acta</h4>
      <div className="titulacion-campos">
        {camposNumericos.map(({campo, nombre, ejemplo, digitos}) => <div key={campo} className="min-w-0 space-y-1">
          {p.editing ? <>
            <label htmlFor={`${p.id}-${campo}`} className={etiquetaCampo}>{nombre}</label>
            <input id={`${p.id}-${campo}`} type="number" min="0" step="1" className={`${control} tabular-nums`} placeholder={ejemplo} value={p.datos[campo] ?? ''} aria-required="true" aria-describedby={`${p.id}-${campo}-ayuda`} onChange={e => p.onNumero(campo, e.target.value)} />
            <p id={`${p.id}-${campo}-ayuda`} className={ayuda}>Formato de {digitos} dígitos en el folio.</p>
          </> : <>
            <p className={etiquetaCampo}>{nombre}</p>
            <p className="text-sm tabular-nums text-gray-700 dark:text-gray-200">{p.datos[campo] ?? 'Sin registrar'}</p>
          </>}
        </div>)}
        <div className="min-w-0 space-y-1">
          {p.editing ? <>
            <label htmlFor={p.id} className={etiquetaCampo}>Folio de Control Oficial</label>
            <input id={p.id} className={`${control} font-mono uppercase`} placeholder={p.folioPropuesto ?? 'Ej. LD-001-0040'} value={p.folioVisible} aria-describedby={`${p.id}-ayuda`} onChange={e => p.onFolio(e.target.value)} />
            <p id={`${p.id}-ayuda`} className={ayuda}>{p.ayudaFolio}</p>
          </> : <>
            <p className={etiquetaCampo}>Folio de Control Oficial</p>
            <p className="break-words text-sm text-gray-700 dark:text-gray-200">{p.folioVisible || p.folioPropuesto || 'Sin folio guardado'}</p>
            {!p.folioVisible && p.folioPropuesto && <p className={ayuda}>Folio propuesto para el cierre.</p>}
          </>}
        </div>
        <div className="min-w-0 space-y-1">
          {p.editing ? <>
            <label htmlFor={`${p.id}-fecha`} className={etiquetaCampo}>{p.etiquetaFecha}</label>
            <input id={`${p.id}-fecha`} type="date" className={control} value={p.fechaActa ?? ''} aria-required="true" onChange={e => p.onFechaActa(e.target.value)} />
          </> : <>
            <p className={etiquetaCampo}>{p.etiquetaFecha}</p>
            <p className="break-words text-sm text-gray-700 dark:text-gray-200">{valorFecha(p.fechaActa) ?? 'Sin fecha registrada'}</p>
          </>}
        </div>
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-5 dark:border-gray-700 dark:bg-[#202936]">
      <p id={`${p.id}-pendientes`} role="status" className={`min-w-0 flex-1 basis-44 text-sm ${p.pendiente ? 'text-amber-900 dark:text-amber-200' : 'text-gray-700 dark:text-gray-200'}`}>
        {p.pendiente ?? 'Revisa el libro, la foja y la fecha antes de confirmar.'}
      </p>
      {!p.editing && p.pendiente && <button type="button" onClick={p.onEditar} className="min-h-10 rounded-lg border border-gray-400 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-700">Editar datos del acta</button>}
      <button type="button" onClick={p.onCompletar} disabled={Boolean(p.pendiente) || p.ocupado} aria-describedby={`${p.id}-pendientes`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:bg-gray-200 disabled:text-gray-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-200 sm:w-auto">
        <CheckCircle2 size={16} aria-hidden="true" /> Asentar acta y titular
      </button>
    </div>
  </>;
}
