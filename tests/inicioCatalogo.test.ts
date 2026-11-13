import test from 'node:test';
import assert from 'node:assert/strict';
import { tareasInicio,AREAS_INICIO,areaPreferidaInicio } from '../src/app/inicioCatalogo';
import { menuAplicacion } from '../src/app/menuAplicacion';
import { puedeAccederRuta } from '../src/app/capacidades';
test('Inicio cubre los destinos operativos principales del menú y excluye configuración y correcciones',()=>{
 const tareas=tareasInicio('ADMINISTRADOR'),rutas=new Set(tareas.map(t=>t.ruta));
 const omitidas=['/herramientas-escolares','/catalogos','/plantillas','/ciclos','/usuarios','/configuracion-app','/dashboard','/rh'];
 for(const item of menuAplicacion('ADMINISTRADOR'))for(const destino of item.children||[item])if(!omitidas.includes(destino.path))assert.ok(rutas.has(destino.path),destino.path);
 for(const ruta of omitidas)assert.equal(rutas.has(ruta),false);
 for(const ruta of ['/plan-pagos','/control-ingresos/consultar','/control-ingresos/registrar','/ficha-alumno','/estadisticas','/deudores','/cobertura-planes-pago','/pagos-adeudos-alumnos','/rh/evaluacion','/reportes-escolares?vista=general','/reportes-escolares?vista=egresados','/reportes-escolares?vista=boletas'])assert.ok(rutas.has(ruta),ruta);
});
test('Inicio conserva permisos, no duplica destinos por perfil y particiona por áreas',()=>{
 for(const rol of ['ADMINISTRADOR','COORDINADOR ACADEMICO','COORDINADOR FINANCIERO','COORDINADOR CONTROL ESCOLAR','COORDINADOR RECURSOS HUMANOS','CAJERO','DOCENTE']){
 const tareas=tareasInicio(rol);assert.ok(tareas.length);assert.equal(new Set(tareas.map(t=>t.ruta)).size,tareas.length);
 assert.ok(tareas.every(t=>puedeAccederRuta(rol,t.ruta)));
 assert.equal(AREAS_INICIO.flatMap(a=>tareasInicio(rol,a.id)).length,tareas.length);
 }
 assert.equal(tareasInicio('CAJERO').some(t=>t.ruta==='/pagos-adeudos-alumnos'),false);
 assert.deepEqual(tareasInicio('DOCENTE').map(t=>t.ruta),['/calificaciones']);assert.deepEqual(tareasInicio(undefined),[]);
 assert.equal(areaPreferidaInicio('COORDINADOR ACADEMICO'),'academico');assert.equal(areaPreferidaInicio('COORDINADOR RECURSOS HUMANOS'),'rh');
});
test('buscar funciones ignora acentos y combina palabras sin modificar el catálogo',()=>{
 const antes=tareasInicio('ADMINISTRADOR');assert.ok(tareasInicio('ADMINISTRADOR',undefined,'aprobacion').some(t=>t.ruta==='/aprobacion-prospectos'));
 assert.ok(tareasInicio('ADMINISTRADOR',undefined,'recibos localizar').some(t=>t.ruta==='/control-ingresos/consultar'));
 assert.deepEqual(tareasInicio('ADMINISTRADOR',undefined,'inexistente xyz'),[]);assert.deepEqual(tareasInicio('ADMINISTRADOR'),antes);
});
