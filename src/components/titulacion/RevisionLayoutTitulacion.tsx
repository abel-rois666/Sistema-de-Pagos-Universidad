import {useEffect, useId, useRef, type ReactNode} from 'react';

export function AvisoDatosPropuestosTitulacion() {
  return <aside className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
    <h2 className="font-semibold">Datos propuestos para revisar</h2>
    <p className="mt-1">Las fechas de carrera proceden de los ciclos del historial de materias: contrástalas con los documentos oficiales. La expedición se propone con el día de incorporación al lote y el correo se toma de la ficha del alumno. Puedes corregirlos aquí.</p>
  </aside>;
}

export function IncidenciasLayoutTitulacion({errores}: {errores: string[]}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!errores.length) return;
    ref.current?.focus({preventScroll:true});
    ref.current?.scrollIntoView({block:'center',behavior:'instant'});
  }, [errores]);
  if (!errores.length) return null;
  return <section ref={ref} tabIndex={-1} role="alert" aria-label="Datos por corregir" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-700 dark:bg-red-950/30 dark:text-red-100">
    <h2 className="font-semibold">Revisa estos datos antes de exportar</h2>
    <p className="mt-1">Corrige aquí los campos de exportación. Nombre y CURP se revisan en la ficha del alumno; las claves institucionales y de carrera, en Configuración y Planes de estudio.</p>
    <ul className="mt-2 max-h-64 space-y-1 overflow-auto break-words">{errores.map((error,i)=><li key={i}>{error}</li>)}</ul>
  </section>;
}

export default function RevisionLayoutTitulacion({revisado, onRevisar, cantidad, busy, pendiente, children}: {
  revisado: boolean; onRevisar: (valor:boolean)=>void; cantidad: number; busy: boolean; pendiente: boolean; children: ReactNode;
}) {
  const id = useId();
  const casilla = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!pendiente) return;
    casilla.current?.focus({preventScroll:true});
    casilla.current?.scrollIntoView({block:'center',behavior:'instant'});
  },[pendiente]);
  return <section aria-label="Revisión final del lote" className="space-y-4 rounded-xl border border-gray-300 bg-white p-4 text-sm text-gray-700 dark:border-gray-600 dark:bg-[#1c2228] dark:text-gray-200 sm:p-5">
    <div><h2 className="font-semibold text-gray-900 dark:text-gray-100">Revisión final del lote · {cantidad} {cantidad===1?'registro':'registros'}</h2>
      <p id={`${id}-alcance`} className="mt-1 leading-relaxed">Comprueba las fechas de antecedente, carrera, examen o exención y expedición, junto con el correo de cada registro, antes de generar el archivo.</p></div>
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-300 p-3 dark:border-gray-500">
      <input ref={casilla} type="checkbox" checked={revisado} disabled={busy} onChange={e=>onRevisar(e.target.checked)} aria-invalid={pendiente || undefined} aria-describedby={`${id}-alcance ${id}-ayuda${pendiente?` ${id}-error`:''}`} className="mt-0.5 h-5 w-5 shrink-0 accent-blue-600"/>
      <span className="font-medium text-gray-800 dark:text-gray-100">Revisé las fechas oficiales y el correo de {cantidad===1?'este registro':`los ${cantidad} registros de este lote`}.</span>
    </label>
    {pendiente && <p id={`${id}-error`} role="alert" className="font-medium text-red-700 dark:text-red-300">Confirma la revisión de fechas y correo antes de exportar.</p>}
    <div className="flex flex-col gap-4 border-t border-gray-200 pt-4 dark:border-gray-600 sm:flex-row sm:items-center sm:justify-between">
      <p id={`${id}-ayuda`} className="max-w-xl text-xs leading-relaxed text-gray-600 dark:text-gray-300">{revisado?'Revisión confirmada para el lote actual.':'Marca la revisión al terminar de comprobar todos los registros.'} Si cambias los datos o los firmantes, tendrás que confirmarla nuevamente.</p>
      {children}
    </div>
  </section>;
}
