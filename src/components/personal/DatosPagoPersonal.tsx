import { useEffect,useRef,useState } from 'react';
import toast from 'react-hot-toast';
import type { OrigenPersonal } from '../../personal/types';
import { DATOS_PAGO_VACIOS,erroresDatosPagoPersonal,type DatosPagoPersonal as Datos } from '../../personal/datosPago';
import { docenciaService,type PerfilPagoPersonal } from '../../services/docenciaService';
import CamposDatosPagoPersonal from './CamposDatosPagoPersonal';
import Campo from './CampoPersonal';
import ModalConfirmacion from '../ui/ModalConfirmacion';
export default function DatosPagoPersonal({origen,bloqueado,onActividad}:{origen:OrigenPersonal;bloqueado:boolean;onActividad:(c:boolean,b:boolean)=>void}){
 const [perfil,setPerfil]=useState<PerfilPagoPersonal|null>(null),[datos,setDatos]=useState<Datos>(DATOS_PAGO_VACIOS),[editando,setEditando]=useState(false),[motivo,setMotivo]=useState(''),[error,setError]=useState(''),[cargando,setCargando]=useState(true),[guardando,setGuardando]=useState(false),[cancelar,setCancelar]=useState(false),[intento,setIntento]=useState(false);
 const secuencia=useRef(0),actividad=useRef(onActividad);actividad.current=onActividad;
 const cambios=editando&&(JSON.stringify(datos)!==JSON.stringify(perfil?.datos)||Boolean(motivo));
 useEffect(()=>{actividad.current(cambios,guardando);return()=>actividad.current(false,false);},[cambios,guardando]);
 async function cargar(){const n=++secuencia.current;setCargando(true);setError('');try{const p=await docenciaService.consultarPago(origen);if(n!==secuencia.current)return;setPerfil(p);setDatos(p.datos);setEditando(false);setMotivo('');}catch(e){if(n===secuencia.current)setError((e as Error).message);}finally{if(n===secuencia.current)setCargando(false);}}
 useEffect(()=>{void cargar();return()=>{secuencia.current++;};},[origen.tipo,origen.id]);
 const errores=erroresDatosPagoPersonal(datos);
 async function guardar(){setIntento(true);if(Object.keys(errores).length||motivo.trim().length<5){toast.error('Revisa los campos indicados y escribe un motivo de al menos cinco caracteres.');return;}if(!perfil)return;setGuardando(true);setError('');try{const r=await docenciaService.guardarPago(origen,perfil,datos,motivo);setPerfil({...perfil,datos,revision:r.revision});setEditando(false);setMotivo('');toast.success('Datos privados guardados.');}catch(e){setError((e as Error).message);}finally{setGuardando(false);}}
 return <section className="personal-tarjeta"><header><h3>Seguridad social y banco</h3>{perfil?.puede_editar&&!editando&&<button className="personal-boton" disabled={bloqueado||!perfil.persona_id||cargando} onClick={()=>{setEditando(true);setIntento(false);}}>Editar datos privados</button>}</header><p className="personal-nota">Opcionales. Administración edita; Administración y Recursos Humanos consultan. Estos datos se comparten entre las funciones de la misma persona.</p>
 {cargando?<p role="status">Consultando datos privados…</p>:<>{error&&<p role="alert" className="personal-aviso personal-error">{error}{!editando&&<button className="personal-boton" onClick={()=>void cargar()}>Reintentar</button>}{editando&&' La captura se conserva.'}</p>}{perfil&&<><fieldset disabled={guardando}><CamposDatosPagoPersonal key={`${editando}-${perfil.revision}`} datos={datos} onCambiar={setDatos} lectura={!editando} errores={intento?errores:{}} disabled={guardando}/>{editando&&<Campo etiqueta="Motivo del registro o corrección *" valor={motivo} onCambiar={setMotivo} maxLength={1000}/>}</fieldset>{!perfil.persona_id&&<p className="personal-nota">Guarda primero los datos generales para crear la identidad compartida.</p>}{editando&&<div className="personal-acciones"><button className="personal-boton" disabled={guardando} onClick={()=>cambios?setCancelar(true):setEditando(false)}>Cancelar</button><button className="personal-boton personal-primario" disabled={guardando} onClick={()=>void guardar()}>{guardando?'Guardando…':'Guardar datos privados'}</button></div>}</>}</>}
 <ModalConfirmacion isOpen={cancelar} title="Descartar datos privados capturados" message="Se conservarán los últimos valores guardados." confirmText="Descartar edición" onCancel={()=>setCancelar(false)} onConfirm={()=>{setDatos(perfil!.datos);setMotivo('');setEditando(false);setCancelar(false);setError('');}}/>
 </section>;
}
