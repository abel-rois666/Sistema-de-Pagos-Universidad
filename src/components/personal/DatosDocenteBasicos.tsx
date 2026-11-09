import { useId } from 'react';
import type { Docente } from '../../types';
import DatoPersonal from './DatoPersonal';
import NombresPersonal from './NombresPersonal';
import { CampoConAyuda } from '../ui/AyudaContextual';

export default function DatosDocenteBasicos({valor,onCambiar,lectura,existente,ocupado=false}:{valor:Partial<Docente>;onCambiar:(valor:Partial<Docente>)=>void;lectura:boolean;existente:boolean;ocupado?:boolean}) {
  const id=useId();
  const cambiar=(campo:keyof Docente,texto:string)=>onCambiar({...valor,[campo]:texto});
  if(lectura)return <dl className="personal-grid"><DatoPersonal etiqueta="Clave docente" valor={valor.clave_legado}/><DatoPersonal etiqueta="Nombre completo" valor={valor.nombre_completo}/><DatoPersonal etiqueta="RFC" valor={valor.rfc}/><DatoPersonal etiqueta="CURP" valor={valor.curp}/><DatoPersonal etiqueta="Correo electrónico" valor={valor.email}/><DatoPersonal etiqueta="Habilitación docente" valor={valor.estatus==='activo'?'Activo para docencia':'Inactivo para docencia'}/></dl>;
  return <><NombresPersonal datos={{nombre_completo:valor.nombre_completo||''}} original={{nombre_completo:valor.nombre_completo||''}} onCambiar={()=>{}} lectura={false} revisado={false} onRevisado={()=>{}} habilitado={false}/><fieldset disabled={ocupado} className="personal-grid">
    <CampoConAyuda etiqueta="Clave docente" ayuda="Identifica al docente en cuentas, asignaciones y horarios. Una clave existente se conserva al ampliar su ficha.">{existente?<p className="personal-dato">{valor.clave_legado}</p>:<input id={`${id}-clave`} value={valor.clave_legado||''} onChange={e=>cambiar('clave_legado',e.target.value.toUpperCase())} required/>}</CampoConAyuda>

    <div><label htmlFor={`${id}-rfc`}>RFC</label><input id={`${id}-rfc`} value={valor.rfc||''} onChange={e=>cambiar('rfc',e.target.value.toUpperCase())} maxLength={13}/></div>
    <div><label htmlFor={`${id}-curp`}>CURP</label><input id={`${id}-curp`} value={valor.curp||''} onChange={e=>cambiar('curp',e.target.value.toUpperCase())} maxLength={18}/></div>
    <div><label htmlFor={`${id}-email`}>Correo electrónico</label><input id={`${id}-email`} type="email" value={valor.email||''} onChange={e=>cambiar('email',e.target.value)} autoComplete="email"/></div>
    <CampoConAyuda etiqueta="Habilitación docente" ayuda="Controla la actividad docente. No sustituye la situación laboral ni cambia contratos administrativos."><select id={`${id}-estatus`} value={valor.estatus||'activo'} onChange={e=>cambiar('estatus',e.target.value)}><option value="activo">Activo para docencia</option><option value="inactivo">Inactivo para docencia</option></select></CampoConAyuda>
  </fieldset></>;
}
