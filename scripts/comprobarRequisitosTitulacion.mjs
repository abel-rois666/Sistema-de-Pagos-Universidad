import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULO||'C:/Users/sopor/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM||'C:/Users/sopor/AppData/Local/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const raiz=path.resolve('.tmp-requisitos-dist'),errores=[];await mkdir('.tmp-requisitos-capturas',{recursive:true});
try{for(const ancho of [390,820,1440])for(const oscuro of [false,true]){
 const p=await browser.newPage({viewport:{width:ancho,height:1000}});p.on('pageerror',e=>errores.push(e.message));
 await p.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='ensayo.invalid')return r.abort();const f=path.resolve(raiz,'.'+decodeURI(u.pathname));if(!f.startsWith(raiz+path.sep))return r.abort();try{await r.fulfill({body:await readFile(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});}catch{await r.fulfill({status:404,body:''});}});
 await p.goto(`https://ensayo.invalid/scripts/ensayoRequisitosTitulacion.html?${oscuro?'oscuro':''}`);
 await p.getByRole('button',{name:'Iniciar Registro'}).click();
 await p.getByRole('button',{name:'— Sin modalidad asignada —',exact:true}).click();await p.getByRole('button',{name:'TESIS',exact:true}).click();
 const requisitos=p.getByRole('region',{name:'Requisitos de titulación',exact:true});
 const filaPromedio=requisitos.getByText('Promedio de 9.50 o superior',{exact:true});
 assert.equal(await filaPromedio.count(),0);
 await p.getByText('Para asentar el acta se requiere la fecha del examen profesional.',{exact:true}).waitFor();
 assert.equal(await requisitos.getByRole('button',{name:'Usar Alto Rendimiento Académico'}).count(),0);
 await p.getByRole('button',{name:'Usar Alto Rendimiento Académico'}).click();
 await filaPromedio.waitFor();
 await p.getByText('Para asentar el acta se requiere la fecha de exención de examen.',{exact:true}).waitFor();
 await p.getByRole('combobox',{name:/Plan de pagos que corresponde/}).selectOption('p1');
 await p.getByRole('combobox',{name:/Servicio social que corresponde/}).selectOption('s1');
 await p.getByText('2 de 2 conceptos liquidados.',{exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Sin desbordamiento en ${ancho}`);
 assert.equal(await p.getByRole('region',{name:'Requisitos de titulación',exact:true}).count(),1);
 assert.equal(await p.getByText('8 de 8 asignaturas aprobadas.',{exact:true}).count(),0);
 assert.equal(await p.getByText('2 de 2 asignaturas aprobadas.',{exact:true}).count(),1);
 assert.equal(await p.getByRole('region',{name:'Requisitos de titulación',exact:true}).getByText('Revisión manual',{exact:true}).count(),1);
 await p.getByRole('button',{name:'Guardar',exact:true}).click();
 await p.getByLabel('Motivo de este cambio').fill('Ensayo ficticio de requisitos');await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();
 await p.getByRole('button',{name:'Editar',exact:true}).waitFor();
 assert.equal(await p.getByRole('combobox',{name:/Plan de pagos que corresponde/}).count(),0);
 const respaldo=p.getByText('2027-1 · Semestral · FICTICIO-001 · LICENCIATURA CON NOMBRE EXTENSO PARA COMPROBAR EL SELECTOR',{exact:true});
 assert.equal(await respaldo.count(),1);assert.equal(await respaldo.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
 const payload=await p.evaluate(()=>window.ensayo.guardados[0].p_datos);
 assert.equal(payload.modalidad,'ALTO RENDIMIENTO ACADÉMICO');assert.equal(payload.promedio_alto_rendimiento,'APLICA');assert.equal(payload.plan_pago_requisito_id,'p1');assert.equal(payload.servicio_social_requisito_id,'s1');assert.equal(payload.pago_titulacion,'COMPLETADO');assert.equal(payload.certificado_estudios,'TRAMITADO');assert.equal(payload.ingles,'COMPLETADO');assert.equal(payload.servicio_social_req,'COMPLETADO');assert.equal(payload.fotografias,'PENDIENTES');assert.equal(payload.doc_curp,'SIN_INICIAR');assert.equal(payload.requisitos_verificados,undefined);
 await p.getByRole('button',{name:'Editar',exact:true}).click();await p.evaluate(()=>window.ensayo.promedio=9.49);await p.getByRole('button',{name:'Actualizar requisitos'}).click();
 await p.getByText('El promedio no alcanza 9.50. Revisa la modalidad antes de completar.').waitFor();assert.equal(await p.getByRole('button',{name:'ALTO RENDIMIENTO ACADÉMICO',exact:true}).count(),1);
 await p.screenshot({path:`.tmp-requisitos-capturas/requisitos-${ancho}-${oscuro?'oscuro':'claro'}.png`});
 await p.evaluate(()=>window.ensayo.error=true);await p.getByRole('button',{name:'Actualizar requisitos'}).click();await p.getByRole('alert').filter({hasText:'Error ficticio de comprobación'}).waitFor();assert.equal(await p.getByRole('button',{name:'Guardar',exact:true}).isDisabled(),true);
 await p.evaluate(()=>window.ensayo.error=false);await p.getByRole('button',{name:'Quitar selección de fuentes y volver a revisar'}).click();await p.getByText('Falta identificar el plan financiero que corresponde a esta carrera.',{exact:true}).waitFor();await p.getByRole('button',{name:'Guardar',exact:true}).waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Guardar'&&!b.disabled));assert.equal(await p.getByRole('button',{name:'Guardar',exact:true}).isEnabled(),true);
 await p.goto(`https://ensayo.invalid/scripts/ensayoRequisitosTitulacion.html?completada&${oscuro?'oscuro':''}`);
 await p.getByText('Estados guardados al completar el trámite.',{exact:false}).waitFor();
 await p.getByText('8 de 8 asignaturas aprobadas.',{exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Actualizar requisitos'}).count(),0);assert.equal(await p.getByText('9.54',{exact:true}).count(),1);assert.equal(await p.getByText('1 de 1 conceptos liquidados.',{exact:true}).count(),1);
 await p.goto(`https://ensayo.invalid/scripts/ensayoRequisitosTitulacion.html?especialidad&${oscuro?'oscuro':''}`);
 await p.getByRole('button',{name:'Iniciar Registro'}).click();await p.getByRole('button',{name:'— Sin modalidad asignada —',exact:true}).click();await p.getByRole('button',{name:'ALTO RENDIMIENTO ACADÉMICO',exact:true}).click();
 await p.getByText('Inglés y servicio social no se exigen para esta modalidad de Especialidad.',{exact:true}).waitFor();
 assert.equal(await p.getByRole('combobox',{name:/Servicio social que corresponde/}).count(),0);
 assert.equal(await p.getByText('Título Profesional',{exact:true}).count(),1);
 await p.getByRole('button',{name:'ALTO RENDIMIENTO ACADÉMICO',exact:true}).click();await p.getByRole('button',{name:'TESINA',exact:true}).click();
 await p.getByText('Para asentar el acta se requiere la fecha del examen profesional.',{exact:true}).waitFor();
 assert.equal(await filaPromedio.count(),0);assert.equal(await p.getByText('Cédula Profesional',{exact:true}).count(),1);
 assert.equal(await requisitos.getByText('Inglés',{exact:true}).count(),0);
 assert.equal(await p.getByRole('combobox',{name:/Servicio social que corresponde/}).count(),0);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.goto(`https://ensayo.invalid/scripts/ensayoRequisitosTitulacion.html?folios&${oscuro?'oscuro':''}`);
 const programa=p.getByRole('button',{name:'Programa de titulación',exact:true});
 const folio=p.getByRole('textbox',{name:'Folio de Control Oficial'});
 const elegirPrograma=async nombre=>{
  await programa.click();await p.getByRole('option',{name:nombre}).click();
  await p.getByRole('button',{name:'Editar',exact:true}).click();await folio.waitFor();
 };
 const guardarFolio=async()=>{
  await p.getByRole('button',{name:'Guardar',exact:true}).click();
  await p.getByLabel('Motivo de este cambio').fill('Ensayo ficticio de folio');
  await p.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await p.getByRole('button',{name:'Editar',exact:true}).waitFor();
 };
 await elegirPrograma(/PLAN HISTÓRICO/);
 await p.evaluate(()=>window.ensayo.promedio=9.49);
 await p.getByRole('button',{name:'Actualizar requisitos'}).click();
 await folio.waitFor();
 assert.equal(await filaPromedio.count(),0);
 await p.getByRole('button',{name:'TESIS',exact:true}).click();await p.getByRole('button',{name:'ALTO RENDIMIENTO ACADÉMICO',exact:true}).click();
 await p.getByText('El promedio no alcanza 9.50. Revisa la modalidad antes de completar.').waitFor();
 assert.equal(await p.getByRole('button',{name:'Asentar acta y titular'}).count(),0);
 await p.getByRole('button',{name:'ALTO RENDIMIENTO ACADÉMICO',exact:true}).click();await p.getByRole('button',{name:'TESIS',exact:true}).click();
 await p.getByRole('button',{name:'Asentar acta y titular'}).waitFor();
 assert.equal(await filaPromedio.count(),0);
 await p.getByLabel('Libro Oficial').fill('2');
 assert.equal(await folio.inputValue(),'FOLIO-HISTÓRICO');
 await folio.fill('');await guardarFolio();
 await elegirPrograma(/PLAN VIGENTE/);
 assert.equal(await folio.inputValue(),'ME-001-0040');
 await p.getByLabel('Foja Oficial').fill('50');assert.equal(await folio.inputValue(),'ME-001-0050');
 await guardarFolio();
 await elegirPrograma(/PLAN SIN CARRERA/);
 assert.equal(await folio.inputValue(),'');
 await p.getByText(/Falta la carrera o el nivel educativo del programa/).waitFor();
 await guardarFolio();
 await p.getByRole('button',{name:'Editar',exact:true}).click();
 await folio.fill('MANUAL-001-0040');await guardarFolio();
 const folios=await p.evaluate(()=>window.ensayo.guardados.map(x=>[x.p_programa,x.p_datos.folio_control]));
 assert.deepEqual(folios,[['pr','LD-002-0040'],['pos','ME-001-0050'],['sin',null],['sin','MANUAL-001-0040']]);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.goto(`https://ensayo.invalid/scripts/ensayoRequisitosTitulacion.html?acta&${oscuro?'oscuro':''}`);
 await p.getByText('9 de 9 requisitos cubiertos para esta modalidad',{exact:true}).waitFor();
 assert.equal(await p.getByRole('navigation',{name:'Secciones de titulación'}).count(),0);
 const modalidad=p.getByRole('region',{name:'Modalidad de titulación',exact:true});
 const acta=p.getByRole('region',{name:'Acta oficial',exact:true});
 const cabeceras=await Promise.all([modalidad,requisitos,acta].map(seccion=>seccion.locator(':scope > header').evaluate(e=>({
  fondo:getComputedStyle(e).backgroundColor,
  rect:e.getBoundingClientRect().toJSON(),
 }))));
 for (const cabecera of cabeceras.slice(1)) {
  assert.equal(cabecera.fondo,cabeceras[0].fondo);
  assert.equal(cabecera.rect.left,cabeceras[0].rect.left);
  assert.equal(cabecera.rect.width,cabeceras[0].rect.width);
 }
 assert.ok(cabeceras[0].rect.bottom<cabeceras[1].rect.top && cabeceras[1].rect.bottom<cabeceras[2].rect.top);
 const geometria=await p.evaluate(()=>{
  const estadoAutomatico=document.querySelector('dl[aria-label="Comprobación automática"] dd');
  const estadoManual=document.querySelector('dl[aria-label="Revisión manual"] dd');
  const fila=estadoAutomatico.parentElement;
  return {posiciones:[estadoAutomatico,estadoManual].map(e=>e.getBoundingClientRect().left),columnas:getComputedStyle(fila).gridTemplateColumns.split(' ').length};
 });
 assert.equal(geometria.columnas,ancho===390?2:3);
 const columnas=requisitos.locator('.titulacion-columnas');
 assert.equal(await columnas.isVisible(),ancho>390);
 if(ancho>390){
  assert.equal(geometria.posiciones[0],geometria.posiciones[1]);
  const tipografia=await columnas.evaluate(e=>{
   const estilo=getComputedStyle(e);
   const lienzo=document.createElement('canvas');
   lienzo.width=lienzo.height=1;
   const contexto=lienzo.getContext('2d');
   const luminancia=color=>{
    contexto.fillStyle=color;
    contexto.fillRect(0,0,1,1);
    const canales=Array.from(contexto.getImageData(0,0,1,1).data.slice(0,3),valor=>valor/255);
    return canales.map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4)
     .reduce((suma,c,i)=>suma+c*[0.2126,0.7152,0.0722][i],0);
   };
   const luces=[luminancia(estilo.color),luminancia(estilo.backgroundColor)];
   const fila=e.parentElement.querySelector('dl dt');
   return {
    contraste:(Math.max(...luces)+0.05)/(Math.min(...luces)+0.05),
    tamano:parseFloat(estilo.fontSize),
    tamanoFila:parseFloat(getComputedStyle(fila).fontSize),
    peso:parseInt(estilo.fontWeight,10),
    estado:e.children[1].getBoundingClientRect().left,
   };
  });
  assert.ok(tipografia.contraste>=4.5 && tipografia.tamano>tipografia.tamanoFila && tipografia.peso>=700);
  assert.equal(tipografia.estado,geometria.posiciones[0]);
 }
 await p.screenshot({path:`.tmp-requisitos-capturas/ficha-${ancho}-${oscuro?'oscuro':'claro'}.png`});
 const finalizar=acta.getByRole('button',{name:'Asentar acta y titular'});
 await acta.getByText('Captura pendiente',{exact:true}).waitFor();
 assert.equal(await finalizar.isDisabled(),true);
 await acta.getByRole('button',{name:'Editar datos del acta'}).click();
 const fechaActa=p.getByLabel('Fecha de exención de examen',{exact:true});
 await p.waitForFunction(()=>document.activeElement?.matches('input[type="date"][aria-required="true"]'));
 await fechaActa.fill('2026-11-19');
 const curp=p.getByRole('combobox',{name:'Estado de CURP'});
 await curp.selectOption('RECHAZADO');
 await p.getByLabel('Motivo del rechazo').fill('Documento de prueba');
 await p.getByText('8 de 9 requisitos cubiertos para esta modalidad',{exact:true}).waitFor();
 assert.equal(await finalizar.count(),0);
 await curp.selectOption('APROBADO');
 await acta.getByText('Lista para confirmar',{exact:true}).waitFor();
 assert.equal(await fechaActa.inputValue(),'2026-11-19');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.screenshot({path:`.tmp-requisitos-capturas/acta-${ancho}-${oscuro?'oscuro':'claro'}.png`});
 await finalizar.click();
 const confirmar=p.getByRole('dialog',{name:'Completar trámite de titulación'});
 await confirmar.getByText('LD-001-0040',{exact:true}).waitFor();
 await confirmar.getByText('19/11/2026',{exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>window.ensayo.guardados.length),0);
 await confirmar.getByLabel('Motivo de este cambio').fill('Acta revisada en el ensayo');
 await confirmar.getByRole('button',{name:'Asentar acta y completar'}).click();
 await acta.getByText('Acta registrada',{exact:true}).waitFor();
 const cierre=await p.evaluate(()=>window.ensayo.guardados[0]);
 assert.equal(cierre.p_accion,'COMPLETAR');assert.equal(cierre.p_programa,'pr');
 assert.equal(cierre.p_datos.fecha_exencion,'2026-11-19');assert.equal(cierre.p_datos.fecha_examen,null);
 await p.close();
}assert.deepEqual(errores,[]);console.log('Titulación: cabeceras uniformes, contraste y cuadrícula adaptable, revisión documental, foco, folios por programa y confirmación auditada. 390/820/1440 y ambos temas, sin red real.');}finally{await browser.close();}
