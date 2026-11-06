import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeAccederRuta, puedeCobrar } from '../src/app/capacidades';
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
