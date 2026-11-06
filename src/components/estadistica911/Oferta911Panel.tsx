import { CampoConAyuda } from '../ui/AyudaContextual';
import { AYUDAS_911 as ayuda } from './ayudas911';
import type { Expediente911, Instancia911 } from '../../estadistica911/types';
import { GUIA_VERSION911, NIVELES911, erroresOferta911, nombreOferta911, nivelSugerido911,nivelPlan911 } from '../../estadistica911/guia';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import { useState } from 'react';

export default function Oferta911Panel({exp,planes,editable,onChange}:{exp:Expediente911;planes:any[];editable:boolean;onChange:(e:Expediente911)=>void}) {
  const [cambio,setCambio]=useState<Instancia911|null>(null);
  function actualizar(i:Instancia911) {
    onChange({...exp,config:{...exp.config,guiaVersion:GUIA_VERSION911,ofertaConfirmada:false},
      instancias:exp.instancias.map(x=>x.id===i.id?i:x),revisiones:{},corteCalculado:''});
  }
  const revisar={...exp,config:{...exp.config,guiaVersion:GUIA_VERSION911,ofertaConfirmada:true}};
  const errores=[...erroresOferta911(revisar),...exp.instancias.filter(i=>i.correspondencia.aplica!=='NO_APLICA').flatMap(i=>planes.filter(p=>i.correspondencia.planes.includes(p.id)&&nivelPlan911(p)&&nivelPlan911(p)!==(i.correspondencia.nivel||nivelSugerido911(i))).map(p=>`${nombreOferta911(i)}: ${p.clave_legado} pertenece a otro nivel educativo`))];
  return <div className="s911-stack"><section className="s911-card"><p className="s911-eyebrow">PASO 2 / OFERTA EDUCATIVA</p><h2>Relaciona cada oferta con sus planes</h2>
    <p>Las claves vienen de la descarga oficial. Confirma el nivel, los planes internos y si hubo actividad actual o resultados del año anterior. Un plan antiguo puede seguir teniendo egresados o titulados.</p>
    <p className="s911-notice">Turno Mixto y modalidad Mixta son datos distintos. La modalidad de esta descarga se conserva; una discrepancia con tus planes necesita homologación antes de confirmar.</p>
    {exp.instancias.filter(i=>['carrera','posgrado'].includes(i.cuestionario)).map(i=>{
      const c=i.correspondencia, nivel=c.nivel||nivelSugerido911(i);
      const opciones=planes.filter(p=>!nivelPlan911(p)||nivelPlan911(p)===nivel||c.planes.includes(p.id)).sort((a,b)=>String(a.nombre).localeCompare(b.nombre,'es',{numeric:true}));
      return <details className="s911-oferta" key={i.id}><summary><strong>{nombreOferta911(i)}</strong><span>Plan oficial {i.identidad.CV_PLAN_ESTUDIOS} · {c.aplica==='NO_APLICA'?'Fuera del reporte':c.confirmada?'Correspondencia confirmada':'Por confirmar'}</span></summary>
        <fieldset disabled={!editable} className="s911-grid">
          <CampoConAyuda etiqueta="¿Esta oferta participa en el reporte?" ayuda={ayuda.oferta}><select value={c.aplica||'APLICA'} onChange={e=>{
            const n={...i,correspondencia:{...c,aplica:e.target.value as 'APLICA'|'NO_APLICA',confirmada:false}};
            if(e.target.value==='NO_APLICA')setCambio(n);else actualizar(n);
          }}><option value="APLICA">Corresponde: matrícula, ingresos, egresados o titulados</option><option value="NO_APLICA">No corresponde a este reporte (requiere justificación)</option></select></CampoConAyuda>
          {c.aplica==='NO_APLICA'?<><label>Motivo (mínimo 20 caracteres)<textarea value={c.motivoNoAplica||''} onChange={e=>actualizar({...i,correspondencia:{...c,motivoNoAplica:e.target.value}})}/></label><label>Evidencia de revisión actual e histórica<textarea value={c.evidenciaNoAplica||''} onChange={e=>actualizar({...i,correspondencia:{...c,evidenciaNoAplica:e.target.value}})}/></label></>:<>
            <label>Nivel de la oferta<select value={c.nivel||''} onChange={e=>actualizar({...i,correspondencia:{...c,nivel:e.target.value,confirmada:false}})}><option value="">{nivel?`Sugerido: ${NIVELES911[nivel as keyof typeof NIVELES911]}`:'Selecciona el nivel'}</option>{Object.entries(NIVELES911).filter(([k])=>nivelSugerido911(i)?k===nivelSugerido911(i):i.cuestionario==='carrera'?['TSU','LICENCIATURA'].includes(k):['ESPECIALIDAD','MAESTRIA','DOCTORADO'].includes(k)).map(([k,n])=><option key={k} value={k}>{n}</option>)}</select></label>
            <CampoConAyuda etiqueta="Periodos escolares por año" ayuda={ayuda.periodos}><input type="number" min={1} max={6} value={c.periodosPorAnio||''} placeholder="Semestral: 2 · Cuatrimestral: 3" onChange={e=>actualizar({...i,correspondencia:{...c,periodosPorAnio:Number(e.target.value),confirmada:false}})}/><small>Confirma la estructura oficial. En créditos o flexible se acredita el avance individual.</small></CampoConAyuda>
            <div className="s911-span"><h3>Planes internos correspondientes</h3><p>Selecciona solo equivalencias verificadas; un plan no puede asignarse a dos ofertas.</p><div className="s911-check-list">{opciones.map(p=>{
              const otro=exp.instancias.some(x=>x.id!==i.id&&x.correspondencia.aplica!=='NO_APLICA'&&x.correspondencia.planes.includes(p.id));
              return <label key={p.id} className="s911-check"><input type="checkbox" checked={c.planes.includes(p.id)} disabled={otro&&!c.planes.includes(p.id)} onChange={e=>actualizar({...i,correspondencia:{...c,planes:e.target.checked?[...c.planes,p.id]:c.planes.filter(k=>k!==p.id),confirmada:false}})}/><span>{p.clave_legado} · {p.nombre}<small>{p.tipo_periodo} · Modalidad {p.modalidad} · {nivelPlan911(p)||'Nivel del catálogo interno por verificar'}{otro?' · Ya asociado a otra oferta':''}</small></span></label>;
            })}</div></div>
            <label className="s911-check s911-span"><input type="checkbox" checked={c.confirmada} onChange={e=>actualizar({...i,correspondencia:{...c,confirmada:e.target.checked,nivel:c.nivel||nivelSugerido911(i),nombre:c.nombre||nombreOferta911(i)}})}/>He revisado la equivalencia de nivel, modalidad, estructura y planes</label>
          </>}
        </fieldset>
      </details>;
    })}
  </section><section className="s911-card"><h2>Confirmar el alcance del reporte</h2><p>Las preguntas de oferta se filtrarán según los niveles y modalidades confirmados. Las preguntas de formación del personal se conservan aunque mencionen otros niveles.</p>
    {errores.length>0&&<ul>{errores.map(e=><li key={e}>{e}</li>)}</ul>}
    <button className="s911-primary" disabled={!editable||errores.length>0} onClick={()=>onChange({...revisar,corteCalculado:'',revisiones:{}})}>{exp.config.ofertaConfirmada?'Oferta confirmada · recalcula si cambió':'Confirmar oferta y pertinencia'}</button>
  </section><ModalConfirmacion isOpen={Boolean(cambio)} title="Excluir oferta de este reporte" message="La oferta y sus datos se conservarán, pero no contribuirán a las cifras ni se exportarán como cuestionario aplicable. Revisa también egresados y titulados del periodo anterior. Deberás documentar el motivo y volver a calcular." onCancel={()=>setCambio(null)} onConfirm={()=>{if(cambio)actualizar(cambio);setCambio(null);}}/></div>;
}
