import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULO||'C:/Users/sopor/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:/Users/sopor/AppData/Local/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-win64/chrome-headless-shell.exe'});
async function comprobarContraste(p){
 const datos=await p.locator('.layout-titulos input:not([type=checkbox]), .layout-titulos select').evaluateAll(elementos=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
  function rgb(color){ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);}
  function mezcla(a,b){return a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])).concat(1);}
  function fondo(e){const capas=[];for(let x=e;x;x=x.parentElement)capas.push(rgb(getComputedStyle(x).backgroundColor));return capas.reverse().reduce((b,a)=>mezcla(a,b),[255,255,255,1]);}
  function luz(c){return c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
  return elementos.map(e=>{const st=getComputedStyle(e),a=luz(rgb(st.color)),b=luz(fondo(e));return {campo:e.id||e.type,contraste:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),etiqueta:!!e.labels?.length};});
 });
 for(const d of datos){assert.ok(d.contraste>=4.5,`Contraste de ${d.campo}: ${d.contraste}`);if(d.campo!=='text')assert.equal(d.etiqueta,true,`Etiqueta de ${d.campo}`);}
}
const raiz=path.resolve('.tmp-layout-dist'),errores=[];await mkdir('.tmp-layout-capturas',{recursive:true});
try{for(const ancho of [390,820,1440])for(const oscuro of [false,true]){
 const p=await browser.newPage({viewport:{width:ancho,height:1000}});p.on('pageerror',e=>errores.push(e.message));
 await p.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='ensayo.invalid')return r.abort();let f=path.resolve(raiz,'.'+decodeURI(u.pathname));if(!f.startsWith(raiz+path.sep))return r.abort();if(u.pathname.includes('Layout%20')||decodeURI(u.pathname).includes('Layout Títulos'))f=path.resolve('public/Layout Títulos_v6_EJEMPLO.xlsx');try{await r.fulfill({body:await readFile(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/html'});}catch{await r.fulfill({status:404,body:''});}});
 await p.goto(`https://ensayo.invalid/scripts/ensayoLayoutTitulos.html?${oscuro?'oscuro':''}`);
 await p.getByPlaceholder('Buscar alumno para titular...').fill('FICTICIO');await p.getByText('ALUMNO FICTICIO',{exact:true}).click();
 await p.getByRole('button',{name:'Siguiente Paso'}).click();await comprobarContraste(p);
 await p.getByRole('checkbox',{name:'¿Incluir un segundo firmante?'}).check();await comprobarContraste(p);await p.getByRole('checkbox',{name:'¿Incluir un segundo firmante?'}).uncheck();
 await p.screenshot({path:`.tmp-layout-capturas/firmantes-${ancho}-${oscuro?'oscuro':'claro'}.png`});
 await p.getByRole('button',{name:'Configurar Alumnos'}).click();await comprobarContraste(p);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Pasos y formulario dentro de la pantalla');
 await p.getByRole('button',{name:'Exportar Excel'}).click();await p.getByRole('alert',{name:'Datos por corregir'}).waitFor();assert.equal(await p.evaluate(()=>window.archivosLayout.length),0);
 assert.equal(await p.getByLabel('Folio de Control',{exact:true}).isVisible(),true);
 assert.equal(await p.getByRole('alert',{name:'Datos por corregir'}).evaluate(e=>document.activeElement===e),true);
 await p.getByLabel('Fecha Término Antecedente',{exact:false}).fill('2013-07-01');
 await p.getByRole('button',{name:'Exportar Excel'}).click();await p.getByRole('region',{name:'Revisión final del lote'}).getByRole('alert').getByText('Confirma la revisión de fechas y correo antes de exportar.').waitFor();assert.equal(await p.getByRole('checkbox',{name:/Revisé las fechas oficiales/}).evaluate(e=>document.activeElement===e),true);assert.equal(await p.evaluate(()=>window.archivosLayout.length),0);
 const final=p.getByRole('region',{name:'Revisión final del lote'});assert.equal(await final.getByRole('button',{name:'Exportar Excel'}).count(),1);
 assert.equal(await p.evaluate(()=>Boolean(document.querySelector('[aria-label="Revisión final del lote"]').compareDocumentPosition(document.querySelector('[id$="-datos"]')) & Node.DOCUMENT_POSITION_PRECEDING)),true);
 await p.screenshot({path:`.tmp-layout-capturas/datos-${ancho}-${oscuro?'oscuro':'claro'}.png`,fullPage:true});
 await p.getByRole('checkbox',{name:/Revisé las fechas oficiales/}).check();await p.getByRole('button',{name:'Exportar Excel'}).click();
 await p.waitForFunction(()=>window.archivosLayout.length===1);assert.equal(await p.getByRole('alert',{name:'Datos por corregir'}).count(),0);
 await p.locator('input[type=email]').fill('otro@example.invalid');assert.equal(await p.getByRole('checkbox',{name:/Revisé las fechas oficiales/}).isChecked(),false);
 const aviso=p.getByRole('region',{name:'Revisión final del lote'});await aviso.scrollIntoViewIfNeeded();assert.equal(await aviso.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true);
 await p.screenshot({path:`.tmp-layout-capturas/layout-${ancho}-${oscuro?'oscuro':'claro'}.png`});await p.close();
}assert.deepEqual(errores,[]);console.log('Títulos: controles con contraste >=4.5:1 y etiquetas, firmantes, ficha por programa, validación sin descarga parcial, confirmación junto a exportar tras los datos y revocación al editar en 390/820/1440 y ambos temas. Sin red ni datos reales.');}finally{await browser.close();}
