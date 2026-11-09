import type { DatosPersona } from '../../personal/types';
import { cambioNombre,componerNombrePersonal,nombreEstructurado } from '../../personal/nombres';
import Campo from './CampoPersonal';

interface Props {
  datos:DatosPersona;original:DatosPersona|null;onCambiar:(d:DatosPersona)=>void;
  lectura:boolean;revisado:boolean;onRevisado:(v:boolean)=>void;habilitado?:boolean;
}
export default function NombresPersonal({datos,original,onCambiar,lectura,revisado,onRevisado,habilitado=true}:Props){
  const historico=original&&!nombreEstructurado(original),cambio=cambioNombre(datos,original);
  const cambiar=(campo:'nombres'|'apellido_paterno'|'apellido_materno',valor:string)=>{
    const d={...datos,[campo]:valor};
    d.nombre_completo=nombreEstructurado(d)?componerNombrePersonal(d):(original?.nombre_completo||'');
    onRevisado(false);onCambiar(d);
  };
  return <section className="personal-nombres" aria-label="Nombres y apellidos">
    {historico&&<div className="personal-referencia"><span className="personal-nota">Nombre registrado · Desglose pendiente de revisión</span><p>{original.nombre_completo}</p></div>}
    <div className="personal-grid personal-nombres-grid">
      <Campo etiqueta={`Primer apellido${lectura?'':' *'}`} valor={datos.apellido_paterno} onCambiar={v=>cambiar('apellido_paterno',v)} lectura={lectura} disabled={!habilitado} maxLength={150} autoComplete="family-name"/>
      <Campo etiqueta="Segundo apellido (opcional)" valor={datos.apellido_materno} onCambiar={v=>cambiar('apellido_materno',v)} lectura={lectura} disabled={!habilitado} maxLength={150}/>
      <Campo etiqueta={`Nombre(s)${lectura?'':' *'}`} valor={datos.nombres} onCambiar={v=>cambiar('nombres',v)} lectura={lectura} disabled={!habilitado} maxLength={150} autoComplete="given-name"/>
    </div>
    {!lectura&&habilitado&&<p className="personal-nota">{historico?'Puedes guardar otros datos conservando el nombre registrado si dejas los tres campos vacíos. ':''}Captura completos los apellidos y nombres compuestos; el nombre de consulta se forma automáticamente.</p>}
    {!lectura&&habilitado&&original&&cambio&&<label className="personal-revisar-nombre"><input type="checkbox" checked={revisado} onChange={e=>onRevisado(e.target.checked)}/>Revisé que los nombres y apellidos corresponden a esta persona.</label>}
    {!habilitado&&!lectura&&<p className="personal-nota">Instala la actualización de nombres de Personal para registrar o corregir el desglose. Los datos de contacto pueden guardarse conservando el nombre actual.</p>}
  </section>;
}
