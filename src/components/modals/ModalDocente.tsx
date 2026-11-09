import { useRef } from 'react';
import type { Docente } from '../../types';
import FichaPersonal from '../personal/FichaPersonal';
interface Props {isOpen:boolean;key?:string;onClose:()=>void;docente?:Docente|null;onDocenteSaved?:()=>void|Promise<void>;readOnly?:boolean}
function Contenido({onClose,docente,onDocenteSaved,readOnly}:Omit<Props,'isOpen'>){
 const nuevoId=useRef(crypto.randomUUID());
 return <FichaPersonal origen={{tipo:'DOCENTE',id:docente?.id||nuevoId.current,nuevo:!docente}} docente={docente} onClose={onClose} onSaved={onDocenteSaved} lecturaInicial={readOnly}/>;
}
export default function ModalDocente({isOpen,...props}:Props){return isOpen?<Contenido key={props.docente?.id||'nuevo'} {...props}/>:null;}
