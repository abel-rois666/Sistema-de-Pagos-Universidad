import test from 'node:test';
import assert from 'node:assert/strict';
import { posicionarSelector } from '../src/utils/posicionSelector';

const ventana = { width: 1280, height: 720 };
test('una opción que cabe debajo no se desplaza hacia la cabecera por usar la altura máxima', () => {
  const p = posicionarSelector({ left: 242, top: 483, bottom: 535, width: 575 }, ventana, 110);
  assert.equal(p.top, 541);
  assert.equal(p.bottom, undefined);
  assert.equal(p.left, 242);
  assert.equal(p.width, 575);
});

test('si abre arriba, el borde inferior queda a seis píxeles del campo para cualquier alto real', () => {
  for (const altura of [110, 230, 900]) {
    const p = posicionarSelector({ left: 242, top: 650, bottom: 692, width: 575 }, ventana, altura);
    assert.equal(p.top, undefined);
    assert.equal(p.bottom, 76);
    assert.equal(ventana.height - p.bottom!, 644);
    assert.equal(p.maxHeight, 340);
  }
});

test('al filtrar una lista larga puede volver debajo si el resultado reducido cabe', () => {
  const ancla = { left: 242, top: 483, bottom: 535, width: 575 };
  assert.equal(posicionarSelector(ancla, ventana, 900).top, undefined);
  assert.equal(posicionarSelector(ancla, ventana, 110).top, 541);
});

test('un menú extenso conserva desplazamiento y utiliza el lado con mayor espacio', () => {
  const p = posicionarSelector({ left: 40, top: 110, bottom: 152, width: 300 }, ventana, 1000);
  assert.equal(p.top, 158);
  assert.equal(p.maxHeight, 340);
});

test('en móvil limita anchura y posición sin sobrepasar los márgenes', () => {
  for (const width of [320, 390, 820]) {
    const p = posicionarSelector({ left: width - 100, top: 260, bottom: 302, width: 575 }, { width, height: 700 }, 110);
    assert.ok(p.left >= 12);
    assert.ok(p.left + p.width <= width - 12);
  }
});

test('con poca altura no impone un mínimo que saque el menú de la ventana', () => {
  const p = posicionarSelector({ left: 20, top: 70, bottom: 112, width: 260 }, { width: 390, height: 160 }, 900);
  assert.equal(p.top, undefined);
  assert.equal(p.maxHeight, 52);
  assert.equal(160 - p.bottom! - p.maxHeight, 12);
});
