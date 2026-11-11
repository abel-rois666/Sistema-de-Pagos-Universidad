import {useState} from 'react';
import {useTitulacionAlumno} from '../../hooks/useTitulacionAlumno';
import {useProteccionCaptura} from '../../app/ProteccionCaptura';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import RevisarTitulacionAnterior from './RevisarTitulacionAnterior';
export default function RevisionTitulacionLote({alumno,fichaId,onCerrar,onActualizado}:{alumno:string;fichaId:string;onCerrar:()=>void;onActualizado:()=>void}){
 const c=useTitulacionAlumno(alumno),[captura,setCaptura]=useState(false);useProteccionCaptura(captura,c.saving);
 const f=c.anteriores.find(f=>f.id===fichaId);
 if(c.loading||c.error||!f)return <ModalConfirmacion isOpen title="Revisar titulación anterior" type="info" confirmText="Cerrar" onConfirm={onCerrar} onCancel={onCerrar} message={<div><p>{c.loading?'Consultando el registro guardado…':c.error||'Esta ficha ya no está pendiente de asociar. Actualiza el listado.'}</p>{c.error&&<button onClick={c.recargar}>Reintentar</button>}</div>}/>;
 return <RevisarTitulacionAnterior ficha={f} fichas={c.fichas} programas={c.programas} ocupados={c.ocupados} programaInicialId={c.programas.length===1?c.programas[0].id:''} editable saving={c.saving} onCapturaChange={setCaptura} onCerrar={onCerrar} onAsignar={async(id,programa,motivo)=>{await c.asociar(id,programa,motivo);onActualizado();}} onArchivar={async(id,motivo)=>{await c.archivar(id,motivo);onActualizado();}}/>;
}
