import type { DatosPersona } from '../../personal/types';
import { edadPersonal } from '../../personal/presentacion';
import Campo from './CampoPersonal';
import NombresPersonal from './NombresPersonal';
export default function GeneralesPersonal({datos,onCambiar,lectura,original,revisado,onRevisado,habilitado}:{datos:DatosPersona;onCambiar:(d:DatosPersona)=>void;lectura:boolean;original:DatosPersona|null;revisado:boolean;onRevisado:(v:boolean)=>void;habilitado:boolean}){
  const cambiar=(k:keyof DatosPersona,v:string)=>onCambiar({...datos,[k]:v||null});
  return <><NombresPersonal datos={datos} original={original} onCambiar={onCambiar} lectura={lectura} revisado={revisado} onRevisado={onRevisado} habilitado={habilitado}/><div className="personal-grid">
    <Campo etiqueta="RFC" valor={datos.rfc} onCambiar={v=>cambiar('rfc',v.toUpperCase())} lectura={lectura} maxLength={13}/><Campo etiqueta="CURP" valor={datos.curp} onCambiar={v=>cambiar('curp',v.toUpperCase())} lectura={lectura} maxLength={18}/>
    <Campo etiqueta="Correo electrónico" tipo="email" valor={datos.email} onCambiar={v=>cambiar('email',v)} lectura={lectura}/><Campo etiqueta="Teléfono" tipo="tel" valor={datos.telefono} onCambiar={v=>cambiar('telefono',v)} lectura={lectura}/>
    <Campo etiqueta="Fecha de nacimiento" tipo="date" valor={datos.fecha_nacimiento} onCambiar={v=>cambiar('fecha_nacimiento',v)} lectura={lectura}/><div><label>Edad</label><p>{edadPersonal(datos.fecha_nacimiento)===null?'Sin registrar':`${edadPersonal(datos.fecha_nacimiento)} años`}</p></div>
    <Campo etiqueta="Sexo" valor={datos.sexo} onCambiar={v=>cambiar('sexo',v)} lectura={lectura} opciones={['Femenino','Masculino','No especificado']}/><Campo etiqueta="Estado civil" valor={datos.estado_civil} onCambiar={v=>cambiar('estado_civil',v)} lectura={lectura} opciones={['Casado/a','Divorciado/a','Soltero/a','Unión libre','Viudo/a','Otro']}/>
    <div className="personal-ancho"><Campo etiqueta="Domicilio" valor={datos.direccion} onCambiar={v=>cambiar('direccion',v)} lectura={lectura}/></div></div>
  </>;
}
