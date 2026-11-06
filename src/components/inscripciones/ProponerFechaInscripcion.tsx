import { useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { consultarHistorialInscripciones } from '../../services/historialInscripcionesService';
import { aplicarFechaInscripcion, proponerFechaInscripcion, type DestinoFechaInscripcion } from '../../inscripciones/fechaPropuesta';
import type { HistorialInscripcion } from '../../inscripciones/historial';
import type { CandidatoInscripcion, CapturaInscripcion } from '../../inscripciones/types';

export default function ProponerFechaInscripcion({filas,destino,habilitado,ocupado,onAplicar}:{
  filas:{candidato:CandidatoInscripcion;captura:CapturaInscripcion}[];destino?:DestinoFechaInscripcion;habilitado:boolean;ocupado:boolean;
  onAplicar:(capturas:Record<string,CapturaInscripcion>)=>void;
}) {
  const [abierto,setAbierto]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [historias,setHistorias]=useState<HistorialInscripcion[]>([]),[seleccion,setSeleccion]=useState<string[]>([]),[pagina,setPagina]=useState(0),[revisado,setRevisado]=useState(false);
  const propuestas=filas.map(f=>{const h=historias.find(h=>h.alumno_programa_id===f.candidato.alumno_programa_id);return {...f,h,p:h?proponerFechaInscripcion(f.candidato,f.captura,h,destino):{fecha:null,cicloFecha:null,origen:null,motivo:'No hay historial verificable para este programa.',motivoOrigen:'No hay historial verificable.',materias:0}};});
  const visibles=propuestas.slice(pagina*10,pagina*10+10),idsPagina=visibles.filter(x=>x.p.fecha||x.p.origen).map(x=>x.candidato.alumno_programa_id);
  const elegidas=propuestas.filter(x=>seleccion.includes(x.candidato.alumno_programa_id)&&(x.p.fecha||x.p.origen)&&x.h);
  async function consultar(){
    setAbierto(true);setBusy(true);setError('');setHistorias([]);setSeleccion([]);setPagina(0);setRevisado(false);
    try{setHistorias(await consultarHistorialInscripciones(filas.map(f=>f.candidato)));}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  function aplicar(){
    try{
      const cambios=Object.fromEntries(elegidas.map(x=>[x.candidato.alumno_programa_id,aplicarFechaInscripcion(x.candidato,x.captura,x.h!,destino)]));
      onAplicar(cambios);setAbierto(false);toast.success(`${elegidas.length} propuestas históricas aplicadas al formulario; aún no se guardan.`);
    }catch(e){toast.error((e as Error).message);}
  }
  return <div className="ic-ancho ic-proponer-fecha"><strong>Completar ingreso al programa y último ciclo cursado</strong>
    <p>El ingreso al programa se propone desde el ciclo más antiguo con calificaciones; el origen, desde el último ciclo anterior al destino con calificaciones. No requiere notas en el ciclo actual. Se conservan los campos ya completados.</p><small>El guardado seguirá exigiendo fechas y documentos para todos los alumnos del lote; revisa por separado a quienes no tengan una propuesta utilizable.</small>
    <button type="button" disabled={!habilitado||ocupado||busy||!destino||filas.length>500} onClick={()=>void consultar()}>Revisar fechas desde las calificaciones</button>
    {!habilitado&&<small>La propuesta requiere la actualización de fechas de inscripción en Supabase. Puedes seguir capturando las fechas manualmente.</small>}
    {abierto&&<div className="ic-modal" role="dialog" aria-modal="true" aria-label="Revisar fechas de inscripción propuestas"><section className="ic-dialog">
      <header><div><small>PROPUESTAS / {destino?.nombre} · {destino?.tipo_periodo}</small><h2>Fecha histórica y origen: propuestas</h2></div><button type="button" aria-label="Cerrar propuestas de fecha" onClick={()=>setAbierto(false)}><X size={20}/></button></header>
      <div className="ic-body"><p className="ic-nota">«Primer ingreso a este programa» toma el inicio del ciclo más antiguo con calificaciones del mismo alumno y plan. La fecha de inscripción en el destino se captura por separado. «Ciclo anterior de origen» toma el último ciclo con calificaciones anterior al destino. La fecha es aproximada; confirma con documentación la inscripción al ciclo actual. No se cambia el grado ni se confirma matrícula al aplicar.</p>
        {busy?<p role="status">Consultando el historial del mismo alumno y plan…</p>:error?<p className="ic-aviso" role="alert">{error}</p>:<>
          <div className="ic-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Seleccionar fechas de la página" disabled={!idsPagina.length} checked={idsPagina.length>0&&idsPagina.every(id=>seleccion.includes(id))} onChange={e=>setSeleccion(ids=>e.target.checked?[...new Set([...ids,...idsPagina])]:ids.filter(id=>!idsPagina.includes(id)))}/></th><th>Alumno / programa</th><th>Ingreso al programa propuesto</th><th>Ciclo anterior propuesto</th><th>Respaldo y revisión</th></tr></thead><tbody>{visibles.map(x=><tr key={x.candidato.alumno_programa_id}><td><input type="checkbox" aria-label={`Usar fecha de ${x.candidato.matricula}`} disabled={!x.p.fecha&&!x.p.origen} checked={seleccion.includes(x.candidato.alumno_programa_id)} onChange={e=>setSeleccion(ids=>e.target.checked?[...ids,x.candidato.alumno_programa_id]:ids.filter(id=>id!==x.candidato.alumno_programa_id))}/></td><td><strong>{x.candidato.nombre}</strong><small>{x.candidato.matricula} · {x.candidato.programa}</small></td><td>{x.p.fecha||'Se conserva / revisión manual'}<small>{x.captura.fecha_primer_ingreso?`Capturada: ${x.captura.fecha_primer_ingreso}`:''}</small>{x.p.cicloFecha&&<small>{x.p.cicloFecha.nombre} · {x.p.cicloFecha.tipo_periodo}</small>}</td><td>{x.p.origen?`${x.p.origen.nombre} · ${x.p.origen.tipo_periodo}`:x.captura.ciclo_origen_id?'Se conserva el origen capturado':'Sin propuesta'}<small>{x.p.motivoOrigen}</small></td><td>{x.p.motivo}{x.p.fecha&&<small>{x.p.materias} {x.p.materias===1?'materia':'materias'} con calificaciones · {x.p.cicloFecha?.nombre} · {x.p.cicloFecha?.tipo_periodo}</small>}</td></tr>)}</tbody></table></div>
          <nav className="ic-paginacion"><button type="button" disabled={!pagina} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>{pagina+1} / {Math.max(1,Math.ceil(filas.length/10))} · {elegidas.length} seleccionados</span><button type="button" disabled={(pagina+1)*10>=filas.length} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></nav>
          <label className="ic-check"><input type="checkbox" checked={revisado} onChange={e=>setRevisado(e.target.checked)}/>Revisé las fechas históricas aproximadas y los ciclos de origen seleccionados. Completaré evidencia y motivo antes de confirmar la inscripción.</label>
        </>}
      </div><footer><button type="button" onClick={()=>setAbierto(false)}>Cancelar</button><button type="button" className="ic-primario" disabled={busy||Boolean(error)||!revisado||!elegidas.length} onClick={aplicar}>Usar propuestas revisadas ({elegidas.length})</button></footer>
    </section></div>}
  </div>;
}
