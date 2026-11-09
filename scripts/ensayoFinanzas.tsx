// Ensayo local. Toda conexión externa se intercepta antes de montar la aplicación.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider, useLocation, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import '../src/index.css';
import { ProteccionCapturaProvider, useProteccionCaptura } from '../src/app/ProteccionCaptura';
import AppLayout from '../src/components/AppLayout';
import { tituloRuta } from '../src/app/titulosRutas';
import PlanPagos from '../src/components/PlanPagos';
import AlumnosConfig from '../src/components/AlumnosConfig';
import PagosAdeudosAlumnos from '../src/components/reportes/PagosAdeudosAlumnos';
import AccesoRuta from '../src/app/AccesoRuta';
import ConsultarRegistros from '../src/components/ConsultarRegistros';
import ModalVinculacionFinanciera from '../src/components/recibos/ModalVinculacionFinanciera';
import { supabase } from '../src/lib/supabase';
import { useAppStore } from '../src/store/useAppStore';
const id = (n:number) => `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const ciclos = [{id:id(1),nombre:'2027-1',tipo_periodo:'Cuatrimestral',activo:true},{id:id(2),nombre:'2027-1',tipo_periodo:'Semestral',activo:false},{id:id(3),nombre:'2026-3',tipo_periodo:'Cuatrimestral',activo:false},{id:id(4),nombre:'2028-1',tipo_periodo:'Cuatrimestral',activo:false}];
const alumnos=[{id:id(10),nombre_completo:'ALUMNO FICTICIO UNO',matricula:'ENSAYO-001',grado_actual:'2',turno:'MATUTINO',estatus:'ACTIVO',saldo_a_favor:50}];
if(new URLSearchParams(location.search).get('padron')==='1') alumnos.push(...Array.from({length:24},(_,i)=>({...alumnos[0],id:id(300+i),nombre_completo:`ALUMNO FICTICIO ${String(i+2).padStart(2,'0')}`,matricula:`ENSAYO-${String(i+2).padStart(3,'0')}`,licenciatura:i%2?'PEDAGOGÍA':'DERECHO',grado_actual:i%2?'10MO':'2DO'})));
let planes = [1,2,3].map((n)=>({id:id(20+n),alumno_id:id(10),nombre_alumno:alumnos[0].nombre_completo,ciclo_id:id(n),ciclo_escolar:n===3?'2026-3':'2027-1',tipo_plan:n===2?'Semestral':'Cuatrimestral',no_plan_pagos:`${n}-ENSAYO`,licenciatura:'PROGRAMA FICTICIO',concepto_1:'PRIMER PAGO',cantidad_1:1000,estatus_1:'NO PAGADO',detalles:[{id:id(30+n),plan_id:id(20+n),indice_concepto:1,concepto:'PRIMER PAGO',cantidad:1000,estatus:'NO PAGADO',fecha_vencimiento:'2026-11-10'}]}));
// Variantes de interfaz: varios planes del mismo alumno y otro alumno, sin operaciones reales.
if (new URLSearchParams(location.search).get('multiples') === '1') {
  alumnos.push({...alumnos[0], id:id(11), nombre_completo:'ZÚÑIGA ALUMNO DE ENSAYO', matricula:'ENSAYO-002'});
  planes.push(...[4,5,6].map(n=>({...planes[0],id:id(20+n),no_plan_pagos:`${n}-ENSAYO`,tipo_plan:n===4?'Titulación':'Especialidad Cuatrimestral',detalles:planes[0].detalles.map(d=>({...d,id:id(30+n),plan_id:id(20+n)}))})));
  planes.push({...planes[0],id:id(29),alumno_id:id(11),nombre_alumno:alumnos[1].nombre_completo,no_plan_pagos:'9-ENSAYO'});
}
if(new URLSearchParams(location.search).get('padron')==='1') planes.push({...planes[0],id:id(80),alumno_id:undefined,nombre_alumno:'PLAN LEGADO FICTICIO SIN ID',no_plan_pagos:'LEGADO-ENSAYO'} as never);
const recibos=Array.from({length:25},(_,n)=>({id:id(100+n),alumno_id:id(10),ciclo_id:id(n>19?3:1),folio:40200+n,total:400,fecha_recibo:'2026-11-01',fecha_pago:'2026-11-01',forma_pago:'EFECTIVO',banco:'NO APLICA',estatus:n===24?'CANCELADO':'ACTIVO',recibos_detalles:[{id:id(200+n),recibo_id:id(100+n),concepto:'PRIMER PAGO CON COSTO PROMOCIONAL',cantidad:1,costo_unitario:400,subtotal:400,indice_concepto_plan:null}]}));
const vinculos:any[]=[];
let fallo=false; const peticiones:{tabla:string;metodo:string}[]=[];
const fetchOriginal=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof Request?input.url:input.toString(),location.href);
 if(url.origin===location.origin)return fetchOriginal(input,init);
 const tabla=url.pathname.split('/').pop()!; const metodo=init?.method||'GET';peticiones.push({tabla,metodo});
 document.querySelector('#operaciones-ensayo')?.replaceChildren(`Solicitudes: ${peticiones.length}; guardar estatus: ${peticiones.filter(p=>p.tabla==='guardar_observacion_plan_v1').length}`);
 if(fallo)return new Response(JSON.stringify({message:'Error simulado; la captura se conserva',code:'P0001'}),{status:400,headers:{'content-type':'application/json'}});
 const body=typeof init?.body==='string'?JSON.parse(init.body):{};
 let data:any=[];let total=0;
 if(tabla==='guardar_observacion_plan_v1') {planes=planes.map(p=>p.id===body.p_plan_id?{...p,estatus_1:body.p_texto,detalles:p.detalles.map(d=>({...d,estatus:body.p_texto}))}:p);data={aplicado:true,estatus:body.p_texto};}
 else if(tabla==='conciliar_recibo_entre_periodos_v1'){
   const p=planes.find(p=>p.id===body.p_plan_id)!;const fuente=recibos.find(r=>r.recibos_detalles.some(d=>d.id===body.p_detalle_id))!;
   const importe=body.p_modo==='historico'?Number(body.p_importe):400;
   if(body.p_confirmar){vinculos.push({plan_id:p.id,indice_concepto:body.p_indice,recibo_detalle_id:body.p_detalle_id,importe,plan:p});}
   data={aplicable:true,aplicado:body.p_confirmar,revision:'ficticia-entre-periodos',aplicado_total:importe,remanente:400-importe,disponible_origen:400,aplicado_previamente:0,excedente_previo:0,motivo_conciliacion:body.p_motivo,evidencia:body.p_evidencia,destinos:[{plan_id:p.id,indice:body.p_indice,importe}]};
 }else if(tabla==='vinculacion_financiera_v1'){
   const d=body.p_destinos; if(body.p_confirmar){for(const destino of d){const p=planes.find(p=>p.id===destino.plan_id)!;const estatus='R-40200 (Abono $400.00, Resta $600.00)';p.estatus_1=estatus;p.detalles[0].estatus=estatus;vinculos.push({plan_id:p.id,indice_concepto:destino.indice,recibo_detalle_id:body.p_detalle_id,importe:400,plan:p});}}data={aplicable:true,aplicado:body.p_confirmar,revision:'ficticia',aplicado_total:400,remanente:0,destinos:d.map((x:any)=>({...x,importe:400}))};
 }else if(tabla==='vista_planes_pago') {
   const eq=url.searchParams.get('id');data=eq?planes.find(p=>p.id===eq.slice(3))||null:planes;
 }else if(tabla==='planes_pago_vinculos_recibo'){data=vinculos;}else if(tabla==='recibos'){
   let rows=recibos.filter(r=>!url.searchParams.get('folio')||r.folio===Number(url.searchParams.get('folio')!.slice(3)));
   const filtro=url.searchParams.get('ciclo_id');if(filtro)rows=rows.filter(r=>filtro.includes(r.ciclo_id));
   const eq=url.searchParams.get('id');if(eq)data=rows.find(r=>r.id===eq.slice(3))||null;
   else {total=rows.length; const offset=Number(url.searchParams.get('offset')||0);const limit=Number(url.searchParams.get('limit')||1000);data=rows.slice(offset,offset+limit);}
 }else if(tabla==='recibos_detalles')data=recibos.flatMap(r=>r.recibos_detalles);
 else if(tabla==='alumnos')data=alumnos[0];
 else if(tabla==='alumno_programas')data=alumnos.map(a=>({id:id(500+alumnos.indexOf(a)),alumno_id:a.id,plan_id:id(600),estatus:'ACTIVO',planes_estudio:{total_periodos:10}}));
 return new Response(JSON.stringify(data),{headers:{'content-type':'application/json','content-range':`0-${Math.max(0,(Array.isArray(data)?data.length:1)-1)}/${total|| (Array.isArray(data)?data.length:1)}`}});
};
supabase.channel=()=>({on(){return this;},subscribe(){return this;}}) as never;supabase.removeChannel=async()=> 'ok';
const parametrosEnsayo=new URLSearchParams(location.search);
supabase.auth.signOut=async()=>{toast.success('Cierre de sesión simulado; sin conexión externa.');return {error:null};};
useAppStore.setState({currentUser:{id:id(90),username:'ensayo',rol:parametrosEnsayo.get('app')==='1'?parametrosEnsayo.get('rol')||'ADMINISTRADOR':'COORDINADOR FINANCIERO',activo:true,preferencia_tema:'light'},authChecked:true,activeCicloId:id(1),ciclos,alumnos,plans:planes,carreras:[],loading:false} as never);
function PaginaDestinoEnsayo(){const ruta=useLocation();const[captura,setCaptura]=useState('');useProteccionCaptura(Boolean(captura));return <section className="mx-auto max-w-3xl space-y-4 rounded-xl border border-gray-300 bg-white p-6 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"><h1>{tituloRuta(ruta.pathname,'ADMINISTRADOR')}</h1><p>Navegación de ensayo. Datos ficticios; sin conexiones externas.</p><label className="block">Captura de ensayo<input className="mt-2 block w-full rounded border p-3" value={captura} onChange={e=>setCaptura(e.target.value)}/></label></section>}
function EnsayoConLayout(){const ruta=useLocation();const navegar=useNavigate();return <AppLayout><AccesoRuta>{ruta.pathname==='/plan-pagos'?<PlanPagos initialPlanId={id(21)} onBack={()=>navegar('/dashboard')} onSavePlan={async()=>true}/>:ruta.pathname==='/alumnos'?<AlumnosConfig onBack={()=>navegar('/dashboard')} onViewFicha={alumnoId=>navegar('/ficha-alumno',{state:{alumnoId}})}/>:ruta.pathname==='/pagos-adeudos-alumnos'?<PagosAdeudosAlumnos/>:<PaginaDestinoEnsayo key={ruta.pathname}/>}</AccesoRuta></AppLayout>}
function Ensayo(){const[oscuro,setOscuro]=useState(false);const[vista,setVista]=useState('planes');const[abierto,setAbierto]=useState(true);const entrada=new URLSearchParams(location.search).get('vinculo');return <div className="min-h-screen bg-gray-100 p-3 dark:bg-gray-950"><div className="flex flex-wrap gap-3 rounded-lg bg-blue-100 p-3 text-sm text-blue-950"><strong>DATOS FICTICIOS · Sin conexiones externas</strong><button onClick={()=>{setOscuro(!oscuro);document.documentElement.classList.toggle('dark',!oscuro);}}>Cambiar tema</button><button onClick={()=>setVista(vista==='planes'?'recibos':'planes')}>Cambiar módulo</button><button onClick={()=>{fallo=!fallo;}}>Simular error</button><button onClick={()=>setAbierto(true)}>Abrir vínculo de ensayo</button><span id="operaciones-ensayo">Solicitudes: 0</span></div>{entrada ? abierto && <ModalVinculacionFinanciera {...(entrada==='plan'?{plan:planes[0],indice:1}:{recibo:recibos[20],detalle:recibos[20].recibos_detalles[0]}) as any} onClose={()=>setAbierto(false)}/> : vista==='planes'?<PlanPagos initialPlanId={id(21)} onBack={()=>{}} onSavePlan={async()=>true}/>:<ConsultarRegistros initialSearchTerm="40200" onNavigateToPlan={()=>setVista('planes')}/>}</div>}
const router=createHashRouter([{path:'*',element:<ProteccionCapturaProvider>{parametrosEnsayo.get('app')==='1'?<EnsayoConLayout/>:<Ensayo/>}<Toaster/></ProteccionCapturaProvider>}]);
const root=createRoot(document.getElementById('root')!);root.render(<RouterProvider router={router}/>);
if(import.meta.hot)import.meta.hot.dispose(()=>{root.unmount();router.dispose();window.fetch=fetchOriginal;});
