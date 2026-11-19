import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {altoRendimiento,aplicarRequisitos,verificarRespuestaRequisitos,type RequisitosTitulacion} from '../src/titulacion/requisitos';
test('9.50 cumple, sin redondear notas inferiores ni aprobar historiales incompletos',()=>{
 assert.equal(altoRendimiento(9.49,2,2),'NO_APLICA');assert.equal(altoRendimiento(9.50,2,2),'APLICA');assert.equal(altoRendimiento(9.51,2,2),'APLICA');assert.equal(altoRendimiento(9.499,2,2),'NO_APLICA');
 for(const [nota,total,con] of [[null,2,2],[10,2,1],[10,0,0]] as const)assert.equal(altoRendimiento(nota,total,con),'SIN_INICIAR');
});
test('aplicar requisitos conserva documentos, notas, modalidad y acta; no altera el original',()=>{
 const d={certificado_estudios:'SIN_INICIAR',ingles:'SIN_INICIAR',servicio_social_req:'SIN_INICIAR',pago_titulacion:'SIN_INICIAR',promedio_alto_rendimiento:'SIN_INICIAR',modalidad:'TESIS',libro:1,doc_curp_nota:'Revisado'} as const;
 const r={estados:{...d,ingles:'COMPLETADO'},plan_pago_id:'p',servicio_social_id:'s'} as unknown as RequisitosTitulacion;
 const result=aplicarRequisitos(d,r);assert.equal(result.ingles,'COMPLETADO');assert.equal(result.modalidad,'TESIS');assert.equal(result.doc_curp_nota,'Revisado');assert.equal(d.ingles,'SIN_INICIAR');
});
test('un error o respuesta incompleta no se convierte en requisito cubierto',()=>{
 assert.throws(()=>verificarRespuestaRequisitos(null),/incompleta/);
 assert.throws(()=>verificarRespuestaRequisitos({estados:{},plan_id:'p',criterio_promedio:'>9.50'}),/incompleta/);
});
test('SQL protege la fuente por alumno/programa, certificado total, mínimo y unicidad',()=>{
 const sql=readFileSync('supabase/migrations/20261118150000_requisitos_titulacion_por_programa.sql','utf8');
 for(const texto of ["tipo_certificado='TOTAL'",'media>=9.50',"pago_titulacion='COMPLETADO'",'h.alumno_id=p_alumno and h.asignatura_id=a.id','titulacion_pago_un_programa','titulacion_ss_un_programa',"pago_estado=case when total=pagados",'r.estatus=\'ACTIVO\'','v.anulado_en is null','md5(btrim','n.requisitos_verificados=verificados'])assert.ok(sql.includes(texto),texto);
 assert.doesNotMatch(sql,/update public\.(recibos|planes_pago|servicio_social|alumnos) set/i);
 assert.ok(sql.includes("'plan_pago_requisito_id','servicio_social_requisito_id') then"));
});
