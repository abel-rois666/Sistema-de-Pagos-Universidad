import { useState } from 'react';
import { CampoConAyuda } from '../ui/AyudaContextual';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import { AYUDAS_INSCRIPCIONES as ayuda } from '../../inscripciones/ayudas';

const opciones={
  evidencia:['Acta o lista oficial de inscripción','Autorización de Control Escolar','Ficha de inscripción','Ficha de reinscripción','Historial de calificaciones revisado','Otro documento'],
  motivo:['Corrección de captura','Corrección de fecha','Corrección del ciclo de origen','Nuevo ingreso','Registro de baja','Regularización del historial','Reinscripción','Anulación de inscripción'],
};

/** Las sugerencias redactan los campos existentes; no afirman que un documento exista. */
export default function CampoSugeridoInscripcion({campo,valor,lote,onChange,onInteractuar}:{
  campo:'evidencia'|'motivo';valor:string;lote:boolean;onChange:(texto:string)=>void;onInteractuar:()=>void;
}) {
  const respaldo=campo==='evidencia';
  const [opcion,setOpcion]=useState(''),[detalle,setDetalle]=useState(''),[pendiente,setPendiente]=useState('');
  const etiqueta=respaldo?'Documento que respalda la inscripción':'Motivo de confirmación o corrección';
  const selector=respaldo?'Sugerencia de respaldo':'Sugerencia de motivo';
  const referencia=respaldo?'Referencia concreta (opcional)':'Detalle de la revisión';
  const detalleLimpio=detalle.trim();
  const propuesta=opcion&&(respaldo||detalleLimpio.length>=5)
    ?detalleLimpio?`${opcion}. ${respaldo?'Referencia':'Detalle'}: ${detalleLimpio}`:opcion
    :'';
  const ordenadas=[...opciones[campo]].sort((a,b)=>a.localeCompare(b,'es'));
  const aplicar=()=>{if(!propuesta)return;if(valor.trim())setPendiente(propuesta);else onChange(propuesta);};
  return <CampoConAyuda className="ic-ancho ic-campo-sugerido" etiqueta={etiqueta} ayuda={ayuda[campo]}>
    <div className="ic-sugerencia-controles">
      <CampoConAyuda etiqueta={selector} ayuda={respaldo?'Elige un respaldo y, si lo deseas, añade una referencia. Elegir una opción no cambia el texto; pulsa Usar sugerencia para aplicarla.':'Opcional. Elige una base para redactar y completa el detalle. Elegir una opción no cambia el texto; pulsa Usar sugerencia para aplicarla.'}>
        <select value={opcion} onChange={e=>{setOpcion(e.target.value);onInteractuar();}}>
          <option value="">Selecciona una sugerencia (opcional)</option>
          {ordenadas.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      </CampoConAyuda>
      <CampoConAyuda etiqueta={referencia} ayuda={respaldo?'Opcional. Puedes añadir folio, fecha, archivo, acta o ciclos revisados para localizar el respaldo. Si la dejas vacía, se aplica solo el tipo de documento elegido.':'Explica qué revisaste, qué se corrige o por qué corresponde el registro. La categoría sola no sustituye tu justificación.'}>
        <input value={detalle} disabled={!opcion} onChange={e=>{setDetalle(e.target.value);onInteractuar();}} placeholder={respaldo?'Folio, fecha, archivo o ciclos revisados':'Qué se revisó o qué se está corrigiendo'}/>
      </CampoConAyuda>
      <button type="button" disabled={!propuesta||propuesta===valor} onClick={aplicar}>{respaldo?'Usar sugerencia de respaldo':'Usar sugerencia de motivo'}</button>
    </div>
    <small className="ic-sugerencia-descripcion">{respaldo?'Selecciona un respaldo y pulsa Usar sugerencia. La referencia es opcional; también puedes escribir directamente abajo.':'Opcional: selecciona una base y añade un detalle de al menos 5 caracteres, o escribe directamente abajo.'}{lote?' El texto común debe corresponder a todos los alumnos seleccionados.':''}</small>
    {propuesta&&<small className="ic-sugerencia-preview">Vista previa: {propuesta}</small>}
    <textarea value={valor} onChange={e=>onChange(e.target.value)} placeholder={respaldo?'Ficha de inscripción, acta o referencia institucional verificable':'Explica por qué se registra o cambia la inscripción'}/>
    <small>El texto es editable. Se guarda al confirmar la inscripción o guardar su preparación, junto con los demás datos.</small>
    <ModalConfirmacion isOpen={Boolean(pendiente)} title={respaldo?'Sustituir texto del respaldo':'Sustituir texto del motivo'} type="warning" confirmText="Sustituir texto" cancelText="Conservar texto actual"
      message={<><span className="block">Se reemplazará lo capturado en este campo. Los demás datos del formulario se conservarán.</span><span className="block mt-2">Actual: {valor}</span><span className="block mt-2">Propuesta: {pendiente}</span></>}
      onCancel={()=>setPendiente('')} onConfirm={()=>{onChange(pendiente);setPendiente('');}}/>
  </CampoConAyuda>;
}
