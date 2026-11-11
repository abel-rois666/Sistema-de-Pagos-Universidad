import { useEffect, useState } from 'react';
import type { AlumnoPrograma, FichaTitulacion } from '../../types';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import { CampoConAyuda } from '../ui/AyudaContextual';
import OpcionesCertificacion from '../certificacion/OpcionesCertificacion';
import DetalleTitulacion from './DetalleTitulacion';

export const etiquetaProgramaTitulacion = (p:AlumnoPrograma) => [p.planes_estudio?.carreras?.nombre,p.planes_estudio?.clave_legado,p.planes_estudio?.nombre].filter(Boolean).join(' · ') || 'Programa sin descripción';

interface Props {
  key?:string;
  ficha:FichaTitulacion; fichas:readonly FichaTitulacion[]; programas:readonly AlumnoPrograma[];
  ocupados:readonly string[]; programaInicialId:string; editable:boolean; saving:boolean; onCerrar:()=>void;
  onAsignar:(id:string,programa:string,motivo:string)=>Promise<void>;
  onArchivar:(id:string,motivo:string)=>Promise<void>; onCapturaChange:(cambios:boolean)=>void;
}
/** Revisa una ficha sin programa; nunca sustituye la consulta del programa del fondo. */
export default function RevisarTitulacionAnterior({ficha,fichas,programas,programaInicialId,ocupados,editable,saving,onCerrar,onAsignar,onArchivar,onCapturaChange}:Props) {
  const [destino,setDestino]=useState(programaInicialId),[motivo,setMotivo]=useState(''),[confirmado,setConfirmado]=useState(false);
  const [salir,setSalir]=useState(false),[archivar,setArchivar]=useState(false),[motivoArchivo,setMotivoArchivo]=useState('');
  const cambios=destino!==programaInicialId||Boolean(motivo.trim())||confirmado||Boolean(motivoArchivo.trim());
  useEffect(()=>{onCapturaChange(cambios);return()=>onCapturaChange(false);},[cambios,onCapturaChange]);
  const programa=programas.find(p=>p.id===destino);
  const ocupado=ocupados.includes(destino);
  const cerrar=()=>{if(!saving){if(cambios)setSalir(true);else onCerrar();}};
  return <>
    <ModalConfirmacion isOpen title="Identificar el programa de esta titulación" type="info" wide busy={saving}
      cancelText="Cerrar revisión" onCancel={cerrar} confirmText="Asignar a este programa"
      confirmDisabled={!destino||ocupado||!confirmado||motivo.trim().length<5||salir||archivar}
      onConfirm={editable?async()=>{await onAsignar(ficha.id,destino,motivo);onCerrar();}:undefined}
      message={<div className="space-y-5 text-left">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><strong>Programa pendiente de identificar</strong><p className="mt-1">Esta titulación todavía no pertenece a ningún programa. Revisa sus datos guardados antes de elegir el destino.</p></div>
        <DetalleTitulacion ficha={ficha}/>
        {editable?<section aria-label="Destino de la titulación" className="space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
          <CampoConAyuda etiqueta="Programa al que pertenece esta titulación" ayuda="Elige la asociación académica exacta del alumno. Asignar conserva el mismo registro y todos sus datos; no los copia a otra titulación."><SelectorBusqueda id="destino-titulacion-anterior" etiqueta="Programa al que pertenece esta titulación" value={destino} disabled={saving} onChange={id=>{setDestino(id);setConfirmado(false);}}
            opciones={programas.map(p=>({value:p.id,label:etiquetaProgramaTitulacion(p)+(ocupados.includes(p.id)?' (ya tiene titulación)':'')})).sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}))} placeholder="Selecciona el programa"/></CampoConAyuda>
          {ocupado&&<p role="status" className="text-sm text-amber-900 dark:text-amber-200">Este programa ya tiene otra titulación. Selecciona otro destino o cierra la revisión para consultar la existente. No se sobrescribirá ninguna ficha.</p>}
          {!programas.length&&<p className="text-sm">Primero registra el programa del alumno desde Trayectoria e inscripciones.</p>}
          <CampoConAyuda etiqueta="Respaldo de la asignación" ayuda="Indica el documento o la revisión institucional que acredita a qué programa pertenece. Este respaldo queda registrado en la auditoría."><textarea rows={2} disabled={saving} value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Documento o revisión que acredita el programa" className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"/></CampoConAyuda>
          <label className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200"><input type="checkbox" checked={confirmado} disabled={saving||!destino||ocupado} onChange={e=>setConfirmado(e.target.checked)} className="mt-1 shrink-0 accent-blue-600"/><span>{programa?<>Confirmé que esta titulación pertenece a <strong>{etiquetaProgramaTitulacion(programa)}</strong>.</>:'Selecciona el programa antes de confirmar la asignación.'}</span></label>
          <p className="text-xs text-gray-600 dark:text-gray-400">Se conserva el registro, sus documentos, pago y fechas. Para corregir esos datos, edita la titulación después de asignarla. Si el servidor informa que cambió, cierra esta revisión y usa Actualizar consulta.</p>
          <div className="flex justify-end"><OpcionesCertificacion descripcion="la ficha anterior sin programa" disabled={saving} onArchivar={()=>setArchivar(true)}/></div>
        </section>:<p className="text-sm">Consulta de solo lectura. Administración puede identificar el programa de esta titulación.</p>}
      </div>}/>
    <ModalConfirmacion isOpen={salir} title="Cerrar revisión sin asignar" message="Se descartarán la selección y el respaldo capturados. La titulación guardada permanece sin cambios." confirmText="Descartar y cerrar" cancelText="Seguir revisando" onCancel={()=>setSalir(false)} onConfirm={onCerrar}/>
    <ModalConfirmacion isOpen={archivar} title="Archivar la ficha anterior sin programa" busy={saving} confirmText="Archivar ficha anterior" onCancel={()=>setArchivar(false)} confirmDisabled={motivoArchivo.trim().length<5}
      message={<div className="space-y-3 text-left"><p>Se retirará únicamente esta ficha pendiente del seguimiento. Sus datos y auditoría se conservan; no se revierten logros académicos ni pagos.</p><label className="block text-sm">Motivo<input disabled={saving} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" value={motivoArchivo} onChange={e=>setMotivoArchivo(e.target.value)}/></label></div>}
      onConfirm={async()=>{await onArchivar(ficha.id,motivoArchivo);onCerrar();}}/>
  </>;
}
