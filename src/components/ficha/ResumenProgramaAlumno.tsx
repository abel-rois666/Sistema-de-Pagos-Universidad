import type { AlumnoPrograma } from '../../types';
import './programasFicha.css';

/** Resumen de referencia: las operaciones académicas pertenecen a Trayectoria. */
export default function ResumenProgramaAlumno({programas,cargando=false,error=false,onVerTrayectoria}:{
  programas:AlumnoPrograma[];cargando?:boolean;error?:boolean;onVerTrayectoria?:(id:string)=>void;
}) {
  const principales=programas.filter(p=>p.es_vigente),programa=principales[0]||programas[0];
  return <section className="programa-resumen-breve" aria-label="Resumen del programa principal">
    <div><small>{principales.length===1?'Programa principal':'Programa de referencia'}</small>
      <p>{cargando?'Consultando programa…':error?'No se pudo consultar el programa':programa?`${programa.planes_estudio?.carreras?.nombre||programa.planes_estudio?.nombre||'Programa sin nombre'}${programa.planes_estudio?.clave_legado?` · ${programa.planes_estudio.clave_legado}`:''}`:'Sin programa asociado'}</p>
      {!cargando&&!error&&programa&&<span>{programa.estatus} {principales.length!==1?'· Principal pendiente de revisión':''}</span>}
    </div>
    {!cargando&&onVerTrayectoria&&<button type="button" onClick={()=>onVerTrayectoria(programa?.id||'')}>Ver trayectoria</button>}
  </section>;
}
