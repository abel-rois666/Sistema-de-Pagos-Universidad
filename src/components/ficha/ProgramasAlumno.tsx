import type { GestionProgramasAlumno } from '../../hooks/useGestionProgramasAlumno';
import type { AlumnoPrograma } from '../../types';
import { useRef } from 'react';
import './programasFicha.css';

export default function ProgramasAlumno({gestion:g,seleccion,onConsultar,onRevisarRetiro}:{gestion:GestionProgramasAlumno;seleccion:string;onConsultar:(id:string)=>void;onRevisarRetiro?:(programa:AlumnoPrograma)=>void}) {
  const lista=useRef<HTMLDetailsElement>(null);
  return <details ref={lista} className="programas-alumno" aria-label="Programas del alumno"><summary>Programas del alumno <span>({g.programas.length})</span></summary>
    <p>Consulta un programa para revisar su ingreso e inscripciones. La selección no cambia el programa principal.</p>
    <div className="programas-alumno-lista">{[...g.programas].sort((a,b)=>g.formatPlanName(a).localeCompare(g.formatPlanName(b),'es',{numeric:true})).map(p=><article key={p.id}>
      <div><h4>{g.formatPlanName(p)}</h4><p>{p.planes_estudio?.clave_legado||'Sin clave'} · {p.planes_estudio?.nombre}</p>
        <div className="programas-etiquetas"><span>{p.estatus}</span>{p.es_vigente&&<strong>Principal</strong>}{p.motivo_estatus&&<span>{p.motivo_estatus.replaceAll('_',' ')}</span>}</div>
      </div>
      <div className="programas-alumno-acciones"><button type="button" aria-pressed={seleccion===p.id} onClick={()=>{onConsultar(p.id);if(lista.current)lista.current.open=false;}}>{seleccion===p.id?'Consultando':'Consultar'}</button>
        {g.canManageProgramas&&!p.es_vigente&&<button type="button" disabled={g.submittingPrograma} onClick={()=>g.handleActivarProgramaRapido(p)}>Establecer principal</button>}
        {g.isAdmin&&onRevisarRetiro&&<button type="button" disabled={g.submittingPrograma} onClick={()=>onRevisarRetiro(p)}>Revisar asociación errónea</button>}
      </div>
    </article>)}</div>
    {!g.loadingProgramas&&!g.errorProgramas&&!g.programas.length&&<p>No hay programas asociados. Usa «Administrar programas» para agregar uno.</p>}
  </details>;
}
