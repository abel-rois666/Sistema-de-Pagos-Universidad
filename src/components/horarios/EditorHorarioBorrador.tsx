import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CornerUpLeft, CornerUpRight, GripVertical, RotateCcw, Scissors } from 'lucide-react';
import toast from 'react-hot-toast';
import { dividirBloque, etiquetaCelda, evaluarDestinoTramo, marcasDocenteHorario, marcasGrupoHorario,
  type DestinoBloque } from '../../horarios/ajusteManual';
import { NOMBRES_DIAS, VENTANAS_TURNO,
  type DiaHorario, type EntradaHorario, type SesionHorario, type VentanaHorario } from '../../horarios/types';
import type { PoliticaHorario } from '../../horarios/politicaHorario';
import { ordenarGruposHorario } from '../../horarios/ordenGruposHorario';
import { opcionesVistaHorario, type VistaHorario } from '../../horarios/cuadricula';

interface Props {
  entrada: EntradaHorario;
  sesiones: SesionHorario[];
  politica: PoliticaHorario;
  vista: VistaHorario;
  activo: boolean;
  ajustado: boolean;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  bloqueado: boolean;
  onActivar: () => void;
  onDesactivar: () => void;
  onCambiar: (sesiones: SesionHorario[]) => void;
  onDeshacer: () => void;
  onRehacer: () => void;
  onRestaurar: () => void;
  onEditarCarga: (cargaId: string) => void;
}

const clave = (dia: DiaHorario, hora: number) => `${dia}:${hora}`;
const hora = (valor: number) => `${String(valor).padStart(2, '0')}:00`;

export default function EditorHorarioBorrador({ entrada, sesiones, politica, vista, activo, ajustado, puedeDeshacer,
  puedeRehacer, bloqueado, onActivar, onDesactivar, onCambiar, onDeshacer, onRehacer, onRestaurar,
  onEditarCarga }: Props) {
  const gruposOrdenados = useMemo(() => ordenarGruposHorario(entrada.grupos), [entrada.grupos]);
  const opciones = useMemo(() => opcionesVistaHorario(entrada, vista.tipo, sesiones)
    .filter(opcion => !vista.ids || vista.ids.includes(opcion.id)), [entrada, vista, sesiones]);
  const [seleccionLocal, setSeleccionLocal] = useState('');
  const entidadId = opciones.some(opcion => opcion.id === seleccionLocal) ? seleccionLocal
    : vista.ids?.find(id => opciones.some(opcion => opcion.id === id)) || opciones[0]?.id || '';
  const [diaMovil, setDiaMovil] = useState<DiaHorario>(1);
  const [indiceElegido, setIndiceElegido] = useState<number | null>(null);
  const [tramoElegido, setTramoElegido] = useState('');
  const [mensajeDestino, setMensajeDestino] = useState('');
  const grupo = vista.tipo === 'grupos' ? gruposOrdenados.find(item => item.id === entidadId) : undefined;
  const ventanas: VentanaHorario[] = grupo ? VENTANAS_TURNO[grupo.turno]
    : vista.tipo === 'docentes' ? Object.values(VENTANAS_TURNO).flat() : [];
  const dias = [...new Set(ventanas.map(ventana => ventana.dia))].sort((a, b) => a - b);
  const diaVisible = dias.includes(diaMovil) ? diaMovil : dias[0];
  const horas = [...new Set(ventanas.flatMap(ventana =>
    Array.from({ length: ventana.fin - ventana.inicio }, (_, indice) => ventana.inicio + indice)))].sort((a, b) => a - b);
  const cargas = useMemo(() => new Map(entrada.cargas.map(carga => [carga.id, carga])), [entrada.cargas]);
  const docentes = useMemo(() => new Map(entrada.docentes.map(docente => [docente.id, docente])), [entrada.docentes]);
  const marcas = useMemo(() => vista.tipo === 'grupos' && grupo
    ? marcasGrupoHorario(entrada, sesiones, grupo.id)
    : vista.tipo === 'docentes' ? marcasDocenteHorario(entrada, sesiones, entidadId) : new Map(),
  [entrada, sesiones, grupo, entidadId, vista.tipo]);
  const elegido = indiceElegido === null ? null : sesiones[indiceElegido];
  const [inicioElegido, duracionElegida] = elegido && tramoElegido
    ? tramoElegido.split(':').map(Number) : [elegido?.inicio || 0, elegido ? elegido.fin - elegido.inicio : 0];
  const tramos = elegido ? Array.from({ length: elegido.fin - elegido.inicio }, (_, indice) => indice + 1)
    .flatMap(duracion => Array.from({ length: elegido.fin - elegido.inicio - duracion + 1 }, (_, paso) => ({
      inicio: elegido.inicio + paso, duracion,
    }))).filter(tramo => tramo.duracion < elegido.fin - elegido.inicio) : [];
  const destinos = useMemo(() => {
    const resultado = new Map<string, DestinoBloque>();
    if (!elegido || indiceElegido === null || (vista.tipo === 'grupos'
      ? elegido.grupoId !== entidadId : elegido.docenteId !== entidadId)) return resultado;
    for (const dia of dias) for (const inicio of horas) resultado.set(clave(dia, inicio),
      evaluarDestinoTramo(entrada, sesiones, indiceElegido, inicioElegido, duracionElegida,
        dia, inicio, false, politica));
    return resultado;
  }, [entrada, sesiones, indiceElegido, entidadId, politica, inicioElegido, duracionElegida, vista.tipo]);

  useEffect(() => {
    if (dias.length && !dias.includes(diaMovil)) setDiaMovil(dias[0]);
  }, [entidadId, vista.tipo]);
  useEffect(() => { setSeleccionLocal(vista.ids?.[0] || ''); }, [vista.tipo, vista.ids?.[0]]);
  useEffect(() => { setIndiceElegido(null); setTramoElegido(''); setMensajeDestino(''); }, [activo, entidadId, vista.tipo]);

  const indiceEn = (dia: DiaHorario, inicio: number) => sesiones.findIndex(sesion =>
    (vista.tipo === 'grupos' ? sesion.grupoId === entidadId : sesion.docenteId === entidadId)
      && sesion.dia === dia && sesion.inicio <= inicio && sesion.fin > inicio);

  const intentarMover = (indice: number, dia: DiaHorario, inicio: number,
    tramoInicio = inicioElegido, duracion = duracionElegida) => {
    if (bloqueado) return;
    const resultado = evaluarDestinoTramo(entrada, sesiones, indice, tramoInicio, duracion,
      dia, inicio, true, politica);
    if (!resultado.permitido || !resultado.sesiones) {
      toast.error(resultado.motivo); setMensajeDestino(resultado.motivo); return;
    }
    if (resultado.sesiones === sesiones) { setIndiceElegido(null); setTramoElegido(''); setMensajeDestino(''); return; }
    onCambiar(resultado.sesiones);
    setIndiceElegido(null); setTramoElegido('');
    setMensajeDestino(resultado.advertencia || `Bloque movido a ${etiquetaCelda(dia, inicio)}.`);
    toast.success(`Bloque movido a ${etiquetaCelda(dia, inicio)}.`);
  };

  const seleccionarOCambiar = (dia: DiaHorario, inicio: number) => {
    if (bloqueado) return;
    const indice = indiceEn(dia, inicio);
    if (indiceElegido === null) {
      if (indice >= 0) { setIndiceElegido(indice); setTramoElegido(''); setMensajeDestino('Elige un destino verde o ámbar. Rojo indica un movimiento bloqueado.'); }
      return;
    }
    if (indice === indiceElegido) { setIndiceElegido(null); setTramoElegido(''); setMensajeDestino(''); return; }
    intentarMover(indiceElegido, dia, inicio);
  };

  const celda = (dia: DiaHorario, inicio: number, movil = false) => {
    const indice = indiceEn(dia, inicio);
    const sesion = indice >= 0 ? sesiones[indice] : null;
    const carga = sesion ? cargas.get(sesion.cargaId) : null;
    const esInicio = sesion?.inicio === inicio;
    const esMismoBloque = indice >= 0 && indice === indiceElegido;
    const esElegido = esMismoBloque && inicio >= inicioElegido && inicio < inicioElegido + duracionElegida;
    const destino = destinos.get(clave(dia, inicio));
    const marcasCelda = marcas.get(clave(dia, inicio));
    const observacion = marcasCelda?.has('hueco') ? `Hueco del ${vista.tipo === 'grupos' ? 'grupo' : 'docente'}`
      : marcasCelda?.has('jornada') ? `Jornada corta del ${vista.tipo === 'grupos' ? 'grupo' : 'docente'}`
        : marcasCelda?.has('docente') ? 'Revisar jornada del docente'
          : marcasCelda?.has('vacante') ? 'Vacante sin docente' : '';
    const docenteVisible = vista.tipo === 'docentes' ? docentes.get(entidadId) : undefined;
    const sinDisponibilidad = docenteVisible?.disponibilidadConocida !== false && docenteVisible && !sesion
      && !docenteVisible.disponibilidad.some(ventana => ventana.dia === dia && ventana.inicio <= inicio && ventana.fin > inicio);
    const estado = esElegido ? 'elegido' : esMismoBloque ? 'ocupado'
      : elegido && (vista.tipo === 'grupos' ? elegido.grupoId === entidadId : elegido.docenteId === entidadId)
      ? destino?.permitido ? destino.advertencia ? 'advertencia' : 'permitido' : 'bloqueado'
      : observacion ? 'observacion' : sesion ? 'ocupado' : sinDisponibilidad ? 'noDisponible' : 'libre';
    const estilos: Record<string, string> = {
      elegido: 'border-blue-600 bg-blue-100 text-blue-950 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/60 dark:text-blue-100',
      permitido: 'border-emerald-400 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-100',
      advertencia: 'border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-100',
      bloqueado: 'border-rose-400 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/45 dark:text-rose-100',
      observacion: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-100',
      ocupado: 'border-blue-200 bg-blue-50 text-slate-900 dark:border-blue-900 dark:bg-blue-950/35 dark:text-slate-100',
      libre: 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#1b2534] dark:text-slate-400 dark:hover:bg-slate-800',
      noDisponible: 'border-slate-300 bg-slate-200 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500',
    };
    const descripcion = esElegido ? 'Tramo seleccionado. Pulsa para cancelar.'
      : esMismoBloque ? 'Esta parte del bloque permanece en su lugar.'
      : elegido ? destino?.motivo || 'Destino no permitido.'
        : observacion || (sesion ? 'Pulsa para mover este bloque.' : 'Hora libre.');
    return <button key={clave(dia, inicio)} type="button"
      draggable={!bloqueado && Boolean(sesion) && (!esMismoBloque || esElegido)} disabled={bloqueado}
      onDragStart={evento => {
        if (indice < 0) return;
        const tramoInicio = indice === indiceElegido ? inicioElegido : sesion!.inicio;
        const duracion = indice === indiceElegido ? duracionElegida : sesion!.fin - sesion!.inicio;
        evento.dataTransfer.setData('text/plain', JSON.stringify({ indice, tramoInicio, duracion }));
        evento.dataTransfer.effectAllowed = 'move';
        if (indice !== indiceElegido) setTramoElegido('');
        setIndiceElegido(indice);
      }}
      onDragOver={evento => {
        evento.preventDefault(); evento.dataTransfer.dropEffect = destino?.permitido ? 'move' : 'none';
        setMensajeDestino(actual => actual === descripcion ? actual : descripcion);
      }}
      onDrop={evento => {
        evento.preventDefault();
        try {
          const origen = JSON.parse(evento.dataTransfer.getData('text/plain')) as {
            indice: number; tramoInicio: number; duracion: number;
          };
          if (Number.isInteger(origen.indice) && origen.indice >= 0 && origen.indice < sesiones.length)
            intentarMover(origen.indice, dia, inicio, origen.tramoInicio, origen.duracion);
        } catch { setMensajeDestino('Selecciona un bloque del horario para moverlo.'); }
      }}
      onClick={() => seleccionarOCambiar(dia, inicio)}
      onMouseEnter={() => setMensajeDestino(descripcion)} onFocus={() => setMensajeDestino(descripcion)}
      title={`${etiquetaCelda(dia, inicio)}: ${descripcion}`}
      aria-label={`${etiquetaCelda(dia, inicio)}. ${carga?.asignatura || 'Sin clase'}. ${descripcion}`}
      className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-1.5 text-center text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${estilos[estado]} ${movil ? 'min-h-20' : ''}`}>
      {sesion ? <>
        {esInicio && <span className="line-clamp-2 font-semibold leading-tight">{carga?.asignatura || 'Asignatura'}</span>}
        {esInicio && <span className="text-[10px] opacity-75">{hora(sesion.inicio)}–{hora(sesion.fin)} · {vista.tipo === 'grupos'
          ? docentes.get(sesion.docenteId)?.nombre || 'VACANTE'
          : `${carga?.asignaturaClave || 'Sin clave'} · ${gruposOrdenados.find(item => item.id === sesion.grupoId)?.codigo || 'Grupo'}`}</span>}
        {!esInicio && <span className="text-[10px] font-medium opacity-70">Continúa · {carga?.asignatura || 'materia'}</span>}
      </> : <span className="text-[10px]">{estado === 'bloqueado' || estado === 'noDisponible' ? 'No disponible' : estado === 'advertencia' ? 'Con aviso' : estado === 'permitido' ? 'Mover aquí' : observacion || '—'}</span>}
      {observacion && !elegido && <AlertTriangle size={12} className="absolute right-1 top-1" aria-hidden="true"/>}
    </button>;
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-[#1c2228]">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Mesa de ajustes</p>
        <h2 className="mt-1 text-lg font-bold">Ajuste manual del borrador</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Mueve bloques desde la vista de grupo o docente. Para cambiar una asignación, selecciona el bloque y usa «Cambiar docente o vacante».</p>
      </div>
      <button type="button" onClick={activo ? onDesactivar : onActivar} aria-pressed={activo} disabled={bloqueado}
        className={`rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${activo
          ? 'border border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200'
          : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
        {activo ? 'Terminar ajuste' : 'Activar ajuste manual'}
      </button>
    </div>
    {ajustado && <p className="mt-3 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-200">Ajustado manualmente · cambios locales del borrador</p>}
    {activo && entidadId && <div className="mt-5 space-y-4 border-t border-slate-200 pt-5 dark:border-slate-700" onKeyDown={evento => {
      if (evento.key === 'Escape') { setIndiceElegido(null); setTramoElegido(''); setMensajeDestino(''); }
    }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-0 text-xs font-semibold">{vista.tipo === 'grupos' ? 'Grupo' : 'Docente o vacante'} para ajustar
          <select value={entidadId} onChange={evento => setSeleccionLocal(evento.target.value)} disabled={bloqueado}
            className="mt-1 block w-full min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
            {opciones.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </label>
        {elegido && tramos.length > 0 && <label className="min-w-52 text-xs font-semibold">Horas a mover juntas
          <select value={tramoElegido} onChange={evento => { setTramoElegido(evento.target.value); setMensajeDestino('Elige el destino del tramo seleccionado.'); }}
            disabled={bloqueado} className="mt-1 block w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-slate-900 dark:border-blue-700 dark:bg-blue-950/40 dark:text-slate-100">
            <option value="">Bloque completo · {hora(elegido.inicio)}–{hora(elegido.fin)}</option>
            {tramos.map(tramo => <option key={`${tramo.inicio}:${tramo.duracion}`} value={`${tramo.inicio}:${tramo.duracion}`}>
              {hora(tramo.inicio)}–{hora(tramo.inicio + tramo.duracion)} · {tramo.duracion} h
            </option>)}
          </select>
        </label>}
        <div className="flex flex-wrap gap-2">
          {elegido && <button type="button" onClick={() => onEditarCarga(elegido.cargaId)} disabled={bloqueado}
            className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-40 dark:border-blue-700 dark:text-blue-200">Cambiar docente o vacante</button>}
          {elegido && <button type="button" onClick={() => { setIndiceElegido(null); setTramoElegido(''); setMensajeDestino(''); }}
            disabled={bloqueado} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-40 dark:border-blue-700 dark:text-blue-200">Cancelar selección</button>}
          <button type="button" onClick={() => { onDeshacer(); setIndiceElegido(null); setTramoElegido(''); }} disabled={bloqueado || !puedeDeshacer}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-600"><CornerUpLeft size={14}/> Deshacer</button>
          <button type="button" onClick={() => { onRehacer(); setIndiceElegido(null); setTramoElegido(''); }} disabled={bloqueado || !puedeRehacer}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-600"><CornerUpRight size={14}/> Rehacer</button>
          <button type="button" onClick={() => {
            if (indiceElegido === null) return;
            const divididas = dividirBloque(sesiones, indiceElegido);
            if (divididas !== sesiones) { onCambiar(divididas); setIndiceElegido(null); setTramoElegido(''); setMensajeDestino('Bloque separado en horas de 60 minutos.'); }
          }} disabled={bloqueado || !elegido || elegido.fin - elegido.inicio <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-slate-600"><Scissors size={14}/> Dividir en horas</button>
          <button type="button" onClick={() => { setIndiceElegido(null); setTramoElegido(''); onRestaurar(); }} disabled={bloqueado || !ajustado}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-40 dark:border-amber-700 dark:text-amber-200"><RotateCcw size={14}/> Restaurar propuesta</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true"/> Permitido</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-amber-500" aria-hidden="true"/> Aviso de hueco o jornada</span>
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-rose-500" aria-hidden="true"/> Bloqueado</span>
        <span><GripVertical size={12} className="inline"/> Arrastra o toca</span>
      </div>
      <p role="status" className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200">
        {mensajeDestino || (elegido ? `${cargas.get(elegido.cargaId)?.asignatura || 'Bloque'} · ${hora(inicioElegido)}–${hora(inicioElegido + duracionElegida)}. Elige destino.`
          : 'Selecciona un bloque. Las celdas con observación se muestran en ámbar.')}
      </p>
      <div className="sm:hidden">
        <label className="block text-xs font-semibold">Día
          <select value={diaVisible} onChange={evento => setDiaMovil(Number(evento.target.value) as DiaHorario)} disabled={bloqueado}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800">
            {dias.map(dia => <option key={dia} value={dia}>{NOMBRES_DIAS[dia]}</option>)}
          </select>
        </label>
        <div className="mt-3 space-y-2">{horas.map(inicio => <div key={inicio} className="grid grid-cols-[90px_1fr] items-stretch gap-2">
          <div className="flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400">{hora(inicio)}–{hora(inicio + 1)}</div>
          {celda(diaVisible, inicio, true)}
        </div>)}</div>
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[600px] table-fixed border-separate border-spacing-1 text-center">
          <thead><tr><th className="w-28 px-1 py-2 text-xs uppercase text-slate-500">Horario</th>
            {dias.map(dia => <th key={dia} className="px-1 py-2 text-xs font-bold uppercase text-slate-700 dark:text-slate-200">{NOMBRES_DIAS[dia]}</th>)}
          </tr></thead>
          <tbody>{horas.map(inicio => <tr key={inicio}><th className="whitespace-nowrap px-1 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{hora(inicio)}–{hora(inicio + 1)}</th>
            {dias.map(dia => <td key={dia} className="p-0.5 align-top">{celda(dia, inicio)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
  </section>;
}
