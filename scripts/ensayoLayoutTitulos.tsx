import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import '../src/index.css';
document.documentElement.classList.toggle('dark',new URLSearchParams(location.search).has('oscuro'));
const nativo=window.fetch.bind(window);
const firmante={id:'firmante',clave_puesto:3,puesto:'RECTOR',titulo_academico:'DRA.',nombres:'NOMBRE',apellido_paterno:'PRUEBA',curp:'XXXX000101MDFXXX00'};
const alumno={id:'alumno',nombre_completo:'ALUMNO FICTICIO',nombres:'NOMBRE',apellido_paterno:'PRUEBA',curp:'XXXX000101HDFXXX00',email:'ensayo@example.invalid',estado_escolaridad:'09',escuela_procedencia:'ESCUELA DE PRUEBA',alumno_programas:[{id:'programa',plan_id:'plan',planes_estudio:{id:'plan',id_autorizacion_reconocimiento:1,rvoe:'00123456',carrera:{nivel_educativo:'LICENCIATURA',nombre:'DERECHO',clave:'612301'}}}]};
window.fetch=async(input,init)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);
 if(u.origin===location.origin)return nativo(input,init);
 if(init?.method && init.method!=='GET')throw new Error('El ensayo no permite escrituras');
 let datos:unknown=[];
 if(u.pathname.endsWith('/configuracion_app'))datos=Object.entries({clave_institucion:'090552',clave_entidad_universidad:'09',nombre_entidad_universidad:'CIUDAD DE MÉXICO'}).map(([id,valor])=>({id,valor}));
 else if(u.pathname.endsWith('/empleados'))datos=[firmante];
 else if(u.pathname.endsWith('/alumnos'))datos=[alumno];
 else if(u.pathname.endsWith('/inscripciones_academicas'))datos=[{id:'historia',asignatura:{plan_id:'plan'},ciclo:{fecha_inicio:'2013-09-01',fecha_termino:'2017-07-01'}}];
 else if(u.pathname.endsWith('/ficha_titulacion')){if(u.searchParams.get('alumno_programa_id')!=='eq.programa')throw new Error('Programa incorrecto');datos=[{modalidad:'POR PROMEDIO',fecha_exencion:'2026-11-01',folio_control:'LD-001-0001'}];}
 else if(u.pathname.endsWith('/servicio_social'))datos=[{estatus:'LIBERADO',variante_legal:'ART_55'}];
 else throw new Error('Petición no prevista en el ensayo');
 return new Response(JSON.stringify(datos),{status:200,headers:{'Content-Type':'application/json','Content-Range':'0-0/1'}});
};
const archivos:Blob[]=[];Object.assign(window,{archivosLayout:archivos});const crear=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{archivos.push(blob);return crear(blob);};
const {default:Wizard}=await import('../src/components/titulacion/WizardLayoutTitulacion');
createRoot(document.getElementById('root')!).render(<MemoryRouter><main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#080e18] dark:text-gray-100"><Wizard/></main></MemoryRouter>);
