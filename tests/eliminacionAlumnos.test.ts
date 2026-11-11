import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverEliminacionAlumnos, type OperacionesEliminacionAlumnos } from '../src/utils/eliminacionAlumnos';

const recibo = { id: 'recibo', alumno_id: 'alumno-1', folio: 41140, estatus: 'ACTIVO' };
const fk = { code: '23503', message: 'update or delete violates foreign key constraint "recibos_alumno_id_fkey" on table "recibos"' };

test('un lote bloqueado conserva todos los alumnos y muestra solo recibos de sus IDs', async () => {
  let llamadas = 0;
  const resultado = await resolverEliminacionAlumnos(['alumno-1', 'alumno-2'], {
    eliminar: async ids => { llamadas++; assert.deepEqual(ids, ['alumno-1', 'alumno-2']); return { ids: [], error: fk }; },
    consultarRecibos: async ids => {
      assert.deepEqual(ids, ['alumno-1', 'alumno-2']);
      return { recibos: [recibo, { ...recibo, id: 'otro', alumno_id: 'fuera-del-lote' }], mas: false };
    },
  });
  assert.equal(llamadas, 1);
  assert.deepEqual(resultado.eliminados, []);
  assert.deepEqual(resultado.recibos, [recibo]);
});

test('un recibo cancelado también conserva el bloqueo de relación', async () => {
  const resultado = await resolverEliminacionAlumnos(['alumno-1'], {
    eliminar: async () => ({ ids: [], error: fk }),
    consultarRecibos: async () => ({ recibos: [{ ...recibo, estatus: 'CANCELADO' }], mas: false }),
  });
  assert.equal(resultado.recibos?.[0].estatus, 'CANCELADO');
  assert.deepEqual(resultado.eliminados, []);
});

test('sin recibos el éxito actualiza únicamente los IDs que devuelve el servidor', async () => {
  const resultado = await resolverEliminacionAlumnos(['alumno-1', 'alumno-1'], {
    eliminar: async ids => { assert.deepEqual(ids, ['alumno-1']); return { ids: ['alumno-1', 'ajeno'], error: null }; },
    consultarRecibos: async () => { throw new Error('No debe consultar recibos después del éxito'); },
  });
  assert.deepEqual(resultado, { eliminados: ['alumno-1'], mensaje: undefined });
});

test('RLS sin filas devueltas no se presenta como una eliminación exitosa', async () => {
  const resultado = await resolverEliminacionAlumnos(['alumno-1'], {
    eliminar: async () => ({ ids: [], error: null }),
    consultarRecibos: async () => { throw new Error('No debe consultar'); },
  });
  assert.deepEqual(resultado.eliminados, []);
  assert.match(resultado.mensaje!, /No se confirmó/);
});

test('una eliminación parcial conserva la selección de IDs no confirmados', async () => {
  const resultado = await resolverEliminacionAlumnos(['alumno-1', 'alumno-2'], {
    eliminar: async () => ({ ids: ['alumno-2'], error: null }),
    consultarRecibos: async () => { throw new Error('No debe consultar'); },
  });
  const seleccion = new Set(['alumno-1', 'alumno-2', 'otra-pagina']);
  resultado.eliminados.forEach(id => seleccion.delete(id));
  assert.deepEqual([...seleccion], ['alumno-1', 'otra-pagina']);
  assert.match(resultado.mensaje!, /registros restantes/);
});

test('un fallo al consultar folios no equivale a ausencia de recibos', async () => {
  const resultado = await resolverEliminacionAlumnos(['alumno-1'], {
    eliminar: async () => ({ ids: [], error: fk }),
    consultarRecibos: async () => { throw new Error('Sin acceso'); },
  });
  assert.equal(resultado.errorConsulta, true);
  assert.deepEqual(resultado.eliminados, []);
  assert.deepEqual(resultado.recibos, []);
});

test('una vista previa limitada indica que quedan recibos por revisar', async () => {
  const resultado = await resolverEliminacionAlumnos(['alumno-1'], {
    eliminar: async () => ({ ids: [], error: fk }),
    consultarRecibos: async () => ({ recibos: [recibo], mas: true }),
  });
  assert.equal(resultado.masRecibos, true);
});

test('otras dependencias y permisos mantienen sus restricciones sin atribuir recibos', async () => {
  for (const error of [{ code: '23503', message: 'Otra dependencia' }, { code: '42501', message: 'Sin permisos' }, { code: '500', message: 'Error interno' }]) {
    const resultado = await resolverEliminacionAlumnos(['alumno-1'], {
      eliminar: async () => ({ ids: [], error }),
      consultarRecibos: async () => { throw new Error('No debe consultar'); },
    });
    assert.deepEqual(resultado.eliminados, []);
    assert.equal(resultado.recibos, undefined);
    assert.ok(resultado.mensaje);
    assert.ok(!resultado.mensaje.includes(error.message));
  }
});

test('una desconexión posterior a enviar el borrado requiere actualizar antes de reintentar', async () => {
  const resultado = await resolverEliminacionAlumnos(['alumno-1'], {
    eliminar: async () => { throw new Error('Red interrumpida'); },
    consultarRecibos: async () => { throw new Error('No debe consultar'); },
  });
  assert.deepEqual(resultado.eliminados, []);
  assert.match(resultado.mensaje!, /Actualiza el padrón/);
});

test('una selección vacía nunca envía un DELETE', async () => {
  const noEjecutar = async () => { throw new Error('No debe ejecutar'); };
  const resultado = await resolverEliminacionAlumnos([], { eliminar: noEjecutar, consultarRecibos: noEjecutar } as OperacionesEliminacionAlumnos);
  assert.deepEqual(resultado.eliminados, []);
  assert.match(resultado.mensaje!, /Selecciona/);
});
