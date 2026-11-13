import test from 'node:test';
import assert from 'node:assert/strict';
import {rutaInicialUsuario,usaInicioFinanciero} from '../src/app/inicioUsuario';
import {menuAplicacion,menuActivo,destinoActivoMenu} from '../src/app/menuAplicacion';
import {tareasInicio} from '../src/app/inicioCatalogo';
test('inicio explícito por perfil: Caja y Financiero usan el tablero existente; RH tiene inicio propio',()=>{
 for(const rol of ['CAJERO','COORDINADOR FINANCIERO']){assert.equal(rutaInicialUsuario(rol),'/');assert.equal(usaInicioFinanciero(rol),true);}
 assert.equal(rutaInicialUsuario('COORDINADOR RECURSOS HUMANOS'),'/rh');assert.equal(rutaInicialUsuario('DOCENTE'),'/calificaciones');assert.equal(rutaInicialUsuario('ADMINISTRADOR'),'/dashboard');assert.equal(usaInicioFinanciero('ADMINISTRADOR'),false);
});
test('los submenús financieros respetan exclusiones de Caja sin accesos de inicio redundantes',()=>{
 const caja=menuAplicacion('CAJERO').find(i=>i.name==='Control Financiero')!.children!;
 assert.equal(caja.some(i=>i.path==='/'),false);assert.ok(caja.some(i=>i.path==='/control-ingresos/registrar'));
 assert.equal(caja.some(i=>i.path==='/pagos-adeudos-alumnos'||i.path==='/cobertura-planes-pago'),false);
 assert.ok(menuAplicacion('COORDINADOR FINANCIERO').find(i=>i.name==='Control Financiero')!.children!.some(i=>i.path==='/cobertura-planes-pago'));
 assert.equal(destinoActivoMenu(caja,'/control-ingresos/consultar'),'/control-ingresos/consultar');assert.equal(destinoActivoMenu(caja,'/'),undefined);assert.equal(menuActivo(menuAplicacion('CAJERO'),'/dashboard')?.name,'Control Financiero');
});
test('RH enumera sus operaciones y solo selecciona un hijo activo, sin confundir inicio con resultados',()=>{
 const menu=menuAplicacion('COORDINADOR RECURSOS HUMANOS'),rh=menu.find(i=>i.path==='/rh')!;
 assert.deepEqual(rh.children!.map(i=>i.path),['/rh/personal','/rh/resultados','/rh/planes','/rh/evaluacion']);
 assert.equal(destinoActivoMenu(rh.children!,'/rh/resultados'),'/rh/resultados');assert.equal(destinoActivoMenu(rh.children!,'/rh'),undefined);assert.equal(rh.incluirInicioMovil,false);
 for(const t of tareasInicio('COORDINADOR RECURSOS HUMANOS','rh'))assert.ok(rh.children!.some(i=>i.path===t.ruta));
 assert.equal(tareasInicio('CAJERO','rh').length,0);
});
