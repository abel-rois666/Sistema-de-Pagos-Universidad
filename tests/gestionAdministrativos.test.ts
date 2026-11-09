import test from 'node:test';
import assert from 'node:assert/strict';
import { cuentaVinculable, validarCuentaAdministrativa, type CuentaAdministrativo, type RevisionAdministrativo } from '../src/personal/gestionAdministrativos';
import { crearCuentaAdministrativa } from '../supabase/functions/manage-users/cuentaAdministrativa';
import { revisarCuentaDocenteExistente } from '../supabase/functions/manage-users/cuentaDocenteExistente';

const empleado = '33333333-3333-4333-8333-333333333333';
const formulario = { username: 'usuario.prueba', password: 'CLAVE_FICTICIA_123', rol: 'CAJERO', email: '', motivo: 'Identidad verificada en expediente ficticio' };
const cuenta = { id: 'u', username: 'u', rol: 'DOCENTE', activo: true, auth_id: 'auth', empleado_id: null, docente_id: 'd' } as CuentaAdministrativo;
const revision = { empleado: { id: empleado }, docente_id: 'd', cuentas: [], dependencias: [], puede_eliminar: true } as RevisionAdministrativo;

test('cuentas administrativas: exige usuario válido, contraseña y selección explícita del rol', () => {
  assert.deepEqual(validarCuentaAdministrativa(formulario), []);
  for (const datos of [{ rol: '' }, { rol: 'DOCENTE' }, { rol: 'ROL_INVENTADO' }, { password: 'corta' }, { username: 'Nombre con espacios' }, { email: 'no-correo' }, { motivo: 'corto' }]) {
    assert.ok(validarCuentaAdministrativa({ ...formulario, ...datos }).length > 0);
  }
});
test('cuenta existente: acepta identidad docente explícita, conserva inactivos y rechaza vínculos ajenos o sin Auth', () => {
  assert.equal(cuentaVinculable(cuenta, revision), true);
  assert.equal(cuentaVinculable({ ...cuenta, activo: false }, revision), true);
  assert.equal(cuentaVinculable({ ...cuenta, docente_id: 'otro' }, revision), false);
  assert.equal(cuentaVinculable({ ...cuenta, empleado_id: 'otro' }, revision), false);
  assert.equal(cuentaVinculable({ ...cuenta, auth_id: null }, revision), false);
  assert.equal(cuentaVinculable(cuenta, { ...revision, cuentas: [{ ...cuenta, id: 'otra' }] }), false);
});

function escenario(opciones: { cuentas?: boolean; revisionError?: boolean; revisionInvalida?: boolean; usernameExiste?: boolean; linkError?: boolean; linkConfirmado?: boolean; lecturaError?: boolean; rollbackError?: boolean } = {}) {
  const operaciones: string[] = [];
  let vinculado = false;
  const perfil = () => ({ id: 'perfil-nuevo', username: formulario.username, rol: formulario.rol, auth_id: 'auth-nuevo', empleado_id: vinculado ? empleado : null });
  const cliente = { async rpc(nombre: string) {
    operaciones.push(nombre);
    if (nombre === 'personal_administrativo_revisar_v1') return { data: { empleado: { id: opciones.revisionInvalida ? 'otro' : empleado }, cuentas: opciones.cuentas ? [cuenta] : [] }, error: opciones.revisionError ? { message: 'RPC no instalada' } : null };
    if (opciones.linkConfirmado || !opciones.linkError) vinculado = true;
    return { data: opciones.linkError ? null : { usuario_id: 'perfil-nuevo' }, error: opciones.linkError ? { message: 'Conflicto de revisión ficticio' } : null };
  } };
  const admin = {
    from() {
      const q = {
        select() { return q; }, eq() { return q; },
        async limit() { return { data: opciones.usernameExiste ? [{ id: 'existente' }] : [], error: null }; },
        async single() { return { data: perfil(), error: null }; },
        async maybeSingle() { return { data: perfil(), error: opciones.lecturaError ? { message: 'Fallo de consulta' } : null }; },
        delete() { operaciones.push('limpiar-perfil'); return q; }, async is() { return { error: null }; },
      }; return q;
    },
    auth: { admin: {
      async createUser(datos: any) { operaciones.push('crear-auth'); assert.equal(datos.user_metadata.rol, 'CAJERO'); return { data: { user: { id: 'auth-nuevo' } }, error: null }; },
      async deleteUser(id: string) { operaciones.push('revertir-auth'); assert.equal(id, 'auth-nuevo'); return { error: opciones.rollbackError ? { message: 'No se revirtió' } : null }; },
    } },
  };
  return { operaciones, cliente, admin };
}
const body = { empleado_id: empleado, original: { id: empleado }, ...formulario };
test('creación: no llama Auth cuando faltan permisos/datos, la revisión falla o ya existe una cuenta', async () => {
  for (const opciones of [{ cuentas: true }, { revisionError: true }, { revisionInvalida: true }, { usernameExiste: true }]) {
    const e = escenario(opciones); const r = await crearCuentaAdministrativa(body, e.cliente, e.admin);
    assert.equal(r.status, 409); assert.ok(!e.operaciones.includes('crear-auth'));
  }
  const e = escenario(); assert.equal((await crearCuentaAdministrativa({ ...body, rol: '' }, e.cliente, e.admin)).status, 400);
  assert.deepEqual(e.operaciones, []);
});
test('creación: confirma identidad Auth y vinculación antes de devolver éxito', async () => {
  const e = escenario(); const r = await crearCuentaAdministrativa(body, e.cliente, e.admin);
  assert.equal(r.status, 200); assert.equal(r.data.success, true);
  assert.deepEqual(e.operaciones, ['personal_administrativo_revisar_v1', 'crear-auth', 'personal_administrativo_vincular_cuenta_v1']);
});
test('creación: un conflicto de vínculo revierte solamente la cuenta recién creada sin vínculo', async () => {
  const e = escenario({ linkError: true }); const r = await crearCuentaAdministrativa(body, e.cliente, e.admin);
  assert.equal(r.status, 409); assert.deepEqual(e.operaciones.slice(-2), ['revertir-auth', 'limpiar-perfil']);
});
test('creación: respuesta perdida tras confirmar vínculo conserva la cuenta y devuelve éxito', async () => {
  const e = escenario({ linkError: true, linkConfirmado: true }); const r = await crearCuentaAdministrativa(body, e.cliente, e.admin);
  assert.equal(r.status, 200); assert.ok(!e.operaciones.includes('revertir-auth'));
});
test('creación: estado incierto o compensación fallida exige revisión y no borra perfiles existentes', async () => {
  const incierto = escenario({ linkError: true, lecturaError: true });
  assert.equal((await crearCuentaAdministrativa(body, incierto.cliente, incierto.admin)).status, 409);
  assert.ok(!incierto.operaciones.includes('revertir-auth'));
  const fallo = escenario({ linkError: true, rollbackError: true });
  assert.equal((await crearCuentaAdministrativa(body, fallo.cliente, fallo.admin)).status, 409);
  assert.ok(!fallo.operaciones.includes('limpiar-perfil'));
});

test('alta docente legada: bloquea una cuenta administrativa compartida y conserva el flujo sin migración', async () => {
  const admin = { from(tabla: string) {
    const q = { select() { return q; }, eq() { return q; }, async limit() { return { data: [], error: null }; },
      async maybeSingle() { return { data: tabla === 'docentes' ? { id: 'd', persona_id: 'persona' } : { id: empleado }, error: null }; } }; return q;
  } };
  const conCuenta = { async rpc() { return { data: [{ empleado_id: empleado, cuentas: [cuenta] }], error: null }; } };
  assert.match((await revisarCuentaDocenteExistente('d', conCuenta, admin))!, /ya tiene cuenta administrativa/);
  assert.equal(await revisarCuentaDocenteExistente('d', { async rpc() { return { data: null, error: { code: 'PGRST202' } }; } }, admin), null);
  assert.equal(await revisarCuentaDocenteExistente('d', { async rpc() { return { data: [{ cuentas: [] }], error: null }; } }, admin), null);
  assert.match((await revisarCuentaDocenteExistente('d', { async rpc() { return { data: null, error: { code: '42501' } }; } }, admin))!, /No se pudo comprobar/);
});
