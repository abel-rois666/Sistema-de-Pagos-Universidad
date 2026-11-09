import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
export const destinoManageUsers = resolve(raiz, 'supabase/dashboard/manage-users.ts');

/** Genera desde las fuentes canónicas; no usa credenciales, conecta a Supabase ni despliega. */
export async function generarManageUsersDashboard() {
  const resultado = await build({
    absWorkingDir: raiz,
    entryPoints: ['supabase/functions/manage-users/index.ts'],
    bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'es2022',
    external: ['https://*'], metafile: true, charset: 'utf8', logLevel: 'silent',
  });
  const salida = Object.values(resultado.metafile.outputs)[0];
  if (salida.imports.some(i => !i.external || !i.path.startsWith('https://'))) {
    throw new Error('El archivo manual conserva dependencias que no puede resolver el editor.');
  }
  const huella = createHash('sha256');
  for (const ruta of Object.keys(resultado.metafile.inputs).sort()) {
    huella.update(ruta.replaceAll('\\', '/')).update('\0');
    huella.update((await readFile(resolve(raiz, ruta), 'utf8')).replaceAll('\r\n', '\n')).update('\0');
  }
  return `// GENERADO: npm run preparar:manage-users-dashboard
// Copiar TODO este archivo en index.ts del editor de la Edge Function manage-users.
// Incluye los módulos locales; conserva la importación HTTPS original de Supabase.
// No editar aquí: modificar supabase/functions/manage-users y volver a generar.
// SHA-256 de fuentes: ${huella.digest('hex')}
\n${resultado.outputFiles[0].text}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const codigo = await generarManageUsersDashboard();
  if (process.argv.includes('--check')) {
    const actual = await readFile(destinoManageUsers, 'utf8').catch(() => '');
    if (actual.replaceAll('\r\n', '\n') !== codigo) {
      throw new Error('El archivo de despliegue manual está desactualizado. Ejecuta npm run preparar:manage-users-dashboard.');
    }
    console.log('manage-users manual coincide con sus fuentes.');
  } else {
    await mkdir(dirname(destinoManageUsers), { recursive: true });
    await writeFile(destinoManageUsers, codigo, 'utf8');
    console.log(`Preparado: ${destinoManageUsers} (${Buffer.byteLength(codigo)} bytes). No se desplegó.`);
  }
}
