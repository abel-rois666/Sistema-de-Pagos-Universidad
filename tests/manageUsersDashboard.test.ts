import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { destinoManageUsers, generarManageUsersDashboard } from '../scripts/generarManageUsersDashboard.mjs';

const codigo = (await readFile(destinoManageUsers, 'utf8')).replaceAll('\r\n', '\n');
const fuente = ts.createSourceFile('manage-users.ts', codigo, ts.ScriptTarget.ES2022, true);
const imports = fuente.statements.filter(ts.isImportDeclaration);

test('manage-users manual: incluye todas las fuentes y solo conserva la dependencia HTTPS original', async () => {
  assert.equal(codigo, await generarManageUsersDashboard());
  assert.equal(imports.length, 1);
  assert.equal((imports[0].moduleSpecifier as ts.StringLiteral).text, 'https://esm.sh/@supabase/supabase-js@2.49.1');
  assert.ok(!codigo.includes('from "./cuentaAdministrativa.ts"'));
});

function entorno(rol = 'ADMINISTRADOR', activo = true) {
  let handler: (req: Request) => Promise<Response>;
  let creadas = 0;
  const actor = {
    async rpc(nombre: string) { return nombre === 'get_my_rol' ? { data: rol, error: null } : { data: null, error: { code: 'PGRST202' } }; },
    auth: { async getUser() { return { data: { user: { id: 'actor-ficticio' } }, error: null }; } },
    from() { const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: { activo }, error: null }; } }; return q; },
  };
  const admin = {
    from() { const q = { select() { return q; }, eq() { return q; }, async limit() { return { data: [{ id: 'cuenta-existente' }], error: null }; } }; return q; },
    auth: { admin: { async createUser() { creadas++; throw new Error('No debe crear cuentas en este escenario ficticio'); } } },
  };
  // Quita únicamente el import verificado e inyecta el cliente ficticio; no existe acceso a la red.
  const ejecutable = codigo.slice(0, imports[0].getFullStart()) + codigo.slice(imports[0].end);
  runInNewContext(ejecutable, {
    createClient: (_url: string, clave: string) => clave === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : actor,
    Deno: { env: { get: (nombre: string) => nombre }, serve: (fn: typeof handler) => { handler = fn; } },
    Response, setTimeout, console: { log() {}, warn() {}, error() {} },
  });
  return {
    ejecutar: (body: Record<string, unknown>, autorizado = true) => handler(new Request('https://ejemplo.invalid/manage-users', {
      method: 'POST', headers: autorizado ? { Authorization: 'Bearer SESION_FICTICIA', 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })),
    preflight: () => handler(new Request('https://ejemplo.invalid/manage-users', { method: 'OPTIONS' })),
    creadas: () => creadas,
  };
}

test('manage-users manual: conserva CORS y rechazo de sesión ausente, rol no administrador y cuenta inactiva', async () => {
  const sinSesion = entorno();
  assert.equal((await sinSesion.preflight()).status, 200);
  assert.equal((await sinSesion.ejecutar({ action: 'CREATE_ADMINISTRATIVO' }, false)).status, 401);
  assert.equal((await entorno('CAJERO').ejecutar({ action: 'CREATE_ADMINISTRATIVO' })).status, 403);
  assert.equal((await entorno('ADMINISTRADOR', false).ejecutar({ action: 'CREATE_ADMINISTRATIVO' })).status, 403);
  assert.equal(sinSesion.creadas(), 0);
});

test('manage-users manual: ejecuta validación administrativa y comprobación docente sin referencias locales faltantes', async () => {
  const entornoNuevo = entorno();
  assert.equal((await entornoNuevo.ejecutar({ action: 'CREATE_ADMINISTRATIVO' })).status, 400);
  const faltaSql = await entornoNuevo.ejecutar({ action: 'CREATE_ADMINISTRATIVO', empleado_id: '33333333-3333-4333-8333-333333333333', original: {}, username: 'usuario.ficticio', password: 'CLAVE_FICTICIA_123', rol: 'CAJERO', motivo: 'Identidad ficticia revisada' });
  assert.equal(faltaSql.status, 409);
  assert.match((await faltaSql.json()).error, /migración/);
  const docente = await entornoNuevo.ejecutar({ action: 'CREATE', username: 'pf.prueba', password: 'CLAVE_FICTICIA_123', rol: 'DOCENTE', docente_id: 'docente-ficticio' });
  assert.equal(docente.status, 409);
  assert.match((await docente.json()).error, /ya tiene una cuenta/);
  assert.equal(entornoNuevo.creadas(), 0);
});
