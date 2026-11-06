import { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { CicloEscolar } from '../../types';
import { estadistica911Service as service } from '../../services/estadistica911Service';
import { ordenarCiclos911 } from '../../estadistica911/guia';
import { aplicarInferencias911, validarLoteIngreso911, type CandidatoIngreso911 } from '../../estadistica911/ingreso';
import ModalConfirmacion from '../ui/ModalConfirmacion';

export default function Propuestas911Panel({ciclos,onGuardado,editable,onPendienteChange}:{ciclos:CicloEscolar[];onGuardado:()=>void;editable:boolean;onPendienteChange?:(v:boolean)=>void}) {
  const [ciclo,setCiclo]=useState(''),[filas,setFilas]=useState<CandidatoIngreso911[]>([]),[seleccion,setSeleccion]=useState<string[]>([]);
  const [desde,setDesde]=useState(''),[hasta,setHasta]=useState(''),[evidencia,setEvidencia]=useState(''),[busqueda,setBusqueda]=useState('');
  const [editado,setEditado]=useState(false);
  const [pagina,setPagina]=useState(0),[busy,setBusy]=useState(false),[accion,setAccion]=useState(''),[tipoMasivo,setTipoMasivo]=useState('REINGRESO'),[reemplazar,setReemplazar]=useState(false);
  const filtradas=useMemo(()=>filas.filter(f=>`${f.matricula} ${f.nombre} ${f.programa}`.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es'))).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')), [filas,busqueda]);
  const visibles=filtradas.slice(pagina*25,pagina*25+25),errores=validarLoteIngreso911(filas,seleccion,desde,hasta,evidencia);
  useEffect(()=>{onPendienteChange?.(editado||seleccion.length>0);return()=>onPendienteChange?.(false);},[editado,seleccion.length,onPendienteChange]);
  useEffect(()=>{if(!editado&&!seleccion.length)return;const avisar=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',avisar);return()=>window.removeEventListener('beforeunload',avisar);},[editado,seleccion.length]);
  const actualizar=(id:string,cambio:Partial<CandidatoIngreso911>)=>{setEditado(true);setFilas(fs=>fs.map(f=>f.alumno_programa_id===id?{...f,...cambio}:f));};
  async function cargar() {
    if(!ciclo)return toast.error('Selecciona el ciclo de inscripción.');
    setBusy(true);
    try {
      setFilas((await service.candidatosGuiados(ciclo)).map(f=>({...f,desde:f.desde||'',hasta:f.hasta||null,evidencia:f.evidencia||'',tipo_ingreso:f.tipo_ingreso||'DESCONOCIDO',fecha_primer_ingreso:f.fecha_primer_ingreso||'',ingreso_procedencia:f.ingreso_procedencia||{}})));
      setSeleccion([]);setEditado(false);setPagina(0);setDesde('');setHasta('');setEvidencia('');
    }catch(e){toast.error((e as Error).message);}finally{setBusy(false);}
  }
  async function inferir() {
    setBusy(true);
    try {
      const datos=await service.inferirIngresos(seleccion,ciclo),mapa=new Map(datos.map(d=>[d.alumno_programa_id,d]));
      setFilas(fs=>fs.map(f=>mapa.has(f.alumno_programa_id)?{...f,propuesta:mapa.get(f.alumno_programa_id)}:f));
      toast.success('Revisa las propuestas y confirma si deseas usarlas.');
    }catch(e){toast.error((e as Error).message);}finally{setBusy(false);}
  }
  async function confirmar() {
    const actual=accion;setAccion('');
    if(actual==='RECARGAR'){await cargar();return;}
    if(actual==='CICLO'){setEditado(false);setFilas([]);setSeleccion([]);setPagina(0);return;}
    if(actual==='TIPO') {setEditado(true);setFilas(fs=>fs.map(f=>seleccion.includes(f.alumno_programa_id)?{...f,tipo_ingreso:tipoMasivo as CandidatoIngreso911['tipo_ingreso']}:f));return;}
    if(actual==='INFERENCIA') {setEditado(true);setFilas(fs=>aplicarInferencias911(fs,seleccion,ciclo,reemplazar));return;}
    if(errores.length)return toast.error(errores[0]);
    setBusy(true);
    try {
      const n=await service.guardarLoteInscripciones(filas.filter(f=>seleccion.includes(f.alumno_programa_id)).map(f=>({
        alumno_programa_id:f.alumno_programa_id,ciclo_id:ciclo,fuente_id:f.fuente_id,actualizado_en:f.actualizado_en,
        desde:desde||f.desde,hasta:hasta||f.hasta||null,tipo_ingreso:f.tipo_ingreso,fecha_primer_ingreso:f.fecha_primer_ingreso||null,
        grado_personal:f.grado,evidencia:evidencia.trim()||f.evidencia,ingreso_procedencia:f.ingreso_procedencia
      })));
      toast.success(`${n} fuentes confirmadas. Recalcula el expediente para actualizar las cifras.`);await cargar();onGuardado();
    }catch(e){toast.error((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="s911-card"><h2>Revisar inscripciones de varios alumnos</h2>
    <p>Elige el ciclo en el que estaban inscritos. Puedes preparar fuentes nuevas y actualizar las ya acreditadas. Los cambios se guardan al confirmar el lote, sin modificar alumnos, grupos ni calificaciones.</p>
    <ol className="s911-pasos-lote"><li>Elige el ciclo y pulsa «Consultar alumnos».</li><li>Selecciona alumnos y revisa fechas, grado y tipo de ingreso. Los campos comunes se aplican solo a la selección.</li><li>Confirma las fuentes cuando se cumplan los requisitos indicados abajo. Después recalcula el expediente.</li></ol><div className="s911-toolbar"><CampoConAyuda etiqueta="Ciclo de inscripción" ayuda={ayuda.cicloFuente}><select disabled={busy||filas.length>0} value={ciclo} onChange={e=>setCiclo(e.target.value)}><option value="">Selecciona un ciclo</option>{ordenarCiclos911(ciclos).map(c=><option key={c.id} value={c.id}>{c.nombre} · {c.tipo_periodo}</option>)}</select></CampoConAyuda><button disabled={!editable||busy} onClick={()=>filas.length?setAccion('RECARGAR'):cargar()}>{filas.length?'Recargar fuentes':'Consultar alumnos'}</button><button disabled={busy||seleccion.length>0} onClick={()=>filas.length?setAccion('CICLO'):setFilas([])}>Elegir otro ciclo</button></div>
    {seleccion.length>0&&<p className="s911-note">Para elegir otro ciclo, quita primero la selección. Al cambiarlo se descartará la preparación no confirmada.</p>}{filas.length>0&&<>
      <div className="s911-grid"><CampoConAyuda etiqueta="Inscritos desde: fecha común a los seleccionados" ayuda={ayuda.desde}><input type="date" disabled={!editable||busy} value={desde} onChange={e=>{setEditado(true);setDesde(e.target.value);}}/><small>Desde cuándo puedes demostrar inscripción en este ciclo. No es el primer ingreso histórico. En fuentes existentes, vacío conserva su fecha.</small></CampoConAyuda><CampoConAyuda etiqueta="Último día inscrito (opcional)" ayuda={ayuda.hasta}><input type="date" disabled={!editable||busy} value={hasta} onChange={e=>{setEditado(true);setHasta(e.target.value);}}/><small>Vacío conserva el término de las fuentes existentes.</small></CampoConAyuda><CampoConAyuda className="s911-span" etiqueta="Documento común que respalda las inscripciones" ayuda={ayuda.evidencia}><textarea disabled={!editable||busy} value={evidencia} onChange={e=>{setEditado(true);setEvidencia(e.target.value);}}/><small>Documento que acredita la inscripción. Vacío conserva la evidencia de las fuentes existentes.</small></CampoConAyuda></div>
      <div className="s911-lote"><h3>Acciones para {seleccion.length} seleccionados</h3><div className="s911-toolbar"><CampoConAyuda etiqueta="Tipo de ingreso para los seleccionados" ayuda={ayuda.ingreso}><select disabled={!editable||busy} value={tipoMasivo} onChange={e=>setTipoMasivo(e.target.value)}><option value="PRIMER_INGRESO">Primer ingreso: inicia este programa</option><option value="REINGRESO">Reingreso: ya cursó este programa</option><option value="DESCONOCIDO">Pendiente de acreditar</option></select></CampoConAyuda><button disabled={!editable||busy||!seleccion.length} onClick={()=>setAccion('TIPO')}>Asignar tipo a seleccionados</button><button disabled={!editable||busy||!seleccion.length||seleccion.length>1000} onClick={inferir}>Consultar ingreso por calificaciones</button></div>
        <p>Consultar no cambia las fechas ni guarda fuentes. Revisa el resultado, pulsa «Usar propuestas revisadas» y después confirma el lote. La propuesta toma la fecha de inicio del ciclo más antiguo con alguna calificación del mismo alumno y plan. Un historial incompleto o con equivalencias puede no representar el ingreso real.</p>
        <label className="s911-check"><input type="checkbox" checked={reemplazar} disabled={!editable||busy} onChange={e=>setReemplazar(e.target.checked)}/>Permitir reemplazar fechas ya capturadas al aplicar propuestas</label><button disabled={!editable||busy||!filas.some(f=>seleccion.includes(f.alumno_programa_id)&&f.propuesta?.estado==='PROPUESTA')} onClick={()=>setAccion('INFERENCIA')}>Usar propuestas revisadas</button>
      </div>
      <div className="s911-toolbar"><label>Buscar alumno o programa<input value={busqueda} onChange={e=>{setBusqueda(e.target.value);setPagina(0);}}/></label><button disabled={busy} onClick={()=>setSeleccion(ids=>[...new Set([...ids,...visibles.map(f=>f.alumno_programa_id)])])}>Seleccionar página visible</button><button onClick={()=>setSeleccion([])}>Quitar selección</button><span>{seleccion.length} seleccionados · {filtradas.length} resultados</span></div>
      <fieldset disabled={!editable||busy}><div className="s911-scroll"><table><thead><tr><th>Incluir</th><th>Alumno / programa</th><th>Grado al corte</th><th>Tipo de ingreso</th><th>Primer ingreso y propuesta</th></tr></thead><tbody>{visibles.map(f=><tr key={f.alumno_programa_id}><td><input type="checkbox" checked={seleccion.includes(f.alumno_programa_id)} onChange={e=>setSeleccion(ids=>e.target.checked?[...ids,f.alumno_programa_id]:ids.filter(id=>id!==f.alumno_programa_id))}/></td><td>{f.nombre}<small>{f.matricula} · {f.programa}</small><small>{f.fuente_id?'Fuente ya acreditada':'Fuente nueva'}</small></td><td><input aria-label={`Grado de ${f.matricula}`} value={f.grado||''} onChange={e=>actualizar(f.alumno_programa_id,{grado:e.target.value})}/></td><td><select aria-label={`Ingreso de ${f.matricula}`} value={f.tipo_ingreso} onChange={e=>actualizar(f.alumno_programa_id,{tipo_ingreso:e.target.value as CandidatoIngreso911['tipo_ingreso']})}><option value="DESCONOCIDO">Pendiente de acreditar</option><option value="PRIMER_INGRESO">Primer ingreso</option><option value="REINGRESO">Reingreso</option></select></td><td><input aria-label={`Fecha de primer ingreso de ${f.matricula}`} type="date" value={f.fecha_primer_ingreso} onChange={e=>actualizar(f.alumno_programa_id,{fecha_primer_ingreso:e.target.value,ingreso_procedencia:{origen:'MANUAL'}})}/>{f.propuesta&&<small>{f.propuesta.estado==='PROPUESTA'?`Propuesta: ${f.propuesta.ciclo} · inicio ${f.propuesta.fecha} · ${f.propuesta.registros} calificaciones`:`Sin propuesta utilizable: ${f.propuesta.estado.replace(/_/g,' ').toLowerCase()}`}</small>}{f.ingreso_procedencia.origen==='CALIFICACIONES'&&<small>Fecha inferida y revisada a partir del historial.</small>}</td></tr>)}</tbody></table></div></fieldset>
      <div className="s911-pagination"><button disabled={pagina===0} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>{pagina+1} / {Math.max(1,Math.ceil(filtradas.length/25))}</span><button disabled={(pagina+1)*25>=filtradas.length} onClick={()=>setPagina(p=>p+1)}>Siguiente</button><button className="s911-primary" disabled={!editable||busy||errores.length>0} onClick={()=>setAccion('GUARDAR')}>Confirmar fuentes seleccionadas</button></div>
      {errores.length>0&&<div className="s911-notice"><strong>Para habilitar la confirmación:</strong><ul>{errores.slice(0,8).map((e,n)=><li key={n}>{e}</li>)}</ul>{errores.length>8&&<p>Hay {errores.length-8} observaciones adicionales en la selección.</p>}</div>}
    </>}
    <ModalConfirmacion isOpen={Boolean(accion)} title={['RECARGAR','CICLO'].includes(accion)?'Descartar preparación del lote':accion==='TIPO'?'Asignar tipo de ingreso':accion==='INFERENCIA'?'Aplicar propuestas revisadas':'Confirmar fuentes 911'} message={['RECARGAR','CICLO'].includes(accion)?'Se descartarán las selecciones, propuestas y ediciones del lote que aún no confirmaste. Las fuentes guardadas se conservan.':accion==='TIPO'?`Se asignará ${tipoMasivo} a ${seleccion.length} seleccionados, incluso en otras páginas. Aún no se guarda en la base.`:accion==='INFERENCIA'?`Se usarán solo propuestas utilizables de los seleccionados. ${reemplazar?'Se reemplazarán fechas existentes.':'Se conservarán fechas existentes.'} El tipo se propone únicamente si estaba pendiente. La fecha de inscripción en el ciclo no cambia.`:`Se guardarán ${seleccion.length} fuentes en una operación. Confirma vigencia, tipo, fechas y respaldo. Si otro usuario cambió una fuente, el lote se rechazará para evitar sobrescribirla. ${editado&&seleccion.length<filas.length?'Las ediciones de filas no seleccionadas se descartarán al recargar; cancela para incluirlas.':''}`} onCancel={()=>setAccion('')} onConfirm={confirmar} confirmText={accion==='GUARDAR'?'Guardar fuentes':'Aplicar a seleccionados'}/>
  </section>;
}
