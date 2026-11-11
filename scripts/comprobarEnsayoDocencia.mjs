// Requiere compilar scripts/ensayoDocencia.html. Solo archivos locales y respuestas ficticias.
import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULO||'C:/Users/sopor/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const raiz=path.resolve('.tmp-docencia-dist'),capturas=path.resolve('.tmp-docencia-capturas');await mkdir(capturas,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:/Users/sopor/AppData/Local/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const errores=[];
async function pagina(ancho=1440,oscuro=false,parametros=''){
 const page=await browser.newPage({viewport:{width:ancho,height:1000}});
 page.on('pageerror',e=>errores.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='ensayo.invalid')return route.abort();const archivo=path.resolve(raiz,'.'+decodeURIComponent(u.pathname));if(!archivo.startsWith(raiz+path.sep))return route.abort();try{const body=await readFile(archivo);await route.fulfill({body,contentType:archivo.endsWith('.js')?'text/javascript':archivo.endsWith('.css')?'text/css':'text/html'});}catch{return route.fulfill({status:404,body:''});}});
 await page.goto(`https://ensayo.invalid/scripts/ensayoDocencia.html?${oscuro?'oscuro&':''}${parametros}`);
 await page.getByRole('dialog',{name:'Ficha de personal',exact:true}).waitFor();return page;
}
try{
 for(const ancho of [390,820,1440])for(const oscuro of [false,true]){
  const page=await pagina(ancho,oscuro);
  await page.getByRole('button',{name:/Expediente de asignatura Entregas/}).click();
  await page.getByRole('button',{name:'Marcar documentos visibles'}).click();
  await page.getByRole('button',{name:'Actualizar consulta',exact:true}).click();
  await page.getByRole('button',{name:'Continuar editando',exact:true}).click();
  await page.getByLabel('Motivo del registro o corrección *',{exact:true}).fill('Revisión ficticia de entregas');
  await page.getByRole('button',{name:'Guardar entregas del ciclo'}).click();
  await page.getByText('6/6 entregados',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.personal-scroll').evaluate(e=>e.scrollTop=0);
  await page.screenshot({path:path.join(capturas,`expediente-${ancho}-${oscuro?'oscuro':'claro'}.png`)});
  await page.getByRole('button',{name:'← Volver a Docencia'}).click();
  await page.getByRole('button',{name:/Materias asignadas por ciclo escolar Horario/}).click();
  await page.getByText('$12,810.00',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(capturas,`materias-${ancho}-${oscuro?'oscuro':'claro'}.png`)});
  await page.getByRole('button',{name:'Tarifa de este docente',exact:true}).click();
  await page.getByLabel('Tarifa por hora (MXN, opcional)',{exact:true}).fill('70');
  await page.getByLabel('Motivo del cambio *',{exact:true}).fill('Tarifa ficticia revisada');
  await page.getByRole('button',{name:'Revisar y guardar'}).click();
  await page.getByRole('button',{name:'Guardar configuración',exact:true}).click();
  await page.getByText('$14,700.00',{exact:true}).waitFor();
  await page.close();
 }
 const banco=await pagina(820,true,'seccion=laborales');
 await banco.getByRole('button',{name:'Editar datos privados'}).click();
 await banco.getByLabel('NSS (opcional)',{exact:true}).fill('123');
 await banco.getByLabel('Motivo del registro o corrección *',{exact:true}).fill('Registro ficticio');
 await banco.getByRole('button',{name:'Guardar datos privados'}).click();
 await banco.getByText('NSS: debe contener exactamente 11 dígitos.',{exact:true}).waitFor();
 assert.equal((await banco.evaluate(()=>window.ensayoDocencia.historial)).filter(x=>x.funcion==='personal_pago_guardar_v1').length,0);
 await banco.getByLabel('NSS (opcional)',{exact:true}).fill('00123456789');
 await banco.getByRole('checkbox',{name:'Número de cuenta',exact:true}).check();
 await banco.getByLabel('Número de cuenta (opcional)',{exact:true}).fill('00123456789');
 await banco.evaluate(()=>window.ensayoDocencia.conflicto=true);
 await banco.getByRole('button',{name:'Guardar datos privados'}).click();
 await banco.getByText(/La revisión cambió.*La captura se conserva/).waitFor();
 assert.equal(await banco.getByLabel('Número de cuenta (opcional)',{exact:true}).inputValue(),'00123456789');
 await banco.evaluate(()=>window.ensayoDocencia.conflicto=false);
 await banco.getByRole('button',{name:'Guardar datos privados'}).click();await banco.getByRole('button',{name:'Mostrar datos'}).waitFor();
 await banco.screenshot({path:path.join(capturas,'banco-oscuro.png')});await banco.close();
 const cortes=await pagina(390,true);await cortes.getByRole('button',{name:/Materias asignadas por ciclo escolar Horario/}).click();
 await cortes.getByRole('button',{name:'Configurar todo el ciclo'}).click();
 await cortes.getByLabel('Hasta',{exact:true}).first().fill('2026-10-20');
 await cortes.getByLabel('Motivo del cambio *',{exact:true}).fill('Corte ficticio revisado');
 await cortes.getByRole('button',{name:'Cancelar configuración',exact:true}).click();await cortes.getByRole('button',{name:'Continuar editando',exact:true}).click();
 assert.equal(await cortes.getByLabel('Hasta',{exact:true}).first().inputValue(),'2026-10-20');
 await cortes.getByLabel('Hasta',{exact:true}).first().scrollIntoViewIfNeeded();await cortes.screenshot({path:path.join(capturas,'cortes-movil-oscuro.png')});
 await cortes.getByRole('button',{name:'Revisar y guardar'}).click();await cortes.getByRole('button',{name:'Guardar configuración',exact:true}).click();await cortes.getByRole('cell',{name:'05/10/2026 – 20/10/2026',exact:true}).waitFor();
 assert.equal(await cortes.getByText('$12,810.00',{exact:true}).count(),1);await cortes.close();
 const sincal=await pagina(390,true,'sincalendario');await sincal.getByRole('button',{name:/Materias asignadas por ciclo escolar Horario/}).click();await sincal.getByText(/falta el calendario de su plan/).waitFor();assert.equal(await sincal.getByText('$12,810.00',{exact:true}).count(),0);await sincal.close();
 const sinasig=await pagina(390,false,'sinasignacion');await sinasig.getByRole('button',{name:/Expediente de asignatura Entregas/}).click();await sinasig.getByRole('heading',{name:'Sin materias publicadas para este docente'}).waitFor();assert.equal(await sinasig.getByRole('button',{name:'Guardar entregas del ciclo'}).count(),0);await sinasig.close();
 const aca=await pagina(820,true,'rol=COORDINADOR%20ACADEMICO');await aca.getByRole('button',{name:/Materias asignadas por ciclo escolar Horario/}).click();await aca.getByText('210 h',{exact:true}).waitFor();assert.equal(await aca.getByText('Importe neto estimado del ciclo',{exact:true}).count(),0);assert.equal(await aca.getByRole('button',{name:'Configurar todo el ciclo'}).count(),0);assert.equal((await aca.evaluate(()=>window.ensayoDocencia.historial)).filter(x=>x.funcion==='personal_pago_consultar_v1').length,0);await aca.close();
 assert.deepEqual(errores,[]);console.log('Ensayo aprobado: 390/820/1440, ambos temas, entregas, tarifa, NSS, conflicto, faltantes y permisos. Sin red real ni SQL.');
}finally{await browser.close();}
