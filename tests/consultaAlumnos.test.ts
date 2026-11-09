import test from 'node:test';
import assert from 'node:assert/strict';
import type { Alumno, PaymentPlan } from '../src/types';
import { filtrarPadron, filtrosPadronVacios, ordenarPadron, construirReporteFinanciero, ordenarReporteFinanciero, ordenarMesesReporte, plantillaDisponibleEnCiclo } from '../src/utils/consultaAlumnos';
import { puedeAccederRuta } from '../src/app/capacidades';

const alumnos=[{id:'a',nombre_completo:'JOSÉ HOMÓNIMO',matricula:'LP-001',licenciatura:'Pedagogía',grado_actual:'2DO',turno:'MIXTO',estatus:'ACTIVO'},
  {id:'b',nombre_completo:'JOSÉ HOMÓNIMO',matricula:'LP-002',licenciatura:'Pedagogía',grado_actual:'10',turno:'MIXTO',estatus:'ACTIVO'}] as Alumno[];
const plan=(id:string,alumno_id:string|undefined,extra:Partial<PaymentPlan>={}):PaymentPlan=>({id,alumno_id,nombre_alumno:'JOSÉ HOMÓNIMO',tipo_plan:'Cuatrimestral',cantidad_1:1000,estatus_1:'PENDIENTE',...extra} as PaymentPlan);
const opciones={tipo:'Todos',mes:'Todos',omitirSinPlan:false};

test('el padrón busca matrícula y acentos sin alterar grados históricos',()=>{
  assert.deepEqual(filtrarPadron(alumnos,{...filtrosPadronVacios(),busqueda:'jose'}).map(a=>a.id),['a','b']);
  assert.deepEqual(filtrarPadron(alumnos,{...filtrosPadronVacios(),busqueda:'LP-002'}).map(a=>a.id),['b']);
  assert.deepEqual(filtrarPadron(alumnos,{...filtrosPadronVacios(),grados:['2']}).map(a=>a.id),['a']);
  assert.deepEqual(ordenarPadron(alumnos,'grado_actual','desc').map(a=>a.id),['b','a']);
  assert.equal(alumnos[0].grado_actual,'2DO');
});
test('los homónimos solo reciben planes de su ID y los legados quedan visibles para revisión',()=>{
  const r=construirReporteFinanciero(alumnos,alumnos,[plan('p','a'),plan('legado',undefined),plan('huérfano','no-existe')],opciones);
  assert.deepEqual(r.registros.map(a=>[a.id,a.adeuda,a.tienePlan]),[['a',1000,true],['b',0,false]]);
  assert.deepEqual(r.pendientes.map(p=>p.id),['legado','huérfano']);
});
test('un filtro sin coincidencias no se convierte en todo el padrón',()=>{
  const poblacion=filtrarPadron(alumnos,{...filtrosPadronVacios(),busqueda:'NO EXISTE'});
  const r=construirReporteFinanciero(alumnos,poblacion,[plan('p','a')],opciones);
  assert.equal(r.registros.length,0);
  assert.equal(r.pendientes.length,0);
});
test('el reporte conserva abonos parciales, planes múltiples y clasificación de titulación',()=>{
  const planes=[plan('abono','a',{estatus_1:'R-40200 (Abono $400.00, Resta $600.00)'}),plan('tit','a',{tipo_plan:'Titulación',cantidad_1:200,estatus_1:'R-40201 (Pagado $200.00)'})];
  const r=construirReporteFinanciero(alumnos,alumnos,planes,opciones);
  assert.equal(r.registros[0].pagado,600);assert.equal(r.registros[0].adeuda,600);
  const ordinarios=construirReporteFinanciero(alumnos,alumnos,planes,{...opciones,tipo:'Ordinario',omitirSinPlan:true});
  assert.equal(ordinarios.registros.length,1);assert.equal(ordinarios.registros[0].pagado,400);
});
test('el reporte respeta el acceso acordado y excluye Caja incluso por URL directa',()=>{
  for(const rol of ['ADMINISTRADOR','COORDINADOR FINANCIERO','COORDINADOR CONTROL ESCOLAR'])assert.equal(puedeAccederRuta(rol,'/pagos-adeudos-alumnos'),true);
  for(const rol of ['CAJERO','DOCENTE','COORDINADOR ACADEMICO','COORDINADOR RECURSOS HUMANOS'])assert.equal(puedeAccederRuta(rol,'/pagos-adeudos-alumnos'),false);
});

test('el reporte ordena antes de paginar y mantiene todos los registros para exportar',()=>{
  const r=construirReporteFinanciero(alumnos,alumnos,[plan('p','a')],opciones).registros;
  const orden=ordenarReporteFinanciero(r,'adeuda','desc');
  assert.deepEqual(orden.slice(0,1).map(x=>x.id),['a']);assert.equal(orden.length,2);
  assert.deepEqual(ordenarReporteFinanciero(r,'grado','desc').map(x=>x.id),['b','a']);
  assert.deepEqual(ordenarMesesReporte(['ENERO 2026','DICIEMBRE 2025','FEBRERO 2026']),['FEBRERO 2026','ENERO 2026','DICIEMBRE 2025']);
});

test('el reporte no vuelve a acreditar excedentes ni cambia el monedero',()=>{
  const a={...alumnos[0],saldo_a_favor:200};
  const r=construirReporteFinanciero([a],[a],[plan('p','a',{estatus_1:'R-40200 (Pagado $1,200.00)'})],opciones);
  assert.equal(r.registros[0].pagado,1000);assert.equal(r.registros[0].adeuda,0);assert.equal(a.saldo_a_favor,200);
});

test('cambiar el ciclo de alta conserva plantillas comunes y rechaza la plantilla de otro ID',()=>{
  assert.equal(plantillaDisponibleEnCiclo({activo:true,ciclo_id:'semestral-2027-1'},'cuatrimestral-2027-1'),false);
  assert.equal(plantillaDisponibleEnCiclo({activo:true,ciclo_id:'cuatrimestral-2027-1'},'cuatrimestral-2027-1'),true);
  assert.equal(plantillaDisponibleEnCiclo({activo:true,ciclo_id:null},'cuatrimestral-2027-1'),true);
  assert.equal(plantillaDisponibleEnCiclo({activo:false,ciclo_id:null},'cuatrimestral-2027-1'),false);
});
