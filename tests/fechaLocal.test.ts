import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('una emisión nocturna en México conserva el día mostrado y no toma el día siguiente de UTC', () => {
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "import {fechaLocalISO} from './src/utils/fechaLocal.ts'; process.stdout.write(fechaLocalISO(new Date('2026-11-06T03:15:00Z')));"],
    { encoding: 'utf8', env: { ...process.env, TZ: 'America/Mexico_City' } });
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.equal(resultado.stdout, '2026-11-05');
});
