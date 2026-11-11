import test from 'node:test';
import assert from 'node:assert/strict';
import { DATOS_PAGO_VACIOS, datosPagoPersonalValidados, erroresDatosPagoPersonal, ocultarDatoPago } from '../src/personal/datosPago';

test('NSS y datos bancarios son opcionales e independientes y conservan ceros iniciales', () => {
  assert.deepEqual(datosPagoPersonalValidados({}), DATOS_PAGO_VACIOS);
  assert.deepEqual(datosPagoPersonalValidados({ nss: '', cuenta: null }), DATOS_PAGO_VACIOS);
  const datos = { nss: '00123456789', clabe: '001234567890123456', cuenta: '00123456789', tarjeta: '0012345678901234' };
  assert.deepEqual(datosPagoPersonalValidados(datos), datos);
  assert.deepEqual(datosPagoPersonalValidados({ cuenta: '123' }), { ...DATOS_PAGO_VACIOS, cuenta: '123' });
});

test('NSS exige exactamente 11 dígitos; CLABE, cuenta y tarjeta respetan sus máximos sin imponer longitudes adicionales', () => {
  assert.ok(erroresDatosPagoPersonal({ nss: '1234567890' }).nss?.includes('exactamente 11'));
  assert.ok(erroresDatosPagoPersonal({ nss: '123456789012' }).nss);
  assert.deepEqual(erroresDatosPagoPersonal({ clabe: '1', cuenta: '1', tarjeta: '1' }), {});
  assert.ok(erroresDatosPagoPersonal({ clabe: '1'.repeat(19) }).clabe);
  assert.ok(erroresDatosPagoPersonal({ cuenta: '1'.repeat(12) }).cuenta);
  assert.ok(erroresDatosPagoPersonal({ tarjeta: '1'.repeat(17) }).tarjeta);
});

test('rechaza letras, espacios, decimales, exponentes y valores numéricos en vez de alterar el identificador', () => {
  for (const valor of ['123A', '123 456', '123-456', '1.5', '1e10', '+123', ' 123', '１２３', 12345678901]) {
    assert.ok(erroresDatosPagoPersonal({ cuenta: valor }).cuenta);
    assert.throws(() => datosPagoPersonalValidados({ cuenta: valor }));
  }
});

test('la presentación oculta los dígitos previos a los últimos cuatro sin tratar un vacío como cero', () => {
  assert.equal(ocultarDatoPago('001'),'•••');
  assert.equal(ocultarDatoPago('00123456789'), '•••••••6789');
  assert.equal(ocultarDatoPago(null), 'Sin registrar');
  assert.equal(ocultarDatoPago('123'), '•••');
});
