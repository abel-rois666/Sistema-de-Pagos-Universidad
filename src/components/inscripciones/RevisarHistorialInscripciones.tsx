import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { CandidatoInscripcion, CapturaInscripcion } from '../../inscripciones/types';
import { capturaDesdeHistorial, proponerDesdeHistorial, type HistorialInscripcion } from '../../inscripciones/historial';
import { consultarHistorialInscripciones } from '../../services/historialInscripcionesService';

export default function RevisarHistorialInscripciones({filas,destino,onClose,onAplicar}:{
  filas:CandidatoInscripcion[];destino:{id:string;nombre:string;fecha_inicio?:string|null};onClose:()=>void;
  onAplicar:(filas:CandidatoInscripcion[],capturas:Record<string,CapturaInscripcion>)=>void;
}) {
  const [historial,setHistorial]=useState<HistorialInscripcion[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  const [seleccion,setSeleccion]=useState<string[]>([]),[revisado,setRevisado]=useState(false),[pagina,setPagina]=useState(0);
  useEffect(()=>{let vigente=true;setBusy(true);
    consultarHistorialInscripciones(filas).then(h=>{if(vigente)setHistorial(h);}).catch(e=>{if(vigente)setError((e as Error).message);}).finally(()=>{if(vigente)setBusy(false);});
    return()=>{vigente=false;};
  },[filas]);
  const propuestas=useMemo(()=>filas.map(c=>{const h=historial.find(x=>x.alumno_programa_id===c.alumno_programa_id);return {c,h,p:h?proponerDesdeHistorial(c,h,destino):null};}),[filas,historial,destino]);
  const visibles=propuestas.slice(pagina*10,pagina*10+10),utilizable=(x:typeof propuestas[number])=>Boolean(x.h?.huella&&(x.p?.ingreso||x.p?.grado));
  const idsPagina=visibles.filter(utilizable).map(x=>x.c.alumno_programa_id);
  function aplicar() {
    const elegidas=propuestas.filter(x=>seleccion.includes(x.c.alumno_programa_id)&&x.p);
    onAplicar(elegidas.map(x=>x.c),Object.fromEntries(elegidas.map(({c,p,h})=>[c.alumno_programa_id,capturaDesdeHistorial(c,p!,h)])));
  }
  return <div className="ic-modal" role="dialog" aria-modal="true" aria-labelledby="ic-historial-titulo"><section className="ic-dialog">
    <header><div><small>RECONCILIACIÓN / {destino.nombre}</small><h2 id="ic-historial-titulo">Revisar trayectoria académica</h2></div><button aria-label="Cerrar historial" onClick={onClose}><X size={20}/></button></header>
    <div className="ic-body"><p className="ic-nota">Primero revisa los antecedentes; después completa la inscripción. El ingreso propuesto es aproximado: inicio del ciclo con calificaciones más antiguo disponible del mismo alumno y plan. Materias recursadas o adelantadas pueden impedir proponer un grado.</p>
      <p>Los datos acreditados se conservan. Aplicar lleva las propuestas al formulario y todavía exige fecha efectiva, evidencia y confirmación.</p>
      {!busy&&historial.some(h=>!h.huella)&&<p className="ic-aviso">Consulta informativa. Instala la migración de preparaciones y procedencia para aplicar propuestas verificables por el servidor.</p>}
      {busy&&<p role="status">Consultando calificaciones y fechas de los ciclos…</p>}{error&&<p className="ic-aviso" role="alert">{error}</p>}
      {!busy&&!error&&<><div className="ic-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Seleccionar propuestas de la página" checked={idsPagina.length>0&&idsPagina.every(id=>seleccion.includes(id))} onChange={e=>setSeleccion(s=>e.target.checked?[...new Set([...s,...idsPagina])]:s.filter(id=>!idsPagina.includes(id)))}/></th><th>Alumno y propuesta</th><th>Antecedentes y advertencias</th></tr></thead><tbody>{visibles.map(x=><tr key={x.c.alumno_programa_id}><td><input type="checkbox" aria-label={`Aplicar propuesta de ${x.c.matricula}`} disabled={!utilizable(x)} checked={seleccion.includes(x.c.alumno_programa_id)} onChange={e=>setSeleccion(s=>e.target.checked?[...s,x.c.alumno_programa_id]:s.filter(id=>id!==x.c.alumno_programa_id))}/></td><td><strong>{x.c.nombre}</strong><small>{x.c.matricula} · {x.c.programa}</small><p>Ingreso: {x.p?.ingreso?`${x.p.ingreso.nombre} · ${x.p.ingreso.fecha_inicio}`:'Por acreditar'}</p><p>Origen anterior: {x.p?.origen?.nombre||'Por revisar'}</p><p>Grado en {destino.nombre}: {x.p?.grado||'Por revisar'}</p>{x.c.inscripcion&&<small>Se conservan el grado y las fechas ya acreditados.</small>}</td><td><ul>{x.p?.avisos.map(a=><li key={a}>{a}</li>)}</ul><details><summary>Ver ciclos y materias considerados</summary>{x.h?.ciclos.map(c=><article key={c.id}><strong>{c.nombre} · {c.tipo_periodo}</strong><small>{c.fecha_inicio||'Sin fecha'}{c.inscripcion?` · Inscripción ${c.inscripcion.estado}, grado ${c.inscripcion.grado_personal}`:''}</small><ul>{c.materias.map(m=><li key={m.id}>{m.nombre} · periodo curricular {m.periodo??'sin definir'}{m.registros>1?` · ${m.registros} registros (una materia)`:''}</li>)}</ul></article>)}</details></td></tr>)}</tbody></table></div>
      <nav className="ic-paginacion"><button disabled={!pagina} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>Página {pagina+1} de {Math.max(1,Math.ceil(filas.length/10))} · {seleccion.length} propuestas seleccionadas</span><button disabled={(pagina+1)*10>=filas.length} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></nav>
      <label className="ic-check"><input type="checkbox" checked={revisado} onChange={e=>setRevisado(e.target.checked)}/>Revisé el historial disponible y sus limitaciones. Validaré los datos propuestos antes de confirmar la inscripción.</label></>}
    </div><footer><button onClick={onClose}>Cancelar</button><button className="ic-primario" disabled={busy||Boolean(error)||!seleccion.length||!revisado} onClick={aplicar}>Aplicar al formulario ({seleccion.length})</button></footer>
  </section></div>;
}
