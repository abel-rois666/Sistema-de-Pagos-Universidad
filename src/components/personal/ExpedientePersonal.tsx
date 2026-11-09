import { useId } from 'react';
import type { ExpedientePersonal as DatosExpediente,EstadoDocumentoPersonal } from '../../personal/types';
import { DOCUMENTOS_PERSONAL } from '../../personal/documentos';
import { resumenExpediente } from '../../personal/reglas';
import DrivePicker from '../DrivePicker';
import Campo from './CampoPersonal';
const etiquetas:Record<EstadoDocumentoPersonal,string>={SIN_REGISTRAR:'Sin registrar',PENDIENTE:'Pendiente de entrega',ENTREGADO:'Entregado',REVISADO:'Revisado',NO_APLICA:'No aplica'};
export default function ExpedientePersonal({datos,onCambiar,lectura}:{datos:DatosExpediente;onCambiar:(d:DatosExpediente)=>void;lectura:boolean}){
  const id=useId(),resumen=resumenExpediente(datos.documentos);
  const cambiar=(clave:string,cambio:object)=>onCambiar({...datos,documentos:datos.documentos.map(d=>d.clave===clave?{...d,...cambio}:d)});
  return <><p className="personal-nota">Administración define los documentos requeridos según la función y contratación. «No aplica» necesita un motivo y queda fuera del cálculo. Marcar entrega no verifica el contenido del archivo.</p><div className="personal-aviso" role="status">{resumen.porcentaje===null?'Requisitos documentales aún sin definir.':`${resumen.entregados} de ${resumen.requeridos} documentos requeridos entregados (${resumen.porcentaje}%). ${resumen.revisados} revisados.`}</div>
    <div className="personal-documentos">{datos.documentos.map(d=><div className="personal-documento" key={d.clave}><div><label htmlFor={`${id}-${d.clave}`}>{DOCUMENTOS_PERSONAL.find(c=>c.key===d.clave)?.label||d.clave}</label>{lectura?<span className="personal-nota">{d.requerido?'Requerido':'No marcado como requerido'}</span>:<label><input type="checkbox" aria-label={`Requerir ${DOCUMENTOS_PERSONAL.find(c=>c.key===d.clave)?.label||d.clave}`} checked={d.requerido} onChange={e=>cambiar(d.clave,{requerido:e.target.checked})}/> Requerido</label>}</div>{lectura?<p>{etiquetas[d.estado]}</p>:<select id={`${id}-${d.clave}`} value={d.estado} onChange={e=>cambiar(d.clave,{estado:e.target.value})}>{Object.entries(etiquetas).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>}{d.estado==='NO_APLICA'&&<div className="personal-nota"><Campo etiqueta="Motivo por el que no aplica *" valor={d.motivo} onCambiar={v=>cambiar(d.clave,{motivo:v})} lectura={lectura}/></div>}<div className="personal-nota"><Campo etiqueta="Referencia del documento (opcional)" valor={d.referencia} onCambiar={v=>cambiar(d.clave,{referencia:v})} lectura={lectura}/></div></div>)}</div>
    <Campo etiqueta="Enlace de carpeta digital (opcional)" valor={datos.enlace_drive} onCambiar={v=>onCambiar({...datos,enlace_drive:v||null})} lectura={lectura} ayuda="Guardar un enlace no concede acceso ni publica documentos. Los permisos de la carpeta se administran en Google Drive."/>
    {!lectura&&<DrivePicker label="Carpeta digital de personal" value={datos.enlace_drive} onSelect={enlace_drive=>onCambiar({...datos,enlace_drive})} disabled={false} isEditing/>}
  </>;
}
