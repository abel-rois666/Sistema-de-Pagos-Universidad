import test from 'node:test';
import assert from 'node:assert/strict';
import { validarInstitucional,PUESTOS_PERSONAL } from '../src/personal/institucional';
import { validarAltaFuncion } from '../src/personal/funciones';
import type { PerfilPersonal,ConfiguracionInstitucionalPersonal } from '../src/personal/types';
const perfil={original:{nombre_completo:'DE LA CRUZ ANA'},datos:{nombre_completo:'DE LA CRUZ ANA',nombres:'ANA',apellido_paterno:'DE LA CRUZ'},docente_id:null,empleado_id:'empleado'} as PerfilPersonal;
test('añadir docencia reutiliza al administrativo existente y no necesita un segundo registro personal',()=>{
 assert.deepEqual(validarAltaFuncion({tipo:'EMPLEADO',id:'empleado'},perfil,'DOCENTE','PF0101','Identidad revisada en expediente',true),[]);
 assert.equal(perfil.docente_id,null);assert.equal(perfil.empleado_id,'empleado');
});
test('una función ya existente no se duplica aunque el origen sea otro directorio',()=>{
 assert.ok(validarAltaFuncion({tipo:'EMPLEADO',id:'empleado'},{...perfil,docente_id:'docente'},'DOCENTE','PF0101','Identidad revisada',true).some(e=>e.includes('ya tiene')));
 assert.ok(validarAltaFuncion({tipo:'DOCENTE',id:'docente'},perfil,'DOCENTE','PF0101','Identidad revisada',true).some(e=>e.includes('ya tiene')));
});
test('un nombre docente histórico no inventa los apellidos obligatorios del registro administrativo',()=>{
 const historico={...perfil,empleado_id:null,docente_id:'docente',datos:{nombre_completo:'NOMBRE HISTÓRICO'}};
 assert.ok(validarAltaFuncion({tipo:'DOCENTE',id:'docente'},historico,'EMPLEADO','','Identidad revisada',true).some(e=>e.includes('apellidos')));
});
test('añadir función exige persona existente, revisión, motivo y clave válida',()=>{
 assert.ok(validarAltaFuncion({tipo:'EMPLEADO',id:'a'},{...perfil,original:null},'DOCENTE','', '',false).length>=4);
 assert.ok(validarAltaFuncion({tipo:'EMPLEADO',id:'a'},perfil,'DOCENTE','X'.repeat(81),'Identidad revisada',true).length);
});
test('la situación de la función se elige explícitamente y admite una función administrativa inactiva',()=>{
 const docente={...perfil,docente_id:'docente',empleado_id:null};
 assert.deepEqual(validarAltaFuncion({tipo:'DOCENTE',id:'docente'},docente,'EMPLEADO','','Alta revisada del registro',true,'inactivo'),[]);
 assert.ok(validarAltaFuncion({tipo:'DOCENTE',id:'docente'},docente,'EMPLEADO','','Alta revisada del registro',true,'').length);
});
test('la configuración conserva cargos históricos sin alterarlos para editar otra información',()=>{
 const original={estatus:'activo',puesto:'Cargo histórico',clave_puesto:99} as ConfiguracionInstitucionalPersonal;
 assert.deepEqual(validarInstitucional({...original,titulo_academico:'Mtra.'},original),[]);
 assert.ok(validarInstitucional({...original,puesto:'Director'},original).length);
});
test('los cargos admiten las mismas autorizaciones de certificados, títulos y boletas',()=>{
 const director={estatus:'activo',puesto:'Director',clave_puesto:1,firmante_certificados:true,firmante_titulos:true,firmante_boletas:true};
 assert.deepEqual(validarInstitucional(director),[]);
 assert.ok(validarInstitucional({...director,puesto:'Coordinador Académico',clave_puesto:8}).length);
 assert.deepEqual(validarInstitucional({...director,puesto:'Coordinador Académico',clave_puesto:8,firmante_certificados:false,firmante_titulos:false}),[]);
 assert.ok(validarInstitucional({...director,puesto:'Auxiliar Administrativo',clave_puesto:10}).length);
});
test('ordenar el catálogo no cambia las claves institucionales históricas',()=>{
 assert.equal(PUESTOS_PERSONAL.find(p=>p.nombre==='Coordinador Académico')?.clave,8);
 assert.equal(PUESTOS_PERSONAL.find(p=>p.nombre==='Responsable de Expedición')?.clave,5);
 assert.equal(new Set(PUESTOS_PERSONAL.map(p=>p.clave)).size,13);
});
