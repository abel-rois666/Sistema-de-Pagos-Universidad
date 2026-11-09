import assert from 'node:assert/strict';
import test from 'node:test';
import { contextoEntrePeriodos, validarRespaldoConciliacion } from '../src/finanzas/conciliacionEntrePeriodos';
import type { CicloEscolar } from '../src/types';
const ciclos = [{ id:'c', nombre:'2027-1', tipo_periodo:'Cuatrimestral' }, { id:'s', nombre:'2027-1', tipo_periodo:'Semestral' }, { id:'a', nombre:'2026-3', tipo_periodo:'Cuatrimestral' }] as CicloEscolar[];
test('homónimos mantienen el flujo habitual y nombres distintos exigen conciliación', () => {
  assert.equal(contextoEntrePeriodos('c',['s'],ciclos),'mismo_periodo');
  assert.equal(contextoEntrePeriodos('a',['c'],ciclos),'entre_periodos');
  assert.equal(contextoEntrePeriodos('c',['c','a'],ciclos),'entre_periodos');
});
test('un ciclo desconocido nunca habilita implícitamente el flujo habitual', () => {
  for (const [origen,destinos] of [[null,['c']],['a',[]],['a',['no-existe']],['no-existe',['c']]] as const) {
    assert.equal(contextoEntrePeriodos(origen,destinos,ciclos),'incompleto');
  }
});
test('requiere motivo reconocido y respaldo concreto para otro periodo', () => {
  assert.ok(validarRespaldoConciliacion({motivo:'',evidencia:'Solicitud revisada'}));
  assert.ok(validarRespaldoConciliacion({motivo:'NO_VALIDO',evidencia:'Solicitud revisada'}));
  assert.ok(validarRespaldoConciliacion({motivo:'OTRO',evidencia:'    '}));
  assert.ok(validarRespaldoConciliacion({motivo:'OTRO',evidencia:'x'.repeat(2001)}));
  assert.equal(validarRespaldoConciliacion({motivo:'PAGO_ANTICIPADO',evidencia:'Solicitud de anticipo revisada'}),null);
});
