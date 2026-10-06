import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const opcion = process.argv[2];
if (opcion && opcion !== '--solo-publicacion') {
  throw new Error('Opción inválida. Usa --solo-publicacion si la primera migración ya está instalada.');
}
const migraciones = (opcion === '--solo-publicacion' ? [
  '20261006121000_publicar_horario_academico.sql',
] : [
  '20261006120000_horarios_academicos.sql',
  '20261006121000_publicar_horario_academico.sql',
]);
const contenidos = await Promise.all(migraciones.map(nombre =>
  readFile(join(raiz, 'supabase', 'migrations', nombre), 'utf8')));
const salida = join(tmpdir(), `ensayo-horarios-${opcion === '--solo-publicacion' ? 'publicacion-' : ''}${Date.now()}.sql`);

await writeFile(salida, [
  '-- ENSAYO: ejecutar TODO el archivo en una sola consulta del SQL Editor.',
  '-- La transacción termina en ROLLBACK: no instala el módulo ni conserva cambios.',
  '-- Puede bloquear escrituras unos segundos; usar fuera de horas de mayor actividad.',
  'BEGIN;',
  "SET LOCAL lock_timeout = '3s';",
  "SET LOCAL statement_timeout = '30s';",
  ...contenidos,
  '-- Si ocurrió un error antes de ROLLBACK, no ejecutar COMMIT; cerrar la sesión o emitir ROLLBACK.',
  'ROLLBACK;',
].join('\n\n'), 'utf8');

process.stdout.write(`${salida}\n`);
