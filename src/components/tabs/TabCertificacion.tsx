import {Link} from 'react-router-dom';
import {useAppStore} from '../../store/useAppStore';
import { useEffect, useRef, useState } from 'react';
import { Award, CheckCircle2, Edit3, Loader2, RefreshCw, Save } from 'lucide-react';
import type { FichaCertificacion } from '../../types';
import { useCertificacionAlumno } from '../../hooks/useCertificacionAlumno';
import { estadoPagoCertificado, estadoTramiteCertificado, requisitosCertificado, terminoOrientativoCertificado } from '../../certificacion/seguimiento';
import EstadoError from '../ui/EstadoError';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import SelectorBusqueda from '../ui/SelectorBusqueda';
import { CampoConAyuda } from '../ui/AyudaContextual';
import DrivePicker from '../DrivePicker';
import CertificacionRequisitos, { DatoCertificacion, fechaCertificacion } from '../certificacion/CertificacionRequisitos';
import RevisarCertificacionAnterior, { etiquetaProgramaCertificacion } from '../certificacion/RevisarCertificacionAnterior';
import OpcionesCertificacion from '../certificacion/OpcionesCertificacion';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';

interface Props {
  alumnoId: string; esEspecialidad: boolean; programaInicialId?: string; soloLectura?: boolean;
  onEstatusChange?: (e: 'SIN_INICIAR' | 'EN_CURSO' | 'COMPLETADO') => void;
  onUpdate?: () => void; onCapturaChange?: (abierta: boolean) => void;
  onGuardandoChange?: (guardando: boolean) => void;
}
const control = 'h-[42px] w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1c2228] text-gray-900 dark:text-gray-100 px-3 text-sm disabled:cursor-not-allowed';
const boton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60';
const secundario = boton+' hover:bg-gray-50 dark:hover:bg-gray-800';
const primario = boton+' bg-[#1456f0] text-white hover:bg-blue-700 dark:hover:bg-blue-700';

export default function TabCertificacion({alumnoId,esEspecialidad,programaInicialId,soloLectura=false,onEstatusChange,onUpdate,onCapturaChange,onGuardandoChange}:Props) {
  const admin=useAppStore(s=>s.currentUser?.rol==='ADMINISTRADOR');
  const c = useCertificacionAlumno(alumnoId,programaInicialId,onUpdate);
  const [revisionAnterior,setRevisionAnterior]=useState(programaInicialId==='__legado__');
  const [revisionConCambios,setRevisionConCambios]=useState(false);
  const consultaRef=useRef<HTMLElement>(null);
  const enfocarConsulta=()=>requestAnimationFrame(()=>{(consultaRef.current?.querySelector<HTMLElement>('[data-editar-certificacion]')||consultaRef.current)?.focus();});
  const [motivo,setMotivo] = useState(''), [accion,setAccion] = useState<'cancelar'|'reabrir'|'archivar'|'recargar'|null>(null);
  useProteccionCaptura(Boolean(c.draft)||revisionConCambios,c.saving);
  useEffect(()=>{setRevisionAnterior(programaInicialId==='__legado__');},[alumnoId,programaInicialId]);
  useEffect(()=>{if(!c.loading&&!c.legado.length&&revisionAnterior){setRevisionAnterior(false);requestAnimationFrame(()=>{const destino=consultaRef.current?.querySelector<HTMLElement>('[data-editar-certificacion]')||consultaRef.current;destino?.focus();});}},[c.loading,c.legado.length,revisionAnterior]);
  useEffect(()=>{onGuardandoChange?.(c.saving);return ()=>onGuardandoChange?.(false);},[c.saving,onGuardandoChange]);
  useEffect(()=>{onCapturaChange?.(Boolean(c.draft)||revisionConCambios||c.saving);return ()=>onCapturaChange?.(false);},[Boolean(c.draft),revisionConCambios,c.saving,onCapturaChange]);
  useEffect(()=>{onEstatusChange?.(c.ficha?.tramite_completado?'COMPLETADO':c.ficha?'EN_CURSO':'SIN_INICIAR');},[c.ficha,onEstatusChange]);
  useEffect(()=>setMotivo(''),[c.programaId]);
  const f = c.draft || c.ficha;
  const nivel = c.programa?.planes_estudio?.carreras?.nivel_educativo;
  const especialidad = nivel ? nivel === 'Especialidad' : esEspecialidad;
  const requisitos = f ? requisitosCertificado(f,especialidad) : false;
  const modificable = !soloLectura && c.disponible;
  const opciones = c.programas.map(p=>({value:p.id,label:etiquetaProgramaCertificacion(p)})).sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}));
  function fechaInicio(valor:string){c.set('fecha_inicio_tramite',valor||null);c.set('fecha_termino_tramite',terminoOrientativoCertificado(valor));}
  if(c.loading&&!c.error)return <p role="status" className="p-6 flex items-center gap-2 text-gray-600 dark:text-gray-300"><Loader2 size={18} className="animate-spin"/>Consultando certificaciones…</p>;
  if(c.error&&!c.programas.length)return <EstadoError mensaje={c.error} onReintentar={c.recargar}/>;
  return <section ref={consultaRef} tabIndex={-1} className="p-4 sm:p-6 space-y-5 text-gray-900 dark:text-gray-100" aria-label="Certificación por programa">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-xl flex items-center gap-2"><Award size={20} className="text-blue-600 dark:text-blue-400"/>Certificación</h3><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Consulta el pago, los documentos y el trámite de cada programa.</p></div>
      <button type="button" className={secundario} disabled={c.saving} onClick={()=>c.draft?setAccion('recargar'):c.recargar()}><RefreshCw size={15}/>Actualizar consulta</button>
    </header>
    {c.legado.length>0&&<aside aria-label="Certificación pendiente de identificar" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/20"><div><p className="font-semibold">Hay una certificación anterior pendiente de identificar</p><p className="mt-1 text-gray-600 dark:text-gray-300">Sus datos están guardados, pero aún no pertenecen a un programa.</p></div><button type="button" className={secundario} disabled={Boolean(c.draft)||c.saving} onClick={()=>setRevisionAnterior(true)}>{modificable?'Revisar y asignar programa':'Consultar ficha pendiente'}</button></aside>}
    {admin&&c.legado.length>0&&!soloLectura&&<Link className="inline-flex text-sm text-blue-600 dark:text-blue-400 underline" to={`/herramientas-escolares/certificaciones?alumno=${encodeURIComponent(alumnoId)}`}>Abrir revisión administrativa de este alumno</Link>}
    <div className="max-w-xl"><CampoConAyuda etiqueta="Programa que vas a consultar" ayuda="Los datos que aparecen debajo pertenecen exclusivamente a este programa. Revisar una certificación pendiente no cambia su asociación."><SelectorBusqueda id="programa-certificacion" etiqueta="Programa que vas a consultar" value={c.programaId} opciones={opciones} onChange={c.setProgramaId} disabled={Boolean(c.draft)||c.saving} placeholder="Selecciona un programa"/></CampoConAyuda></div>
    {!c.disponible&&<p role="status" className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-900 dark:text-amber-200">Consulta de solo lectura. Para registrar o asignar certificaciones por programa falta instalar la migración de certificación.</p>}
    {c.error&&<div role="alert" className="text-sm p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"><p>{c.error}</p><button className="underline mt-2" disabled={c.saving} onClick={()=>setAccion('recargar')}>Revisar versión guardada</button></div>}
    {!c.programas.length&&<p className="text-sm">Primero asocia un programa al alumno desde Trayectoria e inscripciones.</p>}
    {!c.programaId&&c.programas.length>0&&<p className="text-sm text-gray-600 dark:text-gray-400">Elige un programa para consultar su certificación.</p>}
    {c.programaId&&(f?<>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Certificación de este programa</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Pago: <strong>{estadoPagoCertificado(f)}</strong> · Trámite: <strong>{estadoTramiteCertificado(f)}</strong>{c.draft&&<span className="ml-2 text-xs text-amber-700 dark:text-amber-300">Sin guardar</span>}</p></div>
        <div className="flex flex-wrap gap-2">{c.draft?<><button className={secundario} disabled={c.saving} onClick={()=>setAccion('cancelar')}>Cancelar cambios</button><button className={primario} disabled={c.saving} onClick={()=>void c.guardar()}>{c.saving?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}Guardar certificación</button></>:modificable&&<><button data-editar-certificacion className={primario} disabled={c.saving} onClick={c.iniciar}><Edit3 size={15}/>Editar certificación</button><OpcionesCertificacion descripcion="la certificación de este programa" disabled={c.saving} onArchivar={()=>{setMotivo('');setAccion('archivar');}}/></>}</div>
      </div>
      {c.draft&&!f.tramite_completado&&<button className={secundario} disabled={c.saving} onClick={()=>{c.set('pago_certificado','COMPLETADO');for(const campo of ['doc_acta_nacimiento','doc_curp','doc_antecedente',...(especialidad?['doc_titulo_profesional','doc_cedula_profesional']:[])])c.set(campo as keyof FichaCertificacion,'APROBADO');}}>Completar requisitos</button>}
      <CertificacionRequisitos ficha={f} especialidad={especialidad} editable={Boolean(c.draft)&&!c.saving&&!f.tramite_completado} onChange={c.set}/>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4"><h4 className="font-semibold">Trámite del certificado</h4>
        {c.draft&&!requisitos&&!f.tramite_completado&&<p className="text-sm text-gray-600 dark:text-gray-400">Completa el pago, la revisión documental y el tipo de certificado para registrar el inicio.</p>}
        {c.draft?<div className="flex flex-wrap gap-4">{[['fecha_inicio_tramite','Inicio del trámite'],['fecha_termino_tramite','Término previsto']].map(([key,label])=><div key={key} className="w-full sm:w-56"><CampoConAyuda etiqueta={label} ayuda={key==='fecha_inicio_tramite'?'Fecha documentada en que comenzó el trámite, distinta del inicio de captura.':'Se proponen 70 días hábiles de lunes a viernes; revisa feriados y el plazo institucional.'}><input type="date" value={(f[key as keyof FichaCertificacion] as string)||''} disabled={c.saving||!requisitos||Boolean(f.tramite_completado)} onInput={e=>key==='fecha_inicio_tramite'?fechaInicio(e.currentTarget.value):c.set('fecha_termino_tramite',e.currentTarget.value||null)} onChange={e=>key==='fecha_inicio_tramite'?fechaInicio(e.target.value):c.set('fecha_termino_tramite',e.target.value||null)} className={control}/></CampoConAyuda></div>)}</div>:<div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><DatoCertificacion etiqueta="Inicio del trámite" valor={fechaCertificacion(f.fecha_inicio_tramite)}/><DatoCertificacion etiqueta="Término previsto" valor={fechaCertificacion(f.fecha_termino_tramite)}/></div>}
        {f.fecha_completado&&<p className="text-sm">Completado el {new Date(f.fecha_completado).toLocaleDateString('es-MX')}.</p>}
        {c.draft&&(f.tramite_completado?<button className={secundario} disabled={c.saving} onClick={()=>setAccion('reabrir')}>Reabrir trámite</button>:<button className={secundario} disabled={c.saving||!requisitos||!f.fecha_inicio_tramite} onClick={()=>c.set('tramite_completado',true)}><CheckCircle2 size={16}/>Marcar como completado</button>)}
        <p className="text-xs text-gray-600 dark:text-gray-400">El pago se registra en esta ficha; no verifica automáticamente los recibos. Completar los requisitos no concluye el trámite. Un certificado parcial conserva el estatus académico; al completar uno total se cierra únicamente este programa si estaba cursando.</p>
        <DrivePicker label="Expediente digital" value={f.enlace_drive} onSelect={url=>c.set('enlace_drive',url)} disabled={!f.tramite_completado} isEditing={Boolean(c.draft)&&!c.saving}/>
      </section>
    </>:<div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-5 space-y-3"><p className="font-semibold">Este programa aún no tiene un registro de certificación</p><p className="text-sm text-gray-600 dark:text-gray-300">{c.legado.length?'Primero revisa la certificación pendiente de identificar que aparece arriba. No se creará otra mientras siga pendiente.':'Inicia un registro para guardar su pago, revisión documental y trámite.'}</p>{modificable&&!c.legado.length&&<button className={primario} disabled={c.saving} onClick={c.iniciar}>Iniciar registro</button>}</div>)}
    <ModalConfirmacion isOpen={accion==='cancelar'} title="Descartar cambios de certificación" message="Se conservará la última ficha guardada." onCancel={()=>setAccion(null)} onConfirm={()=>{c.cancelar();setAccion(null);}} confirmText="Descartar cambios"/>
    <ModalConfirmacion isOpen={accion==='recargar'} title="Consultar versión guardada" message="Se descartará esta captura y se consultará nuevamente la ficha guardada. Puedes cancelar para conservar lo que estabas editando." onCancel={()=>setAccion(null)} onConfirm={()=>{c.cancelar();c.recargar();setAccion(null);}} confirmText="Descartar captura y recargar"/>
    <ModalConfirmacion isOpen={accion==='reabrir'} title="Reabrir trámite" message="Se quitará su conclusión, conservando el pago, la revisión documental, las fechas y el expediente digital. Confirma después con Guardar certificación." onCancel={()=>setAccion(null)} onConfirm={()=>{c.reabrir();setAccion(null);}} confirmText="Reabrir"/>
    <ModalConfirmacion isOpen={accion==='archivar'} title="Archivar certificación del programa consultado" message={<div className="space-y-3 text-left"><p>Programa: <strong>{c.programa&&etiquetaProgramaCertificacion(c.programa)}</strong>.</p><p>La ficha saldrá del seguimiento activo. Sus datos y auditoría se conservan; no se revierten egresos ni pagos.</p><label className="block text-sm">Motivo<input className={control+' mt-1'} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label></div>} onCancel={()=>setAccion(null)} confirmDisabled={motivo.trim().length<5} onConfirm={async()=>{await c.archivar(motivo);setAccion(null);}} confirmText="Archivar" busy={c.saving}/>
    {revisionAnterior&&c.legado[0]&&<RevisarCertificacionAnterior key={c.legado[0].id} ficha={c.legado[0]} fichas={c.fichas} programas={c.programas} programaInicialId={c.programaId} editable={modificable} saving={c.saving} onCerrar={()=>{setRevisionAnterior(false);setRevisionConCambios(false);}} onAsignar={async(id,programa,motivo)=>{await c.asociar(id,programa,motivo);enfocarConsulta();}} onArchivar={async(id,motivo)=>{await c.archivarAnterior(id,motivo);enfocarConsulta();}} onCapturaChange={setRevisionConCambios}/>}
  </section>;
}
