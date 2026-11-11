// Ensayo de interfaz aislado: intercepta toda petición externa; no ejecuta SQL.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Toaster} from 'react-hot-toast';
import {contextoDocenteFicticio,DOCENTE_FICTICIO as docente,CICLO_FICTICIO as ciclo} from '../tests/fixtures/docencia';
import {sugerirCortes} from '../src/docencia/calculoPago';
import '../src/index.css';
const qs=new URLSearchParams(location.search);document.documentElement.classList.toggle('dark',qs.has('oscuro'));
const original=window.fetch.bind(window);let c=contextoDocenteFicticio();c.financiero!.general.cortes=sugerirCortes(c.ciclo.fecha_inicio!,c.ciclo.fecha_termino!,7);
const rol=qs.get('rol')||'ADMINISTRADOR',admin=rol==='ADMINISTRADOR',privado=admin||rol==='COORDINADOR RECURSOS HUMANOS';
if(!privado)c.financiero=null;if(!admin)c.puede_editar_expediente=rol==='COORDINADOR ACADEMICO';
if(qs.has('sincalendario'))c.calendarios=[];if(qs.has('sinasignacion')){c.cargas=[];c.sesiones=[];}
let banco={persona_id:'persona',revision:1,puede_editar:admin,datos:{nss:'00123456789',clabe:'001234567890123456',cuenta:null,tarjeta:null}};
const historial:unknown[]=[];(window as any).ensayoDocencia={historial,conflicto:false};
window.fetch=async(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);if(u.origin===location.origin)return original(input,init);
 const r=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});const p=JSON.parse(String(init?.body||'{}'));historial.push({funcion:u.pathname.split('/').at(-1),parametros:p});
 if(u.pathname.endsWith('/personal_consultar_v3'))return r({disponible:true,persona_id:'persona',revision:1,original:{nombre_completo:'Docente Ficticio'},datos:{nombre_completo:'Docente Ficticio',nombres:'Docente',apellido_paterno:'Ficticio'},docente_id:docente,empleado_id:null,laborales:[],academicos:[],expediente:null,funciones_disponibles:true,permisos:{generales:admin,docencia:admin,laborales:privado,academicos:admin,expediente:privado,editar_laborales:admin,editar_expediente:admin,vincular:false},referencia_docente:{id:docente,clave_legado:'PF-FICTICIO',estatus:'activo'}});
 if(u.pathname.endsWith('/personal_pago_consultar_v1'))return privado?r(banco):r({message:'Sin permiso'},403);
 if(u.pathname.endsWith('/docencia_consultar_v1'))return r({...c,ciclo:{...c.ciclo,id:p.p_ciclo}});
 if((window as any).ensayoDocencia.conflicto)return r({code:'40001',message:'La revisión cambió. Actualiza la consulta.'},409);
 if(u.pathname.endsWith('/personal_pago_guardar_v1')){banco={...banco,datos:p.p_datos,revision:banco.revision+1};return r({revision:banco.revision});}
 if(u.pathname.endsWith('/docencia_expediente_guardar_v1')){c={...c,expediente:{revision:c.expediente.revision+1,carpeta_drive:p.p_carpeta,entregas:p.p_entregas}};return r({revision:c.expediente.revision});}
 if(u.pathname.endsWith('/docencia_tarifa_guardar_v1')){const a=p.p_docente?'excepcion':'general';c.financiero![a]={monto:p.p_monto,revision:p.p_revision+1,...(a==='general'?{cortes:p.p_cortes}:{})};return r({revision:p.p_revision+1});}
 return r({message:'Red externa bloqueada en ensayo'},403);
};
const {useAppStore}=await import('../src/store/useAppStore');
useAppStore.setState({currentUser:{id:'usuario-ficticio',username:'Ensayo',rol} as any,activeCicloId:ciclo,ciclos:[{id:ciclo,nombre:'2027-1',tipo_periodo:'Cuatrimestral',fecha_inicio:'2026-10-05',fecha_termino:'2027-01-10'},{id:'70000000-0000-4000-8000-000000000005',nombre:'2026-2',tipo_periodo:'Semestral'}] as any});
const {default:FichaPersonal}=await import('../src/components/personal/FichaPersonal');
function App(){const[abierto,setAbierto]=useState(true);return <main><button onClick={()=>setAbierto(true)}>Abrir ficha ficticia</button>{abierto&&<FichaPersonal origen={{tipo:'DOCENTE',id:docente}} docente={{id:docente,nombre_completo:'Docente Ficticio',clave_legado:'PF-FICTICIO',estatus:'activo'} as any} onClose={()=>setAbierto(false)} seccionInicial={qs.get('seccion')||'docencia'}/>}<Toaster/></main>;}
createRoot(document.getElementById('root')!).render(<App/>);
