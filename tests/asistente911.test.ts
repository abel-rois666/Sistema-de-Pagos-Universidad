import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GUIA_VERSION911,aplicarPertinencia911,conflictoPertinencia911,datosComunes911,erroresOferta911,instanciaAplica911,motivoNoPertinente911,nombreOferta911,ordenarCiclos911} from '../src/estadistica911/guia';
import {nivelPlan911} from '../src/estadistica911/guia';
import {aplicarInferencias911,validarLoteIngreso911,type CandidatoIngreso911} from '../src/estadistica911/ingreso';
import {CONFIG_INICIAL911,type Expediente911,type Instancia911} from '../src/estadistica911/types';
import {pendientesReglas911} from '../src/estadistica911/reglas';
import {generarTxt911} from '../src/estadistica911/exportar';

const instancia=(id='carrera-1'):Instancia911=>({id,cuestionario:'carrera',identidad:{CV_CARRERA:'5033100011',CV_MODALIDAD:'1'},respuestas:{},bloques:{},correspondencia:{planes:['plan-lic'],confirmada:true,nivel:'LICENCIATURA'}});
const expediente=():Expediente911=>({id:'exp',nombre:'Ficticio',estado:'BORRADOR',revision:1,version:1,config:{...CONFIG_INICIAL911,guiaVersion:GUIA_VERSION911,ofertaConfirmada:true},catalogoHash:'ficticio',instancias:[instancia()],incidencias:[],revisiones:{}});
const candidato=(id='ap'):CandidatoIngreso911=>({alumno_programa_id:id,alumno_id:'al',matricula:'PRUEBA',nombre:'Alumno ficticio',plan_id:'plan',programa:'Plan de prueba',grado:'2',fuente_id:null,actualizado_en:null,desde:'',hasta:null,evidencia:'',tipo_ingreso:'DESCONOCIDO',fecha_primer_ingreso:'',ingreso_procedencia:{}});

test('todos los selectores usan orden descendente numérico sin perder ciclos homónimos',()=>{
 const c=[{id:'1',nombre:'2026-3',tipo:'Cuatrimestral'},{id:'2',nombre:'2027-1',tipo:'Semestral'},{id:'3',nombre:'2027-1',tipo:'Cuatrimestral'},{id:'4',nombre:'2026-10',tipo:'Otro'}];
 assert.deepEqual(ordenarCiclos911(c).map(x=>x.id),['3','2','4','1']);assert.equal(c[0].id,'1');
});
test('los nombres oficiales y la pertinencia distinguen oferta y formación docente',()=>{
 const e=expediente(),escuela={...instancia('escuela-1'),cuestionario:'escuela' as const};e.instancias.push(escuela);
 assert.equal(nombreOferta911(e.instancias[0]),'LICENCIATURA EN DERECHO');
 assert.ok(motivoNoPertinente911(e,escuela,'V224')); // matrícula doctorado
 assert.equal(motivoNoPertinente911(e,escuela,'V46'),null); // docentes con doctorado
 assert.equal(motivoNoPertinente911(e,escuela,'V761'),null); // doctorado que imparte licenciatura
 e.config.ofertaConfirmada=false;assert.equal(motivoNoPertinente911(e,escuela,'V224'),null);
});
test('no pertinente conserva cero y detecta declaraciones previas que contradicen el perfil',()=>{
 const e=expediente(),escuela={...instancia('escuela-1'),cuestionario:'escuela' as const};e.instancias.push(escuela);
 escuela.respuestas.V224={calculado:4,declarado:4,justificacion:'Histórico por revisar',evidencia:'Acta',origen:'Captura'};
 const r=aplicarPertinencia911(e,e.instancias),i=r[1];
 assert.equal(i.respuestas.V224.calculado,0);assert.equal(i.respuestas.V224.declarado,4);assert.equal(i.respuestas.V224.revisada,false);
 assert.equal(conflictoPertinencia911({...e,instancias:r},i,'V224'),true);
 assert.equal(i.respuestas.V213.calculado,0);assert.equal(i.respuestas.V213.revisada,true);
 assert.equal(escuela.respuestas.V224.calculado,4);
});
test('la exclusión exige explicación y no arrastra sus reglas al cierre',()=>{
 const e=expediente();e.instancias[0].correspondencia.aplica='NO_APLICA';
 assert.ok(erroresOferta911(e).length);assert.equal(instanciaAplica911(e.instancias[0]),false);
 e.instancias[0].correspondencia.motivoNoAplica='Oferta sin actividad actual ni resultados históricos';e.instancias[0].correspondencia.evidenciaNoAplica='Acta de revisión';
 assert.deepEqual(erroresOferta911(e),[]);
 assert.deepEqual(pendientesReglas911(e,[{cuestionario:'carrera',variable:'V1',expresion:'V1=1',mensaje:'Falta',tipo:'VALIDACION',linea:1,seccion:'I',pregunta:'1'}]),[]);
});
test('el domicilio común preserva vacíos, ámbito institucional y evidencia',()=>{
 const e=expediente();e.config.domicilioPlantel={municipio:'Benito Juárez',localidad:'Ciudad de México',vialidad:'',exterior:'',evidencia:'Documento institucional'};
 e.instancias.push({...instancia('institucion-1'),cuestionario:'institucion'});
 e.instancias[0].respuestas.C_NOM_VIALIDAD={calculado:null,declarado:'Calle anterior',origen:'Manual'};
 const fuentes:any={carrera:{campos:[{codigo:'C_NOM_MUN'},{codigo:'C_NOM_LOC'},{codigo:'C_NOM_VIALIDAD'}]}};
 const n=datosComunes911(e,fuentes);assert.equal(n.instancias[0].respuestas.C_NOM_MUN.declarado,'Benito Juárez');
 assert.equal(n.instancias[0].respuestas.C_NOM_VIALIDAD.declarado,'Calle anterior');assert.equal(n.instancias[1].respuestas.C_NOM_MUN,undefined);
});
test('inferencias revisadas conservan fechas previas y tipos elegidos; no mezclan seleccionados',()=>{
 const a={...candidato('a'),propuesta:{alumno_programa_id:'a',estado:'PROPUESTA' as const,ciclo_id:'viejo',ciclo:'2025-1',fecha:'2024-09-30',registros:8}},b={...candidato('b'),fecha_primer_ingreso:'2024-08-20',tipo_ingreso:'REINGRESO' as const,propuesta:{...a.propuesta,alumno_programa_id:'b'}};
 const n=aplicarInferencias911([a,b],['a','b'],'actual');assert.equal(n[0].fecha_primer_ingreso,'2024-09-30');assert.equal(n[0].tipo_ingreso,'REINGRESO');assert.equal(n[1].fecha_primer_ingreso,'2024-08-20');
 assert.equal(aplicarInferencias911([a,b],['b'],'actual',true)[0].fecha_primer_ingreso,'');
 assert.equal(aplicarInferencias911([{...a,propuesta:{...a.propuesta,estado:'AMBIGUA'}}],['a'],'actual')[0].fecha_primer_ingreso,'');
});
test('el lote explica requisitos y no necesita fecha histórica en reingresos',()=>{
 const f={...candidato(),tipo_ingreso:'REINGRESO' as const};assert.ok(validarLoteIngreso911([f],['ap'],'','','').length>=2);
 assert.deepEqual(validarLoteIngreso911([f],['ap'],'2026-09-20','','Lista acreditada'),[]);
 assert.ok(validarLoteIngreso911([{...f,tipo_ingreso:'PRIMER_INGRESO'}],['ap'],'2026-09-20','','Acta').some(x=>x.includes('primer ingreso')));
});
test('la guía no altera el layout TXT e incluye opciones homologadas',()=>{
 const guia=JSON.parse(readFileSync('public/911/2026-2027/guia-captura-v1.json','utf8'));
 assert.equal(guia.campos.carrera.V1.opcion.grupo[1].codigo,'V3');assert.equal(guia.campos.tecnologia.V1.opcion.pareja,'V2');
 const fuente=JSON.parse(readFileSync('public/911/2026-2027/carrera.json','utf8'));
 const i={...instancia(),identidad:fuente.layout.identidades[0]};
 const txt=generarTxt911([i],fuente);assert.equal(txt.split('\r\n')[0],fuente.layout.encabezado.join('|')+'|');
});

test('el filtro de planes usa el nivel del catálogo de carreras y no adivina desde el nombre',()=>{
 assert.equal(nivelPlan911({nombre:'Maestría en nombre histórico',carrera:{nivel_educativo:'Licenciatura'}}),'LICENCIATURA');
 assert.equal(nivelPlan911({carrera:{nivel_educativo:'Maestría'}}),'MAESTRIA');
 assert.equal(nivelPlan911({nombre:'Plan sin metadatos'}),'');
});

test('SQL y cliente comparten exactamente los criterios de pertinencia homologados',()=>{
 const fuente=JSON.parse(readFileSync('src/estadistica911/criterios911.json','utf8'));
 const sql=readFileSync('supabase/migrations/20261027100000_asistente_pertinencia_911.sql','utf8');
 const literal=sql.split('$criterios911$')[1];
 assert.deepEqual(JSON.parse(literal),fuente);
 assert.equal(fuente.version,GUIA_VERSION911);
});
