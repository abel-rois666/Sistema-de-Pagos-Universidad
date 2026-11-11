import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validarLotePago,seleccionarDisponiblesPagoCertificado,type PagoCertificadoCandidato} from '../src/certificacion/pagoLote';
const ficha:PagoCertificadoCandidato={id:'f',alumnoId:'a',programaId:'p',nombre:'Prueba',matricula:'',programa:'Programa',estado:'EN_CURSO',concluido:false,elegible:true,motivo:'',huella:'h'};
test('el lote acepta una ficha asociada y conserva el estado del trámite y programa',()=>{const copia=structuredClone(ficha);assert.equal(validarLotePago([ficha],'COMPLETADO','Revisión de pago acreditada',false),null);assert.deepEqual(ficha,copia);});
test('rechaza fichas sin programa, sin registro, duplicadas o no elegibles',()=>{for(const f of [{...ficha,id:null},{...ficha,programaId:null},{...ficha,elegible:false},{...ficha,huella:null}])assert.ok(validarLotePago([f],'COMPLETADO','Motivo documentado',false));assert.ok(validarLotePago([ficha,ficha],'COMPLETADO','Motivo documentado',false));});
test('un mismo alumno puede elegir explícitamente varias fichas diferentes por programa',()=>{assert.equal(validarLotePago([ficha,{...ficha,id:'f2',programaId:'p2'}],'COMPLETADO','Revisión documentada',false),null);});
test('límites, motivo y estado se comprueban antes del guardado',()=>{assert.ok(validarLotePago([],'COMPLETADO','Motivo documentado',false));assert.ok(validarLotePago(Array.from({length:51},(_,i)=>({...ficha,id:String(i)})),'COMPLETADO','Motivo documentado',false));assert.ok(validarLotePago([ficha],'OTRO','Motivo documentado',false));assert.ok(validarLotePago([ficha],'COMPLETADO','corto',false));});
test('pago no completado de un trámite concluido requiere revisión expresa',()=>{assert.ok(validarLotePago([{...ficha,concluido:true}],'EN_CURSO','Revisión documentada',false));assert.equal(validarLotePago([{...ficha,concluido:true}],'EN_CURSO','Revisión documentada',true),null);});
const sql=readFileSync('supabase/migrations/20261110130000_pago_certificado_lote.sql','utf8');
test('SQL actualiza solo pago y metadatos con auditoría y comparación de huella',()=>{assert.match(sql,/set pago_certificado=p_estado,revision=revision\+1,updated_at=/);assert.match(sql,/md5\(to_jsonb\(f\)::text\) is distinct from/);assert.match(sql,/_certificacion_autorizar_v1\(true\)/);assert.match(sql,/for update/);assert.match(sql,/insert into public.certificacion_auditoria/);assert.doesNotMatch(sql,/certificacion_guardar_v1\(|update public\.(alumnos|alumno_programas|recibos|planes_pago)\b|delete from|set tramite_completado/i);});

test('seleccionar todas incluye cada ficha disponible de los elegidos y excluye las bloqueadas',()=>{
 const r=seleccionarDisponiblesPagoCertificado([ficha,{...ficha,id:'f2',programaId:'p2'},{...ficha,id:'bloqueada',elegible:false},{...ficha,id:null},{...ficha,id:'sinprograma',programaId:null}]);
 assert.deepEqual(r,{f:true,f2:true});assert.equal(ficha.estado,'EN_CURSO');
});
test('selección completa deduplica IDs y no trunca silenciosamente más de 50 fichas',()=>{
 assert.deepEqual(seleccionarDisponiblesPagoCertificado([ficha,ficha]),{f:true});
 assert.deepEqual(seleccionarDisponiblesPagoCertificado([]),{});
 assert.throws(()=>seleccionarDisponiblesPagoCertificado(Array.from({length:51},(_,i)=>({...ficha,id:String(i)}))),/más de 50/);
});
