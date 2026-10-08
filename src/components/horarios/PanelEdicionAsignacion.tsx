import { ArrowRightLeft, Check, X } from 'lucide-react';
import { docentesElegibles } from '../../horarios/motor';
import type { CambioLocalHorario } from '../../horarios/edicionLocal';
import { NOMBRES_DIAS, type EntradaHorario, type SesionHorario } from '../../horarios/types';
import { etiquetaVacante, siguienteVacante, vacantesDeLicenciatura } from '../../horarios/vacantes';

interface Props {
  entrada: EntradaHorario;
  sesiones: SesionHorario[];
  cargaId: string;
  docenteId: string;
  motivo: string;
  propuesta: CambioLocalHorario | null;
  bloqueado: boolean;
  onSeleccionar: (docenteId: string) => void;
  onReparar: (alcance: 'materia' | 'grupo') => void;
  onAplicar: () => void;
  onCerrar: () => void;
}

const resumir = (sesiones: SesionHorario[], cargaId: string, entrada: EntradaHorario) => sesiones
  .filter(sesion => sesion.cargaId === cargaId)
  .sort((a, b) => a.dia - b.dia || a.inicio - b.inicio)
  .map(sesion => `${NOMBRES_DIAS[sesion.dia]} ${String(sesion.inicio).padStart(2, '0')}:00–${String(sesion.fin).padStart(2, '0')}:00 · ${entrada.docentes.find(d => d.id === sesion.docenteId)?.nombre || etiquetaVacante(sesion.docenteId, entrada.grupos.find(g => g.id === sesion.grupoId))}`)
  .join('; ') || 'Sin horas presenciales';

export default function PanelEdicionAsignacion({ entrada, sesiones, cargaId, docenteId, motivo, propuesta, bloqueado,
  onSeleccionar, onReparar, onAplicar, onCerrar }: Props) {
  const carga = entrada.cargas.find(item => item.id === cargaId);
  const grupo = entrada.grupos.find(item => item.id === carga?.grupoId);
  if (!carga || !grupo) return null;
  const elegibles = docentesElegibles(carga, grupo, entrada.docentes, entrada.ocupacionesExternas,
    entrada.cargas.filter(item => item.id !== carga.id));
  const vacantes = vacantesDeLicenciatura(entrada, grupo);
  const nuevaVacante = siguienteVacante(entrada, grupo);
  const destino = docenteId || carga.docenteId || '';
  const afectadas = propuesta ? propuesta.entrada.cargas.filter(item =>
    resumir(sesiones, item.id, entrada) !== resumir(propuesta.sesiones, item.id, propuesta.entrada)) : [];

  return <section id="edicion-asignacion-horario" className="rounded-2xl border border-blue-300 bg-blue-50/60 p-5 shadow-sm dark:border-blue-800 dark:bg-blue-950/20">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Edición local del borrador</p>
        <h3 className="mt-1 text-lg font-bold">{carga.asignatura} · {grupo.codigo}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">Elige un docente o una vacante concreta. Se revisan sus horas antes de aplicar el cambio.</p>
      </div>
      <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-300 p-2 dark:border-slate-600" aria-label="Cerrar edición de asignación"><X size={17}/></button>
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto] md:items-end">
      <label className="text-xs font-bold">Docente o vacante de {grupo.carreraNombre || grupo.codigo}
        <select value={destino} onChange={event => onSeleccionar(event.target.value)} disabled={bloqueado}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800">
          {!destino && <option value="">Selecciona un destino</option>}
          {destino && !elegibles.some(d => d.id === destino) && !vacantes.includes(destino) && destino !== nuevaVacante
            && <option value={destino}>{entrada.docentes.find(d => d.id === destino)?.nombre || etiquetaVacante(destino, grupo)} · asignación actual</option>}
          {elegibles.map(docente => <option key={docente.id} value={docente.id}>{docente.nombre}
            {docente.asignaturasPreferidas.includes(carga.asignaturaId) ? ' ★ preferida' : ''}</option>)}
          {vacantes.map(id => <option key={id} value={id}>{etiquetaVacante(id, grupo)}</option>)}
          <option value={nuevaVacante}>Crear {etiquetaVacante(nuevaVacante, grupo)}</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onReparar('materia')} disabled={bloqueado || !destino}
          className="rounded-lg border border-blue-400 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-40 dark:text-blue-200">Reacomodar esta materia</button>
        <button type="button" onClick={() => onReparar('grupo')} disabled={bloqueado || !destino}
          className="rounded-lg border border-blue-400 px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-40 dark:text-blue-200">Reacomodar este grupo</button>
      </div>
    </div>
    {motivo && <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <ArrowRightLeft size={15} className="mr-2 inline"/>{motivo} Puedes elegir otra vacante o probar un reacomodo local.</p>}
    {propuesta && <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
      <p className="font-bold text-emerald-900 dark:text-emerald-200">Vista previa válida</p>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{propuesta.motivo} {propuesta.cargasMovidas} materia(s) revisada(s), {propuesta.horasMovidas} hora(s) cambiada(s).
        {propuesta.incidencias.length > 0 && ` Quedan ${propuesta.incidencias.length} observación(es) flexibles.`}</p>
      {afectadas.length > 0 && <div className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs">
        {afectadas.map(item => <div key={item.id} className="rounded-lg bg-white/80 p-2 dark:bg-slate-900/60">
          <p className="font-bold">{item.asignatura} · {entrada.grupos.find(g => g.id === item.grupoId)?.codigo}</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">Antes: {resumir(sesiones, item.id, entrada)}</p>
          <p className="mt-1 text-emerald-800 dark:text-emerald-200">Después: {resumir(propuesta.sesiones, item.id, propuesta.entrada)}</p>
        </div>)}
      </div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onAplicar} disabled={bloqueado}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Check size={16}/> Aplicar al borrador</button>
        <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-600">Cancelar</button>
      </div>
    </div>}
  </section>;
}
