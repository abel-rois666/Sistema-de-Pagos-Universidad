import type { ReactNode } from 'react';
export default function DatoPersonal({etiqueta,valor}:{etiqueta:string;valor:ReactNode}) {
  const vacio=valor===null||valor===undefined||valor==='';
  return <div className="personal-dato"><dt>{etiqueta}</dt><dd>{vacio?'Sin registrar':valor}</dd></div>;
}
