import { useEffect,useRef,useState,type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen,Briefcase,CalendarClock,FileText,User,Settings,Users,X } from 'lucide-react';
import type { Docente,Empleado } from '../../types';
import type { OrigenPersonal,PerfilPersonal,SeccionEditablePersonal } from '../../personal/types';
import { useAppStore } from '../../store/useAppStore';
import { useFichaPersonal } from '../../hooks/useFichaPersonal';
import { useDialogoPersonal } from '../../hooks/useDialogoPersonal';
import { useProteccionCaptura } from '../../app/ProteccionCaptura';
import ModalConfirmacion from '../ui/ModalConfirmacion';
import ConfiguracionDocenteHorario from '../horarios/ConfiguracionDocenteHorario';
import NavegacionPersonal from './NavegacionPersonal';
import GeneralesFichaPersonal from './GeneralesFichaPersonal';
import LaboralesPersonal from './LaboralesPersonal';
import AcademicosPersonal from './AcademicosPersonal';
import ExpedientePersonal from './ExpedientePersonal';
import RelacionPersonal from './RelacionPersonal';
import InstitucionalPersonal from './InstitucionalPersonal';
import ReferenciaLaboralPersonal from './ReferenciaLaboralPersonal';
import FuncionesPersonal from './FuncionesPersonal';
import Campo from './CampoPersonal';
import './personal.css';

interface Props {origen:OrigenPersonal;docente?:Docente|null;empleado?:Empleado|null;onClose:()=>void;onSaved?:()=>void|Promise<void>;lecturaInicial?:boolean;seccionInicial?:string;alternativa?:ReactNode;configuracionInstitucional?:()=>void}
export default function FichaPersonal({origen,docente,empleado,onClose,onSaved,lecturaInicial=true,seccionInicial='generales',alternativa,configuracionInstitucional}:Props){
 const f=useFichaPersonal(origen,docente,empleado,onSaved),{currentUser,activeCicloId}=useAppStore();
 const admin=currentUser?.rol==='ADMINISTRADOR',puedeDocencia=['ADMINISTRADOR','COORDINADOR ACADEMICO'].includes(currentUser?.rol||'');
 const [seccion,setSeccion]=useState(seccionInicial),[horario,setHorario]=useState(false),[salida,setSalida]=useState(false),[capturaExtra,setCapturaExtra]=useState(false),[guardandoExtra,setGuardandoExtra]=useState(false),[leyendoFirma,setLeyendoFirma]=useState(false);
 const accion=useRef<()=>void>(()=>{}),iniciada=useRef(false);
 const tieneEmpleado=Boolean(f.perfil?.empleado_id||origen.tipo==='EMPLEADO'),docenteId=f.perfil?.docente_id||f.idDocente;
 const tieneDocente=Boolean(docenteId||origen.tipo==='DOCENTE'),privado=f.perfil?Boolean(f.perfil.permisos.laborales):admin||currentUser?.rol==='COORDINADOR RECURSOS HUMANOS';
 const usarAlternativa=Boolean(!f.cargando&&!f.error&&alternativa&&!f.perfil);
 const ocupado=f.guardando||guardandoExtra||leyendoFirma;
 f.pausaExterna.current=capturaExtra||guardandoExtra||leyendoFirma;
 useEffect(()=>{if(!capturaExtra&&!leyendoFirma)return;const impedir=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',impedir);return()=>window.removeEventListener('beforeunload',impedir);},[capturaExtra,leyendoFirma]);
 const solicitar=(a:()=>void)=>{if(ocupado)return;if(f.cambios||capturaExtra){accion.current=()=>{f.cancelar();a();};setSalida(true);}else{if(f.editando)f.cancelar();a();}};
 const {dialogo,teclado}=useDialogoPersonal(!usarAlternativa,()=>solicitar(onClose));useProteccionCaptura(f.cambios||capturaExtra,ocupado);
 useEffect(()=>{if(!iniciada.current&&!f.cargando){iniciada.current=true;if(!lecturaInicial&&(!f.perfil||f.perfil.permisos.generales))f.comenzar('generales');}},[f.cargando,lecturaInicial]);
 const actualizar=async()=>{await f.cargar();await onSaved?.();};
 const actividad=(c:boolean,b:boolean)=>{setCapturaExtra(c);setGuardandoExtra(b);};
 const opciones=[{id:'generales',titulo:'Datos generales',icono:<User/>},...(privado?[{id:'laborales',titulo:'Datos laborales',icono:<Briefcase/>}]:[]),{id:'academicos',titulo:'Datos académicos',icono:<BookOpen/>},...(privado?[{id:'expediente',titulo:'Expediente',icono:<FileText/>}]:[]),...(tieneEmpleado&&privado?[{id:'institucional',titulo:'Configuración institucional',icono:<Settings/>}]:[]),...(tieneDocente?[{id:'docencia',titulo:'Docencia',icono:<CalendarClock/>}]:[]),...(admin&&f.perfil?.original?[{id:'funciones',titulo:'Funciones de la persona',icono:<Users/>}]:[])];
 useEffect(()=>{if(!f.cargando&&!opciones.some(o=>o.id===seccion))setSeccion('generales');},[f.cargando,seccion,opciones.map(o=>o.id).join('|')]);
 const editando=f.editando===seccion;
 const permisoEditar=seccion==='generales'?f.perfil?.permisos.generales??puedeDocencia:seccion==='laborales'?f.perfil?.permisos.editar_laborales:seccion==='academicos'?f.perfil?.permisos.academicos:seccion==='expediente'?f.perfil?.permisos.editar_expediente:seccion==='institucional'?admin&&f.perfil?.funciones_disponibles:seccion==='docencia'?puedeDocencia&&f.perfil?.funciones_disponibles:false;
 const requiereIdentidad=seccion!=='generales'&&seccion!=='funciones';
 const permisoVer=(seccion==='laborales'||seccion==='expediente'||seccion==='institucional')?privado:true;
 const referencia=f.perfil?.referencia_laboral||empleado;
 if(usarAlternativa)return alternativa;
 return createPortal(<><div className="personal-overlay"><div ref={dialogo} onKeyDown={teclado} role="dialog" aria-modal="true" aria-label="Ficha de personal" className="personal-ficha personal-ficha-persona">
 <header className="personal-cabecera"><div><p>Ficha de personal</p><h2>{f.datos.nombre_completo||f.base.nombre_completo||'Nuevo docente'}</h2><div className="personal-etiquetas">{tieneEmpleado&&<span>Administrativa</span>}{tieneDocente&&<span>Docente{f.perfil?.referencia_docente?.clave_legado||f.base.clave_legado?` · ${f.perfil?.referencia_docente?.clave_legado||f.base.clave_legado}`:''}</span>}</div></div><button aria-label="Cerrar ficha de personal" disabled={ocupado} onClick={()=>solicitar(onClose)}><X size={20}/></button></header>
 <div className="personal-scroll"><NavegacionPersonal secciones={opciones} activa={seccion} onCambiar={s=>solicitar(()=>setSeccion(s))}>
 <header><h3>{opciones.find(o=>o.id===seccion)?.titulo}</h3>{permisoEditar&&!editando&&!f.cargando&&!f.error&&<button className="personal-boton" disabled={requiereIdentidad&&!f.perfil?.persona_id} onClick={()=>solicitar(()=>f.comenzar(seccion as SeccionEditablePersonal))}>Editar sección</button>}</header>
 {f.cargando?<p role="status" className="personal-aviso">Consultando ficha…</p>:f.error?<div role="alert" className="personal-aviso personal-error"><p>{f.error}</p><button className="personal-boton" disabled={ocupado} onClick={()=>void f.cargar()}>Reintentar consulta</button></div>:<>
 {!f.perfil&&<p className="personal-aviso">Las secciones ampliadas requieren instalar la actualización de Personal. La consulta anterior y el acceso académico conservan su funcionamiento.</p>}
 {seccion==='generales'&&<GeneralesFichaPersonal perfil={f.perfil} datos={f.datos} onDatos={f.setDatos} base={f.base} onBase={f.setBase} esDocente={origen.tipo==='DOCENTE'} idDocente={f.idDocente} editando={editando} guardando={ocupado} nombreRevisado={f.nombreRevisado} onNombreRevisado={f.setNombreRevisado}/>}
 {seccion==='generales'&&f.perfil?.permisos.vincular&&origen.tipo==='DOCENTE'&&f.idDocente&&!editando&&<RelacionPersonal docenteId={f.idDocente} perfil={f.perfil} onActividad={actividad} onRelacionada={actualizar}/>}
 {!permisoVer?<p className="personal-aviso">Esta sección está reservada a Administración y Recursos Humanos. Compartir identidad no concede acceso a información laboral o documental.</p>:<>
 {requiereIdentidad&&f.perfil&&!f.perfil.persona_id&&<p className="personal-aviso">Los datos anteriores se muestran como referencia. Para iniciar la edición compartida, revisa y guarda Datos generales. Consultar no crea registros.</p>}
 {seccion==='laborales'&&<><ReferenciaLaboralPersonal datos={referencia}/><fieldset disabled={ocupado}><LaboralesPersonal filas={f.laborales} onCambiar={f.setLaborales} lectura={!editando}/></fieldset></>}
 {seccion==='academicos'&&<>{f.perfil?.referencia_academica?.nivel_estudios&&<p className="personal-aviso">Referencia académica anterior: {f.perfil.referencia_academica.nivel_estudios} · {f.perfil.referencia_academica.nivel_estudios_estado||'Situación sin registrar'}. La abreviatura de firmante se administra en Configuración institucional.</p>}<fieldset disabled={ocupado}><AcademicosPersonal filas={f.academicos} onCambiar={f.setAcademicos} lectura={!editando}/></fieldset></>}
 {seccion==='expediente'&&<fieldset disabled={ocupado}><ExpedientePersonal datos={f.expediente} onCambiar={f.setExpediente} lectura={!editando}/></fieldset>}
 {seccion==='institucional'&&(f.institucional?<fieldset disabled={ocupado}><InstitucionalPersonal onLectura={setLeyendoFirma} datos={f.institucional} onCambiar={f.setInstitucional} lectura={!editando}/></fieldset>:<div className="personal-aviso"><p>La configuración institucional integrada requiere la actualización de funciones de Personal.</p>{configuracionInstitucional&&admin&&<button className="personal-boton" onClick={()=>solicitar(configuracionInstitucional)}>Abrir configuración anterior</button>}</div>)}
 </>}
 {seccion==='docencia'&&<><div className="personal-grid"><Campo etiqueta="Clave docente" valor={f.perfil?.referencia_docente?.clave_legado||f.base.clave_legado} lectura onCambiar={()=>{}}/><Campo etiqueta="Habilitación docente" valor={f.perfil?.referencia_docente?f.estatusDocencia:f.base.estatus} lectura={!editando} opciones={['activo','inactivo']} onCambiar={f.setEstatusDocencia} disabled={ocupado}/></div><p className="personal-nota">La habilitación docente no cambia la situación administrativa ni los contratos. Una cuenta de acceso se administra por separado.</p><div className="personal-acciones"><button className="personal-boton personal-primario" disabled={!docenteId||!puedeDocencia||ocupado} onClick={()=>solicitar(()=>setHorario(true))}>Abrir disponibilidad y materias</button></div><p className="personal-nota">Disponibilidad, planes, materias, grupos y máximo semanal conservan su selector local de ciclo y su guardado independiente.</p>{!puedeDocencia&&<p className="personal-nota">La edición académica corresponde a Administración y Coordinación Académica.</p>}{!docenteId&&<p className="personal-aviso">Guarda primero el docente para conservar su ID.</p>}</>}
 {seccion==='funciones'&&admin&&f.perfil&&(f.perfil.funciones_disponibles?<FuncionesPersonal origen={f.origenActual} perfil={f.perfil} onActividad={actividad} onSaved={actualizar} onSeccion={s=>solicitar(()=>setSeccion(s))}/>:<p className="personal-aviso">Para añadir funciones a la misma identidad falta instalar la actualización de funciones de Personal.</p>)}
 {f.errorGuardado&&<div role="alert" className="personal-aviso personal-error"><p>{f.errorGuardado}</p><p>La captura se conserva. Puedes corregirla o recargar descartando esta edición.</p><button className="personal-boton" disabled={ocupado} onClick={()=>solicitar(()=>void f.cargar())}>Recargar ficha</button></div>}
 {editando&&f.perfil&&<div className="personal-tarjeta"><Campo etiqueta="Motivo del registro o corrección *" valor={f.motivo} onCambiar={f.setMotivo} disabled={ocupado}/><p className="personal-nota">El cambio se guarda por sección y queda registrado en la auditoría.</p></div>}
 </>}
 </NavegacionPersonal></div><footer className="personal-pie"><p className="personal-nota">{ocupado?'Procesando…':f.cambios||capturaExtra?'Hay cambios sin guardar.':'La consulta no modifica registros.'}</p><div className="personal-acciones"><button className="personal-boton" disabled={ocupado} onClick={()=>solicitar(editando?()=>f.cancelar():onClose)}>{editando?'Cancelar edición':'Cerrar'}</button>{editando&&<button className="personal-boton personal-primario" disabled={ocupado||f.cargando||Boolean(f.error)||(Boolean(f.perfil)&&f.motivo.trim().length<5)} onClick={()=>void f.guardar()}>Guardar sección</button>}</div></footer>
 </div></div>{horario&&docenteId&&<ConfiguracionDocenteHorario docenteId={docenteId} docenteNombre={f.datos.nombre_completo||''} cicloId={activeCicloId} onClose={()=>setHorario(false)}/>}
 <ModalConfirmacion isOpen={salida} title="Hay cambios sin guardar" message="Puedes continuar editando o descartar los cambios de esta sección." confirmText="Descartar y continuar" cancelText="Continuar editando" onCancel={()=>setSalida(false)} onConfirm={()=>{setSalida(false);accion.current();}}/>
 </>,document.body);
}
