import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const original = readFileSync('supabase/migrations/20261026110000_catalogo_oficial_911.sql', 'utf8');
const fuentes = original.split('$cat911$')[1];
const reglas = original.split('$reg911$')[1];
const raiz = 'supabase/cargas/911_2026_2027_sql_editor';

test('el paquete para SQL Editor reconstruye byte a byte las fuentes y reglas del catálogo original', () => {
  const puntero = JSON.parse(readFileSync(join(raiz, 'paquete_actual.json'), 'utf8'));
  assert.match(puntero.carpeta, /^[a-f0-9]{12}$/);
  const actual = JSON.parse(readFileSync(join(raiz, puntero.carpeta, 'manifest.json'), 'utf8'));
  assert.equal(puntero.lote, actual.lote);
  assert.equal(puntero.sha256_catalogo, hash(fuentes));
  assert.equal(puntero.sha256_reglas, hash(reglas));
  const paquetes = readdirSync(raiz, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
    const carpeta = join(raiz, d.name);
    return { carpeta, meta: JSON.parse(readFileSync(join(carpeta, 'manifest.json'), 'utf8')) };
  }).filter(p => p.meta.sha256_catalogo === hash(fuentes) && p.meta.sha256_reglas === hash(reglas));
  assert.ok(paquetes.length > 0, 'Falta generar el paquete para el catálogo actual');
  for (const { carpeta, meta } of paquetes) {
    const fragmentos = new Map<string, string>();
    for (const archivo of meta.archivos) {
      const bytes = readFileSync(join(carpeta, archivo.archivo));
      assert.ok(bytes.length < 48_000, `${archivo.archivo} supera el tamaño preparado`);
      assert.equal(bytes.length, archivo.bytes);
      assert.equal(hash(bytes), archivo.sha256, 'La huella debe coincidir también en Windows');
      if (!/^\d{3}_parte_\d{3}\.sql$/.test(archivo.archivo)) continue;
      const sql = bytes.toString('utf8');
      const literal = sql.match(/v_fragmento text=\$(fragmento911_[a-f0-9]+)\$([\s\S]*?)\$\1\$/);
      const clave = sql.match(/metadatos,partes,((?:fuentes|reglas)_\d{4}),sha256/);
      assert.ok(literal && clave, 'Parte SQL sin contenido o clave de control');
      assert.equal(hash(literal[2]), meta.partes[clave[1]].sha256);
      assert.equal(Buffer.byteLength(literal[2], 'utf8'), meta.partes[clave[1]].bytes);
      assert.ok(!fragmentos.has(clave[1]), 'Parte duplicada');
      fragmentos.set(clave[1], literal[2]);
    }
    assert.deepEqual([...fragmentos.keys()].sort(), Object.keys(meta.partes).sort());
    const reconstruir = (tipo: string) => [...fragmentos].filter(([k]) => k.startsWith(tipo + '_')).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v).join('');
    assert.equal(reconstruir('fuentes'), fuentes, 'Se alteraron caracteres, posiciones o encabezados');
    assert.equal(reconstruir('reglas'), reglas, 'Se alteraron reglas o árboles de operaciones');
    assert.equal(JSON.parse(reglas).length, meta.reglas);
    assert.equal(Object.values(JSON.parse(fuentes)).reduce((n: number, f: any) => n + f.campos.length, 0), meta.campos);
  }
});
