// Solo respuestas ficticias. No inicia sesiones ni escribe en Supabase.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Routes,Route,useNavigate,useLocation} from 'react-router-dom';
import '../src/index.css';
import {rutaInicialUsuario,usaInicioFinanciero} from '../src/app/inicioUsuario';
const qs=new URLSearchParams(location.search),rol=qs.get('rol')||'COORDINADOR RECURSOS HUMANOS';document.documentElement.classList.toggle('dark',qs.has('oscuro'));
window.fetch=async()=>new Response('[]',{status:200,headers:{'content-type':'application/json'}});
const {useAppStore}=await import('../src/store/useAppStore');useAppStore.setState({currentUser:{id:'usuario-ficticio',rol,username:qs.has('extenso')?'Administración con un nombre de usuario extenso':'Ensayo',preferencia_tema:qs.has('oscuro')?'dark':'light'} as any,activeCicloId:'c27',alumnos:[{id:'alumno-ficticio',nombre_completo:'Persona de ensayo',estatus:'ACTIVO'}] as any,plans:[{id:'plan-ficticio',alumno_id:'alumno-ficticio',ciclo_id:'c27',cantidad_1:qs.has('extenso')?386611.5:200,fecha_1:'2025-01-01',estatus_1:'PENDIENTE'}] as any,ciclos:[{id:'c27',nombre:'2027-1',tipo_periodo:'Cuatrimestral'},{id:'c26',nombre:'2026-2',tipo_periodo:'Semestral'}] as any});
const {default:AppLayout}=await import('../src/components/AppLayout');
const {default:InicioArea}=await import('../src/app/InicioArea');
const {default:Dashboard}=await import('../src/components/Dashboard');
const {ReportesControlEscolar}=await import('../src/components/reportes/ReportesControlEscolar');
const {default:RecursosHumanosConfig}=await import('../src/components/RecursosHumanosConfig');
function App(){const nav=useNavigate(),loc=useLocation();return <AppLayout><Routes><Route path="/" element={usaInicioFinanciero(rol)?<Dashboard/>:<InicioArea/>}/><Route path="/rh" element={<InicioArea area="rh"/>}/><Route path="/control-escolar" element={<InicioArea area="escolar"/>}/><Route path="/control-academico" element={<InicioArea area="academico"/>}/><Route path="/reportes-escolares" element={<ReportesControlEscolar/>}/><Route path="/financiero" element={<Dashboard/>}/>{(['personal','resultados','planes'] as const).map(d=><Route key={d} path={`/rh/${d}`} element={<RecursosHumanosConfig seccion={d==='personal'?'directorio':d} onSeccionChange={s=>nav(`/rh/${s==='directorio'?'personal':s}`)} onBack={()=>nav('/rh')} onNavigateToEvaluacion={()=>nav('/rh/evaluacion')}/>}/>)}<Route path="*" element={<h1>Pantalla ficticia: {loc.pathname}</h1>}/></Routes></AppLayout>;}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={[qs.get('ruta')||rutaInicialUsuario(rol)]}><App/></MemoryRouter>);
