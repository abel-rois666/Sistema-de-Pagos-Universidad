import SelectorBusqueda from '../ui/SelectorBusqueda';
import type {CandidatoCertificacion} from '../../services/certificacionLoteService';
export default function ProgramaDestinoLote({ficha,value,disabled,onChange}:{ficha:CandidatoCertificacion;value:string;disabled:boolean;onChange:(id:string)=>void}){
 const opciones=ficha.opciones||[];
 return <div className="cert-lote-destino"><label htmlFor={`destino-${ficha.id}`}>Programa que recibirá la ficha</label><SelectorBusqueda id={`destino-${ficha.id}`} etiqueta={`Programa para ${ficha.nombre}`} value={value} disabled={disabled||!ficha.revisable} opciones={opciones.filter(o=>o.disponible).map(o=>({value:o.id,label:o.etiqueta})).sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}))} onChange={onChange}/>{opciones.filter(o=>!o.disponible).map(o=><small key={o.id}>{o.etiqueta}: {o.motivo}</small>)}</div>;
}
