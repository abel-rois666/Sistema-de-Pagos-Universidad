import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeAccederRuta, puedeCobrar, ROLES_REPORTES_ACADEMICOS } from '../src/app/capacidades';
import { menuActivo, menuAplicacion } from '../src/app/menuAplicacion';
import { tareasInicio } from '../src/app/inicioCatalogo';
import { tituloRuta } from '../src/app/titulosRutas';

test('caja cobra y consulta finanzas sin habilitar administración académica', () => {
  assert.equal(puedeCobrar('CAJERO'), true);
  assert.equal(puedeAccederRuta('CAJERO','/control-ingresos/registrar'), true);
  for (const ruta of ['/usuarios','/calificaciones','/grupos','/alumnos','/rh/evaluacion']) assert.equal(puedeAccederRuta('CAJERO',ruta), false);
});

test('el encabezado identifica subrutas y el inicio según el área', () => {
  assert.equal(tituloRuta('/control-ingresos/consultar'), 'Control de Ingresos');
  assert.equal(tituloRuta('/control-ingresos/registrar'), 'Control de Ingresos');
  assert.equal(tituloRuta('/', 'CAJERO'), 'Control Financiero');
  assert.equal(tituloRuta('/', 'COORDINADOR CONTROL ESCOLAR'), 'Inicio');
  assert.equal(tituloRuta('/rh/evaluacion'), 'Evaluación NOM-035');
});
test('los accesos compartidos permiten consultar recibos sin autorizar un cobro', () => {
  assert.equal(puedeAccederRuta('COORDINADOR CONTROL ESCOLAR','/control-ingresos/consultar'), true);
  assert.equal(puedeCobrar('COORDINADOR CONTROL ESCOLAR'), false);
  assert.equal(puedeAccederRuta('DOCENTE','/calificaciones'), true);
  assert.equal(puedeAccederRuta('DOCENTE','/ficha-alumno'), false);
  assert.equal(puedeAccederRuta(null,'/'), false);
});

test('Reportes Académicos se integra bajo Control Académico con acceso por rol esperado', () => {
  assert.deepEqual([...ROLES_REPORTES_ACADEMICOS], [
    'ADMINISTRADOR',
    'COORDINADOR ACADEMICO',
    'COORDINADOR CONTROL ESCOLAR',
  ]);
  for (const rol of ['ADMINISTRADOR', 'COORDINADOR ACADEMICO', 'COORDINADOR CONTROL ESCOLAR']) {
    assert.equal(puedeAccederRuta(rol, '/reportes-academicos'), true);
  }
  for (const rolDenegado of ['CAJERO', 'DOCENTE', 'COORDINADOR FINANCIERO', 'COORDINADOR RECURSOS HUMANOS']) {
    assert.equal(puedeAccederRuta(rolDenegado, '/reportes-academicos'), false);
  }

  assert.equal(tituloRuta('/reportes-academicos'), 'Reportes Académicos');

  for (const rol of ['ADMINISTRADOR', 'COORDINADOR ACADEMICO']) {
    const menu = menuAplicacion(rol);
    const controlAcademico = menu.find(m => m.path === '/control-academico');
    assert.ok(controlAcademico?.children?.some(h => h.path === '/reportes-academicos'));
    assert.equal(menuActivo(menu, '/reportes-academicos')?.path, '/control-academico');
    assert.ok(tareasInicio(rol, 'academico').some(t => t.ruta === '/reportes-academicos'));
  }

  const menuCajero = menuAplicacion('CAJERO');
  assert.equal(
    menuCajero.some(m => m.path === '/reportes-academicos' || m.children?.some(h => h.path === '/reportes-academicos')),
    false
  );
});
