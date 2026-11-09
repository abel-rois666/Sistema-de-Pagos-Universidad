import test from 'node:test';
import assert from 'node:assert/strict';
import { documentosIniciales,resumenExpediente,validarExpediente,validarFormacion,validarGenerales,validarLaborales } from '../src/personal/reglas';
import type { FormacionPersonal,VinculoLaboral } from '../src/personal/types';

test('un expediente sin requisitos no inventa un porcentaje de completitud',()=>{
 const docs=documentosIniciales({curp:true});assert.equal(docs.find(d=>d.clave==='curp')?.estado,'ENTREGADO');assert.equal(resumenExpediente(docs).porcentaje,null);
});
test('los documentos no aplicables quedan fuera del denominador sin borrar su estado',()=>{
 const docs=documentosIniciales().map(d=>({...d,requerido:true}));docs[0].estado='NO_APLICA';docs[0].motivo='No corresponde a su contratación';docs[1].estado='REVISADO';
 assert.deepEqual(resumenExpediente(docs),{requeridos:9,entregados:1,revisados:1,porcentaje:11});assert.equal(docs[0].estado,'NO_APLICA');
 assert.equal(validarExpediente({documentos:docs,enlace_drive:null}).length,0);docs[0].motivo='';assert.equal(resumenExpediente(docs).requeridos,10);assert.ok(validarExpediente({documentos:docs,enlace_drive:null}).length>0);
});
test('el expediente distingue una entrega de una revisión y valida enlaces sin otorgar acceso',()=>{
 const docs=documentosIniciales().slice(0,1).map(d=>({...d,requerido:true,estado:'ENTREGADO' as const}));assert.equal(resumenExpediente(docs).revisados,0);assert.equal(resumenExpediente(docs).porcentaje,100);
 assert.ok(validarExpediente({documentos:docs,enlace_drive:'https://drive.google.com.ejemplo.com/folder'}).length>0);
 assert.equal(validarExpediente({documentos:docs,enlace_drive:'https://drive.google.com/drive/folders/ejemplo'}).length,0);
});
test('los vínculos admiten fechas desconocidas, varias funciones y cero horas, pero no fechas invertidas',()=>{
 const fila:VinculoLaboral={id:'a',funcion:'Docente',departamento:'',contratacion:'Honorarios',jornada:'',fecha_inicio:null,fecha_fin:null,horas_contratadas:0,observaciones:'',archivado:false};
 assert.deepEqual(validarLaborales([fila,{...fila,id:'b',funcion:'Coordinación'}]),[]);assert.ok(validarLaborales([{...fila,fecha_inicio:'2026-11-09',fecha_fin:'2026-11-08'}]).length>0);assert.equal(fila.fecha_inicio,null);
});
test('el historial académico admite varios estudios y una formación principal vigente',()=>{
 const fila:FormacionPersonal={id:'a',nivel:'Licenciatura',programa:'Pedagogía',institucion:'',situacion:'Titulado',cedula:'',fecha_titulacion:null,principal:true,archivado:false};
 assert.ok(validarFormacion([fila,{...fila,id:'b'}]).length>0);assert.equal(validarFormacion([fila,{...fila,id:'b',archivado:true}]).length,0);assert.equal(fila.fecha_titulacion,null);
});
test('un nombre histórico se conserva completo sin dividir apellidos automáticamente',()=>{
 const datos={nombre_completo:'NOMBRE HISTÓRICO DE PRUEBA'};assert.deepEqual(validarGenerales(datos),[]);assert.deepEqual(validarGenerales({...datos,rfc:'   ',curp:'  ',email:' '}),[]);assert.deepEqual(datos,{nombre_completo:'NOMBRE HISTÓRICO DE PRUEBA'});assert.ok(validarGenerales({...datos,nombres:'Nombre'}).length>0);
});
