import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {Toaster} from 'react-hot-toast';
import '../src/index.css';
const docId='11111111-1111-4111-8111-111111111111',empId='22222222-2222-4222-8222-222222222222';
const qs=new URLSearchParams(location.search),originalFetch=window.fetch.bind(window);
const docente={id:docId,clave_legado:'PF0100',nombre_completo:'DOCENTE DE PRUEBA',rfc:'',curp:'',email:'docente@example.test',estatus:'activo'};
let creado=!qs.has('nuevo'),iniciado=!qs.has('sin-persona');
let revision=1,persona='33333333-3333-4333-8333-333333333333',relacionado=!qs.has('sin-vincular');
let datos:any={nombre_completo:docente.nombre_completo,rfc:'',curp:'',email:docente.email,fecha_nacimiento:'1985-11-20',sexo:'Femenino',telefono:'',direccion:'',estado_civil:'',nombres:null,apellido_paterno:null,apellido_materno:null};
let laborales=[{id:'44444444-4444-4444-8444-444444444444',funcion:'Docencia',departamento:'Área académica',contratacion:'Honorarios',jornada:'Diurna',fecha_inicio:'2024-10-01',fecha_fin:null,horas_contratadas:12,observaciones:'Vínculo ficticio',archivado:false},{id:'55555555-5555-4555-8555-555555555555',funcion:'Coordinación',departamento:'Área administrativa',contratacion:'Determinado',jornada:'Diurna',fecha_inicio:null,fecha_fin:null,horas_contratadas:null,observaciones:'Fecha pendiente de revisión',archivado:false}];
let academicos=[{id:'66666666-6666-4666-8666-666666666666',nivel:'Licenciatura',programa:'Pedagogía',institucion:'Institución ficticia',situacion:'Titulado',cedula:'',fecha_titulacion:null,principal:true,archivado:false},{id:'77777777-7777-4777-8777-777777777777',nivel:'Maestría',programa:'Docencia universitaria',institucion:'Institución ficticia',situacion:'En curso',cedula:'',fecha_titulacion:null,principal:false,archivado:false}];
let expediente:any={documentos:['alta_empleado','acta_nacimiento','curp','comprobante_domicilio','constancia_situacion_fiscal','cuenta_bancaria','afiliacion_imss','pruebas','cv','comprobantes_estudio'].map((clave,n)=>({clave,requerido:n<3,estado:n===0?'ENTREGADO':n===1?'REVISADO':'SIN_REGISTRAR',motivo:'',referencia:''})),enlace_drive:null};
if(qs.has('nuevo')){laborales=[];academicos=[];expediente={...expediente,documentos:expediente.documentos.map((d:any)=>({...d,requerido:false,estado:'SIN_REGISTRAR'}))};}
let pendientes=Array.from({length:17},(_,i)=>({docente_id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(i+1).padStart(12,'0')}`,clave:`PF${String(i+1).padStart(4,'0')}`,nombre_historico:`DOCENTE HISTÓRICO ${String(i+1).padStart(2,'0')}`,revision:1,original:{clave_legado:`PF${String(i+1).padStart(4,'0')}`,nombre_completo:`DOCENTE HISTÓRICO ${String(i+1).padStart(2,'0')}`,estatus:'activo'},datos:{nombre_completo:`DOCENTE HISTÓRICO ${String(i+1).padStart(2,'0')}`}}));
let rol='ADMINISTRADOR';
function permisos(){return {generales:rol!=='COORDINADOR RECURSOS HUMANOS',docencia:rol!=='COORDINADOR RECURSOS HUMANOS',academicos:rol!=='COORDINADOR RECURSOS HUMANOS',laborales:rol!=='COORDINADOR ACADEMICO',expediente:rol!=='COORDINADOR ACADEMICO',editar_laborales:rol==='ADMINISTRADOR',editar_expediente:rol==='ADMINISTRADOR',vincular:rol==='ADMINISTRADOR'};}
function perfil(){return {disponible:true,persona_id:!creado||!iniciado?null:persona,revision:!creado||!iniciado?0:revision,original:!creado?null:{...docente},datos:!creado?{nombre_completo:''}:datos,laborales,academicos,expediente:permisos().expediente?expediente:null,permisos:permisos(),empleado_id:relacionado?empId:null,docente_id:creado&&iniciado?docente.id:null,referencia_laboral:null,referencia_academica:null};}
const respuesta=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','content-range':'0-1/2'}});
window.fetch=async(input:any,init?:any)=>{
 const url=new URL(typeof input==='string'?input:input.url||String(input),location.href);
 if(url.origin===location.origin)return originalFetch(input,init);
 const rpc=url.pathname.split('/').pop(),body=init?.body?JSON.parse(String(init.body)):{};
 if(qs.has('legado')&&rpc?.startsWith('personal_'))return respuesta({code:'PGRST202',message:'Function not found in fixture'},404);
 if(rpc==='personal_consultar_v3')return respuesta({code:'PGRST202',message:'El ensayo anterior conserva la API v2 para revisar compatibilidad'},404);
 if(rpc==='personal_consultar_v1'||rpc==='personal_consultar_v2')return respuesta({...perfil(),nombres_disponibles:true});
 if(rpc==='personal_nombres_pendientes_v1'){const rows=pendientes.filter(f=>[f.nombre_historico,f.clave].join(' ').includes((body.p_busqueda||'').toUpperCase()));return respuesta({filas:rows.slice(body.p_offset,body.p_offset+15),total:rows.length});}
 if(rpc==='personal_nombres_revisar_lote_v1'){if(qs.has('conflicto'))return respuesta({code:'40001',message:'Otra sesión modificó el expediente. Actualiza antes de guardar'},409);pendientes=pendientes.filter(f=>!body.p_filas.some((p:any)=>p.docente_id===f.docente_id));return respuesta({revisados:body.p_filas.length});}
 if(rpc==='personal_guardar_v1'){
   if(qs.has('conflicto')||(body.p_revision!==revision&&creado))return respuesta({code:'40001',message:'Otra sesión modificó el expediente. Actualiza antes de guardar'},409);
   if(body.p_seccion==='generales'){datos=body.p_datos.datos;creado=true;iniciado=true;Object.assign(docente,{id:body.p_id||docente.id,clave_legado:body.p_datos.docente?.clave_legado||docente.clave_legado,nombre_completo:datos.nombre_completo,rfc:datos.rfc,curp:datos.curp,email:datos.email,estatus:body.p_datos.docente?.estatus||docente.estatus});}
   if(body.p_seccion==='laborales')laborales=body.p_datos;if(body.p_seccion==='academicos')academicos=body.p_datos;if(body.p_seccion==='expediente')expediente=body.p_datos;
   revision++;return respuesta({persona_id:persona,revision});
 }
 if(rpc==='personal_candidatos_v1')return respuesta([{id:empId,nombre:'PRUEBA DOCENTE',rfc:'',curp:'',persona_id:null,original:{nombres:'DOCENTE',apellido_paterno:'PRUEBA'},revision:0}]);
 if(rpc==='personal_vincular_v1'){relacionado=true;revision++;return respuesta(null);}
 if(rpc==='personal_directorio_docente_v1')return respuesta({filas:[docente],total:1});
 if(rpc==='docentes'){if(init?.method==='POST'||init?.method==='PATCH')return respuesta({id:docId});return respuesta([{clave_legado:'PF0099'},{clave_legado:'PF0100'}]);}
 if(rpc==='docente_configuraciones_horario'||rpc==='planes_estudio'||rpc==='asignaturas'||rpc==='grupos')return respuesta([]);
 if(rpc==='empleados')return respuesta([]);
 return respuesta([]);
};
const {supabase}=await import('../src/lib/supabase');supabase.channel=()=>({on(){return this},subscribe(){return this}}) as any;supabase.removeChannel=async()=> 'ok' as any;
const {useAppStore}=await import('../src/store/useAppStore');
useAppStore.setState({currentUser:{id:'ficticio',username:'ENSAYO',rol:'ADMINISTRADOR'} as any,ciclos:[{id:'88888888-8888-4888-8888-888888888888',nombre:'2027-1',tipo_periodo:'Cuatrimestral',activo:true}] as any,activeCicloId:'88888888-8888-4888-8888-888888888888'});
const {default:ModalDocente}=await import('../src/components/modals/ModalDocente');
const {default:FichaEmpleado}=await import('../src/components/modals/FichaEmpleado');
const {default:RevisionNombresDocentes}=await import('../src/components/personal/RevisionNombresDocentes');
const {default:ModalEmpleado}=await import('../src/components/modals/ModalEmpleado');
const empleado:any={id:empId,persona_id:iniciado?persona:null,nombres:'DOCENTE',apellido_paterno:'PRUEBA',apellido_materno:'',fecha_nacimiento:'1985-11-20',estatus:'activo',puesto:'Coordinador Académico',clave_puesto:8,nivel_estudios:'Licenciatura',nivel_estudios_estado:'Titulado',firmante_boletas:true,titulo_academico:'Lic.'};
function App(){const [abierta,setAbierta]=useState(true),[key,setKey]=useState(0),[oscuro,setOscuro]=useState(qs.has('oscuro')),[editarEmpleado,setEditarEmpleado]=useState(false),[revisar,setRevisar]=useState(qs.has('lote'));
 React.useEffect(()=>{document.documentElement.classList.toggle('dark',oscuro);},[oscuro]);
 return <MemoryRouter><div style={{padding:16,background:oscuro?'#111827':'#f8fafc',minHeight:'100vh',color:oscuro?'white':'#111827'}}><p>ENSAYO LOCAL · PERSONAL FICTICIO · RED EXTERNA INTERCEPTADA</p><button onClick={()=>setAbierta(true)}>Abrir ficha</button><button onClick={()=>setOscuro(o=>!o)}>Cambiar tema</button><label>Rol de ensayo<select value={rol} onChange={e=>{rol=e.target.value;useAppStore.setState({currentUser:{...useAppStore.getState().currentUser!,rol:rol as any}});setKey(k=>k+1);}}><option>ADMINISTRADOR</option><option>COORDINADOR ACADEMICO</option><option>COORDINADOR RECURSOS HUMANOS</option></select></label><button onClick={()=>{revision++;}}>Simular edición concurrente</button>{revisar&&<RevisionNombresDocentes onClose={()=>setRevisar(false)} onSaved={()=>{}}/>}{editarEmpleado&&<ModalEmpleado empleado={empleado} onClose={()=>setEditarEmpleado(false)} onSaved={async()=>{setEditarEmpleado(false);setAbierta(true);}}/>}{!revisar&&abierta&&qs.has('empleado')?<FichaEmpleado empleado={empleado} isAdmin={rol==='ADMINISTRADOR'} onClose={()=>setAbierta(false)} onEdit={()=>{setAbierta(false);setEditarEmpleado(true);}}/>:!revisar&&abierta&&<ModalDocente key={String(key)} isOpen docente={qs.has('nuevo')?undefined:docente} readOnly onClose={()=>setAbierta(false)}/>}</div><Toaster/></MemoryRouter>;
}
const raizEnsayo=createRoot(document.getElementById('root')!);raizEnsayo.render(<App/>);
import.meta.hot?.dispose(()=>raizEnsayo.unmount());
