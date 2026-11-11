import React,{StrictMode,useState} from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '../src/index.css';
const qs=new URLSearchParams(location.search), original=window.fetch.bind(window);
const id=(n:number)=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const alumnos=Array.from({length:33},(_,i)=>({id:id(i+1),nombre_completo:`ALUMNO FICTICIO ${String(i+1).padStart(2,'0')}`,matricula:`DEMO-${i+1}`,licenciatura:i%2?'Derecho':'Administración',estatus:i%3?'EGRESADO':'TITULADO',grado_actual:'8',turno:'MATUTINO',email:i%4?'ejemplo@example.test':'',sexo:i%2?'H':'M',fecha_nacimiento:i%3?'2000-11-09':null,estado_nacimiento:i%2?'DF':'MEX',estado_escolaridad:i%2?'PUE':'CDMX',estado:i%2?'MEX':'PUE'}));
const programas=alumnos.map((a,i)=>({id:id(100+i),alumno_id:a.id,plan_id:id(300+i),es_vigente:true,estatus:'EGRESADO',planes_estudio:{id:id(300+i),nombre:'Plan 2017',clave_legado:'2017-'+i,carrera_id:id(600),carreras:{id:id(600),nombre:a.licenciatura,nivel_educativo:'Licenciatura'}}}));
programas.push({...programas[0],id:id(200),es_vigente:false,planes_estudio:{...programas[0].planes_estudio,nombre:'Plan de especialidad',clave_legado:'ESP-2009',carreras:{id:id(601),nombre:'Docencia universitaria',nivel_educativo:'Especialidad'}}});
let fichas=programas.slice(0,4).map((p,i)=>({id:id(400+i),alumno_id:p.alumno_id,alumno_programa_id:p.id,revision:1,pago_certificado:i===1?'EN_CURSO':'COMPLETADO',tipo_certificado:'TOTAL',doc_acta_nacimiento:'APROBADO',doc_curp:'APROBADO',doc_antecedente:'APROBADO',doc_titulo_profesional:'SIN_INICIAR',doc_cedula_profesional:'SIN_INICIAR',tramite_completado:i===2,fecha_inicio_tramite:i===2?'2026-11-01':null,fecha_completado:i===2?'2026-11-08T12:00:00Z':null,enlace_drive:null,archivado_en:null}));
fichas.push({...fichas[1],id:id(450),alumno_id:alumnos[0].id,alumno_programa_id:null});
// Regresión de asociación y reapertura: un programa y una ficha anterior reales del ensayo.
if(qs.has('asociacion')){
 if(!qs.has('varios-programas'))programas.splice(programas.findIndex(p=>p.id===id(200)),1);
 if(!qs.has('ocupado'))fichas=fichas.filter(f=>f.id!==id(400));
 if(qs.has('sin-pendiente'))fichas=fichas.filter(f=>f.id!==id(450));
}
const planes=[{id:id(500),alumno_id:alumnos[0].id,tipo_plan:'Titulación',ciclo_escolar:'2027-1',ciclo_id:id(700),no_plan_pagos:'271-TIT-001',detalles:[{indice_concepto:1,concepto:'Pago de titulación',cantidad:1500,estatus:'F-12306'}]},{id:id(501),alumno_id:alumnos[0].id,tipo_plan:'Titulación',ciclo_escolar:'2026-2',ciclo_id:id(701),no_plan_pagos:'262-TIT-001',detalles:[{indice_concepto:1,concepto:'Pago de titulación',cantidad:1500,estatus:'R-83 (Abono $500.00, Resta $1000.00)'}]}];
let fallo=qs.has('fallo'),falloGuardar=qs.has('guardar-fallo'),llamadas=0,escrituras=0;
const responder=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const metricas=()=>{const el=document.getElementById('metricas');if(el)el.textContent=`Consultas interceptadas: ${llamadas} · Guardados ficticios: ${escrituras}`;};
window.fetch=async(input:any,init?:RequestInit)=>{
 const u=new URL(typeof input==='string'?input:input.url||String(input),location.href);
 if(u.origin===location.origin)return original(input,init);
 llamadas++;metricas();const rpc=u.pathname.split('/').pop(),body=init?.body?JSON.parse(String(init.body)):{};
 if(init?.signal?.aborted)throw new DOMException('Cancelada','AbortError');
 await new Promise(r=>setTimeout(r,120));
 if(rpc?.startsWith('certificacion_')){
  if(qs.has('sin-migracion'))return responder({code:'PGRST202',message:'Función no instalada (ficticio)'},404);
  if(fallo)return responder({code:'42501',message:'Consulta rechazada (ficticio)'},403);
  if(rpc==='certificacion_consultar_v1')return responder({fichas:fichas.filter(f=>f.alumno_id===body.p_alumno_id&&!f.archivado_en),programas:programas.filter(p=>p.alumno_id===body.p_alumno_id)});
  if(rpc==='certificacion_resumen_v1'){
   const filas=programas.filter(p=>body.p_alumnos.includes(p.alumno_id)).map(p=>{const f=fichas.find(f=>f.alumno_programa_id===p.id&&!f.archivado_en);return {...f,alumno_id:p.alumno_id,alumno_programa_id:p.id,programa:p.planes_estudio.clave_legado+' · '+p.planes_estudio.carreras.nombre,sin_ficha:!f};});
   filas.push(...fichas.filter(f=>!f.alumno_programa_id&&!f.archivado_en&&body.p_alumnos.includes(f.alumno_id)) as any);
   return responder(filas.slice(body.p_desde,body.p_desde+body.p_cantidad));
  }
  if(rpc==='certificacion_guardar_v1'){
   if(falloGuardar)return responder({code:'40001',message:'La ficha cambió. Recarga antes de guardar (ficticio).'},409);
   const prev=fichas.find(f=>f.id===body.p_id);if(prev&&prev.revision!==body.p_revision)return responder({message:'Revisión caducada (ficticio)'},409);
   if(fichas.some(f=>f.id!==body.p_id&&f.alumno_programa_id===body.p_programa_id&&!f.archivado_en))return responder({message:'El programa ya tiene una ficha activa (ficticio)'},409);
   const f={...body.p_datos,id:body.p_id,alumno_id:body.p_alumno_id,alumno_programa_id:body.p_programa_id,revision:(prev?.revision||0)+1};
   fichas=[...fichas.filter(f=>f.id!==body.p_id),f];escrituras++;metricas();return responder(f);
  }
  if(rpc==='certificacion_archivar_v1'){fichas=fichas.map(f=>f.id===body.p_id?{...f,archivado_en:new Date().toISOString()}:f);escrituras++;metricas();return responder(null);}
 }
 if((init?.method||'GET')!=='GET')return responder({message:'Operación externa bloqueada por ensayo'},403);
 if(rpc==='ficha_certificacion'){
  const alumno=u.searchParams.get('alumno_id')||'';return responder(fichas.filter(f=>alumno==='eq.'+f.alumno_id||alumno.includes(f.alumno_id)).map(f=>({...f,alumno_programa_id:qs.has('sin-migracion')?null:f.alumno_programa_id})).slice(Number(u.searchParams.get('offset')||0),Number(u.searchParams.get('offset')||0)+Number(u.searchParams.get('limit')||1000)));
 }
 if(rpc==='inscripciones_academicas'){
  if(Number(u.searchParams.get('offset')||0)>0)return responder([]);
  const ids=u.searchParams.get('alumno_id')||'';return responder(alumnos.filter(a=>ids.includes(a.id)).map(a=>({alumno_id:a.id,ciclo_id:id(700),ciclo_legado:null})));
 }
 if(rpc==='alumno_programas'){const a=u.searchParams.get('alumno_id')?.replace('eq.','');return responder(programas.filter(p=>p.alumno_id===a));}
 return responder([]);
};
const {supabase}=await import('../src/lib/supabase');supabase.channel=()=>({on(){return this;},subscribe(){return this;}}) as any;supabase.removeChannel=async()=> 'ok' as any;
const {useAppStore}=await import('../src/store/useAppStore');
const refresh=async()=>{useAppStore.setState({alumnos:[...alumnos] as any});};
useAppStore.setState({currentUser:{id:id(900),rol:qs.has('control-escolar')?'COORDINADOR CONTROL ESCOLAR':'ADMINISTRADOR',username:'demo'} as any,alumnos:alumnos as any,plans:planes as any,carreras:[{id:id(600),nombre:'Administración',nivel_educativo:'Licenciatura'},{id:id(601),nombre:'Docencia universitaria',nivel_educativo:'Especialidad'}] as any,ciclos:[{id:id(700),nombre:'2027-1',tipo_periodo:'Cuatrimestral'},{id:id(701),nombre:'2026-2',tipo_periodo:'Semestral'}] as any,activeCicloId:id(700),catalogos:{licenciaturas:['Derecho','Administración'],turnos:['MATUTINO']} as any,refreshAlumnos:refresh,refreshAfterPayment:refresh,refreshPlans:async()=>{}});
const {ReporteEgresados}=await import('../src/components/reportes/ReporteEgresados');const {ReporteListadoGeneral}=await import('../src/components/reportes/ReporteListadoGeneral');
const {default:TabCertificacion}=await import('../src/components/tabs/TabCertificacion');
function App(){const [oscuro,setOscuro]=useState(qs.has('oscuro')),[general,setGeneral]=useState(qs.has('general'));
 const [apertura,setApertura]=useState(0);
 React.useEffect(()=>{document.documentElement.classList.toggle('dark',oscuro);},[oscuro]);
 return <MemoryRouter><main className="min-h-screen p-3 sm:p-5 bg-gray-50 dark:bg-[#101620] text-gray-900 dark:text-gray-100"><div className="flex flex-wrap gap-3 text-xs mb-4"><strong>ENSAYO · DATOS FICTICIOS</strong><button onClick={()=>setGeneral(g=>!g)}>Cambiar reporte</button><button onClick={()=>setOscuro(t=>!t)}>Cambiar tema</button><button onClick={()=>{fallo=false;falloGuardar=false;}}>Restablecer conexión ficticia</button>{qs.has('asociacion')&&<button onClick={()=>setApertura(v=>v+1)}>Volver a abrir la sección</button>}</div><p id="metricas" className="text-xs mb-3"/>{qs.has('asociacion')?<TabCertificacion key={apertura} alumnoId={alumnos[0].id} esEspecialidad={false} programaInicialId="__legado__" soloLectura={qs.has('control-escolar')}/>:general?<ReporteListadoGeneral onBack={()=>setGeneral(false)}/>:<ReporteEgresados onBack={()=>setGeneral(true)}/>}<Toaster/></main></MemoryRouter>;
}
const root=createRoot(document.getElementById('root')!);root.render(<StrictMode><App/></StrictMode>);import.meta.hot?.dispose(()=>root.unmount());
