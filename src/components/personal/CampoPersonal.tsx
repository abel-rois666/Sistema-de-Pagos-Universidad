import { useId, type InputHTMLAttributes } from 'react';
import { fechaPersonal } from '../../personal/presentacion';
import { CampoConAyuda } from '../ui/AyudaContextual';
import '../ui/ayudaContextual.css';
export default function CampoPersonal({etiqueta,valor,onCambiar,lectura=false,opciones,ayuda,tipo='text',...props}:{etiqueta:string;valor:string|number|null|undefined;onCambiar:(v:string)=>void;lectura?:boolean;opciones?:readonly string[];ayuda?:string;tipo?:string}&Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'>){
  const id=useId();
  const campo=lectura?<p className="personal-dato">{valor===null||valor===undefined||valor===''?'Sin registrar':tipo==='date'?fechaPersonal(String(valor)):valor}</p>:opciones?<select id={id} value={valor??''} onChange={e=>onCambiar(e.target.value)}><option value="">Sin registrar</option>{valor&&!opciones.includes(String(valor))&&<option value={valor}>{valor} (registro anterior)</option>}{opciones.map(o=><option key={o}>{o}</option>)}</select>:<input {...props} id={id} type={tipo} value={valor??''} onChange={e=>onCambiar(e.target.value)}/>;
  return ayuda?<CampoConAyuda etiqueta={etiqueta} ayuda={ayuda}>{campo}</CampoConAyuda>:<div><label htmlFor={lectura?undefined:id}>{etiqueta}</label>{campo}</div>;
}
