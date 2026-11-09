import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {Toaster} from 'react-hot-toast';
import '../src/index.css';
const qs=new URLSearchParams(location.search),originalFetch=window.fetch.bind(window);
const empId='11111111-1111-4111-8111-111111111111',docId='22222222-2222-4222-8222-222222222222',personaId='33333333-3333-4333-8333-333333333333';
let tieneEmpleado=qs.get('solo')!=='docente',tieneDocente=qs.get('solo')!=='empleado',iniciada=!qs.has('sin-persona'),revision=1,rol='ADMINISTRADOR';
let empleadoIdActual=empId,antecedenteAdministrativo=tieneEmpleado;
let datos={nombre_completo:'DE LA CRUZ LÓPEZ ANA MARÍA',nombres:'ANA MARÍA',apellido_paterno:'DE LA CRUZ',apellido_materno:'LÓPEZ',email:'ensayo@example.test',fecha_nacimiento:'1985-07-15',sexo:'Femenino',rfc:'',curp:'',telefono:'',direccion:'',estado_civil:''};
let docente={id:docId,clave_legado:'PF0100',estatus:'activo'},institucional={estatus:'activo',puesto:'Coordinador Académico',clave_puesto:8,departamento:'Coordinación Académica',firmante_certificados:false,firmante_titulos:false,firmante_boletas:true,titulo_academico:'Mtra.',firma_url:null};
let laborales:any[]=[{id:'44444444-4444-4444-8444-444444444444',funcion:'Coordinación',departamento:'Área académica',contratacion:'Indeterminado',jornada:'Diurna',fecha_inicio:'2020-01-15',fecha_fin:null,horas_contratadas:20,observaciones:'Contrato ficticio',archivado:false}];
let academicos:any[]=[{id:'55555555-5555-4555-8555-555555555555',nivel:'Maestría',programa:'Docencia universitaria',institucion:'Institución ficticia',situacion:'Titulado',cedula:'',fecha_titulacion:null,principal:true,archivado:false}];
let expediente:any={documentos:['curp','cv'].map(clave=>({clave,requerido:true,estado:'REVISADO',motivo:'',referencia:''})),enlace_drive:null};
const empleado=()=>({id:empleadoIdActual,persona_id:iniciada?personaId:null,...datos,...institucional,fecha_ingreso:antecedenteAdministrativo?'2020-01-15':null,tipo_contratacion:antecedenteAdministrativo?'Indeterminado':null,tipo_jornada:antecedenteAdministrativo?'Diurna':null,nivel_estudios:antecedenteAdministrativo?'Maestría':null,nivel_estudios_estado:antecedenteAdministrativo?'Titulado':null,documentos_entregados:{curp:true,cv:true}});
function perfil(tipo:string){const privado=rol!=='COORDINADOR ACADEMICO';return {disponible:true,nombres_disponibles:true,funciones_disponibles:true,persona_id:iniciada?personaId:null,revision:iniciada?revision:0,
 original:tipo==='EMPLEADO'?{...datos}:{nombre_completo:datos.nombre_completo,rfc:datos.rfc,curp:datos.curp,email:datos.email,clave_legado:docente.clave_legado,estatus:docente.estatus},datos,
 empleado_id:tieneEmpleado?empleadoIdActual:null,docente_id:tieneDocente?docente.id:null,referencia_docente:tieneDocente?docente:null,referencia_institucional:tieneEmpleado&&privado?institucional:null,
 referencia_laboral:tieneEmpleado&&privado?empleado():null,referencia_academica:tieneEmpleado?empleado():null,laborales:privado&&iniciada?laborales:[],academicos:iniciada?academicos:[],expediente:privado&&iniciada?expediente:null,
 permisos:{generales:rol!=='COORDINADOR RECURSOS HUMANOS',docencia:rol!=='COORDINADOR RECURSOS HUMANOS',academicos:rol!=='COORDINADOR RECURSOS HUMANOS',laborales:privado,expediente:privado,editar_laborales:rol==='ADMINISTRADOR',editar_expediente:rol==='ADMINISTRADOR',vincular:rol==='ADMINISTRADOR'}};}
const respuesta=(d:any,status=200)=>new Response(JSON.stringify(d),{status,headers:{'content-type':'application/json'}});
window.fetch=async(input:any,init?:any)=>{const url=new URL(typeof input==='string'?input:input.url||String(input),location.href);if(url.origin===location.origin)return originalFetch(input,init);
 const rpc=url.pathname.split('/').pop(),b=init?.body?JSON.parse(String(init.body)):{};
 if(rpc==='personal_consultar_v3')return respuesta(perfil(b.p_tipo));
 if(rpc==='personal_buscar_personas_v1')return respuesta({filas:datos.nombre_completo.includes(b.p_busqueda.toUpperCase())?[{origen:{tipo:tieneEmpleado?'EMPLEADO':'DOCENTE',id:tieneEmpleado?empId:docId},nombre:datos.nombre_completo,persona_id:iniciada?personaId:null,empleado_id:tieneEmpleado?empleadoIdActual:null,docente_id:tieneDocente?docente.id:null,clave_docente:tieneDocente?docente.clave_legado:null}]:[],total:datos.nombre_completo.includes(b.p_busqueda.toUpperCase())?1:0});
 if(rpc==='personal_anadir_funcion_v1'){if(qs.has('conflicto'))return respuesta({code:'40001',message:'La identidad cambió. Recarga y revisa antes de añadir la función.'},409);if(b.p_destino==='DOCENTE'){tieneDocente=true;docente={id:b.p_nuevo_id,...b.p_datos};}else {tieneEmpleado=true;antecedenteAdministrativo=false;empleadoIdActual=b.p_nuevo_id;institucional={estatus:b.p_datos.estatus,puesto:'',clave_puesto:null,departamento:'',firmante_certificados:false,firmante_titulos:false,firmante_boletas:false,titulo_academico:'',firma_url:null};}iniciada=true;revision++;return respuesta({id:b.p_nuevo_id,persona_id:personaId});}
 if(rpc==='personal_guardar_v1'){if(qs.has('conflicto'))return respuesta({code:'40001',message:'El expediente cambió. Recarga antes de guardar.'},409);if(b.p_seccion==='generales'){datos=b.p_datos.datos;iniciada=true;}if(b.p_seccion==='laborales')laborales=b.p_datos;if(b.p_seccion==='academicos')academicos=b.p_datos;if(b.p_seccion==='expediente')expediente=b.p_datos;revision++;return respuesta({persona_id:personaId,revision});}
 if(rpc==='personal_institucional_guardar_v1'){if(qs.has('cupo'))return respuesta({code:'P0001',message:'Ya existe un firmante de certificados.'},422);institucional=b.p_datos;revision++;return respuesta(null);}
 if(rpc==='personal_docencia_guardar_v1'){docente={...docente,estatus:b.p_estatus};revision++;return respuesta(null);}
 if(rpc==='docentes')return respuesta([{clave_legado:'PF0100'}]);
 if(rpc==='personal_candidatos_v1')return respuesta([]);
 return respuesta([]);
};
const {supabase}=await import('../src/lib/supabase');supabase.channel=()=>({on(){return this},subscribe(){return this}}) as any;supabase.removeChannel=async()=> 'ok' as any;
const {useAppStore}=await import('../src/store/useAppStore');useAppStore.setState({currentUser:{id:'ficticio',username:'ENSAYO',rol} as any});
const {default:FichaEmpleado}=await import('../src/components/modals/FichaEmpleado');
const {default:FichaPersonal}=await import('../src/components/personal/FichaPersonal');const {default:AltaPersonal}=await import('../src/components/personal/AltaPersonal');
function App(){const [abierta,setAbierta]=useState(!qs.has('alta')),[tema,setTema]=useState(qs.has('oscuro')),[version,setVersion]=useState(0),[alta,setAlta]=useState<'DOCENTE'|'EMPLEADO'|null>(qs.has('alta')?'DOCENTE':null),[mensaje,setMensaje]=useState(''),[origen,setOrigen]=useState<any>({tipo:qs.has('desde-docente')||!tieneEmpleado?'DOCENTE':'EMPLEADO',id:qs.has('desde-docente')||!tieneEmpleado?docId:empId,nuevo:false});
 React.useEffect(()=>{document.documentElement.classList.toggle('dark',tema);},[tema]);
 return <MemoryRouter><main style={{padding:20,color:tema?'#fff':'#172033',background:tema?'#111827':'#f6f8fc',minHeight:'100vh'}}><p>ENSAYO LOCAL · FICHA ÚNICA · SOLO DATOS FICTICIOS</p><button onClick={()=>setAbierta(true)}>Abrir ficha</button><button onClick={()=>setTema(t=>!t)}>Cambiar tema</button><button onClick={()=>setAlta('DOCENTE')}>Alta docente</button><button onClick={()=>setAlta('EMPLEADO')}>Alta administrativa</button><label>Rol<select value={rol} onChange={e=>{rol=e.target.value;useAppStore.setState({currentUser:{id:'ficticio',username:'ENSAYO',rol} as any});setVersion(v=>v+1);}}><option>ADMINISTRADOR</option><option>COORDINADOR ACADEMICO</option><option>COORDINADOR RECURSOS HUMANOS</option></select></label><p>{mensaje}</p>
 {alta&&<AltaPersonal destino={alta} onClose={()=>setAlta(null)} onCrear={()=>{setAlta(null);setMensaje('Alta independiente autorizada tras buscar coincidencias.');}} onAbrir={o=>{setOrigen(o);setAlta(null);setAbierta(true);setVersion(v=>v+1);}}/>}
 {!alta&&abierta&&qs.has('envoltura')&&origen.tipo==='EMPLEADO'?<FichaEmpleado empleado={empleado() as any} isAdmin={rol==='ADMINISTRADOR'} onClose={()=>setAbierta(false)}/>:!alta&&abierta&&<FichaPersonal key={version} origen={origen} empleado={origen.tipo==='EMPLEADO'?empleado() as any:undefined} onClose={()=>setAbierta(false)} seccionInicial={qs.has('funciones')?'funciones':'generales'}/>}
 </main><Toaster/></MemoryRouter>;
}
const raiz=createRoot(document.getElementById('root')!);raiz.render(<App/>);import.meta.hot?.dispose(()=>raiz.unmount());
