import '../ui/temaModulosEscolares.css';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ClipboardCheck, Download, FileText, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { useEstadistica911 } from '../../hooks/useEstadistica911';
import { diagnosticoCierre911 } from '../../estadistica911/calculo';
import { pendientesReglas911, excepcionAcreditada911 } from '../../estadistica911/reglas';
import Reglas911Panel from './Reglas911Panel';
import { ROLES911, CUESTIONARIOS } from '../../estadistica911/types';
import { estadistica911Service as service } from '../../services/estadistica911Service';
import { supabase, fetchAllSupabase } from '../../lib/supabase';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import Modal911 from './Modal911';
import Configuracion911 from './Configuracion911';
import Cuestionario911Panel from './Cuestionario911Panel';
import Fuentes911Panel from './Fuentes911Panel';
import Propuestas911Panel from './Propuestas911Panel';
import Personal911Panel from './Personal911Panel';
import Exportaciones911Panel from './Exportaciones911Panel';
import './estadistica911.css';
import Pasos911,{PASOS911} from './Pasos911';
import ResumenCuestionarios911 from './ResumenCuestionarios911';
import Oferta911Panel from './Oferta911Panel';
import DatosComunes911 from './DatosComunes911';
import { instanciaAplica911,nombreOferta911 } from '../../estadistica911/guia';
import GuiaUso911 from './GuiaUso911';
import AyudaContextual, { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
export default function Estadistica911() {
  const h = useEstadistica911();
  const currentUser = useAppStore(s => s.currentUser),
    ciclos = useAppStore(s => s.ciclos);
  const rol = currentUser?.rol || '';
  const academico = ['ADMINISTRADOR', 'COORDINADOR CONTROL ESCOLAR'].includes(rol);
  const [tab, setTab] = useState('expediente'),
    [planes, setPlanes] = useState<any[]>([]),
    [accion, setAccion] = useState(''),
    [motivo, setMotivo] = useState(''),
    [versiones, setVersiones] = useState<any[]>([]),
    [snapshot, setSnapshot] = useState(false);
  const [lotePendiente,setLotePendiente]=useState(false);
  const [salirLote,setSalirLote]=useState<null|(()=>void)>(null);
  function protegerLote(fn:()=>void){if(lotePendiente)setSalirLote(()=>fn);else fn();}
  const [destino,setDestino]=useState({instancia:'',variable:''});
  const pasos=PASOS911.filter(p=>p.id!=='fuentes'||academico).filter(p=>p.id!=='oferta'||academico).filter(p=>p.id!=='personal'||rol==='ADMINISTRADOR'||rol==='COORDINADOR RECURSOS HUMANOS');
  const indicePaso=pasos.findIndex(p=>p.id===tab);
  async function continuarSinLote() {
    if(h.dirty && !(await h.guardar()))return;
    if(pasos[indicePaso+1])setTab(pasos[indicePaso+1].id);
  }
  useEffect(() => {
    let alive = true;
    void fetchAllSupabase(() => supabase.from('planes_estudio').select('id,nombre,clave_legado,tipo_periodo,modalidad,carrera:carreras(nombre,nivel_educativo)').order('id')).then(({
      data,
      error
    }) => {
      if (!alive) return;
      if (error) toast.error(error.message);else setPlanes(data || []);
    });
    return () => {
      alive = false;
    };
  }, []);
  const reglasPendientes = useMemo(() => h.exp && h.fuentes ? pendientesReglas911(h.exp, h.fuentes.reglas) : [], [h.exp?.instancias, h.fuentes]);
  const editable = Boolean(h.exp?.estado === 'BORRADOR' && !snapshot && !h.busy && (!h.exp.id || h.respaldoListo));
  const puedeEditar = (q: string) => editable && (!h.exp?.config.guiaVersion||h.exp.config.ofertaConfirmada===true) && (academico || rol === 'COORDINADOR RECURSOS HUMANOS' && q === 'escuela' || rol === 'COORDINADOR FINANCIERO' && q === 'institucion' || rol === 'COORDINADOR ACADEMICO' && ['carrera', 'posgrado', 'tecnologia', 'infraestructura'].includes(q));
  if (!ROLES911.includes(rol)) return <p>Sin permiso para Estadística 911.</p>;
  const errores = h.exp && h.fuentes ? [...diagnosticoCierre911(h.exp, h.fuentes.fuentes), ...reglasPendientes.filter(r => !excepcionAcreditada911(h.exp?.excepciones?.[r.clave])).map(r => r.clave + ': ' + r.mensaje)] : [];
  return <div className="s911"><header className="s911-hero"><div><p className="s911-eyebrow">CONTROL ESCOLAR / EXPEDIENTE ANUAL</p><h1>Estadística educativa <b>911</b></h1><p>2026–2027 · Escuela 09PSU0509Q · Institución 09MSU0509T</p></div><div className="s911-hero-seal"><ShieldCheck size={27} /><span>Cifras con respaldo<small>Captura · revisión · cierre</small></span></div></header>
 {h.error && <div className="s911-warning" role="alert"><strong>Instalación / conexión pendiente</strong><p>{h.error}</p><p>La preparación del SQL y el catálogo está en el repositorio. Este módulo no instala migraciones automáticamente.</p></div>}
 <div className="s911-toolbar s911-card"><CampoConAyuda className="s911-selector-expediente" etiqueta="Expediente anual" ayuda={ayuda.expediente}><select disabled={h.busy} value={h.exp?.id || ''} onChange={e => {
          const x = h.lista.find(x => x.id === e.target.value);
          if (x) protegerLote(()=>{
            h.abrir(x);
            setSnapshot(false);
            setVersiones([]);
            setTab('expediente');setDestino({instancia:'',variable:''});
          });
        }}><option value="">Selecciona un expediente</option>{h.lista.map(e => <option key={e.id} value={e.id}>{e.nombre} · {e.estado}</option>)}</select></CampoConAyuda><button disabled={!h.fuentes || rol !== 'ADMINISTRADOR' || h.busy} onClick={() => {
        protegerLote(()=>{h.nuevo();setSnapshot(false);setVersiones([]);setTab('expediente');setDestino({instancia:'',variable:''});});
      }}>Nuevo expediente</button>{h.exp && <><span className={`s911-status ${h.exp.estado}`}>{snapshot ? 'VERSIÓN ARCHIVADA' : h.exp.estado.replace('_', ' ')}</span><span className="s911-note">Revisión de datos {h.exp.revision}{h.dirty ? ' · Cambios sin guardar' : ''}</span><button className="s911-primary" disabled={!editable || h.busy || !h.dirty} onClick={() => h.guardar()}><Save size={16} />Guardar expediente</button><AyudaContextual etiqueta="Guardar expediente" texto="Conserva las respuestas y la configuración del borrador. El botón se habilita cuando tienes cambios sin guardar y permiso de edición; durante una consulta o guardado hay que esperar. Guardar no cierra ni oficializa el reporte."/></>}</div>
 <GuiaUso911/>
 {!h.exp ? <section className="s911-card s911-welcome"><BookOpen size={45} /><h2>Empieza abriendo un expediente anual</h2><p>Selecciona un expediente guardado en la lista superior. Administración puede usar «Nuevo expediente» para comenzar uno. Después sigue los pasos de datos generales, oferta, alumnos y revisión.</p><p>Las cifras sin información seguirán pendientes; no se convierten en cero.</p><div className="s911-grid">{h.fuentes?.manifest.advertencias.map(t => <p key={t} className="s911-notice">{t}</p>)}</div></section> : <>
 {snapshot?<p className="s911-notice">Estás consultando una versión archivada. Puedes revisar y descargar sus datos; esta copia no se edita.</p>:h.exp.estado!=='BORRADOR'?<p className="s911-notice">El expediente está {h.exp.estado==='CERRADO'?'cerrado':'en revisión'} y se consulta sin editar. Para corregirlo, usa el cambio de estado autorizado en «Calcular y revisar».</p>:h.exp.id&&!h.respaldoListo?<p className="s911-notice" role="status">Espera a que terminen de cargar el catálogo y los listados guardados para habilitar la edición.</p>:null}
 <Pasos911 pasos={pasos} actual={tab} onPaso={id=>protegerLote(()=>setTab(id))} />
 {tab === 'expediente' && <>{rol!=='ADMINISTRADOR'&&<p className="s911-notice">Administración configura los datos generales, fechas y ciclos. Puedes consultarlos y abrir sus ayudas; las secciones que te corresponden se habilitan según tu rol y el estado del expediente.</p>}<Configuracion911 exp={h.exp} ciclos={ciclos} editable={editable && rol === 'ADMINISTRADOR'} onChange={e => h.modificar(() => e)} />{h.fuentes&&<DatosComunes911 exp={h.exp} fuentes={h.fuentes.fuentes} editable={editable&&rol==='ADMINISTRADOR'} onChange={e=>h.modificar(()=>e)}/>}</>}
 {tab==='oferta'&&<>{rol!=='ADMINISTRADOR'&&<p className="s911-notice">Administración confirma las correspondencias de oferta educativa. Aquí puedes revisar qué planes se asociaron y consultar las ayudas.</p>}<Oferta911Panel exp={h.exp} planes={planes} editable={editable&&rol==='ADMINISTRADOR'} onChange={e=>h.modificar(()=>e)}/></>}
 {tab === 'fuentes' && academico && <div className="s911-stack"><Propuestas911Panel ciclos={ciclos} onPendienteChange={setLotePendiente} onGuardado={()=>{h.cargarAcademicas();h.modificar(e=>({...e,corteCalculado:'',revisiones:{}}));}} editable={editable} /><Fuentes911Panel datos={h.academicas} ciclos={ciclos.map(c => ({
          ...c,
          tipo: c.tipo_periodo
        }))} onCargar={h.cargarAcademicas} onGuardado={()=>{h.cargarAcademicas();h.modificar(e=>({...e,corteCalculado:'',revisiones:{}}));}} editable={editable} /></div>}
 {tab === 'personal' && <Personal911Panel editable={editable && (rol === 'ADMINISTRADOR' || rol === 'COORDINADOR RECURSOS HUMANOS')} />}
 {tab === 'cuestionarios' && h.fuentes && <>{h.exp.config.guiaVersion&&!h.exp.config.ofertaConfirmada&&<p className="s911-warning">Para habilitar las respuestas, Administración debe confirmar la oferta educativa. Puedes consultar los cuestionarios mientras se completa ese paso.</p>}<ResumenCuestionarios911 exp={h.exp} fuentes={h.fuentes.fuentes} onAbrir={id=>setDestino({instancia:id,variable:''})}/><Cuestionario911Panel inicialInstancia={destino.instancia} inicialVariable={destino.variable} exp={h.exp} fuentes={h.fuentes.fuentes} reglas={h.fuentes.reglas} planes={planes} respaldos={h.respaldos} editable={puedeEditar} onChange={e => h.modificar(() => e)} puedeVerAlumnos={academico} configurable={editable && rol === 'ADMINISTRADOR'} /></>}
 {tab === 'validacion' && <div className="s911-stack"><section className="s911-card"><div className="s911-section-heading"><div><h2><ClipboardCheck size={21} /> Calcular cifras y revisar diferencias</h2><p>Recalcular consulta los registros de respaldo y propone cifras nuevas. Revisa las diferencias y aplícalas al borrador; los ajustes justificados se conservan. Después vuelve a Cuestionarios para comprobar las respuestas.</p></div><button disabled={!editable || !academico || h.busy} onClick={h.recalcular}><RefreshCw size={16} />Recalcular</button></div><p>{errores.length} comprobaciones pendientes · {h.exp.incidencias.length} incidencias del último cálculo · {h.fuentes?.cuarentena.length || 0} reglas oficiales que requieren revisión técnica</p><details><summary>Ver comprobaciones para el cierre</summary><ul>{errores.slice(0, 250).map((x, n) => <li key={n}>{x}<button onClick={()=>{const i=h.exp!.instancias.find(i=>x.startsWith(i.id+':')||x.startsWith(i.id+'/'));if(i){setDestino({instancia:i.id,variable:x.match(/\/(V\d+|E\d+)/)?.[1]||''});setTab('cuestionarios');}else setTab(x.includes('oferta')?'oferta':'expediente');}}>Ir a corregir</button></li>)}</ul><p className="s911-note">Primeras 250 comprobaciones. El cierre verifica todas las variables aplicables.</p></details><details><summary>Incidencias de cálculo y reglas</summary><ul>{h.exp.incidencias.map((x, n) => <li key={n}>{x}</li>)}</ul></details><div className="s911-grid">{CUESTIONARIOS.filter(q=>h.exp!.instancias.some(i=>i.cuestionario===q&&instanciaAplica911(i))).map(q => <label key={q}>Revisión de {q}<textarea disabled={!editable || !(rol === 'ADMINISTRADOR' || rol === 'COORDINADOR CONTROL ESCOLAR' && ['carrera', 'posgrado'].includes(q) || rol === 'COORDINADOR FINANCIERO' && q === 'institucion' || rol === 'COORDINADOR RECURSOS HUMANOS' && q === 'escuela' || rol === 'COORDINADOR ACADEMICO' && ['carrera', 'posgrado', 'infraestructura', 'tecnologia'].includes(q))} value={h.exp!.revisiones[q] || ''} placeholder="Responsable, resultado de revisión y excepciones documentadas" onChange={e => h.modificar(x => ({
                ...x,
                revisiones: {
                  ...x.revisiones,
                  [q]: e.target.value
                }
              }))} /></label>)}</div></section>
 <Reglas911Panel exp={h.exp} incidencias={reglasPendientes} editable={editable && academico} onChange={e => h.modificar(() => e)} /><section className="s911-card"><h2>Estado y versiones</h2><p>Borrador: puedes editar. En revisión: el trabajo se consulta para su aprobación. Cerrado: se conserva una versión fija para reproducir sus documentos. Reabrir conserva la anterior y crea una nueva versión de trabajo.</p><div className="s911-toolbar">{academico && !snapshot && <>{h.exp.estado === 'BORRADOR' && <button disabled={h.dirty || !h.exp.id} onClick={() => setAccion('REVISAR')}>Enviar a revisión</button>}{h.exp.estado === 'EN_REVISION' && <><button onClick={() => setAccion('DEVOLVER')}>Devolver a borrador</button><button disabled={rol !== 'ADMINISTRADOR' || errores.length > 0} onClick={() => setAccion('CERRAR')}>Cerrar versión revisada</button></>}{h.exp.estado === 'CERRADO' && rol === 'ADMINISTRADOR' && <button onClick={() => setAccion('REABRIR')}>Reabrir con nueva versión</button>}</>}<button disabled={!h.exp.id} onClick={async () => {
              try {
                setVersiones(await service.versiones(h.exp!.id));
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}>Consultar versiones cerradas</button></div>{versiones.map(v => <div key={v.id} className="s911-version"><span>Versión {v.numero} · {v.cerrado_en}<small>SHA-256: {v.sha256}</small></span><button disabled={h.dirty} onClick={async () => {
              const e = {
                ...v.payload,
                id: h.exp!.id,
                revision: v.payload.revision ?? v.numero,
                version: v.numero,
                estado: 'CERRADO' as const
              };
              h.abrir(e);
              setSnapshot(true);
            }}>Abrir copia archivada</button></div>)}</section></div>}
 {tab === 'exportar' && h.fuentes && <Exportaciones911Panel exp={h.exp} fuentes={h.fuentes.fuentes} respaldos={h.respaldos} sinGuardar={h.dirty || h.busy || !h.respaldoListo} puedeVerAlumnos={academico} />}
 </>}
 {h.exp&&<footer className="s911-continuar"><button disabled={indicePaso<=0||h.busy} onClick={()=>protegerLote(()=>setTab(pasos[indicePaso-1].id))}>Anterior</button><span>Paso {indicePaso+1} de {pasos.length}</span>{indicePaso<pasos.length-1&&<button className="s911-primary" disabled={h.busy||h.dirty&&!editable} onClick={()=>protegerLote(()=>{void continuarSinLote();})}>{h.dirty?'Guardar y continuar':'Continuar'}</button>}</footer>}
 {h.busy && <div className="s911-busy" role="status">Consultando / guardando expediente…</div>}
 <ModalConfirmacion isOpen={Boolean(salirLote)} title="Salir del lote sin confirmar" message="Se descartarán las selecciones y ediciones de fuentes que aún no confirmaste. Puedes cancelar y usar Confirmar fuentes seleccionadas para conservarlas." onCancel={()=>setSalirLote(null)} onConfirm={()=>{salirLote?.();setSalirLote(null);}} confirmText="Descartar y continuar" />
 <ModalConfirmacion isOpen={Boolean(h.confirmacion)} title={h.confirmacion?.titulo || ''} message={h.confirmacion?.mensaje || ''} onCancel={() => h.setConfirmacion(null)} onConfirm={() => {
      h.confirmacion?.accion();
      h.setConfirmacion(null);
    }} confirmText="Continuar y descartar" />
 {h.propuesta && <Modal911 titulo="Revisión del recálculo" onClose={() => h.setPropuesta(null)}><div className="s911-body"><p>{h.propuesta.cambios.length} cifras cambian; los ajustes declarados se conservan. Se retiran las revisiones de sección para volver a comprobar el resultado.</p><div className="s911-diff">{h.propuesta.cambios.map((s, n) => <p key={n}>{s}</p>)}</div><p>{h.propuesta.exp.incidencias.length} incidencias. Una cobertura insuficiente mantiene cifras pendientes.</p><footer><button onClick={() => h.setPropuesta(null)}>Cancelar</button><button className="s911-primary" onClick={h.aplicarPropuesta}>Aplicar al borrador</button></footer></div></Modal911>}
 {accion && <Modal911 titulo={`Cambio de estado: ${accion}`} onClose={() => setAccion('')}><div className="s911-body s911-stack"><label>Motivo<textarea value={motivo} onChange={e => setMotivo(e.target.value)} /></label><footer><button onClick={() => setAccion('')}>Cancelar</button><button className="s911-primary" disabled={h.busy || motivo.trim().length < 5} onClick={async () => {
            await h.transicion(accion, motivo);
            setAccion('');
            setMotivo('');
          }}>Confirmar</button></footer></div></Modal911>}
 </div>;
}


