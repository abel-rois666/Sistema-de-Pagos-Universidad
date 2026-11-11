import {ArrowRight,Trash2,X} from 'lucide-react';
import type {CandidatoCertificacion} from '../../services/certificacionLoteService';

interface Props {
 filas:CandidatoCertificacion[]; motivo:string; saving:boolean; bloqueado:boolean;
 onQuitar:(f:CandidatoCertificacion)=>void; onLimpiar:()=>void;
 onMotivo:(valor:string)=>void; onRevisar:()=>void;
}
/** Resumen visual del lote; no transforma ni guarda las asociaciones. */
export default function ResumenCertificacionesLote({filas,motivo,saving,bloqueado,onQuitar,onLimpiar,onMotivo,onRevisar}:Props){
 return <section className="cert-lote-resumen" aria-labelledby="titulo-resumen-lote">
  <div className="cert-lote-resumen-cabecera"><div><h3 id="titulo-resumen-lote">Lote por confirmar <span className="cert-lote-contador">{filas.length} / 50</span></h3><p>Fichas revisadas y seleccionadas, incluidas las de otras páginas.</p></div><button type="button" disabled={saving} onClick={onLimpiar}><Trash2 size={15} aria-hidden="true"/>Limpiar selección</button></div>
  {filas.length>0?<div className="cert-lote-seleccion" role="region" aria-label="Fichas seleccionadas y programas de destino" tabIndex={0}><div className="cert-lote-seleccion-titulos" aria-hidden="true"><span>Alumno</span><span>Programa de destino</span><span/></div><ul>{filas.map(f=><li key={f.id}>
   <div className="cert-lote-persona"><strong>{f.nombre}</strong><small>{f.matricula||'Sin matrícula'}</small></div>
   <div className="cert-lote-programa"><ArrowRight size={15} aria-hidden="true"/><span>{f.programa}</span></div>
   <button className="cert-lote-quitar" type="button" disabled={saving} onClick={()=>onQuitar(f)} aria-label={`Quitar a ${f.nombre} del lote`}><X size={15} aria-hidden="true"/><span>Quitar</span></button>
  </li>)}</ul></div>:<p className="cert-lote-vacio">Elige un programa y marca las fichas revisadas en la tabla para preparar el lote.</p>}
  <div className="cert-lote-resumen-pie"><div className="cert-lote-respaldo"><label htmlFor="respaldo-lote">Respaldo de la asignación</label><textarea id="respaldo-lote" rows={3} maxLength={1000} disabled={saving} value={motivo} onChange={e=>onMotivo(e.target.value)} aria-describedby="ayuda-respaldo-lote" placeholder="Describe la revisión institucional realizada."/><small id="ayuda-respaldo-lote">Mínimo 10 caracteres. Se conservará en la auditoría de las fichas.</small></div><div className="cert-lote-resumen-accion"><p>Primero revisarás los alumnos y sus destinos. La asociación se guarda al confirmar.</p><button className="cert-lote-primario" type="button" disabled={saving||bloqueado||!filas.length||motivo.trim().length<10} onClick={onRevisar}>Revisar lote ({filas.length})<ArrowRight size={16} aria-hidden="true"/></button></div></div>
 </section>;
}
