import AyudaContextual, { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { estadistica911Service as service } from '../../services/estadistica911Service';
import { diagnosticarPersonal911, FUNCIONES_PERSONAL911, validarPersonal911 } from '../../estadistica911/personal';
export default function Personal911Panel({
  editable
}: {
  editable: boolean;
}) {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof service.personal>> | null>(null),
    [busy, setBusy] = useState(false),
    [seleccion, setSeleccion] = useState<string[]>([]),
    [funcion, setFuncion] = useState('DOCENTE'),
    [sexo, setSexo] = useState(''),
    [central, setCentral] = useState(false),
    [desde, setDesde] = useState(''),
    [hasta, setHasta] = useState(''),
    [evidencia, setEvidencia] = useState(''),
    [clave, setClave] = useState('');
  async function cargar() {
    setBusy(true);
    try {
      setDatos(await service.personal());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function guardar() {
    const d = {
      directorios: seleccion,
      funcion_principal: funcion,
      sexo,
      central,
      confirmado: true
    };
    const errs = validarPersonal911(d);
    if (errs.length) return toast.error(errs[0]);
    if (!clave || !desde || !evidencia) return toast.error('Registra clave única de persona, fecha y evidencia');
    setBusy(true);
    try {
      await service.guardarFuente('complementos', {
        tipo: 'PERSONAL',
        referencia_id: clave,
        desde,
        hasta: hasta || null,
        datos: d,
        evidencia
      });
      toast.success('Identidad y función confirmadas');
      await cargar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <section className="s911-card"><div className="s911-section-heading"><div><h2>Personal y posibles duplicidades</h2><p>1. Consulta los directorios. 2. Selecciona únicamente los registros que pertenecen a una misma persona. 3. Confirma su identidad, función y fechas. Repite por persona; no selecciones empleados distintos como si fueran uno solo.</p></div><button disabled={busy} onClick={cargar}>Consultar directorios</button></div>
 {datos && <><div className="s911-scroll"><table><thead><tr><th>Persona propuesta</th><th>Docentes</th><th>Recursos Humanos</th><th>Revisión</th></tr></thead><tbody>{diagnosticarPersonal911(datos.docentes, datos.empleados).map(g => <tr key={g.id}><td>{g.nombres.join(' / ')}</td><td>{g.docentes.map(id => <label className="s911-check" key={id}><input type="checkbox" disabled={!editable} checked={seleccion.includes('docente:' + id)} onChange={e => setSeleccion(e.target.checked ? [...seleccion, 'docente:' + id] : seleccion.filter(k => k !== 'docente:' + id))} />Seleccionar</label>)}</td><td>{g.empleados.map(id => <label className="s911-check" key={id}><input type="checkbox" disabled={!editable} checked={seleccion.includes('empleado:' + id)} onChange={e => setSeleccion(e.target.checked ? [...seleccion, 'empleado:' + id] : seleccion.filter(k => k !== 'empleado:' + id))} />Seleccionar</label>)}</td><td>{g.posibleDuplicado ? 'Posible coincidencia: confirmar identidad' : 'Confirmar función y vigencia'}</td></tr>)}</tbody></table></div>
 <fieldset disabled={!editable || busy} className="s911-grid"><CampoConAyuda etiqueta="Identificador interno de esta persona" ayuda={ayuda.clavePersonal}><input value={clave} onChange={e => setClave(e.target.value)} placeholder="No utilizar CURP" /></CampoConAyuda><CampoConAyuda etiqueta="Función principal" ayuda={ayuda.funcion}><select value={funcion} onChange={e => setFuncion(e.target.value)}>{FUNCIONES_PERSONAL911.map(f => <option key={f}>{f}</option>)}</select></CampoConAyuda><label>Sexo<select value={sexo} onChange={e => setSexo(e.target.value)}><option value="">Pendiente</option><option value="H">Hombre</option><option value="M">Mujer</option></select></label><CampoConAyuda etiqueta="Función acreditada desde" ayuda="Primer día desde el que puedes demostrar que esta persona tenía la función y adscripción indicadas. Debe estar vigente en el corte para sustentar el conteo."><input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></CampoConAyuda><CampoConAyuda etiqueta="Último día de esa función (opcional)" ayuda="Último día incluido en la vigencia de estos datos. Déjalo vacío si no hay un término documentado."><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></CampoConAyuda><div className="campo-con-ayuda-etiqueta"><label className="s911-check"><input type="checkbox" checked={central} onChange={e => setCentral(e.target.checked)} />Administración central</label><AyudaContextual etiqueta="Administración central" texto={ayuda.central}/></div><CampoConAyuda className="s911-span" etiqueta="Documento que respalda identidad, función y fechas" ayuda={ayuda.evidencia}><textarea value={evidencia} onChange={e => setEvidencia(e.target.value)} /></CampoConAyuda><div><button onClick={guardar}>Confirmar persona</button><small>{seleccion.length} registros seleccionados: deben pertenecer a una sola persona.</small></div></fieldset><p>{datos.complementos.length} registros de personal confirmados. Los conteos requieren acreditar cobertura y separar plantel de administración central.</p></>}
 </section>;
}
