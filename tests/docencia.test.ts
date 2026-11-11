import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contextoDocenteFicticio,DOCENTE_FICTICIO as docente,ASIGNATURA_FICTICIA as asignatura } from './fixtures/docencia';
import { adaptarPublicacionDocente } from '../src/docencia/publicacion';
import { calcularPagoDocente,importeCentavos,periodosPagoDocencia,repartirCentavos,sugerirCortes,validarCortes } from '../src/docencia/calculoPago';
import { entregaInicial,marcarEntregasVisibles,validarEntregas,validarCarpetaAsignatura } from '../src/docencia/entregas';
const adaptar=(c:ReturnType<typeof contextoDocenteFicticio>)=>adaptarPublicacionDocente(c,docente,'Docente ficticio');
const calcular=(c:ReturnType<typeof contextoDocenteFicticio>)=>calcularPagoDocente(c,adaptar(c));
test('docencia: 14 semanas por 15 horas a 61 producen 12810 y siete cuotas de 1830',()=>{
 const c=contextoDocenteFicticio();c.financiero!.general.cortes=sugerirCortes(c.ciclo.fecha_inicio!,c.ciclo.fecha_termino!,7);const r=calcular(c);
 assert.equal(r.horasCiclo,210);assert.equal(r.totalCentavos,1281000);assert.equal(r.horasPromedioSemana,15);assert.equal(r.cuotas.length,7);assert.deepEqual(r.cuotas.map(x=>x.importeCentavos),Array(7).fill(183000));assert.deepEqual(r.avisos,[]);
});
test('docencia: inhábiles solapados se excluyen una vez antes de repartir; ordinarios cuentan como clase',()=>{
 const c=contextoDocenteFicticio();c.eventos=[{id:'1',calendario_id:'cal',nombre:'Festivo',tipo:'FESTIVO',fecha_inicio:'2026-10-05',fecha_fin:'2026-10-05',color:'',suspende_clases:true},{id:'2',calendario_id:'cal',nombre:'Vacación',tipo:'VACACIONES',fecha_inicio:'2026-10-05',fecha_fin:'2026-10-06',color:'',suspende_clases:true},{id:'3',calendario_id:'cal',nombre:'Ordinarios',tipo:'ORDINARIOS',fecha_inicio:'2026-10-07',fecha_fin:'2026-10-07',color:'',suspende_clases:false}];
 c.financiero!.general.cortes=sugerirCortes(c.ciclo.fecha_inicio!,c.ciclo.fecha_termino!,7);const r=calcular(c);assert.equal(r.horasCiclo,204);assert.equal(r.horasNoLectivas,6);assert.equal(r.totalCentavos,204*6100);assert.equal(r.cuotas.reduce((n,c)=>n+c.importeCentavos,0),r.totalCentavos);
});
test('docencia: semestre usa 16 semanas de referencia y ocho quincenas; no toma ciclos homónimos',()=>{
 const c=contextoDocenteFicticio();c.ciclo.tipo_periodo='Semestral';c.calendarios[0].fecha_fin='2027-01-24';c.ciclo.fecha_termino='2027-01-24';c.financiero!.general.cortes=sugerirCortes(c.ciclo.fecha_inicio!,c.ciclo.fecha_termino!,8);const r=calcular(c);assert.equal(r.horasCiclo,240);assert.equal(r.horasPromedioSemana,15);assert.equal(r.cuotas.length,8);
 c.calendarios[0].ciclo_id='otro-id-mismo-nombre';assert.equal(calcular(c).totalCentavos,null);
});
test('docencia: asíncronas nunca se pagan; en línea se paga solo en modalidad MIXTA independiente del turno',()=>{
 const c=contextoDocenteFicticio();c.cargas[0].horas_asincronas=5;c.sesiones[0].medio='EN_LINEA';c.cargas[0].asignatura!.planes_estudio!.modalidad='MIXTA';c.calendarios[0].modalidad='MIXTA';const r=calcular(c);assert.equal(r.enLineaSemana,3);assert.equal(r.asincronasSemana,5);assert.equal(r.horasCiclo,210);
 c.cargas[0].asignatura!.planes_estudio!.modalidad='ESCOLARIZADA';c.calendarios[0].modalidad='ESCOLARIZADA';assert.equal(calcular(c).enLineaSemana,0);
 c.cargas[0].grupo_turno='MIXTO';c.calendarios[0].turnos=['MIXTO'];c.sesiones=[{carga_id:'carga',dia_semana:6,hora_inicio:7,hora_fin:10,medio:'PRESENCIAL'}];assert.equal(calcular(c).horasCiclo,42);
});
test('docencia: faltantes, calendarios ambiguos y empalmes no dan importe parcial ni cero',()=>{
 for(const modo of ['falta','ambiguo','empalme']){const c=contextoDocenteFicticio();if(modo==='falta')c.calendarios=[];if(modo==='ambiguo')c.calendarios.push({...c.calendarios[0],id:'otro'});if(modo==='empalme')c.sesiones.push({...c.sesiones[0]});const r=calcular(c);assert.equal(r.totalCentavos,null);assert.equal(r.horasCiclo,null);assert.ok(r.avisos.length);}
});
test('docencia: cargas sin sesiones y calendarios inválidos quedan pendientes; no inventa horas',()=>{
 const c=contextoDocenteFicticio();c.sesiones=[];assert.equal(calcular(c).horasCiclo,null);c.sesiones=contextoDocenteFicticio().sesiones;c.calendarios[0].fecha_fin='2026-02-31';assert.equal(calcular(c).totalCentavos,null);
});
test('docencia: tarifa cero explícita vence a general; ausente no se convierte en cero; ACA no recibe importe',()=>{
 const c=contextoDocenteFicticio();c.financiero!.excepcion.monto=0;assert.equal(calcular(c).totalCentavos,0);c.financiero!.excepcion.monto=null;c.financiero!.general.monto=null;assert.equal(calcular(c).totalCentavos,null);c.financiero=null;assert.equal(calcular(c).horasCiclo,210);assert.equal(calcular(c).totalCentavos,null);
});
test('docencia: centavos, cortes consecutivos, cobertura, años bisiestos y fechas personalizadas',()=>{
 assert.deepEqual(repartirCentavos(100,7),[14,14,14,14,14,14,16]);assert.equal(importeCentavos('61.05'),6105);for(const v of ['NaN','-1','1e3','61.001'])assert.throws(()=>importeCentavos(v));
 assert.equal(validarCortes([{inicio:'2024-02-01',fin:'2024-02-29'},{inicio:'2024-03-01',fin:'2024-03-20'}],2,'2024-02-01','2024-03-20'),'');
 assert.ok(validarCortes([{inicio:'2024-02-01',fin:'2024-02-28'},{inicio:'2024-03-01',fin:'2024-03-20'}],2));assert.ok(validarCortes([{inicio:'2024-02-01',fin:'2024-02-29'}],1,'2024-02-01','2024-03-20'));assert.equal(periodosPagoDocencia('Titulación'),null);
});
test('docencia: agrupa asignatura por ID entre grupos, no por nombre; publicación ajena o dañada se rechaza',()=>{
 const c=contextoDocenteFicticio();c.cargas.push({...c.cargas[0],id:'c2',grupo_id:'grupo2',grupo_codigo:'2-ADM'});assert.equal(adaptar(c).materias.length,1);assert.equal(adaptar(c).materias[0].grupos.length,2);c.cargas[1].asignatura_id='otra';assert.equal(adaptar(c).materias.length,2);c.cargas[1].docente_id='ajeno';assert.throws(()=>adaptar(c));
});
test('docencia: checklist visible conserva ocultos, valida requisitos y acepta carpeta HTTPS de Drive',()=>{
 const e=entregaInicial(asignatura),otro=entregaInicial('otra'),materia=adaptar(contextoDocenteFicticio()).materias;const marcados=marcarEntregasVisibles([e,otro],materia,true);assert.equal(marcados[0].entregados.length,6);assert.equal(marcados[1].entregados.length,0);assert.equal(validarEntregas(marcados),'');assert.ok(validarEntregas([{...e,examenes:[]}]));assert.ok(validarEntregas([{...e,entregados:['EXTRA']}]));assert.equal(validarCarpetaAsignatura('https://drive.google.com/drive/folders/ficticio'),'');assert.ok(validarCarpetaAsignatura('https://drive.google.com.ejemplo.org/'));
});
test('SQL preparado: acceso privado por RPC, revisiones, ID exacto, auditoría y ninguna escritura financiera',()=>{
 const banco=readFileSync('supabase/migrations/20261111100000_datos_pago_personal.sql','utf8'),doc=readFileSync('supabase/migrations/20261111110000_expedientes_y_tarifas_docencia.sql','utf8');assert.match(banco,/enable row level security/);assert.match(banco,/rol not in \('ADMINISTRADOR','COORDINADOR RECURSOS HUMANOS'\)/);assert.match(banco,/right\(v,4\)/);assert.match(banco,/coalesce\(anterior.revision,0\)<>p_revision/);assert.match(doc,/c.docente_id=p_docente/);assert.match(doc,/estado='publicado'/);assert.match(doc,/h is distinct from p_horario/);assert.match(doc,/pg_advisory_xact_lock/);assert.match(doc,/No elimina entregas/);assert.doesNotMatch(doc,/\b(?:update|insert into|delete from) public\.(?:recibos|monedero|horarios_)/i);
});
