import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarListadoGeneral,type FiltrosListadoGeneral } from '../src/reportes/filtrosListadoGeneral';
import type { Alumno,PaymentPlan } from '../src/types';
const alumnos=[{id:'a',nombre_completo:'Ana',licenciatura:'Derecho',turno:'MATUTINO',estatus:'ACTIVO'},
 {id:'b',nombre_completo:'Beto',licenciatura:'Derecho',turno:'VESPERTINO',estatus:'EGRESADO'},
 {id:'c',nombre_completo:'Celia',licenciatura:'Pedagogía',turno:'MIXTO',estatus:'TITULADO',ciclo_ultima_asignacion_grado:'cua'},
 {id:'d',nombre_completo:'Dora',licenciatura:'Derecho',turno:'MATUTINO',estatus:'BAJA'}] as Alumno[];
const planes=[{id:'1',alumno_id:'a',ciclo_id:'sem',tipo_plan:'Semestral'},{id:'2',alumno_id:'a',ciclo_id:'cua',tipo_plan:'Titulación'},
 {id:'3',alumno_id:'b',ciclo_id:'cua',tipo_plan:'Cuatrimestral'}, {id:'4',nombre_alumno:'Dora',ciclo_id:'cua',tipo_plan:'Titulación'}] as PaymentPlan[];
const base:FiltrosListadoGeneral={ciclos:[],licenciaturas:[],tiposPlan:[],turnos:[],estatus:[]};
const ids=(f:Partial<FiltrosListadoGeneral>)=>filtrarListadoGeneral(alumnos,planes,{...base,...f}).map(a=>a.id);
test('listado: sin selección no limita ni modifica alumnos o planes',()=>{const copia=JSON.stringify({alumnos,planes});assert.deepEqual(ids({}),['a','b','c','d']);assert.equal(JSON.stringify({alumnos,planes}),copia);});
test('listado: admite varios estados y turnos, unidos dentro del filtro y cruzados entre filtros',()=>{
 assert.deepEqual(ids({estatus:['ACTIVO','EGRESADO'],turnos:['MATUTINO','VESPERTINO']}),['a','b']);
 assert.deepEqual(ids({estatus:['ACTIVO','EGRESADO'],turnos:['MIXTO']}),[]);
 assert.deepEqual(ids({estatus:['ACTIVO','TITULADO'],licenciaturas:['Derecho','Pedagogía']}),['a','c']);
});
test('listado: ciclos homónimos se filtran por ID y varios ciclos no duplican al alumno',()=>{
 assert.deepEqual(ids({ciclos:['sem']}),['a']);assert.deepEqual(ids({ciclos:['cua']}),['a','b','c']);
 assert.deepEqual(ids({ciclos:['sem','cua']}),['a','b','c']);assert.deepEqual(ids({ciclos:['otro-id']}),[]);
});
test('listado: multiselección de tipos conserva el alcance previo independiente del ciclo',()=>{
 assert.deepEqual(ids({tiposPlan:['Semestral','Cuatrimestral']}),['a','b']);
 assert.deepEqual(ids({ciclos:['sem'],tiposPlan:['Titulación','Cuatrimestral']}),['a']);
 assert.deepEqual(ids({tiposPlan:['Titulación'],estatus:['BAJA']}),[]); // Nunca atribuir un plan por nombre.
});
