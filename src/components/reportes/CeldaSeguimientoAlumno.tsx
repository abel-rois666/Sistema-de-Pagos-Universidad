import type { PaymentPlan } from '../../types';
import { certificacionesAlumno, estadoPagoCertificado, estadoTramiteCertificado, etiquetaProgramaCertificado, planesTitulacionAlumno, type ResumenCertificacion } from '../../certificacion/seguimiento';
import { resumirPagoTitulacion } from '../../reportes/estadoPagoTitulacion';
import type { DestinoAlumnoReporte } from './ConsultaAlumnoReporte';

export default function CeldaSeguimientoAlumno({alumnoId,campo,certificaciones,planes,onAbrir}:{alumnoId:string;campo:'pagoTitulacion'|'pagoCertificado'|'certificacion';certificaciones:readonly ResumenCertificacion[];planes:readonly PaymentPlan[];onAbrir:(destino:DestinoAlumnoReporte)=>void}){
  const boton='text-left text-sm rounded px-1 py-1 underline decoration-dotted underline-offset-4 text-blue-700 dark:text-blue-300 hover:decoration-solid focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500';
  if(campo==='pagoTitulacion'){
    const propios=planesTitulacionAlumno(planes,alumnoId);
    return <div className="space-y-2">{propios.length?propios.map(p=><button key={p.id} type="button" className={boton+' block'} onClick={()=>onAbrir({alumnoId,vista:'plan',planId:p.id})}><span className="block font-semibold">{resumirPagoTitulacion(p)}</span>{propios.length>1&&<span className="block text-xs">{p.ciclo_escolar||'Sin ciclo'} · {p.no_plan_pagos||'Sin folio'}</span>}</button>):<button type="button" className={boton} onClick={()=>onAbrir({alumnoId,vista:'plan'})}>Sin plan</button>}</div>;
  }
  const propias=certificacionesAlumno(certificaciones,alumnoId);
  return <div className="space-y-2">{propias.length?propias.map(f=><button type="button" key={`${f.alumno_programa_id||'legado'}/${f.id||''}`} className={boton+' block'} onClick={()=>onAbrir({alumnoId,vista:'certificacion',programaId:f.alumno_programa_id||'__legado__'})}><span className="block font-semibold">{campo==='pagoCertificado'?estadoPagoCertificado(f):estadoTramiteCertificado(f)}</span><span className="block text-xs">{etiquetaProgramaCertificado(f)}</span></button>):<button type="button" className={boton} onClick={()=>onAbrir({alumnoId,vista:'certificacion'})}>Sin registro</button>}</div>;
}
