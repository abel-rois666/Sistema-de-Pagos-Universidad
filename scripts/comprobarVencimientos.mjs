import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULO||'C:/Users/sopor/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:/Users/sopor/AppData/Local/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const raiz=path.resolve('.tmp-vencimientos-dist');await mkdir('.tmp-vencimientos-capturas',{recursive:true});const errores=[];
async function comprobarContraste(p){
 const colores=await p.locator('.cf-cabecera h2,.cf-nota,.cf-indicador-etiqueta p,.cf-indicador-valor,.cf-tabla thead th,.cf-tabla tbody tr:first-child td').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{
  const rgb=c=>c.match(/[\d.]+/g).map(Number);let fondo=[255,255,255];const ancestros=[];for(let n=e;n;n=n.parentElement)ancestros.unshift(n);
  for(const n of ancestros){const c=rgb(getComputedStyle(n).backgroundColor),a=c[3]??1;fondo=fondo.map((v,i)=>c[i]*a+v*(1-a));}
  return {texto:e.textContent,color:rgb(getComputedStyle(e).color).slice(0,3),fondo};
 }));
 const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((t,v,i)=>t+v*[.2126,.7152,.0722][i],0);
 for(const c of colores){const x=lum(c.color),y=lum(c.fondo);assert.ok((Math.max(x,y)+.05)/(Math.min(x,y)+.05)>=4.5,`Contraste: ${c.texto}`);}
}
try{for(const ancho of [390,820,1440,1920])for(const oscuro of [false,true]){
 const p=await browser.newPage({viewport:{width:ancho,height:1000}});p.on('pageerror',e=>errores.push(e.message));
 await p.clock.setFixedTime(new Date('2026-11-12T18:00:00Z'));
 await p.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='ensayo.invalid')return r.abort();const f=path.resolve(raiz,'.'+u.pathname);if(!f.startsWith(raiz+path.sep))return r.abort();try{await r.fulfill({body:await readFile(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});}catch{await r.fulfill({status:404,body:''});}});
 await p.goto(`https://ensayo.invalid/scripts/ensayoVencimientos.html?${oscuro?'oscuro':''}`);
 const panel=p.locator('.reporte-financiero-panel');await panel.getByRole('heading',{name:'Pagos y adeudos por alumno'}).waitFor();
 assert.ok((await p.locator('.pagos-adeudos-alumnos').boundingBox()).width<=1280,'Ancho del padrón respetado');
 if(ancho>=1440)assert.equal(await panel.locator('.cf-tabla-desplazable').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'Tabla de saldos ajustada al contenedor');
 const fila=panel.getByRole('row').filter({hasText:/Alumno Ficticio 00/i});
 const celdas=await fila.getByRole('cell').allTextContents();assert.ok(celdas.includes('$600.00'));assert.ok(celdas.includes('$1,500.00'));assert.ok(celdas.includes('$200.00'));assert.ok(celdas.includes('$2,300.00'));
 assert.equal(await panel.getByRole('columnheader',{name:'Vencido por pagar',exact:true}).count(),1);
 await comprobarContraste(p);
 await panel.locator('.cf-filtros-padron summary').click();
 await panel.locator('.reporte-filtros').getByRole('button',{name:'Estatus',exact:true}).click();
 await panel.locator('.reporte-filtros').getByRole('button',{name:'ACTIVO',exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Filtro desplegado dentro de la pantalla');
 await p.keyboard.press('Escape');await panel.locator('.cf-filtros-padron summary').click();
 const scroll=panel.getByRole('region',{name:'Saldos por alumno, tabla desplazable'});
 const posicion=await fila.getByRole('cell').first().evaluate(e=>e.getBoundingClientRect().left);
 await scroll.evaluate(e=>e.scrollLeft=e.scrollWidth-e.clientWidth);
 assert.ok(Math.abs((await fila.getByRole('cell').first().evaluate(e=>e.getBoundingClientRect().left))-posicion)<2,'Alumno fijo al desplazar');
 await scroll.evaluate(e=>e.scrollLeft=0);
 await panel.getByRole('button',{name:'Exportar CSV',exact:true}).click();
 const csv=await p.evaluate(()=>window.ensayoCSV.at(-1).text());const lineas=csv.replace(/^\uFEFF/,'').trim().split('\r\n');
 assert.equal(lineas.length,27);assert.equal(lineas[0],'ALUMNO,LICENCIATURA,GRADO,ESTATUS,TIENE_PLAN,HA_PAGADO,ADEUDA,VENCIDO_POR_PAGAR,POR_PAGAR_AUN_EN_PLAZO,PENDIENTE_DE_REVISAR_FECHA');
 assert.ok(lineas.some(f=>f.includes('2300,600,1500,200')));
 const impresion=p.locator('[aria-hidden="true"]').filter({has:p.getByRole('heading',{name:'Pagos y adeudos por alumno',includeHidden:true})});
 assert.equal(await impresion.locator('tbody tr').count(),26);assert.equal(await impresion.locator('thead th').count(),10);
 await p.waitForFunction(()=>[...document.querySelectorAll('.reporte-financiero-panel,table:first-of-type tbody tr')].every(e=>getComputedStyle(e).opacity==='1'));
 await p.evaluate(()=>window.scrollTo(0,0));
 await p.screenshot({path:`.tmp-vencimientos-capturas/resumen-${ancho}-${oscuro?'oscuro':'claro'}.png`,fullPage:false});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await panel.getByLabel('Ordenar por').selectOption('vencido');await panel.getByRole('button',{name:'Ascendente',exact:true}).click();
 assert.match(await panel.getByRole('row').nth(1).innerText(),/Alumno Ficticio 00/i);
 await p.getByRole('button',{name:'Ver Deudores',exact:true}).click();await p.getByRole('heading',{name:/Lista de Deudores/}).waitFor();
 const tabla=p.locator('table').first();assert.equal(await tabla.getByText('VENCE HOY',{exact:true}).count(),0);assert.equal(await tabla.getByText('SIN FECHA VÁLIDA',{exact:true}).count(),0);
 assert.ok((await p.locator('.cf-deudores').boundingBox()).width<=1280,'Deudores con ancho del padrón');
 await comprobarContraste(p);
 const monto=tabla.getByRole('button',{name:'Monto',exact:true});await monto.focus();await p.keyboard.press('Enter');assert.equal(await tabla.getByRole('columnheader',{name:'Monto',exact:true}).getAttribute('aria-sort'),'ascending');
 await p.keyboard.press('Enter');assert.equal(await tabla.getByRole('columnheader',{name:'Monto',exact:true}).getAttribute('aria-sort'),'descending');
 await p.getByRole('textbox',{name:'Buscar alumno o concepto',exact:true}).fill('NO EXISTE');await p.getByRole('heading',{name:'Sin resultados',exact:true}).waitFor();
 assert.equal(await p.getByRole('heading',{name:'Sin resultados',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true,'Estado vacío legible sin desplazar tabla');
 await p.getByRole('textbox',{name:'Buscar alumno o concepto',exact:true}).fill('');
 await p.waitForFunction(()=>[...document.querySelectorAll('.reporte-financiero-panel,table:first-of-type tbody tr')].every(e=>getComputedStyle(e).opacity==='1'));
 await p.screenshot({path:`.tmp-vencimientos-capturas/deudores-${ancho}-${oscuro?'oscuro':'claro'}.png`,fullPage:false});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.clock.setFixedTime(new Date('2026-11-13T06:01:00Z'));await p.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await tabla.getByText('VENCE HOY',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Ver resumen',exact:true}).click();await panel.getByRole('heading',{name:'Pagos y adeudos por alumno'}).waitFor();
 const nuevo=await panel.getByRole('row').filter({hasText:/Alumno Ficticio 00/i}).getByRole('cell').allTextContents();assert.ok(nuevo.includes('$1,600.00'));assert.ok(nuevo.includes('$500.00'));assert.ok(nuevo.includes('$2,300.00'));
 await p.getByRole('textbox',{name:'Buscar alumno'}).fill('NO EXISTE');await panel.getByText('No hay datos para mostrar.',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'Exportar CSV',exact:true}).click();assert.equal((await p.evaluate(()=>window.ensayoCSV.at(-1).text())).trim().split('\r\n').length,1);
 assert.equal(await panel.getByRole('row').count(),2);await p.close();
}assert.deepEqual(errores,[]);console.log('Vencimientos: cortes, abonos, fecha inválida, cambio de día, orden, filtros sin resultados y 390/820/1440/1920 en ambos temas aprobados sin red.');}finally{await browser.close();}
