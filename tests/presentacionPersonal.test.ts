import test from 'node:test';
import assert from 'node:assert/strict';
import { edadPersonal,antiguedadPersonal } from '../src/personal/presentacion';

test('edad y antigüedad respetan el cumpleaños y las fechas civiles',()=>{
  const hoy=new Date(2026,10,8,12);
  assert.equal(edadPersonal('2000-11-09',hoy),25);
  assert.equal(edadPersonal('2000-11-08',hoy),26);
  assert.equal(edadPersonal('2026-11-08',new Date(2026,10,8,7)),0);
  assert.equal(antiguedadPersonal('2024-11-09',hoy),'1 año 11 meses');
  assert.equal(antiguedadPersonal('2024-11-08',hoy),'2 años');
});
test('ausencia, fechas imposibles o futuras no producen edades inventadas',()=>{
  const hoy=new Date(2026,10,8,12);
  for(const fecha of ['',undefined,'2026-02-31','2027-01-01'])assert.equal(edadPersonal(fecha,hoy),null);
  assert.equal(edadPersonal('2000-02-29',hoy),26);
});
