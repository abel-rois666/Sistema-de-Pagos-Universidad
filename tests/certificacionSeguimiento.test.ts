import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoPagoCertificado,estadoTramiteCertificado,reabrirCertificado,requisitosCertificado,textoCertificaciones,textoPagosTitulacion,planesTitulacionAlumno,terminoOrientativoCertificado,type ResumenCertificacion } from '../src/certificacion/seguimiento';
import { columnasListado,csvListado,ordenarListado } from '../src/reportes/listadoGeneral';
import type { Alumno,FichaCertificacion,PaymentPlan } from '../src/types';

const ficha = (c:Partial<FichaCertificacion>={}):FichaCertificacion=>({id:'f',alumno_id:'a',alumno_programa_id:'p1',pago_certificado:'COMPLETADO',tipo_certificado:'TOTAL',doc_acta_nacimiento:'APROBADO',doc_acta_nacimiento_nota:null,doc_curp:'APROBADO',doc_curp_nota:null,doc_antecedente:'APROBADO',doc_antecedente_nota:null,doc_titulo_profesional:'SIN_INICIAR',doc_titulo_profesional_nota:null,doc_cedula_profesional:'SIN_INICIAR',doc_cedula_profesional_nota:null,...c});
test('el plazo orientativo conserva fechas civiles y rechaza entradas inválidas',()=>{
 assert.equal(terminoOrientativoCertificado('2026-11-02'),'2027-02-08');
 for(const f of ['','2026-02-31','fecha','2026-1-2'])assert.equal(terminoOrientativoCertificado(f),null);
});
test('certificación: pago completo no inicia ni termina el trámite',()=>{
 assert.equal(estadoPagoCertificado(ficha()),'Completado');assert.equal(estadoTramiteCertificado(ficha()),'En preparación');
 assert.equal(estadoTramiteCertificado(ficha({fecha_inicio_tramite:'2026-11-01'})),'En trámite');
 assert.equal(estadoTramiteCertificado(ficha({tramite_completado:true})),'Completado');
 assert.equal(estadoTramiteCertificado(null),'Sin registro');
 assert.equal(estadoPagoCertificado({...ficha(),sin_ficha:true}),'Sin registro');
 assert.equal(estadoTramiteCertificado({...ficha(),sin_ficha:true}),'Sin registro');
});
test('certificación: no inventa el pago cuando su valor es desconocido',()=>{
 assert.equal(estadoPagoCertificado({...ficha(),pago_certificado:'OTRO'}),'Por revisar');
 assert.equal(estadoPagoCertificado({...ficha(),pago_certificado:undefined}),'Por revisar');
 assert.equal(estadoPagoCertificado(ficha({pago_certificado:'EN_CURSO'})),'En curso');
});
test('certificación: la especialidad exige sus documentos adicionales',()=>{
 assert.equal(requisitosCertificado(ficha(),false),true);assert.equal(requisitosCertificado(ficha(),true),false);
 assert.equal(requisitosCertificado(ficha({doc_titulo_profesional:'APROBADO',doc_cedula_profesional:'APROBADO'}),true),true);
 assert.equal(requisitosCertificado(ficha({pago_certificado:'EN_CURSO'}),false),false);
 assert.equal(requisitosCertificado(ficha({tipo_certificado:null}),false),false);
});
test('reabrir conserva pago, documentos, fechas y enlace sin modificar la ficha original',()=>{
 const original=ficha({tramite_completado:true,fecha_completado:'2026-11-03T12:00:00Z',fecha_inicio_tramite:'2026-09-01',fecha_termino_tramite:'2026-12-01',enlace_drive:'https://example.test/expediente'});
 const copia=structuredClone(original),abierta=reabrirCertificado(original);
 assert.deepEqual(original,copia);assert.equal(abierta.tramite_completado,false);assert.equal(abierta.fecha_completado,null);
 assert.deepEqual({...abierta,tramite_completado:true,fecha_completado:original.fecha_completado},original);
});
test('reportes: programas y ficha anterior son independientes, incluso con la misma carrera',()=>{
 const filas:ResumenCertificacion[]=[{...ficha(),programa:'Derecho · 2009',tramite_completado:true},{...ficha({id:'f2',alumno_programa_id:'p2',pago_certificado:'EN_CURSO'}),programa:'Derecho · 2017',tramite_completado:false},{...ficha({id:'vieja',alumno_programa_id:null}),tramite_completado:false},{...ficha({alumno_id:'otro'}),tramite_completado:true}];
 assert.equal(textoCertificaciones(filas,'a','pagoCertificado'),'Derecho · 2009: Completado · Derecho · 2017: En curso · Ficha anterior sin asociar: Completado');
 assert.match(textoCertificaciones(filas,'a','certificacion'),/2009: Completado.*2017: En preparación.*sin asociar: En preparación/);
 assert.equal(textoCertificaciones(filas,'sin-ficha','certificacion'),'Sin registro');
});
test('reportes: varios planes de titulación conservan ciclo, folio, abonos y asociación por ID',()=>{
 const planes=[{id:'1',alumno_id:'a',tipo_plan:'Titulación',no_plan_pagos:'PP-1',ciclo_escolar:'2026-2',concepto_1:'Pago',estatus_1:'R-83 (Efectivo)'},{id:'2',alumno_id:'a',tipo_plan:'Titulación',no_plan_pagos:'PP-2',ciclo_escolar:'2027-1',concepto_1:'Pago',estatus_1:'R-84 (Abono $20.00, Resta $30.00)'},{id:'3',nombre_alumno:'Mismo Nombre',tipo_plan:'Titulación',concepto_1:'Pago',estatus_1:'PAGADO'},{id:'4',alumno_id:'a',tipo_plan:'Cuatrimestral'}] as PaymentPlan[];
 assert.deepEqual(planesTitulacionAlumno(planes,'a').map(p=>p.id),['2','1']);
 assert.match(textoPagosTitulacion(planes,'a'),/^2027-1 \/ PP-2: Pago en curso.*2026-2 \/ PP-1: Pago completo$/);
 assert.equal(textoPagosTitulacion(planes,'otro'),'Sin plan');
});
test('listado: columnas opcionales de seguimiento ordenan y exportan los mismos valores',()=>{
 const alumnos=[{id:'a',nombre_completo:'Ana',licenciatura:'Derecho'},{id:'b',nombre_completo:'Beto',licenciatura:'Derecho'}] as Alumno[];
 const cols=columnasListado(['pagoTitulacion','pagoCertificado','certificacion'],{pagoTitulacion:a=>a.id==='b'?'Pago completo':'Pago en curso',pagoCertificado:()=> 'Programa "A": Completado',certificacion:()=> 'En preparación'});
 assert.equal(columnasListado([]).length,5);
 assert.deepEqual(ordenarListado(alumnos,'pagoTitulacion',false,'2026-11-09',cols).map(a=>a.id),['b','a']);
 const csv=csvListado(alumnos,cols,'2026-11-09');assert.match(csv,/"Pago del certificado","Trámite de certificación"/);assert.match(csv,/"Programa ""A"": Completado"/);
 assert.ok(!csvListado([],columnasListado([]),'2026-11-09').includes('Titulación'));
});
