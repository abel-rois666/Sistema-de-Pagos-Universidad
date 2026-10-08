import { AlertTriangle } from 'lucide-react';
import { docentesElegibles } from '../../horarios/motor';
import { horasTrasAsignar, superaCupoDocente } from '../../horarios/cupoDocente';
import type { DetalleAsignacionAutomatica } from '../../horarios/asignacionAutomatica';
import type { CargaHorario, EntradaHorario, GrupoHorario } from '../../horarios/types';
import { esVacante, etiquetaVacante, siguienteVacante, vacantesDeLicenciatura } from '../../horarios/vacantes';
import { esMateriaComplementaria } from '../../horarios/seleccion';

interface Props {
  entrada: EntradaHorario;
  grupos: GrupoHorario[];
  cargas: CargaHorario[];
  cargasIncluidas: ReadonlySet<string>;
  omitirComplementarias: boolean;
  modo: 'manual' | 'automatico';
  cargasFijas: ReadonlySet<string>;
  detalleAutomatico: Record<string, DetalleAsignacionAutomatica>;
  deshabilitado: boolean;
  bloquearHorasIndividuales: boolean;
  puedeEditarBorrador: boolean;
  onCambiarCarga: (id: string, cambio: Partial<CargaHorario>) => void;
  onSeleccionarDocente: (id: string, docenteId: string | null) => void;
  onReservarVacante: (id: string) => void;
  onEditarCarga: (id: string) => void;
  onAlternarFijacion: (id: string) => void;
  onAlternarMateria: (id: string) => void;
  onOmitirComplementarias: (omitir: boolean) => void;
}

export default function PanelCargasHorario({ entrada, grupos, cargas, cargasIncluidas, modo, cargasFijas,
  omitirComplementarias, detalleAutomatico, deshabilitado, bloquearHorasIndividuales, puedeEditarBorrador,
  onCambiarCarga, onSeleccionarDocente, onReservarVacante, onEditarCarga,
  onAlternarFijacion, onAlternarMateria, onOmitirComplementarias }: Props) {
  const docentesPorId = new Map(entrada.docentes.map(docente => [docente.id, docente]));
  const cargasActivas = cargas.filter(carga => cargasIncluidas.has(carga.id));
  const complementarias = entrada.cargas.filter(esMateriaComplementaria);

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1c2228]">
    <h2 className="text-lg font-bold">2. Revisa cargas y docentes</h2>
    <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
      {modo === 'manual'
        ? 'Elige un docente por materia y ajusta las horas antes de generar el horario.'
        : 'Las asignaciones existentes están fijadas por defecto. Libera una para permitir que el sistema proponga otro docente.'}
      {' '}Desmarca las materias que quieras omitir de este borrador.
    </p>
    {complementarias.length > 0 && <label className="mb-4 flex w-fit cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-slate-100">
      <input type="checkbox" checked={omitirComplementarias} disabled={deshabilitado}
        onChange={evento => onOmitirComplementarias(evento.target.checked)} className="mt-0.5"/>
      <span><strong>Omitir materias complementarias ({complementarias.length})</strong>
        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">Se desmarcan en todos los grupos del ciclo. Puedes publicar el horario sin ellas; sus asignaciones guardadas no se borran.</span>
      </span>
    </label>}
    <div className="space-y-4">{grupos.map(grupo => <div key={grupo.id} className="rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
        <h3 className="font-bold">{grupo.codigo} · {grupo.turno}</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {cargas.filter(carga => carga.grupoId === grupo.id && cargasIncluidas.has(carga.id))
            .reduce((total, carga) => total + (carga.horasPresenciales || 0), 0)} h presenciales incluidas
          {grupo.turno === 'MIXTO' ? ' / 8 h disponibles' : ''}
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {cargas.filter(carga => carga.grupoId === grupo.id).map(carga => {
          const elegibles = docentesElegibles(carga, grupo, entrada.docentes, entrada.ocupacionesExternas, cargasActivas).filter(docente =>
            docente.id === carga.docenteId || new Set(cargas.filter(otra => otra.grupoId === grupo.id && otra.id !== carga.id
              && otra.docenteId === docente.id).map(otra => otra.asignaturaId)).size < 3);
          const actual = docentesPorId.get(carga.docenteId || '');
          const cupoExcedido = actual && carga.horasPresenciales !== 0
            && superaCupoDocente(actual, horasTrasAsignar(actual, carga, cargasActivas, entrada.ocupacionesExternas));
          const vacante = esVacante(carga.docenteId);
          const vacantes = vacantesDeLicenciatura(entrada, grupo);
          const nuevaVacante = siguienteVacante(entrada, grupo);
          const valido = !carga.docenteId || vacante || elegibles.some(docente => docente.id === carga.docenteId);
          const detalle = detalleAutomatico[carga.id];
          const incluida = cargasIncluidas.has(carga.id);
          const complementaria = esMateriaComplementaria(carga);
          return <div key={carga.id} className={`grid gap-3 px-4 py-3 lg:grid-cols-[minmax(180px,1.5fr)_minmax(180px,1fr)_minmax(210px,1.2fr)] lg:items-center ${incluida ? '' : 'bg-slate-50/70 dark:bg-slate-800/30'}`}>
            <div>
              <label className="flex items-start gap-2 font-semibold"><input type="checkbox" checked={incluida}
                disabled={deshabilitado || (complementaria && omitirComplementarias)} onChange={() => onAlternarMateria(carga.id)} className="mt-1"
                aria-label={`Incluir ${carga.asignatura} de ${grupo.codigo} en el horario`}/>
                <span>{carga.asignatura}{complementaria && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">Complementaria</span>}
                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">{incluida ? 'Incluida' : 'Omitida'}</span></span>
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">{carga.horasTotales ?? 'Sin definir'} h por semana</p>
              <label className="mt-2 block text-xs text-slate-500 dark:text-slate-400">Máximo por sesión
                <select value={carga.maxBloque || 4} disabled={deshabilitado || !incluida}
                  onChange={evento => onCambiarCarga(carga.id, { maxBloque: Number(evento.target.value) as 1 | 2 | 3 | 4 })}
                  className="ml-1 rounded-md border border-slate-300 bg-white px-1.5 py-1 dark:border-slate-600 dark:bg-slate-800">
                  {[1, 2, 3, 4].map(horas => <option key={horas} value={horas}>{horas} h</option>)}
                </select>
              </label>
            </div>
            <div>{grupo.turno === 'MIXTO' ? <label className="block text-xs font-medium">Presenciales / asíncronas
              <div className="mt-1 flex items-center gap-2"><input type="number" min="0" max={carga.horasTotales ?? 0} step="1"
                value={carga.horasPresenciales ?? ''} disabled={deshabilitado || !incluida || bloquearHorasIndividuales}
                onChange={evento => { const valor = evento.target.value === '' ? null : Number(evento.target.value);
                  onCambiarCarga(carga.id, { horasPresenciales: valor,
                    horasAsincronas: valor === null || carga.horasTotales === null ? null : carga.horasTotales - valor }); }}
                className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"/>
                <span className="text-sm text-slate-500">/ {carga.horasAsincronas ?? '—'} h</span>
              </div>
            </label> : <p className="text-sm text-slate-500">{carga.horasTotales ?? '—'} h presenciales</p>}</div>
            <div>
              <label className="block text-xs font-medium">Docente o vacante
                <select value={carga.docenteId || ''} disabled={deshabilitado || !incluida}
                  onChange={evento => onSeleccionarDocente(carga.id, evento.target.value || null)}
                  className={`mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm dark:bg-slate-800 ${valido
                    ? 'border-slate-300 dark:border-slate-600' : 'border-amber-500 text-amber-800 dark:text-amber-300'}`}>
                  <option value="">{modo === 'automatico' ? 'Sin asignar; buscar automáticamente' : 'Elegir docente'}</option>
                  {vacantes.map(id => <option key={id} value={id}>{etiquetaVacante(id, grupo)}</option>)}
                  <option value={nuevaVacante}>Crear {etiquetaVacante(nuevaVacante, grupo)} (solo borrador)</option>
                  {vacante && !vacantes.includes(carga.docenteId!) && <option value={carga.docenteId!}>{etiquetaVacante(carga.docenteId!, grupo)}</option>}
                  {actual && !valido && <option value={actual.id}>{actual.nombre} · asignado con conflicto</option>}
                  {elegibles.map(docente => <option key={docente.id} value={docente.id}>{docente.nombre}
                    {docente.asignaturasPreferidas.includes(carga.asignaturaId) ? ' ★ preferida' : ''}
                    {docente.maxHorasSemanales != null
                      ? ` · ${horasTrasAsignar(docente, carga, cargasActivas, entrada.ocupacionesExternas)}/${docente.maxHorasSemanales} h semanales`
                      : ''}</option>)}
                </select>
              </label>
              {modo === 'automatico' && incluida && carga.docenteId && <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={cargasFijas.has(carga.id)} disabled={deshabilitado}
                  onChange={() => onAlternarFijacion(carga.id)}/> {vacante ? 'Conservar esta vacante' : 'Conservar este docente'}
              </label>}
              {incluida && carga.docenteId && !vacante && <button type="button"
                disabled={deshabilitado} onClick={() => onReservarVacante(carga.id)}
                className="mt-2 block text-left text-xs font-semibold text-amber-700 underline underline-offset-2 disabled:opacity-40 dark:text-amber-300">
                Liberar docente y reservar esta materia como vacante
              </button>}
              {incluida && puedeEditarBorrador && <button type="button" onClick={() => onEditarCarga(carga.id)} disabled={deshabilitado}
                className="mt-2 block text-left text-xs font-semibold text-blue-700 underline underline-offset-2 disabled:opacity-40 dark:text-blue-300">
                Revisar asignación en este borrador
              </button>}
              {modo === 'automatico' && incluida && detalle && <p className="mt-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                {detalle.vacante ? 'Propuesta · vacante pendiente' : detalle.fija ? 'Asignación conservada' : detalle.preferida ? 'Propuesta · materia preferida' : 'Propuesta · materia no preferida'}
              </p>}
              {incluida && vacante && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">La materia queda reservada como VACANTE. Vuelve a generar para distribuir las horas; asigna un docente activo antes de publicar.</p>}
              {incluida && !valido && <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle size={12}/> {cupoExcedido
                  ? `Supera el máximo semanal de ${actual?.maxHorasSemanales} h; revisa otras materias o elige otro docente.`
                  : 'Revisa disponibilidad, plan o grupo restringido.'}
              </p>}
              {incluida && !elegibles.length && !esVacante(carga.docenteId) && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No hay docentes elegibles para este ciclo. Puedes reservar el espacio como vacante en el borrador.
              </p>}
            </div>
          </div>;
        })}
        {cargas.some(carga => carga.grupoId === grupo.id)
          && !cargas.some(carga => carga.grupoId === grupo.id && cargasIncluidas.has(carga.id))
          && <p className="p-4 text-sm font-medium text-amber-700 dark:text-amber-300">
            {cargas.filter(carga => carga.grupoId === grupo.id).every(esMateriaComplementaria)
              ? 'Todas las materias de este grupo son complementarias y están omitidas. El grupo quedará sin sesiones en el horario.'
              : 'Este grupo no tiene materias incluidas. Incluye alguna o desmarca el grupo para omitirlo.'}
          </p>}
        {!cargas.some(carga => carga.grupoId === grupo.id) && <p className="p-4 text-sm text-slate-500">
          Este grupo no tiene asignaturas. Configúralas en Control Escolar → Grupos.
        </p>}
      </div>
    </div>)}</div>
  </section>;
}
