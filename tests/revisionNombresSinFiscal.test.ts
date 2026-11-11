import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { actualizarCapturasNombres, iniciarRevisionNombre, mensajeErrorRevisionNombres, validarLoteNombres } from '../src/personal/revisionNombres';
import { validarGenerales } from '../src/personal/reglas';

const pendiente = { docente_id: '11111111-1111-4111-8111-111111111111', clave: 'PF0001', revision: 0, nombre_historico: 'DOCENTE DE PRUEBA', original: { rfc: 'RFC HISTÓRICO' }, datos: { nombre_completo: 'DOCENTE DE PRUEBA', rfc: 'RFC HISTÓRICO', curp: 'ANTERIOR', email: 'CORREO ANTERIOR' } };
const captura = { ...iniciarRevisionNombre(pendiente), nombres: 'MARÍA DEL CARMEN', apellido_paterno: 'DE LA CRUZ', apellido_materno: '', revisado: true };

test('la revisión nominal acepta datos históricos fiscales sin relajar la validación del formulario general', () => {
  assert.deepEqual(validarLoteNombres([captura]), []);
  const generales = validarGenerales(captura.datos);
  assert.ok(generales.some(e => e.includes('RFC')));
  assert.ok(generales.some(e => e.includes('CURP')));
  assert.ok(generales.some(e => e.includes('correo')));
});

test('la selección usa el ID docente, no RFC compartido, y mantiene los duplicados por ID bloqueados', () => {
  assert.deepEqual(validarLoteNombres([captura, { ...captura, docente_id: '22222222-2222-4222-8222-222222222222', clave: 'PF0002' }]), []);
  assert.ok(validarLoteNombres([captura, captura]).some(e => e.includes('repetidos')));
});

test('actualizar un original cambiado conserva las partes propuestas y exige volver a revisar, sin tocar otras páginas', () => {
  const otra = { ...captura, docente_id: 'otro' };
  const original = { [captura.docente_id]: captura, otro: otra };
  const resultado = actualizarCapturasNombres(original, [{ ...pendiente, revision: 2, original: { rfc: 'OTRO HISTÓRICO' } }]);
  const f = resultado[captura.docente_id];
  assert.equal(f.nombres, captura.nombres); assert.equal(f.apellido_paterno, captura.apellido_paterno);
  assert.equal(f.revision, 2); assert.equal(f.original.rfc, 'OTRO HISTÓRICO'); assert.equal(f.revisado, false);
  assert.equal(resultado.otro, otra); assert.equal(original[captura.docente_id].revision, 0);
  assert.equal(actualizarCapturasNombres(original, [pendiente])[captura.docente_id], captura);
});

test('errores antiguos, conflictos y respuestas inciertas orientan sin recomendar borrar datos fiscales', () => {
  const antiguo = mensajeErrorRevisionNombres({ code: 'P0001', message: 'Revisa el formato del RFC' });
  assert.ok(antiguo.includes('función instalada')); assert.ok(antiguo.includes('no borres'));
  assert.ok(mensajeErrorRevisionNombres({ code: '40001' }).includes('No se guardó el lote'));
  assert.ok(mensajeErrorRevisionNombres(new Error('Failed to fetch')).includes('si los nombres quedaron guardados'));
  assert.ok(mensajeErrorRevisionNombres({ code: '42501' }).includes('no tiene permiso'));
});

const leer = (ruta: string) => readFileSync(new URL('../' + ruta, import.meta.url), 'utf8');
const sql = leer('supabase/migrations/20261110150000_revision_nombres_sin_validacion_fiscal.sql');
function cuerpo(texto: string, nombre: string) {
  const m = texto.match(new RegExp(`function public\\.${nombre}\\(.*?as \\$\\$(.*?)\\$\\$;`, 'is'));
  assert.ok(m, `Debe existir ${nombre}`); return m[1];
}
test('la preparación protege las versiones revisadas y conserva sin cambios la proyección general anterior', () => {
  const base = leer('supabase/migrations/20261108120000_personal_y_docentes.sql');
  const nombres = leer('supabase/migrations/20261108150000_nombres_estructurados_personal.sql');
  for (const [nombre, anterior] of [['_personal_reflejar_v1', base], ['personal_nombres_revisar_lote_v1', nombres]]) {
    for (const texto of [anterior, sql]) {
      const md5 = createHash('md5').update(cuerpo(texto, nombre).replace(/\s/g, '')).digest('hex');
      assert.ok(sql.slice(0, sql.indexOf('end $guard$;')).includes(md5), 'La guarda debe revisar la versión instalada y la correctiva');
    }
  }
  const original = cuerpo(base, '_personal_reflejar_v1');
  const desde = original.indexOf('  update public.docentes set');
  const general = cuerpo(sql, '_personal_reflejar_v1').split('-- Proyección general anterior: sin cambios para otras operaciones de Personal.')[1];
  assert.equal(general.replace(/\s/g, ''), original.slice(desde).replace(/\s/g, ''));
});

test('la preparación del lote no llama al guardado general ni escribe campos fiscales o contactos', () => {
  const lote = cuerpo(sql, 'personal_nombres_revisar_lote_v1');
  assert.ok(!lote.includes('public.personal_guardar_v1('));
  assert.ok(lote.includes('v_antes||v_partes'));
  assert.ok(lote.includes('v_fuente->\'original\' is distinct from v_fila->\'original\''));
  assert.ok(lote.includes('for update'));
  const escrituras = [...lote.matchAll(/update public\.\w+ set ([\s\S]*?) where /g)].map(m => m[1]).join('\n');
  assert.ok(!/\b(rfc|curp|email|fecha_nacimiento|clave_legado|estatus)\s*=/i.test(escrituras));
  assert.ok(/insert into public.personal_auditoria/.test(lote));
  assert.ok(sql.includes('revoke all on function public._personal_reflejar_v1() from public,anon,authenticated;'));
});
