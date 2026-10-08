import { encabezadosDias, type SeccionCuadriculaHorario, type VistaHorario } from '../../horarios/cuadricula';

interface Props { secciones: SeccionCuadriculaHorario[]; tipo: VistaHorario['tipo'] }

export default function CuadriculaHorario({ secciones, tipo }: Props) {
  if (!secciones.length) return <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
    Selecciona al menos un {tipo === 'grupos' ? 'grupo' : 'docente o licenciatura con vacantes'} para mostrar el horario.
  </p>;

  return <div className="space-y-6">{secciones.map(seccion => <article key={seccion.id}
    className="rounded-xl border border-slate-300 bg-white p-4 text-slate-900 shadow-sm sm:p-6 dark:border-slate-600">
    <header className="mb-5 space-y-1 text-center">
      {seccion.encabezado.map((linea, indice) => <p key={`${seccion.id}-${indice}`}
        className={indice === 0 ? 'text-base font-bold uppercase sm:text-lg' : 'text-xs font-medium uppercase sm:text-sm'}>
        {linea}
      </p>)}
    </header>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] table-fixed border-collapse text-center text-[11px] sm:text-xs">
        <thead><tr>{encabezadosDias(seccion.dias).map(encabezado => <th key={encabezado}
          className="border border-slate-600 bg-slate-300 px-2 py-2 font-bold">{encabezado}</th>)}</tr></thead>
        <tbody>{seccion.filas.map((fila, indice) => <tr key={`${seccion.id}-${seccion.horas[indice]}`}>
          {fila.map((celda, columna) => <td key={columna}
            className={`h-12 whitespace-pre-line border border-slate-500 px-2 py-1 align-middle ${columna === 0
              ? 'w-28 font-semibold' : seccion.noDisponibles[indice]?.[columna - 1]
                ? 'bg-slate-300 text-slate-600' : celda === 'HORA LIBRE' ? 'bg-slate-100 text-slate-500' : ''}`}
            aria-label={columna > 0 && seccion.noDisponibles[indice]?.[columna - 1] ? 'Docente no disponible' : undefined}>
            {celda}
          </td>)}
        </tr>)}</tbody>
        {tipo === 'docentes' && <tfoot><tr><th className="border border-slate-600 bg-slate-200 px-2 py-2">HORAS POR DÍA</th>
          {seccion.totalesDiarios.map((total, indice) => <td key={seccion.dias[indice]}
            className="border border-slate-600 bg-slate-100 px-2 py-2 font-semibold">{total}</td>)}
        </tr></tfoot>}
      </table>
    </div>
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-center text-[11px] sm:text-xs">
        <thead><tr>{(tipo === 'grupos' ? ['CLAVE', 'HORAS PRES.', 'MATERIA', 'DOCENTE']
          : ['CLAVE', 'HORAS PRES.', 'MATERIA', 'GRUPO']).map(encabezado => <th key={encabezado}
          className="border border-slate-600 bg-slate-300 px-2 py-2 font-bold">{encabezado}</th>)}</tr></thead>
        <tbody>{seccion.materias.map((materia, indice) => <tr key={`${seccion.id}-materia-${indice}`}>
          {materia.map((dato, columna) => <td key={columna} className="border border-slate-500 px-2 py-2">{dato}</td>)}
        </tr>)}</tbody>
        {tipo === 'docentes' && <tfoot><tr><th className="border border-slate-600 bg-slate-200 px-2 py-2">TOTAL</th>
          <td className="border border-slate-600 bg-slate-100 px-2 py-2 font-bold">{seccion.totalesDiarios.reduce((a, b) => a + b, 0)}</td>
          <td colSpan={2} className="border border-slate-600 bg-slate-100" /></tr></tfoot>}
      </table>
    </div>
    {seccion.asincronas.length > 0 && <div className="mt-5 overflow-x-auto">
      <h4 className="mb-2 text-sm font-bold">Trabajo asíncrono sin horario fijo</h4>
      <table className="w-full min-w-[420px] border-collapse text-center text-[11px] sm:text-xs">
        <thead><tr>{(tipo === 'grupos' ? ['MATERIA', 'HORAS / SEMANA']
          : ['MATERIA', 'HORAS / SEMANA', 'GRUPO']).map(encabezado => <th key={encabezado}
          className="border border-slate-600 bg-slate-300 px-2 py-2 font-bold">{encabezado}</th>)}</tr></thead>
        <tbody>{seccion.asincronas.map((fila, indice) => <tr key={`${seccion.id}-asincrona-${indice}`}>
          {fila.map((dato, columna) => <td key={columna} className="border border-slate-500 px-2 py-2">{dato}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
  </article>)}</div>;
}
