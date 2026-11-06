import test from 'node:test';
import assert from 'node:assert/strict';
import { camposEvento,tituloEvento,ordenarEventos,aproximacionesEvento,textoCampoHistorial } from '../src/inscripciones/historialCambios';

test('una corrección enumera solo datos funcionales modificados, sin metadatos ni motivo duplicado',()=>{
 const campos=camposEvento({antes:{id:'a',desde:'2023-09-29',grado_personal:'7',revision:1,motivo:'Anterior'},despues:{id:'a',desde:'2026-09-25',grado_personal:'7',revision:2,motivo:'Corrección'}});
 assert.deepEqual(campos.map(c=>c.clave),['desde']);
 assert.equal(campos[0].antes,'2023-09-29');assert.equal(campos[0].despues,'2026-09-25');
});
test('registro inicial conserva cero y vacíos con rótulos legibles, sin columna previa ficticia',()=>{
 const e={antes:null,despues:{grado_personal:0,hasta:null,estado:'CONFIRMADA',creado_por:'id-interno'}};
 assert.equal(tituloEvento(e),'Inscripción registrada');assert.equal(camposEvento(e).length,3);
 assert.equal(textoCampoHistorial('grado_personal',0,()=>''),'0');
 assert.equal(textoCampoHistorial('hasta',null,()=>''),'Sin término registrado');
 assert.equal(textoCampoHistorial('estado','CONFIRMADA',()=>''),'Inscripción confirmada');
});
test('preparación separa el estado del trámite del estado previsto de inscripción',()=>{
 const antes={estado:'PENDIENTE',datos:{estado:'CONFIRMADA',desde:'2026-10-21'},ciclo_id:'c'};
 const despues={...antes,estado:'CONFIRMADA'};
 assert.equal(tituloEvento({antes,despues}),'Preparación confirmada');
 assert.deepEqual(camposEvento({antes,despues}).map(c=>c.clave),['estado_preparacion']);
 assert.equal(textoCampoHistorial('estado_preparacion','CONFIRMADA',()=>''),'Preparación confirmada');
});
test('ordena instantes con zonas distintas sin modificar los datos originales',()=>{
 const eventos=[{id:'1',creado_en:'2026-10-29T20:00:00-06:00'},{id:'2',creado_en:'2026-10-30T01:00:00Z'},{id:'3',creado_en:'fecha inválida'}];
 assert.deepEqual(ordenarEventos(eventos).map(e=>e.id),['1','2','3']);
 assert.equal(eventos[0].id,'1');
});
test('no convierte fecha civil en otro día y resuelve ciclos por identificador',()=>{
 assert.equal(textoCampoHistorial('desde','2026-09-25',()=>''),'25/09/2026');
 assert.equal(textoCampoHistorial('ciclo_id','sem',id=>id==='sem'?'2027-1 · Semestral':'Otro'),'2027-1 · Semestral');
});
test('marca aproximaciones solo en los campos sustentados por su procedencia',()=>{
 assert.deepEqual(aproximacionesEvento({procedencia:{contexto:{ingreso:{aproximado:true},desde:'MANUAL'}}}),['Primer ingreso aproximado']);
 assert.deepEqual(aproximacionesEvento({despues:{desde:'2023-09-29'}}),[]);
});
