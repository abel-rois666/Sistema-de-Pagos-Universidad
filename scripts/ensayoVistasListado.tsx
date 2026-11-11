import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { configuracionInicialListado } from '../src/reportes/vistasListado';
import '../src/index.css';

const qs=new URLSearchParams(location.search),original=window.fetch.bind(window);
const id=(n:number)=>`55555555-5555-4555-8555-${String(n).padStart(12,'0')}`;
let propietario=id(901),conflicto=qs.has('conflicto'),lecturas=0,escrituras=0;
const clave=(p:string)=>`ensayo-vistas-listado:${p}`;
function inicial(p:string){const c=configuracionInicialListado();c.columnas=['email','grado'];c.filtros.estatus=p===id(901)?['ACTIVO']:['BAJA'];return [{id:p===id(901)?id(101):id(102),nombre:p===id(901)?'Activos de prueba':'Privada de la segunda cuenta',configuracion:c,predeterminada:true,revision:1}];}
function leer(p:string){try{return JSON.parse(localStorage.getItem(clave(p))||'null')||inicial(p);}catch{return inicial(p);}}
function guardar(p:string,v:unknown){localStorage.setItem(clave(p),JSON.stringify(v));}
const responder=(d:unknown,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json'}});
const metricas=()=>{const e=document.getElementById('vistas-metricas');if(e)e.textContent=`Lecturas ficticias: ${lecturas} · Escrituras ficticias: ${escrituras}`;};
window.fetch=async(input,init)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);
 if(u.origin===location.origin)return original(input,init);
 const rpc=u.pathname.split('/').at(-1),body=JSON.parse(String(init?.body||'{}')),dueno=propietario;
 if(rpc?.startsWith('listado_vista')){
  if(qs.has('sin-migracion'))return responder({code:'PGRST202',message:'Falta función ficticia'},404);
  let vistas=qs.has('demora')?inicial(dueno):leer(dueno);
  if(rpc==='listado_vistas_consultar_v1'){lecturas++;metricas();await new Promise(r=>setTimeout(r,qs.has('demora')?8000:80));return responder(vistas);}
  if(rpc==='listado_vista_guardar_v1'){
   const anterior=vistas.find((v:any)=>v.id===body.p_id);
   if(conflicto){conflicto=false;return responder({code:'40001',message:'La vista cambió. Actualiza las vistas antes de sobrescribirla'},409);}
   if((anterior&&anterior.revision!==body.p_revision)||(!anterior&&body.p_revision!==0))return responder({code:'40001',message:'Revisión desactualizada (ficticio)'},409);
   if(vistas.some((v:any)=>v.id!==body.p_id&&v.nombre.toLowerCase()===body.p_nombre.toLowerCase()))return responder({message:'Ya existe una vista con ese nombre'},409);
   vistas=vistas.filter((v:any)=>v.id!==body.p_id).map((v:any)=>body.p_predeterminada&&v.predeterminada?{...v,predeterminada:false,revision:v.revision+1}:v);
   vistas.push({id:body.p_id,nombre:body.p_nombre,configuracion:body.p_configuracion,predeterminada:body.p_predeterminada,revision:(anterior?.revision||0)+1});
  }else if(rpc==='listado_vista_eliminar_v1'){
   if(!vistas.some((v:any)=>v.id===body.p_id&&v.revision===body.p_revision))return responder({code:'40001',message:'Vista no disponible (ficticio)'},409);
   vistas=vistas.filter((v:any)=>v.id!==body.p_id);
  }
  escrituras++;metricas();guardar(dueno,vistas);return responder(vistas);
 }
 if(rpc==='certificacion_resumen_v1')return responder([]);
 if((init?.method||'GET')!=='GET')return responder({message:'Escritura externa bloqueada por ensayo'},403);
 return responder([]);
};
const {useAppStore}=await import('../src/store/useAppStore');
const usuario=()=>({id:propietario,auth_id:propietario,username:'Cuenta ficticia',rol:'ADMINISTRADOR'});
useAppStore.setState({currentUser:usuario() as any,alumnos:Array.from({length:33},(_,n)=>({id:id(n+1),nombre_completo:`PERSONA FICTICIA ${String(n+1).padStart(2,'0')}`,licenciatura:n%2?'Derecho':'Administración',turno:n%2?'MATUTINO':'MIXTO',estatus:n%3?'ACTIVO':'BAJA',grado_actual:String(n%8+1),email:'ensayo@example.test',fecha_nacimiento:'2000-01-01',sexo:n%2?'H':'M'})) as any,
 ciclos:[{id:id(501),nombre:'2027-1',tipo_periodo:'Cuatrimestral'},{id:id(502),nombre:'2027-1',tipo_periodo:'Semestral'}] as any,plans:[],catalogos:{licenciaturas:['Administración','Derecho'],turnos:['MATUTINO','MIXTO']} as any});
const {ReporteListadoGeneral}=await import('../src/components/reportes/ReporteListadoGeneral');
function App(){const [oscuro,setOscuro]=useState(qs.has('oscuro')),[visible,setVisible]=useState(true);React.useEffect(()=>{document.documentElement.classList.toggle('dark',oscuro);},[oscuro]);
 return <MemoryRouter><main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-5"><header className="flex flex-wrap gap-3 mb-4 text-xs"><strong>ENSAYO LOCAL · DATOS FICTICIOS · RED EXTERNA INTERCEPTADA</strong><span id="vistas-metricas"/>
 <button onClick={()=>setOscuro(v=>!v)}>Cambiar tema</button><button onClick={()=>{propietario=propietario===id(901)?id(902):id(901);useAppStore.setState({currentUser:usuario() as any});}}>Cambiar cuenta ficticia</button><button onClick={()=>setVisible(v=>!v)}>Salir / volver al listado</button><button onClick={()=>{guardar(propietario,inicial(propietario));location.reload();}}>Reiniciar vistas ficticias</button></header>
 {visible&&<ReporteListadoGeneral onBack={()=>setVisible(false)}/>}<Toaster/></main></MemoryRouter>;
}
const root=createRoot(document.getElementById('root')!);root.render(<StrictMode><App/></StrictMode>);import.meta.hot?.dispose(()=>root.unmount());
