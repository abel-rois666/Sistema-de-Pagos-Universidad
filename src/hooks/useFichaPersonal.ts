import { useCallback,useEffect,useRef,useState } from 'react';
import toast from 'react-hot-toast';
import type { Docente,Empleado } from '../types';
import { personalService } from '../services/personalService';
import { documentosIniciales,validarExpediente,validarFormacion,validarGenerales,validarLaborales } from '../personal/reglas';
import { validarInstitucional } from '../personal/institucional';
import { validarNombrePersonal } from '../personal/nombres';
import type { DatosPersona,ExpedientePersonal,FormacionPersonal,OrigenPersonal,PerfilPersonal,SeccionEditablePersonal,SeccionDatosPersonal,VinculoLaboral,ConfiguracionInstitucionalPersonal } from '../personal/types';

export function useFichaPersonal(origen:OrigenPersonal,docente?:Docente|null,empleado?:Empleado|null,onSaved?:()=>void|Promise<void>){
 const [perfil,setPerfil]=useState<PerfilPersonal|null>(null),[cargando,setCargando]=useState(true),[error,setError]=useState(''),[guardando,setGuardando]=useState(false),[errorGuardado,setErrorGuardado]=useState('');
 const [base,setBase]=useState<Partial<Docente>>(docente||{clave_legado:'',nombre_completo:'',rfc:'',curp:'',email:'',estatus:'activo'});
 const [datos,setDatos]=useState<DatosPersona>({nombre_completo:docente?.nombre_completo||[empleado?.apellido_paterno,empleado?.apellido_materno,empleado?.nombres].filter(Boolean).join(' ')});
 const [laborales,setLaborales]=useState<VinculoLaboral[]>([]),[academicos,setAcademicos]=useState<FormacionPersonal[]>([]),[expediente,setExpediente]=useState<ExpedientePersonal>({documentos:documentosIniciales(),enlace_drive:null});
 const [editando,setEditando]=useState<SeccionEditablePersonal|null>((origen.nuevo??(origen.tipo==='DOCENTE'&&!docente))?'generales':null),[motivo,setMotivo]=useState('');
 const actual=useRef(onSaved);actual.current=onSaved;const consulta=useRef(0),inicial=useRef(docente);
 const [idDocente,setIdDocente]=useState(docente?.id||'');
 const [nombreRevisado,setNombreRevisado]=useState(false);
 const [institucional,setInstitucional]=useState<ConfiguracionInstitucionalPersonal|null>(null),[estatusDocencia,setEstatusDocencia]=useState('activo');
 const origenActual:OrigenPersonal={tipo:origen.tipo,id:origen.tipo==='DOCENTE'?(idDocente||origen.id):origen.id};
 const origenId=origenActual.id;
 const inicializar=useCallback((p:PerfilPersonal|null)=>{
   setPerfil(p);setNombreRevisado(false);if(!p)return;
   setInstitucional(p.referencia_institucional||null);setEstatusDocencia(p.referencia_docente?(p.referencia_docente.estatus??''):'activo');
   setDatos({...p.datos,nombre_completo:p.datos.nombre_completo||''});
   if(origen.tipo==='DOCENTE')setBase(prev=>({...prev,nombre_completo:p.datos.nombre_completo||prev.nombre_completo,rfc:p.datos.rfc||'',curp:p.datos.curp||'',email:p.datos.email||'',clave_legado:String(p.original?.clave_legado||prev.clave_legado||''),estatus:p.original?String(p.original.estatus??''):String(prev.estatus||'activo')}));
   setLaborales(p.laborales||[]);setAcademicos(p.academicos||[]);
   setExpediente(p.expediente||{documentos:documentosIniciales(p.referencia_laboral?.documentos_entregados||{}),enlace_drive:p.referencia_laboral?.enlace_drive||null});
 },[origen.tipo]);
 const cargar=useCallback(async()=>{const n=++consulta.current;setCargando(true);setError('');setErrorGuardado('');try{
   const p=await personalService.consultar({tipo:origen.tipo,id:origenId});if(n!==consulta.current)return;inicializar(p);if(origen.tipo==='DOCENTE'&&(p?.docente_id||p?.original))setIdDocente(p.docente_id||origenId);
   if(origen.tipo==='DOCENTE'&&!inicial.current&&!idDocente&&!p?.docente_id&&!p?.original){const clave=await personalService.siguienteClave();if(n===consulta.current)setBase(prev=>({...prev,clave_legado:prev.clave_legado||clave}));}
 }catch(e){if(n===consulta.current)setError((e as Error).message||'No se pudo consultar la ficha.');}finally{if(n===consulta.current)setCargando(false);}},[origen.tipo,origenId,idDocente,inicializar]);
 useEffect(()=>{void cargar();return()=>{consulta.current++;};},[cargar]);
 const editorActual=useRef(false);editorActual.current=Boolean(editando)||guardando;
 const pausaExterna=useRef(false);
 useEffect(()=>{const refrescar=()=>{if(!editorActual.current&&!pausaExterna.current)void cargar();};window.addEventListener('focus',refrescar);return()=>window.removeEventListener('focus',refrescar);},[cargar]);
 const firma=JSON.stringify({datos,base,laborales,academicos,expediente,motivo,nombreRevisado,institucional,estatusDocencia});const [baseCaptura,setBaseCaptura]=useState(firma);
 useEffect(()=>{setBaseCaptura(firma);},[perfil,cargando]);
 useEffect(()=>{if(!editando)setBaseCaptura(firma);},[firma,editando]);
 const cambios=editando!==null&&!cargando&&firma!==baseCaptura;
 useEffect(()=>{if(!cambios)return;const impedir=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',impedir);return()=>window.removeEventListener('beforeunload',impedir);},[cambios]);
 const comenzar=(s:SeccionEditablePersonal)=>{setBaseCaptura(firma);setMotivo('');setErrorGuardado('');setEditando(s);};
 const cancelar=()=>{inicializar(perfil);setBase(perfil?b=>({...b,nombre_completo:perfil.datos.nombre_completo,rfc:perfil.datos.rfc||'',curp:perfil.datos.curp||'',email:perfil.datos.email||'',estatus:perfil.original?String(perfil.original.estatus??''):b.estatus}):JSON.parse(baseCaptura).base);setEditando(null);setMotivo('');setErrorGuardado('');};
 async function guardar(){if(!editando||guardando||cargando||error)return;setError('');
   const errores=editando==='institucional'?(institucional?validarInstitucional(institucional,perfil?.referencia_institucional):['Consulta primero la configuración institucional.']):editando==='docencia'?([]):perfil?(editando==='generales'?validarGenerales(datos):editando==='laborales'?validarLaborales(laborales):editando==='academicos'?validarFormacion(academicos):validarExpediente(expediente)):[];
   if(errores.length){toast.error(errores.join(' '));return;}
   if(editando==='generales'&&perfil?.nombres_disponibles){const e=validarNombrePersonal(datos,perfil.original?perfil.datos:null,nombreRevisado);if(e.length){toast.error(e.join(' '));return;}}
   if(editando==='generales'&&origen.tipo==='DOCENTE'&&!idDocente&&!perfil?.nombres_disponibles){toast.error('Instala la actualización de nombres de Personal antes de registrar un nuevo docente.');return;}
   if(perfil&&motivo.trim().length<5){toast.error('Describe el motivo del registro o corrección.');return;}
   if(editando==='generales'&&origen.tipo==='DOCENTE'&&!['activo','inactivo'].includes(base.estatus||'')){toast.error('Elige la habilitación docente antes de guardar Datos generales.');return;}
   if(origen.tipo==='DOCENTE'&&(!base.clave_legado?.trim()||(!perfil&&!base.nombre_completo?.trim()))){toast.error('El nombre y la clave docente son obligatorios.');return;}
   setGuardando(true);setErrorGuardado('');try{
     if(perfil&&editando==='institucional'&&institucional){await personalService.guardarInstitucional(origenActual,perfil,institucional,motivo);}
     else if(perfil&&editando==='docencia'){await personalService.guardarDocencia(origenActual,perfil,estatusDocencia,motivo);}
     else if(perfil){await personalService.guardar(origenActual,perfil,editando as SeccionDatosPersonal,editando==='generales'?{datos,nombre_revisado:nombreRevisado,docente:{clave_legado:base.clave_legado,estatus:base.estatus}}:editando==='laborales'?laborales:editando==='academicos'?academicos:expediente,motivo);if(origen.tipo==='DOCENTE')setIdDocente(origenActual.id);}
     else if(origen.tipo==='DOCENTE'){const id=await personalService.guardarDocenteLegado(base,idDocente||undefined);setIdDocente(id);}
     else throw new Error('La actualización de personal aún no está disponible.');
     setEditando(null);setMotivo('');await cargar();await actual.current?.();toast.success('Sección guardada correctamente.');
   }catch(e){const mensaje=(e as Error).message||'No se pudo guardar la sección.';setErrorGuardado(mensaje);toast.error(mensaje);}finally{setGuardando(false);}
 }
 return {perfil,cargando,error,errorGuardado,guardando,base,setBase,datos,setDatos,nombreRevisado,setNombreRevisado,institucional,setInstitucional,estatusDocencia,setEstatusDocencia,laborales,setLaborales,academicos,setAcademicos,expediente,setExpediente,editando,motivo,setMotivo,cambios,comenzar,cancelar,guardar,cargar,idDocente,origenActual,pausaExterna};
}
