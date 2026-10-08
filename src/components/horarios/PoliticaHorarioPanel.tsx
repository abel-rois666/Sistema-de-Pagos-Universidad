import type { MetricasHorario } from '../../horarios/evaluacionHorario';
import type { PoliticaHorario } from '../../horarios/politicaHorario';

export interface ResumenPoliticaHorario {
  metricas: MetricasHorario | null;
  exhaustiva: boolean;
  soluciones: number;
}

interface Props {
  politica: PoliticaHorario;
  resultados: Partial<Record<PoliticaHorario, ResumenPoliticaHorario>>;
  deshabilitado: boolean;
  onCambiar: (politica: PoliticaHorario) => void;
}

const opciones: { id: PoliticaHorario; descripcion: string }[] = [
  { id: 'flexible', descripcion: 'Prioriza menos vacantes. Los huecos y mínimos diarios aparecen como avisos.' },
  { id: 'estricto', descripcion: 'Exige huecos y mínimos diarios. Puede necesitar más vacantes si las permites.' },
];

export default function PoliticaHorarioPanel({ politica, resultados, deshabilitado, onCambiar }: Props) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]">
    <h2 className="text-lg font-bold">Cumplimiento de la jornada</h2>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Se aplica tanto a la asignación manual como a la automática. Los empalmes, turnos, disponibilidad y cupo siempre son obligatorios.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Política de cumplimiento del horario">
      {opciones.map(opcion => <label key={opcion.id} className={`cursor-pointer rounded-xl border p-4 transition-colors ${politica === opcion.id
        ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
        : 'border-slate-300 hover:border-blue-300 dark:border-slate-600 dark:hover:border-blue-700'}`}>
        <span className="flex items-center gap-2 font-semibold"><input type="radio" name="politica-horario" value={opcion.id}
          checked={politica === opcion.id} disabled={deshabilitado} onChange={() => onCambiar(opcion.id)}/>
          {opcion.id === 'flexible' ? 'Flexible' : 'Estricto'}</span>
        <span className="mt-1 block pl-6 text-sm text-slate-600 dark:text-slate-300">{opcion.descripcion}</span>
      </label>)}
    </div>
    {(resultados.flexible || resultados.estricto) && <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
      <h3 className="text-sm font-bold">Comparación de búsquedas de esta selección</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{opciones.map(opcion => {
        const resultado = resultados[opcion.id];
        return <div key={opcion.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40">
          <p className="font-bold">{opcion.id === 'flexible' ? 'Flexible' : 'Estricto'}</p>
          {!resultado ? <p className="mt-1 text-slate-500 dark:text-slate-400">Aún no se ha buscado.</p>
            : resultado.metricas ? <p className="mt-1 text-slate-700 dark:text-slate-200">
              {resultado.metricas.vacantes} vacante(s) · {resultado.metricas.jornadasCortasGrupo} jornada(s) corta(s) de grupo · {resultado.metricas.huecosGrupo} hora(s) libres de grupo<br/>
              {resultado.metricas.jornadasCortasDocente} jornada(s) corta(s) de docente · {resultado.metricas.huecosDocente} hora(s) libres de docente
            </p> : <p className="mt-1 text-amber-800 dark:text-amber-300">Sin propuesta completa {resultado.exhaustiva ? 'tras revisar las combinaciones exploradas' : 'dentro del límite de búsqueda'}.</p>}
          {resultado && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{resultado.soluciones} horario(s) completos revisados · Búsqueda {resultado.exhaustiva ? 'completa' : 'acotada'}</p>}
        </div>;
      })}</div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Las cifras comparan la mejor propuesta encontrada en cada búsqueda antes de ajustes manuales. No cambian datos publicados.</p>
    </div>}
  </section>;
}
