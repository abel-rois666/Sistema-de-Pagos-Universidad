// Ensayo local reproducible. Datos ficticios y ninguna conexión a la base real.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider, Link, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '../src/index.css';
import { ProteccionCapturaProvider } from '../src/app/ProteccionCaptura';
import LimiteError from '../src/app/LimiteError';
import InicioArea from '../src/app/InicioArea';
import DocentesConfig from '../src/components/DocentesConfig';
import GruposConfig from '../src/components/GruposConfig';
import Calificaciones from '../src/components/CalificacionesModule';
import Estadisticas from '../src/components/Estadisticas';
import ControlIngresos from '../src/components/ControlIngresos';
import PlanPagos from '../src/components/PlanPagos';
import { supabase } from '../src/lib/supabase';
import { useAppStore } from '../src/store/useAppStore';

const fetchOriginal = window.fetch.bind(window);
const ciclo = { id: '11111111-1111-4111-8111-111111111111', nombre: '2027-1', tipo_periodo: 'Cuatrimestral', activo: true };
const otroCiclo = { id: '22222222-2222-4222-8222-222222222222', nombre: '2027-1', tipo_periodo: 'Semestral', activo: false };
const alumno = { id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', nombre_completo:'ALUMNO FICTICIO', matricula:'ENSAYO-001', grado_actual:'1', turno:'MATUTINO', estatus:'ACTIVO', monedero:0 };
const grupo = { id:'33333333-3333-4333-8333-333333333333',codigo_grupo:'GRUPO-FICTICIO',ciclo_id:ciclo.id,plan_id:'plan-ficticio',grado:1,turno:'MATUTINO',estatus:'activo',plan:{nombre:'Plan ficticio',carrera_id:'carrera-ficticia',carrera:{nombre:'Programa ficticio'}},ciclo };
let consultasFallan = false;
window.fetch = async (input, init) => {
  const url = new URL(typeof input==='string' ? input : input instanceof Request ? input.url : input.toString(), location.href);
  if (url.origin === location.origin) return fetchOriginal(input,init);
  const tabla = url.pathname.split('/').pop();
  if (init?.method === 'DELETE') return new Response(JSON.stringify({message:'Eliminación rechazada en el ensayo: el plan se conserva',code:'P0001'}),{status:400,headers:{'content-type':'application/json'}});
  if (url.pathname.includes('/rpc/') || (consultasFallan && tabla==='recibos_detalles')) return new Response(JSON.stringify({message:'Fallo simulado: no se guardó ningún dato',code:'P0001'}),{status:400,headers:{'content-type':'application/json'}});
  let data: unknown = [];
  if (tabla==='docentes') data=Array.from({length:31},(_,n)=>({id:'docente-'+n,clave_legado:String(n+1),nombre_completo:'DOCENTE FICTICIO '+String(n+1).padStart(2,'0'),estatus:'activo',usuarios:[]}));
  if (tabla==='grupos') data=[grupo];
  if (tabla==='docentes_grupos_asignaturas') data=[{grupo_id:grupo.id,asignatura_id:'44444444-4444-4444-8444-444444444444',asignaturas:{nombre:'Complementaria ficticia',clave_legado:'C01',clasificacion_clave:'266'},docentes:{nombre_completo:'DOCENTE FICTICIO'}}];
  if (tabla==='alumnos_grupos') data=[{id:'relacion-ficticia',grupo_id:grupo.id,alumno_id:alumno.id,asignatura_id:'44444444-4444-4444-8444-444444444444',alumnos:alumno}];
  if (tabla==='inscripciones_academicas') data=[{id:'55555555-5555-4555-8555-555555555555',alumno_id:alumno.id,ciclo_id:ciclo.id,asignatura_id:'44444444-4444-4444-8444-444444444444',parcial_1:null,parcial_2:null,parcial_3:null,calificacion_final:null,tipo_evaluacion:'ORDINARIO',estatus:'Cursando'}];
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json','content-range':'0-30/31'}});
};
supabase.channel=()=>({on(){return this;},subscribe(){return this;}}) as never;
supabase.removeChannel=async()=> 'ok';
const parametros = new URLSearchParams(location.search);
const rolEnsayo = ['ADMINISTRADOR','CAJERO','COORDINADOR FINANCIERO','DOCENTE'].includes(parametros.get('rol') || '') ? parametros.get('rol')! : 'ADMINISTRADOR';
supabase.auth.getSession=async()=>({data:{session:null},error:null});
supabase.auth.onAuthStateChange=()=>({data:{subscription:{unsubscribe(){}}}}) as never;
useAppStore.setState({currentUser:{id:'usuario-ficticio',username:'ENSAYO',rol:rolEnsayo,activo:true},authChecked:true,activeCicloId:ciclo.id,ciclos:[ciclo,otroCiclo],alumnos:[alumno],plans:[],carreras:[{id:'carrera-ficticia',nombre:'Programa ficticio',nivel_educativo:'Licenciatura',calificacion_minima_aprobatoria:6}],loading:false} as never);

function Ensayo() {
  const [oscuro,setOscuro]=useState(false);
  return <ProteccionCapturaProvider><div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">
    <header className="flex flex-wrap items-center gap-3 border-b border-gray-300 p-3 text-xs dark:border-gray-700">
      <strong>ENSAYO FICTICIO · SIN DATOS REALES</strong>
      <button onClick={()=>{document.documentElement.classList.toggle('dark');setOscuro(!oscuro);}} className="rounded border px-2 py-1">{oscuro?'Tema claro':'Tema oscuro'}</button>
      <button onClick={()=>{consultasFallan=!consultasFallan;}} className="rounded border px-2 py-1">Alternar fallo de consulta</button>
      <button onClick={()=>useAppStore.setState({plans:[{id:'66666666-6666-4666-8666-666666666666',alumno_id:alumno.id,ciclo_id:ciclo.id,nombre_alumno:alumno.nombre_completo,no_plan_pagos:'ENSAYO-001',tipo_plan:'Cuatrimestral',licenciatura:'Programa ficticio',concepto_1:'Colegiatura',cantidad_1:850,estatus_1:'PENDIENTE',fecha_1:'2026-10-21',fecha_plan:'21/10/2026',observaciones:[]}]} as never)} className="rounded border px-2 py-1">Cargar plan ficticio</button>
      <nav className="flex flex-wrap gap-3"><Link to="/">Inicio</Link><Link to="/docentes">Docentes</Link><Link to="/grupos">Grupos</Link><Link to="/calificaciones">Calificaciones</Link><Link to="/estadisticas">Estadísticas</Link><Link to="/control-ingresos/registrar">Recibos</Link><Link to="/plan-pagos">Planes</Link></nav>
    </header>
    <main><LimiteError><Outlet /></LimiteError></main><Toaster />
  </div></ProteccionCapturaProvider>;
}
const rutasEnsayo=[{element:<Ensayo />,children:[
  {path:'/',element:<InicioArea />},{path:'/docentes',element:<DocentesConfig />},
  {path:'/grupos',element:<GruposConfig />},{path:'/calificaciones',element:<Calificaciones />},
  {path:'/estadisticas',element:<Estadisticas onBack={()=>{}} />},
  {path:'/control-ingresos/*',element:<ControlIngresos onBack={()=>{}} />},
  {path:'/plan-pagos',element:<PlanPagos onBack={()=>{}} onSavePlan={()=>false} onDeletePlan={id=>useAppStore.setState(s=>({plans:s.plans.filter(plan=>plan.id!==id)}))} />},
]}];
const App = parametros.has('app') ? (await import('../src/App')).default : null;
const router=createHashRouter(App ? [{path:'*',element:<ProteccionCapturaProvider><App /><Toaster /></ProteccionCapturaProvider>}] : rutasEnsayo);
const raiz = createRoot(document.getElementById('root')!);
raiz.render(<RouterProvider router={router} />);
if (import.meta.hot) import.meta.hot.dispose(() => { raiz.unmount(); router.dispose(); window.fetch = fetchOriginal; });
