import test from 'node:test';
import assert from 'node:assert/strict';
import { componerNombrePersonal,validarNombrePersonal } from '../src/personal/nombres';
import { iniciarRevisionNombre,previsualizarNombresImportados,validarLoteNombres } from '../src/personal/revisionNombres';

const historico={nombre_completo:'MARÍA DEL CARMEN DE LA CRUZ LÓPEZ'};
const completo={...historico,nombres:'MARÍA DEL CARMEN',apellido_paterno:'DE LA CRUZ',apellido_materno:'LÓPEZ'};
const pendiente={docente_id:'11111111-1111-4111-8111-111111111111',clave:'PF0001',nombre_historico:historico.nombre_completo,datos:historico,revision:0,original:{...historico}};
const cabecera=['docente_id','clave','nombre_registrado','revision','primer_apellido','segundo_apellido','nombres'];
const fila=[pendiente.docente_id,pendiente.clave,pendiente.nombre_historico,0,'DE LA CRUZ','LÓPEZ','MARÍA DEL CARMEN'];

test('compone apellidos y nombres compuestos conservando acentos y sin dividir palabras',()=>{
  assert.equal(componerNombrePersonal({...completo,apellido_paterno:'  DE  LA CRUZ  '}),'DE LA CRUZ LÓPEZ MARÍA DEL CARMEN');
  assert.equal(componerNombrePersonal({...completo,apellido_materno:null}),'DE LA CRUZ MARÍA DEL CARMEN');
});
test('un alta requiere nombres estructurados y admite segundo apellido vacío',()=>{
  assert.ok(validarNombrePersonal(historico,null,true).length);
  assert.deepEqual(validarNombrePersonal({...completo,apellido_materno:null},null,false),[]);
});
test('editar contacto histórico no exige inventar un desglose ni lo propone automáticamente',()=>{
  assert.deepEqual(validarNombrePersonal({...historico,email:'nuevo@example.test'},historico,false),[]);
  const revision=iniciarRevisionNombre(pendiente);assert.equal(revision.nombres,'');assert.equal(revision.apellido_paterno,'');assert.equal(revision.revisado,false);
});
test('un desglose parcial o una corrección sin revisar no son confirmables',()=>{
  assert.ok(validarNombrePersonal({...historico,apellido_materno:'LÓPEZ'},historico,true).length);
  assert.ok(validarNombrePersonal(completo,historico,false).length);
  assert.deepEqual(validarNombrePersonal(completo,historico,true),[]);
  assert.ok(validarNombrePersonal(historico,completo,true).length);
});
test('conservar nombres confirmados permite editar otros datos sin repetir la confirmación',()=>{
  assert.deepEqual(validarNombrePersonal({...completo,telefono:'555'},completo,false),[]);
});
test('un lote admite únicamente filas únicas revisadas y limita su tamaño',()=>{
  const revision={...iniciarRevisionNombre(pendiente),...completo,revisado:true};
  assert.deepEqual(validarLoteNombres([revision]),[]);
  assert.ok(validarLoteNombres([{...revision,revisado:false}]).length);
  assert.ok(validarLoteNombres([revision,revision]).length);
  assert.ok(validarLoteNombres([]).length);
  assert.ok(validarLoteNombres(Array.from({length:51},(_,i)=>({...revision,docente_id:String(i)}))).length);
});
test('XLSX propone sin confirmar y rechaza cambios de ID, revisión, nombre histórico y fórmulas',()=>{
  const vista=previsualizarNombresImportados([cabecera,fila],[pendiente]);
  assert.equal(vista.errores.length,0);assert.equal(vista.propuestas[0].revisado,false);
  for(const [col,valor] of [[0,'otro'],[2,'alterado'],[3,1],[4,{formula:'A1'}]] as const){const modificada=[...fila] as unknown[];modificada[col]=valor;assert.ok(previsualizarNombresImportados([cabecera,modificada],[pendiente]).errores.length);}
  assert.ok(previsualizarNombresImportados([cabecera,fila,fila],[pendiente]).errores.length);
});
test('filas XLSX vacías no crean nombres ficticios y un error no guarda propuestas',()=>{
  assert.deepEqual(previsualizarNombresImportados([cabecera,[...fila.slice(0,4),'','',''],[]],[pendiente]),{propuestas:[],errores:[]});
  assert.ok(previsualizarNombresImportados([['otra plantilla'],fila],[pendiente]).errores.length);
});
