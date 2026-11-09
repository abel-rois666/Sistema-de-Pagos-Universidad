import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Edit3, Loader2, Save } from 'lucide-react';
import type { FichaCertificacion } from '../../types';
import { useCertificacionAlumno } from '../../hooks/useCertificacionAlumno';
import { estadoPagoCertificado, estadoTramiteCertificado, requisitosCertificado, terminoOrientativoCertificado } from '../../certificacion/seguimiento';
import EstadoError from '../ui/EstadoError';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import { CampoConAyuda } from '../ui/AyudaContextual';
import DrivePicker from '../DrivePicker';
import CertificacionRequisitos from '../certificacion/CertificacionRequisitos';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';

interface Props {
  alumnoId: string; esEspecialidad: boolean; programaInicialId?: string; soloLectura?: boolean;
  onEstatusChange?: (e: 'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO') => void;
  onUpdate?: () => void; onCapturaChange?: (abierta: boolean) => void;
  onGuardandoChange?: (guardando: boolean) => void;
}
const control = 'h-[42px] w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 px-3 text-sm disabled:cursor-not-allowed';
const boton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500';
export default function TabCertificacion({alumnoId,esEspecialidad,programaInicialId,soloLectura=false,onEstatusChange,onUpdate,onCapturaChange,onGuardandoChange}:Props) {
  const c = useCertificacionAlumno(alumnoId,programaInicialId,onUpdate);
  useProteccionCaptura(Boolean(c.draft),c.saving);
  useEffect(()=>{onGuardandoChange?.(c.saving);return ()=>onGuardandoChange?.(false);},[c.saving,onGuardandoChange]);
  const [motivo,setMotivo] = useState(''), [accion,setAccion] = useState<'cancelar'|'reabrir'|'archivar'|'recargar'|null>(null);
  useEffect(()=>{onCapturaChange?.(Boolean(c.draft)||c.saving);return ()=>onCapturaChange?.(false);},[Boolean(c.draft),c.saving,onCapturaChange]);
  useEffect(()=>{ onEstatusChange?.(c.ficha?.tramite_completado ? 'COMPLETADO' : c.ficha ? 'EN_CURSO' : 'SIN_INICIAR'); },[c.ficha,onEstatusChange]);
  useEffect(()=>setMotivo(''),[c.programaId,c.fichaAnterior]);
  const f = c.draft || c.ficha;
  const nivel = c.programa?.planes_estudio?.carreras?.nivel_educativo;
  const especialidad = nivel ? nivel === 'Especialidad' : esEspecialidad;
  const requisitos = f ? requisitosCertificado(f,especialidad) : false;
  const modificable = !soloLectura && c.disponible;
  const asociando = Boolean(c.draft && c.ficha && !c.ficha.alumno_programa_id);
  const destinoOcupado = c.fichaAnterior && c.fichas.some(f=>f.alumno_programa_id===c.programaId);
  const opciones = c.programas.map(p=>({value:p.id,label:[p.planes_estudio?.carreras?.nombre,p.planes_estudio?.clave_legado,p.planes_estudio?.nombre].filter(Boolean).join(' · ')})).sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}));
  function fechaInicio(valor: string) {
    c.set('fecha_inicio_tramite',valor||null);
    c.set('fecha_termino_tramite',terminoOrientativoCertificado(valor));
  }
  if(c.loading&&!c.error)return <p role="status" className="p-6 flex items-center gap-2 text-gray-600 dark:text-gray-300"><Loader2 size={18} className="animate-spin"/>Consultando certificaciones…</p>;
  if(c.error&&!c.programas.length)return <EstadoError mensaje={c.error} onReintentar={c.recargar}/>;
  return <section className="p-4 sm:p-6 space-y-5 text-gray-900 dark:text-gray-100" aria-label="Certificación por programa">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-xl flex items-center gap-2"><Award size={20} className="text-blue-600 dark:text-blue-400"/>Certificación</h3><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Cada programa conserva su pago, documentos y trámite.</p></div>
      {f&&<div className="text-sm space-y-1"><p>Pago: <strong>{estadoPagoCertificado(f)}</strong></p><p>Trámite: <strong>{estadoTramiteCertificado(f)}</strong>{c.draft&&<span className="ml-2 text-xs text-amber-700 dark:text-amber-300">Sin guardar</span>}</p></div>}</header>
    <div className="max-w-xl"><CampoConAyuda etiqueta="Programa que vas a consultar" ayuda="Selecciona la asociación académica exacta. La marca Principal no transfiere certificaciones ni demuestra que una ficha antigua pertenezca a ese programa."><SelectorBusqueda id="programa-certificacion" etiqueta="Programa que vas a consultar" value={c.programaId} opciones={opciones} onChange={id=>{if(!c.draft&&!c.saving){c.setProgramaId(id);c.setFichaAnterior(false);}}} disabled={Boolean(c.draft)||c.saving} placeholder="Selecciona un programa"/></CampoConAyuda></div>
    {!c.disponible&&<p role="status" className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-900 dark:text-amber-200">Consulta de fichas anteriores. Para registrar o asociar certificaciones por programa falta instalar la migración de certificación.</p>}
    {c.legado.length>0&&<aside className="rounded-lg border border-amber-300 dark:border-amber-700 p-3 text-sm space-y-2"><p>Existe una ficha anterior sin programa. Sus datos se conservan y no se atribuyen automáticamente a una carrera.</p><button type="button" className={boton} disabled={Boolean(c.draft)||c.saving} onClick={()=>c.setFichaAnterior(!c.fichaAnterior)}>{c.fichaAnterior?'Volver al programa seleccionado':'Revisar ficha anterior'}</button></aside>}
    {c.error&&<div role="alert" className="text-sm p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"><p>{c.error}</p><button className="underline mt-2" disabled={c.saving} onClick={()=>setAccion('recargar')}>Revisar versión guardada</button></div>}
    {destinoOcupado&&<p role="status" className="text-sm text-amber-800 dark:text-amber-200">El programa seleccionado ya tiene certificación. Elige el programa que corresponde a la ficha anterior; no se sobrescribirá la existente.</p>}
    {!c.programas.length&&<p className="text-sm">Primero asocia un programa al alumno desde Trayectoria e inscripciones.</p>}
    {!c.programaId&&!c.fichaAnterior&&c.programas.length>0&&<p className="text-sm text-gray-600 dark:text-gray-400">Elige un programa para consultar o iniciar su certificación.</p>}
    {(c.programaId||c.fichaAnterior)&&<>
      <div className="flex flex-wrap gap-2">
        {c.draft?<><button className={boton} disabled={c.saving} onClick={()=>setAccion('cancelar')}>Cancelar cambios</button>{!c.draft.tramite_completado&&<button className={boton} disabled={c.saving} onClick={()=>{c.set('pago_certificado','COMPLETADO');for(const campo of ['doc_acta_nacimiento','doc_curp','doc_antecedente',...(especialidad?['doc_titulo_profesional','doc_cedula_profesional']:[])])c.set(campo as keyof FichaCertificacion,'APROBADO');}}>Completar requisitos</button>}<button className={boton+' bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700'} disabled={c.saving||asociando&&motivo.trim().length<5} onClick={()=>void c.guardar(motivo)}>{c.saving?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}Guardar certificación</button></>
          :modificable&&<><button className={boton} disabled={!c.programaId||c.saving||destinoOcupado||!c.ficha&&c.legado.length>0} onClick={c.iniciar}><Edit3 size={15}/>{c.fichaAnterior?'Asociar y revisar esta ficha':c.ficha?'Editar':'Iniciar registro'}</button>{c.ficha&&<button className={boton} disabled={c.saving} onClick={()=>{setMotivo('');setAccion('archivar');}}>Archivar ficha</button>}</>}
      </div>
      {asociando&&<CampoConAyuda etiqueta="Respaldo de la asociación" ayuda="Explica cómo comprobaste que esta ficha anterior pertenece al programa seleccionado. Se guarda en auditoría; no se copia a los demás programas."><input value={motivo} disabled={c.saving} onChange={e=>setMotivo(e.target.value)} className={control+' max-w-xl'} placeholder="Documento o revisión que acredita el programa"/></CampoConAyuda>}
      {f?<>
        <CertificacionRequisitos ficha={f} especialidad={especialidad} editable={Boolean(c.draft)&&!c.saving&&!f.tramite_completado} onChange={c.set}/>
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4"><h4 className="font-semibold">Trámite del certificado</h4>
          {!requisitos&&!f.tramite_completado&&<p className="text-sm text-gray-600 dark:text-gray-400">Completa el pago, la revisión documental y el tipo de certificado para registrar el inicio.</p>}
          <div className="flex flex-wrap gap-4">{[['fecha_inicio_tramite','Inicio del trámite'],['fecha_termino_tramite','Término previsto']].map(([key,label])=><div key={key} className="w-full sm:w-56"><CampoConAyuda etiqueta={label} ayuda={key==='fecha_inicio_tramite'?'Fecha documentada en que comenzó el trámite, distinta del inicio de captura.':'Se proponen 70 días hábiles de lunes a viernes; revisa feriados y el plazo institucional.'}><input type="date" value={(f[key as keyof FichaCertificacion] as string)||''} disabled={!c.draft||c.saving||!requisitos||Boolean(f.tramite_completado)} onInput={e=>key==='fecha_inicio_tramite'?fechaInicio(e.currentTarget.value):c.set('fecha_termino_tramite',e.currentTarget.value||null)} onChange={e=>key==='fecha_inicio_tramite'?fechaInicio(e.target.value):c.set('fecha_termino_tramite',e.target.value||null)} className={control}/></CampoConAyuda></div>)}</div>
          {f.fecha_completado&&<p className="text-sm">Completado el {new Date(f.fecha_completado).toLocaleDateString('es-MX')}.</p>}
          {c.draft&&(f.tramite_completado?<button className={boton} disabled={c.saving} onClick={()=>setAccion('reabrir')}>Reabrir trámite</button>:<button className={boton} disabled={c.saving||!requisitos||!f.fecha_inicio_tramite} onClick={()=>c.set('tramite_completado',true)}><CheckCircle2 size={16}/>Marcar como completado</button>)}
          <p className="text-xs text-gray-600 dark:text-gray-400">El pago se registra en esta ficha; no verifica automáticamente los recibos. Completar los requisitos no concluye el trámite. Un certificado parcial conserva el estatus académico; al completar uno total se cierra únicamente este programa si estaba cursando.</p>
          <DrivePicker label="Expediente digital" value={f.enlace_drive} onSelect={url=>c.set('enlace_drive',url)} disabled={!f.tramite_completado} isEditing={Boolean(c.draft)&&!c.saving}/>
        </section>
      </>:<p className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-sm">Sin registro de certificación para este programa.</p>}
    </>}
    <ModalConfirmacion isOpen={accion==='cancelar'} title="Descartar cambios de certificación" message="Se conservará la última ficha guardada." onCancel={()=>setAccion(null)} onConfirm={()=>{c.cancelar();setAccion(null);}} confirmText="Descartar cambios"/>
    <ModalConfirmacion isOpen={accion==='recargar'} title="Consultar versión guardada" message="Se descartará esta captura y se consultará nuevamente la ficha guardada. Puedes cancelar para conservar lo que estabas editando." onCancel={()=>setAccion(null)} onConfirm={()=>{c.cancelar();c.recargar();setAccion(null);}} confirmText="Descartar captura y recargar"/>
    <ModalConfirmacion isOpen={accion==='reabrir'} title="Reabrir trámite" message="Se quitará su conclusión, conservando el pago, la revisión documental, las fechas y el expediente digital. Confirma después con Guardar certificación." onCancel={()=>setAccion(null)} onConfirm={()=>{c.reabrir();setAccion(null);}} confirmText="Reabrir"/>
    <ModalConfirmacion isOpen={accion==='archivar'} title="Archivar certificación" message={<div className="space-y-3"><p>La ficha saldrá del seguimiento activo. Sus datos y auditoría se conservan; no se revierten egresos ni pagos.</p><label className="block text-sm">Motivo<input className={control+' mt-1'} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label></div>} onCancel={()=>setAccion(null)} confirmDisabled={motivo.trim().length<5} onConfirm={async()=>{await c.archivar(motivo);setAccion(null);}} confirmText="Archivar" busy={c.saving}/>
  </section>;
}
