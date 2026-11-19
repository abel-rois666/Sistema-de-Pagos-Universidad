// Regresión aislada: todas las respuestas son ficticias, sin conexión a Supabase.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import '../src/index.css';
document.documentElement.classList.toggle('dark',new URLSearchParams(location.search).has('oscuro'));
const ensayo={promedio:9.50,error:false,guardados:[] as Record<string,unknown>[],ficha:null as Record<string,unknown>|null};
const parametros=new URLSearchParams(location.search);
const ensayarFolios=parametros.has('folios');
const programasFolios=[
 {id:'pr',plan_id:'plan',planes_estudio:{nombre:'PLAN HISTÓRICO',carreras:{nombre:'Derecho',nivel_educativo:'Licenciatura'}}},
 {id:'pos',plan_id:'posgrado',es_vigente:true,planes_estudio:{nombre:'PLAN VIGENTE',carreras:{nombre:'Educación',nivel_educativo:'Maestría'}}},
 {id:'sin',plan_id:'incompleto',planes_estudio:{nombre:'PLAN SIN CARRERA',carreras:null}},
];
const fichasFolios=programasFolios.map(programa=>({
 id:`ficha-${programa.id}`,alumno_id:'a',alumno_programa_id:programa.id,revision:1,modalidad:'TESIS',tramite_completado:false,
 pago_titulacion:'COMPLETADO',certificado_estudios:'TRAMITADO',ingles:'COMPLETADO',servicio_social_req:'COMPLETADO',
 fotografias:'ENTREGADAS',doc_antecedente:'APROBADO',doc_acta_nacimiento:'APROBADO',doc_curp:'APROBADO',libro:1,foja:40,fecha_examen:'2026-11-18',
 plan_pago_requisito_id:'p1',servicio_social_requisito_id:'s1',folio_control:programa.id==='pr'?'FOLIO-HISTÓRICO':null,
}));
if(parametros.has('acta')){
 ensayo.ficha={...fichasFolios[0],modalidad:'ALTO RENDIMIENTO ACADÉMICO',folio_control:'LD-001-0040',fecha_examen:null,fecha_exencion:null};
}
if(parametros.has('completada')){
 ensayo.promedio=8;
 ensayo.ficha={id:'ficha',alumno_id:'a',alumno_programa_id:'pr',revision:2,modalidad:'ALTO RENDIMIENTO ACADÉMICO',tramite_completado:true,
  pago_titulacion:'COMPLETADO',certificado_estudios:'TRAMITADO',ingles:'COMPLETADO',servicio_social_req:'COMPLETADO',promedio_alto_rendimiento:'APLICA',
  fotografias:'ENTREGADAS',doc_antecedente:'APROBADO',doc_acta_nacimiento:'APROBADO',doc_curp:'APROBADO',libro:1,foja:1,folio_control:'FICTICIO',fecha_exencion:'2026-11-18',
  plan_pago_requisito_id:'p1',servicio_social_requisito_id:'s1',requisitos_verificados:{promedio:9.54,materias_promedio:53,materias_con_nota:53,ingles_total:8,ingles_aprobadas:8,pago_pagados:1,pago_conceptos:1,certificacion_id:'cert',verificado_en:'2026-11-18T12:00:00Z'}};
}
Object.assign(window,{ensayo});
const nativo=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
 if(u.origin===location.origin)return nativo(input,init);
 let datos:unknown;
 if(ensayarFolios&&u.pathname.endsWith('/rpc/titulacion_consultar_v1')){
  datos={fichas:fichasFolios,programas:programasFolios,ocupados:programasFolios.map(p=>p.id)};
 }else if(u.pathname.endsWith('/rpc/titulacion_requisitos_v1')){
  if(ensayo.error)return new Response(JSON.stringify({message:'Error ficticio de comprobación',code:'P0001'}),{status:400,headers:{'Content-Type':'application/json'}});
  const p=JSON.parse(String(init?.body));
  const programa=programasFolios.find(x=>x.id===p.p_programa);
  if(p.p_alumno!=='a'||!programa||(!ensayarFolios&&programa.id!=='pr'))throw new Error('Identidad incorrecta');
  datos={alumno_id:'a',alumno_programa_id:programa.id,plan_id:programa.plan_id,plan_pago_id:p.p_pago,servicio_social_id:p.p_ss,certificacion_id:'cert',ingles_total:2,ingles_aprobadas:2,materias_plan:4,promedio:ensayo.promedio,materias_promedio:2,materias_con_nota:2,pago_revisar:false,pago_conceptos:p.p_pago?2:0,pago_pagados:p.p_pago?2:0,verificado_en:'2026-11-18T12:00:00Z',criterio_promedio:'>=9.50',
   estados:{certificado_estudios:'TRAMITADO',ingles:'COMPLETADO',servicio_social_req:p.p_ss?'COMPLETADO':'SIN_INICIAR',pago_titulacion:p.p_pago?'COMPLETADO':'SIN_INICIAR',promedio_alto_rendimiento:ensayo.promedio>=9.5?'APLICA':'NO_APLICA'},
   planes_pago:[{id:'p1',folio:'FICTICIO-001',licenciatura:'LICENCIATURA CON NOMBRE EXTENSO PARA COMPROBAR EL SELECTOR',ciclo:'2027-1',tipo_periodo:'Semestral'}],servicios_sociales:[{id:'s1',empresa:'INSTITUCIÓN FICTICIA DE SERVICIO SOCIAL',estado:'LIBERADO',fecha:'2026-01-01'}]};
 }else if(u.pathname.endsWith('/rpc/titulacion_guardar_v1')){
  const p=JSON.parse(String(init?.body));ensayo.guardados.push(p);
  datos=ensayo.ficha={...p.p_datos,id:'ficha',alumno_id:'a',alumno_programa_id:'pr',revision:1,created_at:'2026-11-18',updated_at:'2026-11-18',tramite_completado:p.p_accion==='COMPLETAR'};
 }else{
  if(init?.method&&init.method!=='GET')throw new Error('Escritura no prevista');
  if(u.pathname.endsWith('/ficha_titulacion'))datos=ensayarFolios
   ? fichasFolios.find(f=>`eq.${f.alumno_programa_id}`===u.searchParams.get('alumno_programa_id'))||null
   : ensayo.ficha;
  else throw new Error('Petición no prevista: '+u.pathname);
 }
 return new Response(JSON.stringify(datos),{status:200,headers:{'Content-Type':'application/json'}});
};
const {default:Ficha}=await import('../src/components/titulacion/FichaTitulacionPrograma');
const {default:TabTitulacion}=await import('../src/components/tabs/TabTitulacion');
const {useAppStore}=await import('../src/store/useAppStore');
if(ensayarFolios)useAppStore.getState().setCurrentUser({id:'admin',rol:'ADMINISTRADOR',username:'ensayo',activo:true});
const modalidades=['TESIS','TESINA','ALTO RENDIMIENTO ACADÉMICO'];
const carrera={nombre:'Derecho',nivel_educativo:parametros.has('especialidad')?'Especialidad':'Licenciatura'};
createRoot(document.getElementById('root')!).render(<MemoryRouter><main className="mx-auto min-h-screen max-w-6xl bg-gray-50 p-4 text-gray-900 dark:bg-[#080e18] dark:text-gray-100">{ensayarFolios
 ? <TabTitulacion alumnoId="a" modalidadesCatalogo={modalidades}/>
 : <Ficha alumnoId="a" programaId="pr" carreraPrograma={carrera} modalidadesCatalogo={modalidades}/>}</main></MemoryRouter>);
