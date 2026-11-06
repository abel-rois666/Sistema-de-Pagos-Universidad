import { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { componerMensajeConIngles, renderizarAvisoIngles, renderizarPlantillaMensaje,
  validarPlantillaIngles, validarPlantillaMensaje, type PlantillasComunicado } from '../../comunicados/preparacion';

const ejemplo = {
  nombre: 'ALDERETE BAZÁN SUSANA GABRIELA', matricula: 'LA-2025-12258',
  ciclo: '2027-1', ciclo_boleta: '2026-3', enlace: 'https://drive.google.com/drive/folders/ejemplo',
};

export default function PlantillaMensajeComunicado({ plantilla, deshabilitado, guardar }: {
  plantilla: PlantillasComunicado;
  deshabilitado: boolean;
  guardar: (contenido: PlantillasComunicado) => Promise<void>;
}) {
  const [borrador, setBorrador] = useState(plantilla);
  const [guardando, setGuardando] = useState(false);
  const anterior = useRef(plantilla);
  useEffect(() => {
    const previo = anterior.current;
    setBorrador(actual => ({
      contenido: actual.contenido === previo.contenido ? plantilla.contenido : actual.contenido,
      contenido_nuevo_ingreso: actual.contenido_nuevo_ingreso === previo.contenido_nuevo_ingreso
        ? plantilla.contenido_nuevo_ingreso : actual.contenido_nuevo_ingreso,
      contenido_ingles: actual.contenido_ingles === previo.contenido_ingles
        ? plantilla.contenido_ingles : actual.contenido_ingles,
    }));
    anterior.current = plantilla;
  }, [plantilla]);
  const error = validarPlantillaMensaje(borrador.contenido)
    || validarPlantillaMensaje(borrador.contenido_nuevo_ingreso, false)
    || validarPlantillaIngles(borrador.contenido_ingles);
  const cambiado = (Object.keys(plantilla) as (keyof PlantillasComunicado)[])
    .some(clave => borrador[clave].trim() !== plantilla[clave].trim());
  const base = error ? '' : renderizarPlantillaMensaje(borrador.contenido_nuevo_ingreso, ejemplo);
  const aviso = error ? '' : renderizarAvisoIngles(borrador.contenido_ingles, ejemplo, ['Inglés V']);

  const guardarCambios = async () => {
    if (error || !cambiado) return;
    setGuardando(true);
    try {
      await guardar({ contenido: borrador.contenido.trim(),
        contenido_nuevo_ingreso: borrador.contenido_nuevo_ingreso.trim(),
        contenido_ingles: borrador.contenido_ingles.trim() });
      toast.success('Plantillas guardadas para los usuarios autorizados.');
    } catch (fallo) { toast.error(fallo instanceof Error ? fallo.message : 'No se pudieron guardar las plantillas.'); }
    finally { setGuardando(false); }
  };

  return <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#1c2228]">
    <summary className="cursor-pointer text-sm font-bold text-slate-900 dark:text-slate-100">Plantillas del mensaje de Telegram</summary>
    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
      Configura el mensaje con boleta, el de nuevo ingreso y un aviso opcional de Inglés. Se comparten entre usuarios autorizados.
    </p>
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
      Campos: {'{nombre}'}, {'{matricula}'}, {'{ciclo}'}, {'{ciclo_boleta}'} y {'{enlace}'}.
      El aviso admite {'{materias_ingles}'} y se agrega solo a los alumnos seleccionados.
    </p>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Alumnos con boleta
        <textarea value={borrador.contenido} onChange={evento => setBorrador(actual => ({ ...actual, contenido: evento.target.value }))}
          rows={7} maxLength={3000} disabled={deshabilitado || guardando}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
      </label>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Nuevo ingreso sin boleta
        <textarea value={borrador.contenido_nuevo_ingreso}
          onChange={evento => setBorrador(actual => ({ ...actual, contenido_nuevo_ingreso: evento.target.value }))}
          rows={7} maxLength={3000} disabled={deshabilitado || guardando}
          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
      </label>
    </div>
    <label className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-200">Aviso opcional de Inglés
      <textarea value={borrador.contenido_ingles}
        onChange={evento => setBorrador(actual => ({ ...actual, contenido_ingles: evento.target.value }))}
        rows={3} maxLength={1000} disabled={deshabilitado || guardando}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
    </label>
    {error && <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">{error}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void guardarCambios()} disabled={Boolean(error) || !cambiado || guardando || deshabilitado}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1456f0] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
        <Save size={15} />{guardando ? 'Guardando…' : 'Guardar plantillas'}
      </button>
      {cambiado && <button type="button" onClick={() => setBorrador(plantilla)} disabled={guardando}
        className="text-xs font-semibold text-slate-600 dark:text-slate-300">Descartar cambios</button>}
    </div>
    {base && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Vista previa: nuevo ingreso con Inglés</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100">
        {componerMensajeConIngles(base, aviso, ejemplo.enlace)}
      </p>
    </div>}
  </details>;
}
