import type {Expediente911,Fuente911} from '../../estadistica911/types';
import {valorRespuesta} from '../../estadistica911/types';
import {instanciaAplica911,nombreOferta911,motivoNoPertinente911} from '../../estadistica911/guia';
export default function ResumenCuestionarios911({exp,fuentes,onAbrir}:{exp:Expediente911;fuentes:Record<string,Fuente911>;onAbrir:(id:string)=>void}) {
  return <section className="s911-card"><h2>Avance por cuestionario</h2><p>Abre una oferta o un cuestionario general para revisar sus respuestas. Las preguntas se filtran según el nivel y la modalidad confirmados en «Oferta educativa». Esta barra indica respuestas revisadas; el cierre requiere además comprobar fuentes, reglas y revisiones de sección.</p>
    {exp.config.guiaVersion&&!exp.config.ofertaConfirmada&&<p className="s911-warning">Completa «Oferta educativa» para habilitar la captura específica y el filtrado por nivel y modalidad.</p>}
    <div className="s911-resumen">{exp.instancias.filter(instanciaAplica911).map(i=>{
      const campos=(fuentes[i.cuestionario]?.campos||[]).filter(f=>/^[VE]\d+$/.test(f.codigo)&&!motivoNoPertinente911(exp,i,f.codigo));
      const revisadas=campos.filter(f=>i.respuestas[f.codigo]?.revisada&&valorRespuesta(i.respuestas[f.codigo])!==null).length;
      return <button key={i.id} onClick={()=>onAbrir(i.id)}><strong>{nombreOferta911(i)}</strong><small>{i.identidad.CV_PLAN_ESTUDIOS?`Plan ${i.identidad.CV_PLAN_ESTUDIOS} · `:''}{revisadas} de {campos.length} preguntas revisadas</small><progress max={campos.length||1} value={revisadas}/></button>;
    })}</div>
    {exp.instancias.some(i=>!instanciaAplica911(i))&&<details><summary>Ofertas documentadas fuera de este reporte</summary>{exp.instancias.filter(i=>!instanciaAplica911(i)).map(i=><p key={i.id}>{nombreOferta911(i)}: {i.correspondencia.motivoNoAplica}</p>)}</details>}
  </section>;
}
