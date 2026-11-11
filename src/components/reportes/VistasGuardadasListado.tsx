import { useState } from 'react';
import { RefreshCw, Save, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import { CampoConAyuda } from '../ui/AyudaContextual';
import { configuracionInicialListado, firmaVista, type ConfiguracionVistaListado, type VistaListado } from '../../reportes/vistasListado';
import type { useVistasListado } from '../../hooks/useVistasListado';
import './vistasGuardadasListado.css';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';

export default function VistasGuardadasListado({ gestion: g, actual, edadHoy, onEdadHoy }: {
  gestion: ReturnType<typeof useVistasListado>; actual: ConfiguracionVistaListado; edadHoy: boolean; onEdadHoy: (valor: boolean) => void;
}) {
  const [edicion, setEdicion] = useState<{ id: string; original?: VistaListado; nombre: string; predeterminada: boolean; config: ConfiguracionVistaListado } | null>(null);
  const [aplicar, setAplicar] = useState<VistaListado | 'inicial' | null>(null), [eliminar, setEliminar] = useState<VistaListado | null>(null);
  const [descartar, setDescartar] = useState(false);
  const edicionModificada=Boolean(edicion&&(edicion.nombre!==(edicion.original?.nombre||'')||edicion.predeterminada!==(edicion.original?.predeterminada||false)));
  useProteccionCaptura(edicionModificada,g.busy);
  const nueva = (original?: VistaListado) => setEdicion({ id: original?.id || crypto.randomUUID(), original,
    nombre: original?.nombre || '', predeterminada: original?.predeterminada || false, config: structuredClone(actual) });
  const cambiar = (id: string) => {
    const vista = g.vistas.find(v => v.id === id); if (!vista) return;
    if (firmaVista(actual) === firmaVista(vista.configuracion)) g.aplicar(vista); else setAplicar(vista);
  };
  return <section className="listado-vistas" aria-label="Vistas guardadas del listado">
    <div className="listado-vistas-barra">
      <div className="listado-vistas-selector"><CampoConAyuda etiqueta="Vista guardada" ayuda="Guarda columnas, filtros y orden para reutilizarlos con tu cuenta, también en otro dispositivo. Una vista predeterminada se aplica al entrar; no guarda copias de alumnos.">
        <SelectorBusqueda id="vista-guardada-listado" etiqueta="Vista guardada" value={g.seleccion} disabled={g.loading || g.busy || Boolean(g.error)}
          placeholder={g.loading ? 'Consultando vistas…' : 'Consulta personalizada'} onChange={cambiar}
          opciones={g.vistas.map(v => ({ value: v.id, label: v.nombre + (v.predeterminada ? ' · Predeterminada' : '') }))} />
      </CampoConAyuda></div>
      <div className="listado-vistas-acciones">
        <button type="button" disabled={g.loading || g.busy || Boolean(g.error)} onClick={() => nueva()}><Save size={15} />Guardar como nueva</button>
        {g.elegida && <button type="button" disabled={g.busy || Boolean(g.error)} onClick={() => nueva(g.elegida)}>Actualizar vista</button>}
        <button type="button" disabled={g.busy} onClick={() => firmaVista(actual) === firmaVista(configuracionInicialListado()) ? g.restablecer(configuracionInicialListado()) : setAplicar('inicial')}><RotateCcw size={15} />Restablecer consulta</button>
      </div>
    </div>
    <div className="listado-vistas-pie"><p>{g.elegida ? `${g.elegida.nombre}${g.conCambios ? ' · Con cambios sin guardar' : ' · Aplicada'}` : 'Las vistas son privadas. Guarda esta consulta para volver a utilizarla.'}</p>
      <div className="listado-vistas-acciones"><button type="button" disabled={g.busy || g.loading} onClick={g.recargar}><RefreshCw size={14}/>Actualizar vistas</button>
      {g.elegida && <button type="button" disabled={g.busy || Boolean(g.error)} onClick={() => setEliminar(g.elegida!)}>Eliminar vista guardada</button>}</div>
    </div>
    {actual.columnas.includes('edad') && <label className="listado-vistas-fecha"><input type="checkbox" checked={edadHoy} onChange={e => onEdadHoy(e.target.checked)} disabled={g.busy} />Calcular la edad al día de consulta al cargar la vista</label>}
    {g.error && <div role="alert" className="listado-vistas-error"><p>{g.error}</p><button type="button" onClick={g.recargar}><RefreshCw size={14} />Reintentar vistas</button></div>}
    <ModalConfirmacion isOpen={Boolean(edicion)} title={edicion?.original ? 'Actualizar vista guardada' : 'Guardar vista del listado'}
      type="info" busy={g.busy} confirmText="Guardar vista" confirmDisabled={!edicion || edicion.nombre.trim().length < 2 || edicion.nombre.trim().length > 80}
      onCancel={() => edicionModificada?setDescartar(true):setEdicion(null)} onConfirm={async () => {
        if (!edicion) return;
        await g.guardar(edicion.id, edicion.original, edicion.nombre, edicion.config, edicion.predeterminada);
        setEdicion(null); toast.success('Vista guardada en tu cuenta.');
      }} message={edicion && <div className="listado-vistas-formulario">
        <p>Se guardarán las columnas, los filtros y el orden de esta consulta. Los alumnos y sus datos se conservan.</p>
        <label>Nombre de la vista<input autoComplete="off" maxLength={80} value={edicion.nombre} onChange={e => setEdicion({ ...edicion, nombre: e.target.value })} placeholder="Por ejemplo: Certificados pendientes" /></label>
        <label className="listado-vistas-check"><input type="checkbox" checked={edicion.predeterminada} onChange={e => setEdicion({ ...edicion, predeterminada: e.target.checked })} />Usar al entrar al Listado General</label>
        <p>{edicion.config.columnas.length + 5} columnas · {(Object.values(edicion.config.filtros) as string[][]).reduce((n, v) => n + v.length, 0)} selecciones en filtros principales. Los filtros de columnas también se conservarán.</p>
      </div>} />
    <ModalConfirmacion isOpen={descartar} title="Descartar nombre y opciones de la vista" message="Se cerrará esta captura sin guardar la vista. Los filtros del listado se conservan." onCancel={() => setDescartar(false)} onConfirm={() => { setDescartar(false); setEdicion(null); }} confirmText="Descartar captura" />
    <ModalConfirmacion isOpen={Boolean(aplicar)} title={aplicar === 'inicial' ? 'Restablecer consulta del listado' : 'Aplicar vista guardada'}
      message={aplicar === 'inicial' ? 'Se mostrarán las columnas iniciales y se quitarán los filtros actuales. Tus vistas guardadas se conservan.'
        : `Se sustituirán las columnas, los filtros y el orden actuales por la vista «${aplicar?.nombre}». Los cambios de configuración sin guardar se descartarán.`}
      onCancel={() => setAplicar(null)} confirmText={aplicar === 'inicial' ? 'Restablecer consulta' : 'Aplicar vista'}
      onConfirm={() => { if (aplicar === 'inicial') g.restablecer(configuracionInicialListado()); else if (aplicar) g.aplicar(aplicar); setAplicar(null); }} />
    <ModalConfirmacion isOpen={Boolean(eliminar)} title="Eliminar vista guardada" type="danger" busy={g.busy}
      message={`Se eliminará únicamente la configuración «${eliminar?.nombre || ''}». El listado actual y los datos de alumnos se conservan.`}
      onCancel={() => setEliminar(null)} confirmText="Eliminar vista" onConfirm={async () => { if (eliminar) { await g.eliminar(eliminar); setEliminar(null); toast.success('Vista eliminada de tu cuenta.'); } }} />
  </section>;
}
