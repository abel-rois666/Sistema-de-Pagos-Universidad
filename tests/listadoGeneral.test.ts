import test from 'node:test';
import assert from 'node:assert/strict';
import type { Alumno } from '../src/types';
import { columnasListado,edadListado,entidadListado,gradoListado,sexoListado,ordenarListado,csvListado,etiquetaColumnaListado } from '../src/reportes/listadoGeneral';
import { pdfListadoGeneral } from '../src/reportes/exportarListadoGeneral';
const alumno={id:'a',nombre_completo:'ALUMNO, "PRUEBA"',licenciatura:'Derecho',turno:'Mixto',grado_actual:'2DO',fecha_nacimiento:'2000-10-31',estado_nacimiento:'DF',estado_escolaridad:'15',estado:'PUE',sexo:'H',email:'prueba@example.invalid'} as Alumno;
test('edad usa años cumplidos y fechas civiles, sin convertir ausencias o fechas imposibles a cero',()=>{
 assert.equal(edadListado('2000-10-31','2026-10-30'),25);
 assert.equal(edadListado('2000-10-31','2026-10-31'),26);
 assert.equal(edadListado('2026-10-30','2026-10-30'),0);
 assert.equal(edadListado('2004-02-29','2025-02-28'),20);
 assert.equal(edadListado('2004-02-29','2025-03-01'),21);
 for(const f of [null,'','2026-02-30','2026-11-01'])assert.equal(edadListado(f,'2026-10-30'),null);
});
test('entidades reconocen claves exactas, abreviaturas y nombres sin adivinar a partir de fragmentos',()=>{
 for(const v of ['DF','D.F.','09','9','CDMX','Distrito Federal'])assert.equal(entidadListado(v),'Ciudad de México');
 assert.equal(entidadListado('15'),'Estado de México');assert.equal(entidadListado('PUE'),'Puebla');
 assert.equal(entidadListado('GR'),'Guerrero');assert.equal(entidadListado('GRO'),'Guerrero');
 assert.equal(entidadListado(null),'Sin dato');assert.equal(entidadListado('15abc'),'Por revisar (15abc)');
 assert.equal(entidadListado('99'),'Por revisar (99)');assert.equal(entidadListado('33'),'Por revisar (33)');assert.equal(entidadListado('NE'),'Extranjero');
});
test('las seis columnas nuevas son opcionales y toman datos personales actuales',()=>{
 assert.deepEqual(columnasListado(['email']).map(c=>c.id),['nombre','licenciatura','turno','estatus','telefonos','email']);
 assert.equal(gradoListado('2DO'),'2');assert.equal(gradoListado('0'),'Por revisar (0)');
 assert.equal(sexoListado(alumno),'Hombre');assert.equal(sexoListado({...alumno,sexo:'M'}),'Mujer');
 assert.equal(sexoListado({...alumno,sexo:null,id_sexo:250}),'Mujer');
 const c=columnasListado(['grado','edad','sexo','nacimiento','procedencia','residencia']);
 assert.deepEqual(c.slice(5).map(c=>c.valor(alumno,'2026-10-30')),['2','25','Hombre','Ciudad de México','Estado de México','Puebla']);
});
test('el orden numérico por grado se aplica al conjunto completo y no modifica la fuente',()=>{
 const filas=[{...alumno,id:'10',grado_actual:'10MO'},{...alumno,id:'2',grado_actual:'2DO'}];
 assert.deepEqual(ordenarListado(filas,'grado',false,'2026-10-30').map(a=>a.id),['2','10']);
 assert.equal(filas[0].id,'10');
});
test('CSV respeta columnas, comillas y fecha de referencia, y exporta todas las filas recibidas',()=>{
 const columnas=columnasListado(['edad','nacimiento']),csv=csvListado(Array.from({length:31},(_,i)=>({...alumno,id:String(i)})),columnas,'2026-10-30');
 assert.ok(csv.includes('"ALUMNO, ""PRUEBA"""'));assert.ok(csv.includes('Edad al 30/10/2026 (años)'));
 assert.equal(csv.split('\r\n').length,32);assert.equal(csv.includes('Correo electrónico'),false);
 assert.equal(etiquetaColumnaListado(columnas.find(c=>c.id==='edad')!,'2026-10-30'),'Edad al 30/10/2026 (años)');
});
test('PDF divide columnas anchas y conserva el último alumno del conjunto',()=>{
 const columnas=columnasListado(['email','grado','edad','sexo','nacimiento','procedencia','residencia']);
 const doc=pdfListadoGeneral(Array.from({length:31},(_,i)=>({...alumno,id:String(i),nombre_completo:`PERSONA FICTICIA ${i+1}`})),columnas,'2026-10-30',['Ciclo de referencia: todos']);
 assert.ok(doc.internal.pageSize.getWidth()>doc.internal.pageSize.getHeight());
 assert.ok(doc.getNumberOfPages()>1);
 assert.ok(doc.output().includes('PERSONA FICTICIA 31'));
});
