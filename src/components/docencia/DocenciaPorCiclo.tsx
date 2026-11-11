import { useMemo,useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useContextoDocencia } from '../../hooks/useContextoDocencia';
import { adaptarPublicacionDocente } from '../../docencia/publicacion';
import SelectorCicloModulo from '../ui/SelectorCicloModulo';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import ExpedienteAsignatura from './ExpedienteAsignatura';
import MateriasAsignadasDocente from './MateriasAsignadasDocente';
import './docencia.css';
interface Props {vista:'expediente'|'materias';docenteId:string;nombre:string;onVolver:()=>void;onActividad:(c:boolean,b:boolean)=>void}
export default function DocenciaPorCiclo({vista,docenteId,nombre,onVolver,onActividad}:Props){
 const {ciclos,activeCicloId}=useAppStore(),[ciclo,setCiclo]=useState(ciclos.some(c=>c.id===activeCicloId)?activeCicloId:''),[cambios,setCambios]=useState(false),[ocupado,setOcupado]=useState(false),[accion,setAccion]=useState<(()=>void)|null>(null);
 const q=useContextoDocencia(docenteId,ciclo||'');
 const adaptado=useMemo(()=>{try{return {datos:q.contexto?adaptarPublicacionDocente(q.contexto,docenteId,nombre):null,error:''};}catch(e){return {datos:null,error:(e as Error).message};}},[q.contexto,docenteId,nombre]);
 const solicitar=(a:()=>void)=>{if(ocupado)return;if(cambios)setAccion(()=>a);else a();};
 const actividad=(c:boolean,b:boolean)=>{setCambios(c);setOcupado(b);onActividad(c,b);};
 return <div className="docencia-vista"><div className="docencia-barra"><button className="personal-boton" disabled={ocupado} onClick={onVolver}>← Volver a Docencia</button><h3>{vista==='expediente'?'Expediente de asignatura':'Materias asignadas por ciclo'}</h3></div><div className="docencia-barra"><SelectorCicloModulo ciclos={ciclos} cicloId={ciclo||''} onChange={id=>solicitar(()=>setCiclo(id))} disabled={ocupado} label="Ciclo escolar" ayuda="Consulta la publicación vigente del ciclo exacto. Este selector no cambia el contexto de otros módulos."/><button className="personal-boton" disabled={ocupado||q.cargando||!ciclo} onClick={()=>solicitar(()=>void q.cargar())}>Actualizar consulta</button></div>
 {!ciclo?<p className="personal-aviso">Selecciona un ciclo escolar para consultar las asignaciones.</p>:q.cargando?<p role="status" className="personal-aviso">Consultando publicación y expediente…</p>:q.error||adaptado.error?<p role="alert" className="personal-aviso personal-error">{q.error||adaptado.error}</p>:q.contexto&&adaptado.datos?<>
 {(!q.contexto.publicacion||!q.contexto.cargas.length)&&<section className="personal-tarjeta"><h4>Sin materias publicadas para este docente</h4><p className="personal-nota">En Horarios académicos, elige este ciclo, configura las cargas y publica el horario. Esta sección mostrará las asignaciones publicadas; un borrador no es suficiente.</p></section>}
 {vista==='expediente'?<ExpedienteAsignatura key={`${ciclo}-${q.contexto.expediente.revision}`} contexto={q.contexto} docenteId={docenteId} materias={adaptado.datos.materias} onActividad={actividad} onGuardado={q.setContexto}/>:q.contexto.publicacion&&q.contexto.cargas.length>0&&<MateriasAsignadasDocente key={`${ciclo}-${q.contexto.financiero?.general.revision}-${q.contexto.financiero?.excepcion.revision}`} contexto={q.contexto} publicado={adaptado.datos} docenteId={docenteId} onActividad={actividad} onGuardado={q.setContexto}/>}
 </>:null}
 <ModalConfirmacion isOpen={Boolean(accion)} title="Hay cambios sin guardar" message="Puedes continuar editando o descartar la captura antes de cambiar la consulta." confirmText="Descartar y continuar" cancelText="Continuar editando" onCancel={()=>setAccion(null)} onConfirm={()=>{const ejecutar=accion;setAccion(null);setCambios(false);onActividad(false,false);ejecutar?.();}}/>
 </div>;
}
