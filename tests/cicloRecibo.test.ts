import assert from 'node:assert/strict';
import test from 'node:test';
import type { CicloEscolar, PaymentPlan } from '../src/types';
import { resolverContextoCicloRecibo, validarConfirmacionCicloRecibo } from '../src/utils/cicloRecibo';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ContextoCicloRecibo from '../src/components/recibos/ContextoCicloRecibo';

const ciclos = [
  { id: 'sem', nombre: '2027-1', tipo_periodo: 'Semestral' },
  { id: 'cuat', nombre: '2027-1', tipo_periodo: 'Cuatrimestral' },
] as CicloEscolar[];
const planes = [
  { id: 'p1', alumno_id: 'a1', ciclo_id: 'cuat', tipo_plan: 'Cuatrimestral' },
  { id: 'p2', alumno_id: 'a1', ciclo_id: 'sem', tipo_plan: 'Semestral' },
] as PaymentPlan[];
const fila = { plan_id: 'p1', indice_concepto_plan: 1 };

test('un recibo independiente respeta el ID elegido y exige un ciclo existente', () => {
  assert.equal(resolverContextoCicloRecibo(ciclos, planes, 'a1', 'sem', []).ciclo?.id, 'sem');
  assert.equal(resolverContextoCicloRecibo(ciclos, planes, 'a1', '', []).ciclo, undefined);
  assert.ok(resolverContextoCicloRecibo(ciclos, planes, 'a1', 'eliminado', []).error);
});

test('cobrar desde un plan hereda su ciclo pese a la preferencia de otro módulo', () => {
  const contexto = resolverContextoCicloRecibo(ciclos, planes, 'a1', 'sem', [fila], 'p1');
  assert.equal(contexto.ciclo?.id, 'cuat');
  assert.equal(contexto.plan?.id, 'p1');
  assert.equal(contexto.error, undefined);
  assert.ok(resolverContextoCicloRecibo(ciclos, [], 'a1', 'sem', [], 'p1').error);
  assert.ok(resolverContextoCicloRecibo(ciclos, planes, 'otro-alumno', 'cuat', [fila], 'p1').error);
});

test('se rechazan referencias incompletas, planes mezclados y una asociación cambiada durante la captura', () => {
  assert.ok(resolverContextoCicloRecibo(ciclos, planes, 'a1', 'cuat', [{ indice_concepto_plan: 1 }]).error);
  assert.ok(resolverContextoCicloRecibo(ciclos, planes, 'a1', 'cuat', [fila,
    { plan_id: 'p2', indice_concepto_plan: 1 }]).error);
  assert.ok(resolverContextoCicloRecibo(ciclos, planes, 'a1', 'sem', [fila]).error);
  assert.ok(resolverContextoCicloRecibo(ciclos, [{ ...planes[0], ciclo_id: 'sem' }],
    'a1', 'sem', [fila]).error);
});

test('la resolución del ciclo no cambia importes, estatus, recibos ni monedero', () => {
  const antes = JSON.stringify({ ciclos, planes, fila });
  assert.equal(resolverContextoCicloRecibo(ciclos, planes, 'a1', 'cuat', [fila]).error, undefined);
  assert.equal(JSON.stringify({ ciclos, planes, fila }), antes);
});

test('cada recibo independiente confirma su ciclo y el cobro del plan hereda su contexto', () => {
  const independiente = resolverContextoCicloRecibo(ciclos, planes, 'a1', 'sem', []);
  assert.ok(validarConfirmacionCicloRecibo(independiente, false));
  assert.equal(validarConfirmacionCicloRecibo(independiente, true), null);
  assert.equal(validarConfirmacionCicloRecibo(
    resolverContextoCicloRecibo(ciclos, planes, 'a1', 'sem', [fila], 'p1'), false), null);
  const props = { ciclos, cicloId: 'cuat', onChange: () => {}, confirmado: false, onConfirmar: () => {} };
  const manual = renderToStaticMarkup(createElement(ContextoCicloRecibo, { ...props, desdePlan: false }));
  assert.match(manual, /type="checkbox"/);
  assert.match(manual, /Confirmo emitir este recibo en 2027-1/);
  assert.match(manual, /Cuatrimestral/);
  const heredado = renderToStaticMarkup(createElement(ContextoCicloRecibo,
    { ...props, desdePlan: true, referenciaPlan: '271-001' }));
  assert.doesNotMatch(heredado, /type="checkbox"/);
  assert.match(heredado, /<select[^>]*disabled/);
  assert.match(heredado, /Ciclo heredado del plan 271-001/);
});
