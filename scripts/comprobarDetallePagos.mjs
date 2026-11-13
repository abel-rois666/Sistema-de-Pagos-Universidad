import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULO || 'C:/Users/sopor/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const JSZip = require('jszip'), raiz = path.resolve('.tmp-pagos-dist');
await mkdir('.tmp-pagos-capturas', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || 'C:/Users/sopor/AppData/Local/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-win64/chrome-headless-shell.exe' });
const errores = [];
try {
  for (const ancho of [390, 820, 1440]) for (const oscuro of [false, true]) {
    const p = await browser.newPage({ viewport: { width: ancho, height: 1000 } }); p.on('pageerror', e => errores.push(e.message));
    await p.route('**/*', async r => { const u = new URL(r.request().url()); if (u.hostname !== 'ensayo.invalid') return r.abort(); const f = path.resolve(raiz, '.' + u.pathname); if (!f.startsWith(raiz + path.sep)) return r.abort(); try { await r.fulfill({ body: await readFile(f), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); } catch { await r.fulfill({ status: 404, body: '' }); } });
    await p.goto(`https://ensayo.invalid/scripts/ensayoDetallePagos.html?${oscuro ? 'oscuro' : ''}`);
    const consultar = p.getByRole('button', { name: 'Consultar pagos de 27 filtrados', exact: true }); await consultar.waitFor(); await consultar.click();
    const d = p.getByRole('dialog', { name: 'Pagos de certificados y titulación' }); await d.waitFor();
    await d.getByText('Página 1 de 3 · 10 alumnos por página', { exact: true }).waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.classList.contains('dark')), oscuro);
    assert.equal(await d.getByText('$70.00', { exact: true }).count(), 20); // Fuente del estado y vínculos, 10 personas.
    assert.equal(await d.getByText('F-12306', { exact: true }).locator('visible=true').count(), 10);
    await d.getByLabel('Contenido de la consulta').selectOption('certificados');
    assert.equal(await d.getByText('Planes de pagos de titulación', { exact: true }).count(), 0);
    assert.equal(await d.getByText('DOCENCIA UNIVERSITARIA · PLAN 2009', { exact: true }).count(), 1);
    await p.screenshot({ path: `.tmp-pagos-capturas/certificados-${ancho}-${oscuro ? 'oscuro' : 'claro'}.png`, fullPage: false });
    await d.getByLabel('Contenido de la consulta').selectOption('ambos');
    await d.getByRole('button', { name: 'Exportar detalle (ZIP)', exact: true }).click();
    await p.waitForFunction(() => window.ensayoBlobs.length > 0);
    const bytes = await p.evaluate(async () => [...new Uint8Array(await window.ensayoBlobs[0].arrayBuffer())]);
    const zip = await JSZip.loadAsync(Buffer.from(bytes));
    const planes = await zip.file('titulacion_planes.csv').async('string'), recibos = await zip.file('recibos_detalle.csv').async('string');
    assert.equal(planes.trim().split('\r\n').length, 28); assert.equal(recibos.trim().split('\r\n').length, 82);
    assert.ok(recibos.includes('TRANSFERENCIA')); assert.ok(recibos.includes('"70.00"') === false); // Son importes de cada abono, no el agregado.
    await d.getByRole('button', { name: 'Volver al listado', exact: true }).click(); await d.waitFor({ state: 'detached' });
    assert.equal(await consultar.evaluate(e => e === document.activeElement), true);
    await p.getByRole('button', { name: 'Elegir alumnos para consultar', exact: true }).click();
    await p.getByRole('checkbox', { name: 'Seleccionar para consulta los alumnos de esta página', exact: true }).check();
    await p.getByRole('navigation', { name: 'Páginas del listado' }).getByRole('button', { name: 'Siguiente' }).click();
    await p.getByRole('checkbox', { name: /Consultar pagos de ALUMNO FICTICIO 25/ }).check();
    await p.getByRole('button', { name: 'Consultar pagos de 26 seleccionados', exact: true }).click(); await d.getByText('Página 1 de 3 · 10 alumnos por página', { exact: true }).waitFor();
    await p.keyboard.press('Escape'); await d.waitFor({ state: 'detached' });
    assert.ok(await p.getByText('Página 2 de 2 · 25 por página', { exact: true }).isVisible());
    await p.getByRole('navigation', { name: 'Páginas del listado' }).getByRole('button', { name: 'Anterior' }).click();
    await p.getByRole('checkbox', { name: 'Seleccionar para consulta los alumnos de esta página', exact: true }).uncheck();
    await p.getByLabel('Estatus', { exact: true }).click(); await p.getByRole('button', { name: 'EGRESADO', exact: true }).click();
    await p.getByRole('heading', { name: 'Consultar pagos y recibos', exact: true }).click();
    await p.getByRole('button', { name: 'Consultar pagos de 1 seleccionado', exact: true }).click();
    await d.getByRole('heading', { name: /ALUMNO FICTICIO 25/ }).waitFor();
    assert.equal(await d.getByRole('heading', { name: /ALUMNO FICTICIO 26/ }).count(), 0);
    await d.getByRole('button', { name: 'Volver al listado', exact: true }).click();
    await p.getByRole('button', { name: 'Limpiar selección (1)', exact: true }).click();
    await p.getByRole('button', { name: 'Consultar pagos', exact: true }).click(); await d.getByRole('heading', { name: /ALUMNO FICTICIO 26/ }).waitFor();
    await p.screenshot({ path: `.tmp-pagos-capturas/titulacion-${ancho}-${oscuro ? 'oscuro' : 'claro'}.png`, fullPage: false });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await d.getByRole('button', { name: 'Volver al listado', exact: true }).click();
    await p.evaluate(() => { window.ensayoFallar = true; });
    await p.getByRole('button', { name: 'Consultar pagos', exact: true }).click(); await d.getByRole('alert').waitFor();
    assert.equal(await d.getByRole('button', { name: 'Exportar detalle (ZIP)', exact: true }).isDisabled(), true);
    await p.evaluate(() => { window.ensayoFallar = false; }); await d.getByRole('button', { name: 'Reintentar consulta', exact: true }).click(); await d.getByRole('heading', { name: /ALUMNO FICTICIO 26/ }).waitFor();
    const llamadas = await p.evaluate(() => window.ensayoLlamadas);
    assert.ok(llamadas.every(c => ['listado_vistas_consultar_v1', 'vista_planes_pago', 'recibos', 'recibos_detalles', 'planes_pago_vinculos_recibo', 'certificacion_resumen_v1'].includes(c.tabla)));
    assert.ok(llamadas.every(c => c.metodo === 'GET' || ['listado_vistas_consultar_v1', 'certificacion_resumen_v1'].includes(c.tabla)));
    await p.close();
  }
  assert.deepEqual(errores, []);
  console.log('Consulta de pagos: filtros, selección entre páginas, alumno, estados, abonos, facturas, ZIP completo, error/reintento, foco y 390/820/1440 en ambos temas aprobados sin red real.');
} finally { await browser.close(); }
