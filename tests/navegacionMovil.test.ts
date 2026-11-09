import assert from 'node:assert/strict';
import test from 'node:test';
import { menuAplicacion, dividirMenuMovil, menuActivo } from '../src/app/menuAplicacion';
import { puedeAccederRuta } from '../src/app/capacidades';

test('administración conserva seis secciones más Salir sin comprimir siete accesos en móvil',()=>{
  const menu=menuAplicacion('ADMINISTRADOR');
  assert.equal(menu.length,6);
  const {principales,adicionales}=dividirMenuMovil(menu);
  assert.deepEqual(principales.map(i=>i.name),['Inicio','Control Escolar','Control Financiero','Control Académico']);
  assert.deepEqual(adicionales.map(i=>i.name),['Recursos Humanos','Configuración']);
  assert.deepEqual(adicionales[1].children?.map(i=>i.path),['/catalogos','/plantillas','/ciclos','/usuarios','/configuracion-app']);
});
test('el catálogo móvil y lateral conserva los permisos de cada rol y sus enlaces',()=>{
  for(const rol of ['ADMINISTRADOR','CAJERO','COORDINADOR FINANCIERO','COORDINADOR CONTROL ESCOLAR','COORDINADOR ACADEMICO','COORDINADOR RECURSOS HUMANOS','DOCENTE']) {
    const menu=menuAplicacion(rol);
    assert.ok(menu.length>0);
    for(const item of menu) for(const destino of item.children||[item]) assert.ok(puedeAccederRuta(rol,destino.path),`${rol}: ${destino.path}`);
    const movil=dividirMenuMovil(menu);
    assert.deepEqual([...movil.principales,...movil.adicionales],menu);
  }
  assert.deepEqual(menuAplicacion('CAJERO').map(i=>i.path),['/']);
  assert.deepEqual(menuAplicacion('DOCENTE').map(i=>i.path),['/calificaciones']);
  assert.equal(menuAplicacion('COORDINADOR FINANCIERO').some(i=>i.path==='/estadistica-911'),true);
});
test('la sección activa cubre subrutas, configuración y destinos secundarios sin prefijos falsos',()=>{
  const menu=menuAplicacion('ADMINISTRADOR');
  for(const ruta of ['/plan-pagos','/control-ingresos/consultar','/cobertura-planes-pago']) assert.equal(menuActivo(menu,ruta)?.name,'Control Financiero');
  assert.equal(menuActivo(menu,'/inscripciones?ciclo=1')?.name,'Control Escolar');
  assert.equal(menuActivo(menu,'/usuarios')?.name,'Configuración');
  assert.equal(menuActivo(menu,'/rh/evaluacion')?.name,'Recursos Humanos');
  assert.equal(menuActivo(menu,'/horarios')?.name,'Control Académico');
  assert.equal(menuActivo(menu,'/usuarios-inexistentes'),undefined);
  assert.equal(menuActivo(menuAplicacion('COORDINADOR ACADEMICO'),'/calificaciones')?.name,'Control Académico');
});
