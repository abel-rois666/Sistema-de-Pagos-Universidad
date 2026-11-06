import { useId, type ReactNode } from 'react';
import AyudaContextual from './AyudaContextual';

/** Contexto consultable, sin caret ni apariencia de control de captura. */
export default function DatoInformativo({etiqueta,ayuda,valor,children,className=''}:{
  etiqueta:string;ayuda?:string;valor:ReactNode;children?:ReactNode;className?:string;
}) {
  const id=useId();
  return <div className={`dato-informativo ${className}`} role="group" aria-labelledby={id}>
    <div className="campo-con-ayuda-etiqueta"><span id={id} className="dato-informativo-etiqueta">{etiqueta}</span>
      {ayuda&&<AyudaContextual etiqueta={etiqueta} texto={ayuda}/>}</div>
    <div className="dato-informativo-valor">{valor}</div>
    {children&&<div className="dato-informativo-descripcion">{children}</div>}
  </div>;
}
