import toast from 'react-hot-toast';
import type { ConfiguracionInstitucionalPersonal } from '../../personal/types';
import { AREAS_PERSONAL,PUESTOS_PERSONAL } from '../../personal/institucional';
import Campo from './CampoPersonal';

export default function InstitucionalPersonal({datos,onCambiar,lectura,onLectura}:{datos:ConfiguracionInstitucionalPersonal;onCambiar:(d:ConfiguracionInstitucionalPersonal)=>void;lectura:boolean;onLectura:(b:boolean)=>void}){
 const cambiar=(k:keyof ConfiguracionInstitucionalPersonal,v:unknown)=>onCambiar({...datos,[k]:v});
 async function firma(file?:File){if(!file)return;if(file.size>500*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){toast.error('Usa una firma PNG, JPEG o WebP de hasta 500 KB.');return;}
 onLectura(true);try{const valor=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject();r.readAsDataURL(file);});cambiar('firma_url',valor);}catch{toast.error('No se pudo leer la imagen de la firma.');}finally{onLectura(false);}}
 return <><p className="personal-nota">Cargo y área de referencia para documentos institucionales y NOM-035. Sus cambios no modifican contratos ni la habilitación docente.</p><div className="personal-grid">
 <Campo etiqueta="Situación administrativa" valor={datos.estatus} onCambiar={v=>cambiar('estatus',v)} lectura={lectura} opciones={['activo','inactivo']}/>
 <Campo etiqueta="Área institucional" valor={datos.departamento} onCambiar={v=>cambiar('departamento',v)} lectura={lectura} opciones={AREAS_PERSONAL}/>
 <Campo etiqueta="Cargo institucional" valor={datos.puesto} onCambiar={v=>{const p=PUESTOS_PERSONAL.find(p=>p.nombre===v);onCambiar({...datos,puesto:v,clave_puesto:p?.clave});}} lectura={lectura} opciones={PUESTOS_PERSONAL.map(p=>p.nombre)}/>
 <Campo etiqueta="Clave del cargo" valor={datos.clave_puesto} onCambiar={()=>{}} lectura ayuda="Se obtiene del cargo elegido. Conserva la referencia utilizada en los documentos institucionales."/>
 </div><section className="personal-tarjeta"><h4>Autorizaciones de firma</h4><p className="personal-nota">Un firmante de certificados y hasta dos de títulos. Boletas admite los cargos institucionales autorizados.</p>
 {([{campo:'firmante_certificados',texto:'Certificados',permitido:[1,2,3,4,5]},{campo:'firmante_titulos',texto:'Títulos',permitido:[1,2,3,4,5]},{campo:'firmante_boletas',texto:'Boletas y constancias',permitido:[1,2,3,4,5,8]}] as const).map(f=><label className="personal-revisar-nombre" key={f.campo}><input type="checkbox" checked={Boolean(datos[f.campo])} disabled={lectura||(!datos[f.campo]&&!f.permitido.some(k=>k===datos.clave_puesto))} onChange={e=>cambiar(f.campo,e.target.checked)}/>{f.texto}</label>)}
 <div className="personal-grid"><Campo etiqueta="Abreviatura académica para documentos" valor={datos.titulo_academico} onCambiar={v=>cambiar('titulo_academico',v)} lectura={lectura} maxLength={80} ayuda="Por ejemplo, Lic., Mtra. o Dr. Se conserva independiente de la formación principal."/></div>
 <h4>Firma registrada</h4>{datos.firma_url?<div className="personal-firma"><img src={datos.firma_url} alt="Firma institucional registrada"/></div>:<p className="personal-nota">Sin firma registrada.</p>}
 {!lectura&&<label>Reemplazar imagen de firma<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void firma(e.target.files?.[0]);e.currentTarget.value='';}}/><span className="personal-nota">La imagen se conserva en la captura hasta guardar esta sección.</span></label>}
 </section></>;
}
