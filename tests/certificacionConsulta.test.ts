import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararAsociacionCertificacion, resolverVistaCertificacion } from '../src/certificacion/consulta';
import type { AlumnoPrograma, FichaCertificacion } from '../src/types';

const anterior = { id: 'ficha-anterior', alumno_id: 'alumno', alumno_programa_id: null,
  pago_certificado: 'EN_CURSO', tipo_certificado: 'TOTAL', doc_curp: 'APROBADO',
  fecha_inicio_tramite: '2026-09-01', enlace_drive: 'https://example.test/expediente', revision: 1 } as FichaCertificacion;

test('al reabrir el acceso anterior muestra la ficha asociada sin perder su información', () => {
  const guardada = { ...anterior, alumno_programa_id: 'programa', revision: 2 };
  const vista = resolverVistaCertificacion([guardada], 'programa', true);
  assert.equal(vista.ficha, guardada);
  assert.equal(vista.fichaAnterior, false);
  assert.equal(vista.destinoOcupado, false);
  assert.deepEqual(vista.legado, []);
  assert.equal(vista.ficha?.id, anterior.id);
  assert.equal(vista.ficha?.doc_curp, 'APROBADO');
  assert.equal(vista.ficha?.pago_certificado, 'EN_CURSO');
  assert.equal(vista.ficha?.enlace_drive, anterior.enlace_drive);
});

test('la ficha anterior pendiente se puede revisar frente a un destino vacío', () => {
  const vista = resolverVistaCertificacion([anterior], 'programa', true);
  assert.equal(vista.ficha, anterior);
  assert.equal(vista.fichaAnterior, true);
  assert.equal(vista.destinoOcupado, false);
});

test('una ficha diferente en destino sigue bloqueando la asociación sin sobrescribirla', () => {
  const existente = { ...anterior, id: 'otra-ficha', alumno_programa_id: 'programa' };
  const fichas = [anterior, existente];
  const copia = structuredClone(fichas);
  const vista = resolverVistaCertificacion(fichas, 'programa', true);
  assert.equal(vista.ficha, anterior);
  assert.equal(vista.destinoOcupado, true);
  assert.deepEqual(fichas, copia);
  const programa = resolverVistaCertificacion(fichas, 'programa', false);
  assert.equal(programa.ficha, existente);
  assert.equal(programa.destinoOcupado, false);
});

test('la consulta distingue programas por ID y no hereda la certificación de otro', () => {
  const guardada = { ...anterior, alumno_programa_id: 'programa-1' };
  for (const programaId of ['programa-2', '']) {
    const vista = resolverVistaCertificacion([guardada], programaId, true);
    assert.equal(vista.ficha, null);
    assert.equal(vista.fichaAnterior, false);
    assert.equal(vista.destinoOcupado, false);
  }
});

const programas = [{id:'programa',alumno_id:'alumno',plan_id:'plan',es_vigente:true}] as AlumnoPrograma[];
test('la consulta por programa mantiene pendiente la ficha anterior sin mostrar sus estados como propios',()=>{
  const vista=resolverVistaCertificacion([anterior],'programa',false);
  assert.equal(vista.ficha,null);
  assert.equal(vista.fichaAnterior,false);
  assert.deepEqual(vista.legado,[anterior]);
});

test('asignar preserva la misma ficha, todos sus datos y la revisión para el servidor',()=>{
  const copia=structuredClone(anterior);
  const propuesta=prepararAsociacionCertificacion(anterior.id,'programa','Acta revisada',[anterior],programas);
  assert.deepEqual(propuesta,{...anterior,alumno_programa_id:'programa'});
  assert.deepEqual(anterior,copia);
  assert.equal(propuesta.revision,anterior.revision);
});

test('asignar rechaza destino ocupado, programa de otro alumno y ausencia de respaldo',()=>{
  const ocupada={...anterior,id:'otra-ficha',alumno_programa_id:'programa'};
  assert.throws(()=>prepararAsociacionCertificacion(anterior.id,'programa','Respaldo',[anterior,ocupada],programas),/ya tiene certificación/);
  assert.throws(()=>prepararAsociacionCertificacion(anterior.id,'programa','Respaldo',[anterior],[{...programas[0],alumno_id:'otro'}]),/programa de este alumno/);
  assert.throws(()=>prepararAsociacionCertificacion(anterior.id,'programa','   ',[anterior],programas),/respaldo/);
});

test('no se reasigna una ficha ya vinculada ni se reutiliza una fuente archivada o ausente',()=>{
  for(const fichas of [[],[{...anterior,alumno_programa_id:'programa'}],[{...anterior,archivado_en:'2026-11-09T12:00:00Z'}]]){
    assert.throws(()=>prepararAsociacionCertificacion(anterior.id,'programa','Respaldo',fichas,programas),/ya no está disponible/);
  }
});
