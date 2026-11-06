import { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import { ordenarCiclos911 } from '../../estadistica911/guia';
import { useEffect, useState } from 'react';
import { BASE911 } from '../../estadistica911/fuentes';
import toast from 'react-hot-toast';
import { estadistica911Service } from '../../services/estadistica911Service';
import type { Persona911 } from '../../estadistica911/types';
type Datos = Awaited<ReturnType<typeof estadistica911Service.fuentesAcademicas>>;
export default function Fuentes911Panel({
  datos,
  ciclos,
  onCargar,
  onGuardado,
  editable
}: {
  datos: Datos | null;
  ciclos: {
    id: string;
    nombre: string;
    tipo?: string;
  }[];
  onCargar: () => void;
  onGuardado: () => void;
  editable: boolean;
}) {
  const [tipo, setTipo] = useState('inscripciones'),
    [ap, setAp] = useState(''),
    [ciclo, setCiclo] = useState(''),
    [desde, setDesde] = useState(''),
    [hasta, setHasta] = useState(''),
    [ingreso, setIngreso] = useState<Persona911['tipo_ingreso']>('DESCONOCIDO'),
    [primero, setPrimero] = useState(''),
    [grado, setGrado] = useState(''),
    [anio, setAnio] = useState(''),
    [situacion, setSituacion] = useState('ACTIVO'),
    [evidencia, setEvidencia] = useState(''),
    [busqueda, setBusqueda] = useState(''),
    [saving, setSaving] = useState(false),
    [extra, setExtra] = useState<Record<string, string | boolean | null>>({
      discapacidad: null,
      indigena: null,
      pais_nacimiento: '',
      entidad_residencia: '',
      entidad_nacimiento: ''
    });
  const [paises, setPaises] = useState<{
    ID_PAIS: string;
    NOM_PAIS: string;
  }[]>([]);
  useEffect(() => {
    void fetch(BASE911 + 'catalogo-paises.json').then(r => r.json()).then(setPaises).catch(() => toast.error('No se pudo consultar el catálogo de países'));
  }, []);
  const candidatos = datos?.programas.filter(p => {
    const a = datos.alumnos.find(a => a.id === p.alumno_id);
    return `${a?.matricula} ${a?.nombre_completo}`.toLowerCase().includes(busqueda.toLowerCase());
  }).slice(0, 80) || [];
  async function guardar() {
    if (!ap || !desde || !evidencia.trim()) return toast.error('Selecciona programa, fecha y evidencia');
    setSaving(true);
    try {
      let fila: Record<string, unknown> = {
        alumno_programa_id: ap,
        ciclo_id: ciclo,
        desde,
        hasta: hasta || null,
        tipo_ingreso: ingreso,
        fecha_primer_ingreso: primero || null,
        grado_personal: grado,
        anio_avance_911: anio || null,
        situacion,
        confirmado: true,
        evidencia
      };
      if (tipo === 'eventos') fila = {
        alumno_programa_id: ap,
        tipo: situacion === 'TITULACION' ? 'TITULACION' : 'EGRESO',
        fecha: desde,
        confirmado: true,
        evidencia
      };
      if (tipo === 'complementos') {
        const p = datos!.programas.find(p => p.id === ap);
        fila = {
          tipo: 'ALUMNO',
          referencia_id: p.alumno_id,
          desde,
          hasta: hasta || null,
          datos: extra,
          evidencia
        };
      }
      await estadistica911Service.guardarFuente(tipo, fila);
      toast.success('Fuente confirmada. Recalcula el expediente para ver diferencias.');
      onGuardado();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return <section className="s911-card"><div className="s911-section-heading"><div><h2>Registrar un respaldo académico individual</h2><p>Usa este formulario para documentar una inscripción, un egreso, una titulación o una característica estadística. Para varios alumnos, usa la revisión por lote. Confirmar aquí guarda una fuente para el 911; después recalcula el expediente.</p></div><button onClick={onCargar}>Consultar fuentes</button></div>
 {datos && <><div className="s911-metrics"><span>{datos.programas.length} programas registrados</span><span>{datos.inscripciones.length} inscripciones 911</span><span>{datos.eventos.length} eventos fechados</span></div>
 {editable && <div className="s911-grid"><CampoConAyuda etiqueta="Qué dato vas a registrar" ayuda={ayuda.fuente}><select value={tipo} onChange={e => setTipo(e.target.value)}><option value="inscripciones">Inscripción alumno–programa–ciclo</option><option value="eventos">Egreso / titulación</option><option value="complementos">Características estadísticas temporales</option></select></CampoConAyuda><label>Buscar alumno<input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Matrícula o nombre" /></label>
 <CampoConAyuda className="s911-span" etiqueta="Alumno y programa que vas a respaldar" ayuda={ayuda.fuente}><select value={ap} onChange={e => {
            setAp(e.target.value);
            const p = datos.programas.find(p => p.id === e.target.value);
            const a = datos.alumnos.find(a => a.id === p?.alumno_id);
            setGrado(a?.grado_actual || '');
          }}><option value="">Selecciona uno de los primeros 80 resultados</option>{candidatos.map(p => {
              const a = datos.alumnos.find(a => a.id === p.alumno_id);
              const plan = datos.planes.find(x => x.id === p.plan_id);
              return <option key={p.id} value={p.id}>{a?.matricula} · {a?.nombre_completo} · {plan?.clave_legado}</option>;
            })}</select></CampoConAyuda>
 <CampoConAyuda etiqueta={tipo === 'eventos' ? 'Fecha real del egreso o titulación' : tipo === 'inscripciones' ? 'Inscrito desde (fecha acreditada)' : 'Dato acreditado desde'} ayuda={tipo === 'eventos' ? 'Fecha en que ocurrió el egreso o la titulación según su documento. Se usa para ubicarlo en el periodo de resultados; no uses la fecha en que capturas el registro.' : tipo === 'inscripciones' ? ayuda.desde : 'Primer día para el que puedes acreditar esta característica. Permite usar datos históricos al corte, en lugar de asumir que la situación actual siempre fue la misma.'}><input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></CampoConAyuda>{tipo !== 'eventos' && <CampoConAyuda etiqueta="Vigente hasta (opcional)" ayuda={ayuda.hasta}><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></CampoConAyuda>}
 {tipo === 'inscripciones' && <><CampoConAyuda etiqueta="Ciclo de inscripción" ayuda={ayuda.cicloFuente}><select value={ciclo} onChange={e => setCiclo(e.target.value)}><option value="">Selecciona</option>{ordenarCiclos911(ciclos).map(c => <option key={c.id} value={c.id}>{c.nombre} · {c.tipo}</option>)}</select></CampoConAyuda><CampoConAyuda etiqueta="Tipo de ingreso" ayuda={ayuda.ingreso}><select value={ingreso} onChange={e => setIngreso(e.target.value as Persona911['tipo_ingreso'])}><option value="DESCONOCIDO">Pendiente de acreditar</option><option value="PRIMER_INGRESO">Primer ingreso al programa</option><option value="REINGRESO">Reingreso</option></select></CampoConAyuda><CampoConAyuda etiqueta="Fecha de primer ingreso al programa" ayuda={ayuda.primerIngreso}><input type="date" value={primero} onChange={e => setPrimero(e.target.value)} /></CampoConAyuda><CampoConAyuda etiqueta="Grado del alumno en la fecha de corte" ayuda={ayuda.grado}><input value={grado} onChange={e => setGrado(e.target.value)} /></CampoConAyuda><CampoConAyuda etiqueta="Año equivalente de avance 911 (opcional, 1–6)" ayuda={ayuda.avance}><input type="number" min={1} max={6} value={anio} onChange={e => setAnio(e.target.value)} /><small>Para planes por créditos, flexibles u otra equivalencia: exige respaldo de la tabla oficial.</small></CampoConAyuda></>}
 {tipo !== 'complementos' && <label>{tipo === 'eventos' ? 'Evento oficial' : 'Situación al corte'}<select value={situacion} onChange={e => setSituacion(e.target.value)}>{(tipo === 'eventos' ? ['EGRESO', 'TITULACION'] : ['ACTIVO', 'CURSANDO', 'BAJA', 'EGRESADO', 'TITULADO']).map(v => <option key={v}>{v}</option>)}</select></label>}
 {tipo === 'complementos' && <><p className="s911-span s911-note">Datos restringidos. «Sin confirmar» mantiene el conteo pendiente; no equivale a «No». El país de nacimiento es distinto de la nacionalidad.</p>{(['discapacidad', 'indigena'] as const).map(k => <label key={k}>{k === 'discapacidad' ? 'Presenta discapacidad' : 'Habla una lengua indígena'}<select value={extra[k] === null ? '' : String(extra[k])} onChange={e => setExtra(x => ({
              ...x,
              [k]: e.target.value === '' ? null : e.target.value === 'true'
            }))}><option value="">Sin confirmar</option><option value="true">Sí</option><option value="false">No</option></select></label>)}<label>País de nacimiento<select value={String(extra.pais_nacimiento || '')} onChange={e => setExtra(x => ({
              ...x,
              pais_nacimiento: e.target.value
            }))}><option value="">Sin confirmar</option><option value="MX">MÉXICO</option>{paises.map(p => <option key={p.ID_PAIS} value={p.ID_PAIS}>{p.NOM_PAIS}</option>)}</select></label>{(['entidad_residencia', 'entidad_nacimiento'] as const).map(k => <label key={k}>{k === 'entidad_residencia' ? 'Entidad de residencia' : 'Entidad de nacimiento'} (01–32, 99 extranjero)<input value={String(extra[k] || '')} maxLength={2} onChange={e => setExtra(x => ({
              ...x,
              [k]: e.target.value
            }))} /></label>)}</>}
 <CampoConAyuda className="s911-span" etiqueta="Documento y explicación que respaldan el dato" ayuda={ayuda.evidencia}><textarea value={evidencia} onChange={e => setEvidencia(e.target.value)} /></CampoConAyuda><div className="s911-span"><button className="s911-primary" disabled={saving} onClick={guardar}>Confirmar fuente</button></div></div>}
 <div className="s911-scroll"><table><thead><tr><th>Matrícula</th><th>Programa</th><th>Ciclo / evento</th><th>Referencia</th><th>Grado personal</th><th>Ingreso y procedencia</th><th>Evidencia</th></tr></thead><tbody>{datos.personas.slice(0, 150).map(p => <tr key={p.id}><td>{p.matricula}</td><td>{p.programa}</td><td>{p.evento || ciclos.find(c => c.id === p.ciclo_id)?.nombre}</td><td>{p.desde} / {p.hasta || 'vigente'}</td><td>{p.grado}</td><td>{p.tipo_ingreso}<small>{p.fecha_primer_ingreso||'Fecha histórica pendiente'}</small>{p.ingreso_procedencia?.origen==='CALIFICACIONES'&&<small>Inferido de {p.ingreso_procedencia.ciclo}; confirmado para 911</small>}</td><td>{p.evidencia}</td></tr>)}</tbody></table></div><p className="s911-note">Vista de las primeras 150 fuentes. El cálculo consulta todas las páginas. No se modifican alumnos, grupos ni programas operativos.</p></>}
 </section>;
}
