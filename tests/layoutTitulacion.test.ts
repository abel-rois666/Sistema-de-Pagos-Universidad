import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import {crearLibroLayoutTitulacion,prepararDatosLayoutTitulacion,type TitulacionAlumnoData} from '../src/titulacion/layoutTitulacion';
import {validarPlantillaLayout} from '../src/titulacion/layoutTitulosContrato';
import type {AppConfig,Empleado} from '../src/types';
const config={claveInstitucion:'090552',claveEntidadUniversidad:'09',nombreEntidadUniversidad:'CIUDAD DE MÉXICO'} as AppConfig;
const firmante={clave_puesto:3,puesto:'RECTOR',titulo_academico:'DRA.',nombres:'NOMBRE',apellido_paterno:'PRUEBA',apellido_materno:'',curp:'XXXX000101MDFXXX00'} as Empleado;
const item=(id=1):TitulacionAlumnoData=>({alumno:{uid:`programa-${id}`,nombre_completo:`ALUMNO FICTICIO ${id}`,nombres:'NOMBRE',apellido_paterno:'PRUEBA',apellido_materno:'',curp:'XXXX000101HDFXXX00',carrera:{nivel_educativo:'LICENCIATURA',nombre:'DERECHO',clave:'612301'},plan:{rvoe:'00123456'},servicio_social:{estatus:'LIBERADO'}},configuracion:{correo:'ENSAYO@example.invalid',modalidad_id:'2',fecha_examen:'',fecha_exencion:'2026-11-01',antecedente_inicio:'',antecedente_fin:'2013-07-01',cedula_especialidad:'',folio_control:`LD-001-000${id}`,id_autorizacion:'1',fundamento_legal_ss:'2',escuela_procedencia:'ESCUELA DE PRUEBA',id_tipo_antecedente:'4',entidad_federativa_antecedente:'09',fecha_inicio_carrera:'2013-09-01',fecha_termino_carrera:'2017-07-01',fecha_expedicion:'2026-11-18'}});
const plantilla=readFileSync('public/Layout Títulos_v6_EJEMPLO.xlsx');
const bytes=()=>plantilla.buffer.slice(plantilla.byteOffset,plantilla.byteOffset+plantilla.byteLength) as ArrayBuffer;

test('XLSX guardado: un registro por alumno, fechas reales, tipos explícitos, blancos reales y estilos uniformes',async()=>{
 const libro=await crearLibroLayoutTitulacion(bytes(),[item(1),item(2),item(3)],config,firmante);
 const recargado=new ExcelJS.Workbook();await recargado.xlsx.load(await libro.xlsx.writeBuffer());
 const hoja=recargado.getWorksheet('MIS TITULOS')!;
 assert.equal(hoja.rowCount,6);assert.equal(hoja.columnCount,47);
 for(let r=4;r<=6;r++){
  assert.equal(hoja.getCell(`A${r}`).value,`LD-001-000${r-3}`);
  for(const c of ['T','U','AD','AH','AT']){assert.ok(hoja.getCell(`${c}${r}`).value instanceof Date);assert.equal(hoja.getCell(`${c}${r}`).numFmt,'dd/mm/yyyy');}
  assert.equal((hoja.getCell(`AD${r}`).value as Date).toISOString(),'2026-11-18T00:00:00.000Z');
  for(const c of ['B','R','V','AE','AI','AJ'])assert.equal(typeof hoja.getCell(`${c}${r}`).value,'number');
  for(const c of ['I','J','K','L','M','N','O','AG','AS','AU','AB'])assert.equal(hoja.getCell(`${c}${r}`).value,null,c);
  assert.equal(hoja.getCell(`P${r}`).value,'090552');assert.equal(hoja.getCell(`AL${r}`).value,'09');assert.equal(hoja.getCell(`AQ${r}`).value,'09');assert.equal(hoja.getCell(`X${r}`).value,'00123456');
  assert.equal(hoja.getCell(`AC${r}`).value,'ensayo@example.invalid');
  for(let c=1;c<=47;c++)assert.deepEqual(hoja.getRow(r).getCell(c).style,hoja.getRow(4).getCell(c).style);
 }
 assert.equal(hoja.getCell('X2').value,'NÚMERO Acuerdo o RVOE');
 const original=new ExcelJS.Workbook();await original.xlsx.load(bytes());
 assert.deepEqual(recargado.worksheets.map(s=>s.name),original.worksheets.map(s=>s.name));
 for(let i=1;i<11;i++){
  const valores=(w:ExcelJS.Worksheet)=>{const out:unknown[]=[];w.eachRow(row=>{const c:unknown[]=[];row.eachCell((cell,n)=>{if(cell.value!==null&&cell.value!=='')c.push([n,cell.value]);});if(c.length)out.push([row.number,c]);});return out;};
  assert.deepEqual(valores(recargado.worksheets[i]),valores(original.worksheets[i]),original.worksheets[i].name);
 }
 assert.deepEqual([...hoja.model.merges].sort(),[...original.worksheets[0].model.merges].sort());
});
test('tesis y posgrado conservan examen/exención excluyentes, segundo firmante y cédula textual',()=>{
 const a=item();a.configuracion.modalidad_id='1';a.configuracion.fecha_examen='2026-11-01';a.configuracion.fecha_exencion='';a.alumno.carrera.nivel_educativo='ESPECIALIDAD';a.configuracion.cedula_especialidad='001234';
 const row=prepararDatosLayoutTitulacion([a],config,firmante,firmante)[0];
 assert.ok(row[32].valor instanceof Date);assert.equal(row[33].valor,null);assert.equal(row[46].valor,'001234');assert.equal(row[8].valor,3);
});
test('bloquea faltantes obligatorios, formatos inválidos, catálogos y fechas imposibles antes de descargar',()=>{
 for(const [campo,valor] of [['correo',''],['fecha_expedicion','2026-02-30'],['modalidad_id','99'],['antecedente_fin',''],['fecha_inicio_carrera','2027-01-01'],['fundamento_legal_ss','']]){
  const a=item();(a.configuracion as unknown as Record<string,string>)[campo]=valor;
  assert.throws(()=>prepararDatosLayoutTitulacion([a],config,firmante),/ALUMNO FICTICIO 1/);
 }
 assert.throws(()=>prepararDatosLayoutTitulacion([item()],{...config,claveInstitucion:'90552'},firmante),/seis dígitos/);
 assert.throws(()=>prepararDatosLayoutTitulacion([item()],config,{...firmante,curp:''}),/CURP/);
 assert.throws(()=>prepararDatosLayoutTitulacion([item(),item()],config,firmante),/duplicado/);
 assert.throws(()=>prepararDatosLayoutTitulacion([],config,firmante),/Selecciona/);
});
test('rechaza plantillas con encabezados o pestaña incorrectos',async()=>{
 const w=new ExcelJS.Workbook();await w.xlsx.load(bytes());w.worksheets[0].getCell('T2').value='CAMBIADO';assert.throws(()=>validarPlantillaLayout(w),/columna 20/);
 w.worksheets[0].name='CAMBIADA';assert.throws(()=>validarPlantillaLayout(w),/MIS TITULOS/);
});
test('consulta de programas solicita el ID que utiliza para buscar la ficha y maneja fallos del historial',()=>{
 const codigo=readFileSync('src/components/titulacion/WizardLayoutTitulacion.tsx','utf8');
 assert.match(codigo,/alumno_programas\(\s+id,\s+plan_id/);assert.match(codigo,/eq\('alumno_programa_id', prog.id\)/);assert.match(codigo,/if\(errorHistorial\)throw/);assert.match(codigo,/asignatura.plan_id/);
});
