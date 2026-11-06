import { useState } from 'react';
import type { Expediente911,Fuente911 } from '../../estadistica911/types';
import { datosComunes911 } from '../../estadistica911/guia';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import toast from 'react-hot-toast';
export default function DatosComunes911({exp,fuentes,editable,onChange}:{exp:Expediente911;fuentes:Record<string,Fuente911>;editable:boolean;onChange:(e:Expediente911)=>void}) {
  const [confirmar,setConfirmar]=useState(false);
  const d=exp.config.domicilioPlantel||{municipio:'',localidad:'',vialidad:'',exterior:'',evidencia:''};
  return <section className="s911-card"><h2>Domicilio común del plantel</h2><p>Se aplica a los cuestionarios del plantel que contienen estos campos. El domicilio de la institución se captura por separado si es distinto.</p><fieldset disabled={!editable} className="s911-grid">{Object.entries({municipio:'Municipio o alcaldía',localidad:'Localidad',vialidad:'Calle o vialidad',exterior:'Número exterior',evidencia:'Documento que respalda el domicilio'}).map(([k,n])=><label key={k}>{n}<input value={d[k as keyof typeof d]} onChange={e=>onChange({...exp,config:{...exp.config,domicilioPlantel:{...d,[k]:e.target.value}},revisiones:{}})}/></label>)}<div><button disabled={!d.evidencia.trim()} onClick={()=>setConfirmar(true)}>Aplicar datos comunes a los cuestionarios</button></div></fieldset>{!d.evidencia.trim()&&<p className="s911-note">Para aplicar el domicilio, indica primero el documento que lo respalda. Revisa los datos antes de confirmar su copia a los formularios.</p>}
    <ModalConfirmacion isOpen={confirmar} title="Aplicar domicilio del plantel" message="Se reemplazarán los campos de domicilio informados en los cuestionarios del plantel y se retirarán sus revisiones de sección. Los campos vacíos y el domicilio institucional se conservan." onCancel={()=>setConfirmar(false)} onConfirm={()=>{try{onChange(datosComunes911(exp,fuentes));setConfirmar(false);}catch(e){toast.error((e as Error).message);}}}/>
  </section>;
}
