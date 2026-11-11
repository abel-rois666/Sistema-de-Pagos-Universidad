import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { borrarReciboPrueba } from '../src/recibos/borradoPrueba';

test('borrar un recibo antiguo o reciente usa la misma operación segura, sin reajuste en el cliente', async () => {
  for (const id of ['recibo-antiguo', 'recibo-ultimo']) {
    const llamadas: unknown[] = [];
    const resultado = await borrarReciboPrueba(id, async (funcion, parametros) => {
      llamadas.push({ funcion, parametros }); return { error: null };
    });
    assert.equal(resultado.success, true);
    assert.deepEqual(llamadas, [{ funcion: 'borrar_recibo_prueba_v2', parametros: { p_recibo_id: id } }]);
  }
});

test('si falta la migración bloquea el borrado sin recurrir a la RPC antigua', async () => {
  for (const code of ['PGRST202', '42883']) {
    let llamadas = 0;
    const resultado = await borrarReciboPrueba('recibo', async () => { llamadas++; return { error: { code } }; });
    assert.equal(llamadas, 1);
    assert.equal(resultado.success, false);
    if (!resultado.success) assert.match(resultado.error.message, /20261109180000/);
  }
});

test('rechazos por permiso y dependencias conservan su explicación', async () => {
  for (const [code, texto] of [['42501', /Administración/], ['23503', /registros vinculados/]] as const) {
    const resultado = await borrarReciboPrueba('recibo', async () => ({ error: { code } }));
    assert.equal(resultado.success, false);
    if (!resultado.success) assert.match(resultado.error.message, texto);
  }
});

test('una desconexión no anuncia éxito y obliga a actualizar antes de reintentar', async () => {
  const resultado = await borrarReciboPrueba('recibo', async () => { throw new Error('Red'); });
  assert.equal(resultado.success, false);
  if (!resultado.success) assert.match(resultado.error.message, /Actualiza la consulta/);
});

test('sin identificador no envía peticiones', async () => {
  const resultado = await borrarReciboPrueba('', async () => { assert.fail('No debe llamar al servidor'); });
  assert.equal(resultado.success, false);
});

const sql = readFileSync('supabase/migrations/20261109180000_borrado_recibos_sin_reiniciar_folios.sql', 'utf8');
const cuerpo = sql.split('$borrado$')[1];
const wrapper = sql.split('as $compatible$')[1].split('$compatible$')[0];
test('el SQL preparado no toca secuencias en ninguno de los puntos de entrada', () => {
  for (const cuerpoFuncion of [cuerpo, wrapper]) assert.doesNotMatch(cuerpoFuncion, /setval|nextval|restart|sync_secuencia/i);
  assert.match(wrapper, /perform public\.borrar_recibo_prueba_v2\(p_recibo_id\)/);
  assert.match(cuerpo, /for update/);
  assert.match(cuerpo, /rol='ADMINISTRADOR' and activo is true/);
  assert.match(cuerpo, /saldo_a_favor=coalesce\(saldo_a_favor,0\)\+v_recibo\.uso_saldo_a_favor/);
  assert.match(sql, /revoke all on function public\.borrar_recibo_prueba_v2\(uuid\) from public,anon/);
});

test('la guarda reconoce la definición de partida versionada y no acepta variantes desconocidas', () => {
  const origen = readFileSync('tests/fixtures/borrar_recibo_admin_legado.sql', 'utf8');
  const esperado = sql.split('$legado$')[1];
  const normalizar = (s: string) => s.replace(/\s+/g, '');
  assert.equal(normalizar(origen), normalizar(esperado));
  assert.match(sql, /La función de borrado instalada difiere/);
  assert.match(sql, /Existen disparadores de borrado/);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /commit;\s*$/);
});

test('la guarda reconoce el cuerpo instalado recibido sin ejecutar sus operaciones de secuencia', () => {
  const instalada = readFileSync('tests/fixtures/borrar_recibo_admin_instalado_20261109.sql', 'utf8');
  const reconocida = sql.split('$instalada$')[1];
  const normalizar = (s: string) => s.replace(/\s+/g, '');
  assert.equal(normalizar(instalada), normalizar(reconocida));
  assert.match(sql, /regexp_replace\(instalada_revisada,'\\s\+','','g'\)/);
  // El setval histórico solo se compara como texto dentro de la guarda.
  assert.ok(sql.indexOf('$instalada$') < sql.indexOf('$revision$;'));
  assert.doesNotMatch(cuerpo, /setval|nextval|restart|sync_secuencia/i);
  assert.doesNotMatch(cuerpo, /(?:update|delete\s+from)\s+(?:public\.)?planes_pago/i);
});

test('una variante con otra regla financiera sigue fuera de las referencias admitidas', () => {
  const normalizar = (s: string) => s.replace(/\s+/g, '');
  const referencias = ['$legado$', '$instalada$', '$compatible$'].map(tag => normalizar(sql.split(tag)[1]));
  const instalada = readFileSync('tests/fixtures/borrar_recibo_admin_instalado_20261109.sql', 'utf8');
  const distinta = instalada.replace('saldo_a_favor + v_uso_saldo', 'saldo_a_favor - v_uso_saldo');
  assert.ok(referencias.includes(normalizar(instalada.replace(/\n/g,'\r\n'))));
  assert.ok(!referencias.includes(normalizar(distinta)));
  assert.match(sql, /if actual is null or regexp_replace\(actual,'\\s\+','','g'\) not in/);
  assert.match(sql, /Existen disparadores de borrado que requieren revisión previa/);
});
