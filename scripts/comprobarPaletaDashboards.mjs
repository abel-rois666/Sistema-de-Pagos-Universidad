// Ensayo visual aislado: datos ficticios, sin solicitudes a servicios reales.
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULO||'C:/Users/sopor/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:/Users/sopor/AppData/Local/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const raiz=path.resolve('.tmp-areas-dist'),errores=[];
await mkdir('.tmp-dashboard-capturas',{recursive:true});
const rgb=c=>c.match(/[\d.]+/g).slice(0,3).map(Number);
const lum=c=>rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((t,v,i)=>t+v*[.2126,.7152,.0722][i],0);
const contraste=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const casos=[
  ['financiero','COORDINADOR FINANCIERO','/financiero'],['caja','CAJERO','/financiero'],
  ['financiero-admin','ADMINISTRADOR','/financiero'],['escolar','ADMINISTRADOR','/control-escolar'],
  ['academico','ADMINISTRADOR','/control-academico'],['rh','COORDINADOR RECURSOS HUMANOS','/rh'],
  ['reportes','ADMINISTRADOR','/reportes-escolares'],
];
const elegidos=casos.filter(c=>!process.env.DASHBOARD_CASO||c[0]===process.env.DASHBOARD_CASO||(process.env.DASHBOARD_CASO==='finanzas'&&(c[0].startsWith('financiero')||c[0]==='caja')));
const anchos=(process.env.DASHBOARD_ANCHOS||'390,820,1440').split(',').map(Number);
try {
for(const [nombre,rol,ruta] of elegidos)for(const width of anchos)for(const dark of [false,true]){
  const p=await browser.newPage({viewport:{width,height:width>=1200?1400:1000}});
  p.on('pageerror',e=>errores.push(e.message));
  await p.route('**/*',async r=>{
    const u=new URL(r.request().url());if(u.hostname!=='ensayo.invalid')return r.abort();
    const f=path.resolve(raiz,'.'+u.pathname);if(!f.startsWith(raiz+path.sep))return r.abort();
    try{await r.fulfill({body:await readFile(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});}catch{await r.fulfill({status:404,body:''});}
  });
  await p.goto(`https://ensayo.invalid/scripts/ensayoIniciosAreas.html?rol=${encodeURIComponent(rol)}&ruta=${encodeURIComponent(ruta)}${dark?'&oscuro':''}${process.env.DASHBOARD_EXTENSO?'&extenso':''}`);
  const tablero=p.locator('.paleta-dashboard');await tablero.waitFor();
  await p.waitForFunction(()=>[...document.querySelectorAll('main [style]')].every(e=>Number(getComputedStyle(e).opacity)>=.99));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${nombre}/${width}: desborde`);
  // Contraste real del texto de tarjetas, tanto en reposo como al pasar el cursor.
  const cards=tablero.locator('.tablero-tarjeta,.reportes-tarjeta,.inicio-enlaces a');
  if(nombre==='reportes')assert.equal(await tablero.evaluate(e=>e.getBoundingClientRect().bottom>=[...e.querySelectorAll('.reportes-tarjeta')].at(-1).getBoundingClientRect().bottom),true,'El contenedor abarca todas sus tarjetas');
  for(const card of await cards.all()){
    for(const hover of [false,true]){
      if(hover){await card.hover();await p.waitForTimeout(180);}
      const colores=await card.evaluate(e=>{let n=e,fondo=getComputedStyle(n).backgroundColor;while((fondo==='transparent'||fondo==='rgba(0, 0, 0, 0)')&&n.parentElement){n=n.parentElement;fondo=getComputedStyle(n).backgroundColor;}return [...e.querySelectorAll('h2,h3,p')].map(t=>({texto:t.textContent,color:getComputedStyle(t).color,fondo}));});
      for(const c of colores)assert.ok(contraste(c.color,c.fondo)>=4.5,`${nombre}/${dark}/${hover}: ${c.texto}`);
    }
  }
  if(nombre.startsWith('financiero')||nombre==='caja'){
    assert.equal(await tablero.locator('.tablero-estadistica').count(),rol==='CAJERO'?0:4);
    assert.equal(await tablero.getByRole('button',{name:/Pagos y adeudos por alumno/}).count(),rol==='CAJERO'?0:1);
    assert.equal(await tablero.locator('.tablero-acceder').count(),2);
    assert.equal(await tablero.locator('.tablero-importar').count(),rol==='ADMINISTRADOR'?1:0);
    for(const icono of await tablero.locator('.tablero-icono').all()){
      const colores=await icono.evaluate(e=>({color:getComputedStyle(e).color,fondo:getComputedStyle(e).backgroundColor}));
      assert.ok(contraste(colores.color,colores.fondo)>=3,'Iconos legibles');
    }
    assert.equal(await tablero.locator('.tablero-estadistica-valor').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth)),true,'Importes sin desborde');
    assert.equal(await tablero.evaluate(e=>getComputedStyle(e).fontFamily===getComputedStyle(document.body).fontFamily),true,'Fuente de la aplicación conservada');
    const columnas=await tablero.locator('.tablero-operaciones-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
    assert.equal(columnas,width>=1200?2:1,'Operaciones adaptables');
    if(rol==='ADMINISTRADOR'){
      const importar=tablero.getByRole('button',{name:'Importar CSV',exact:true});
      for(const hover of [false,true]){
        if(hover){await importar.hover();await p.waitForTimeout(180);}
        const c=await importar.evaluate(e=>({color:getComputedStyle(e).color,fondo:getComputedStyle(e).backgroundColor}));
        assert.ok(contraste(c.color,c.fondo)>=4.5,'Importar CSV legible');
      }
      await importar.click();await p.getByRole('heading',{name:'Importar desde CSV',exact:true}).waitFor();
      const cobertura=await p.getByRole('heading',{name:'Importar desde CSV',exact:true}).evaluate(e=>{
        const r=e.closest('.fixed').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,w:innerWidth,h:innerHeight};
      });
      assert.ok(Math.abs(cobertura.x)<1&&Math.abs(cobertura.y)<1&&Math.abs(cobertura.width-cobertura.w)<1&&Math.abs(cobertura.height-cobertura.h)<1,'El importador cubre la ventana');
      await p.getByRole('button',{name:'Cancelar',exact:true}).click();
    }
    const operaciones=tablero.getByRole('button',{name:'Operaciones Financieras',exact:true});
    await operaciones.click();assert.equal(await operaciones.getAttribute('aria-expanded'),'false');
    await operaciones.click();await tablero.getByRole('button',{name:/Plan de Pagos/}).waitFor();
    const ciclo=tablero.getByRole('button',{name:'Ciclo del tablero',exact:true});
    await ciclo.click();await p.getByRole('option',{name:'2026-2 · Semestral',exact:true}).click();
    assert.match(await ciclo.textContent(),/2026-2/);
    await ciclo.click();await p.getByRole('option',{name:'2027-1 · Cuatrimestral',exact:true}).click();
    await operaciones.focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');assert.equal(await operaciones.evaluate(e=>e.matches(':focus-visible')&&getComputedStyle(e).outlineWidth==='2px'),true);
  }
  await tablero.locator('h1,h2').first().click();await p.mouse.move(0,0);await p.waitForTimeout(180);await p.screenshot({path:`.tmp-dashboard-capturas/${nombre}-${width}-${dark?'oscuro':'claro'}.png`,fullPage:true});
  if(nombre.startsWith('financiero')||nombre==='caja'){
    await tablero.getByRole('button',{name:rol==='CAJERO'?'Registrar Cobro':'Control de Ingresos',exact:false}).click();
    await p.getByRole('heading',{name:'Pantalla ficticia: /control-ingresos',exact:true}).waitFor();
  }
  await p.close();
}
assert.deepEqual(errores,[]);
console.log(`${elegidos.length*anchos.length*2} vistas (${elegidos.map(c=>c[0]).join(', ')}). Contraste normal/hover >=4.5:1, foco, selector, secciones y navegación. Sin red real.`);
}finally{await browser.close();}
