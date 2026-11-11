import test from 'node:test';
import assert from 'node:assert/strict';
import { configuracionInicialListado, fechaVista, firmaVista, leerConfiguracionVista } from '../src/reportes/vistasListado';
import { fechaActualListado } from '../src/reportes/listadoGeneral';

test('una vista conserva columnas, filtros múltiples y orden sin persistir filas de alumnos',()=>{
  const config=configuracionInicialListado();config.columnas=['email','grado','certificacion'];
  config.filtros.ciclos=['93a9e5d8-da9f-4d20-9dfc-75334add0464'];
  config.filtros.licenciaturas=['Derecho','Administración'];config.filtros.estatus=['ACTIVO','EGRESADO'];
  config.filtrosColumnas={grado:['1','2'],certificacion:['En preparación','En trámite']};config.orden={columna:'grado',descendente:true};
  assert.deepEqual(leerConfiguracionVista(JSON.parse(JSON.stringify(config))),config);
  assert.throws(()=>leerConfiguracionVista({...config,alumnos:[{nombre:'Persona'}]}),/incompatible/);
});
test('la fecha actual se resuelve al cargar y una referencia fija conserva su fecha',()=>{
  const config=configuracionInicialListado();assert.equal(fechaVista(config),fechaActualListado());
  config.fechaEdad={modo:'fija',valor:'2020-09-30'};assert.equal(fechaVista(leerConfiguracionVista(config)),'2020-09-30');
});
test('restaurar nunca elimina filtros desconocidos ampliando silenciosamente la población',()=>{
  const config=configuracionInicialListado();config.filtros.estatus=['ESTADO HISTÓRICO NO DISPONIBLE'];
  assert.deepEqual(leerConfiguracionVista(config).filtros.estatus,config.filtros.estatus);
  assert.throws(()=>leerConfiguracionVista({...config,filtros:{...config.filtros,ciclos:['2027-1']}}),/incompatible/);
  assert.throws(()=>leerConfiguracionVista({...config,filtros:{...config.filtros,otro:['ACTIVO']}}),/incompatible/);
});
test('filtros ocultos, versiones y ordenamientos incompatibles se rechazan antes de aplicarse',()=>{
  const config=configuracionInicialListado();
  for(const cambio of [{version:2},{columnas:['inventada']},{filtrosColumnas:{grado:['1']}},{orden:{columna:'grado',descendente:false}},{orden:{columna:'nombre',descendente:'false'}}])
    assert.throws(()=>leerConfiguracionVista({...config,...cambio}),/incompatible/);
});
test('los límites de filtros y fechas se validan sin aceptar fechas ficticias',()=>{
  const config=configuracionInicialListado();
  assert.throws(()=>leerConfiguracionVista({...config,filtros:{...config.filtros,turnos:Array(201).fill('MIXTO')}}),/incompatible/);
  for(const valor of ['2025-02-30','9999-01-01','30/09/2020',null])
    assert.throws(()=>leerConfiguracionVista({...config,fechaEdad:{modo:'fija',valor}}),/incompatible/);
});
test('la marca de cambios ignora el orden de selección, pero detecta cambios de alcance',()=>{
  const a=configuracionInicialListado(),b=configuracionInicialListado();
  a.columnas=['grado','email'];b.columnas=['email','grado'];a.filtros.estatus=['ACTIVO','BAJA'];b.filtros.estatus=['BAJA','ACTIVO'];
  assert.equal(firmaVista(a),firmaVista(b));b.filtros.estatus=['ACTIVO'];assert.notEqual(firmaVista(a),firmaVista(b));
});
