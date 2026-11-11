import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20261110010000_asociar_certificaciones_lote.sql','utf8');
test('el lote exige programa único contando históricos y respeta fichas existentes',()=>{
 assert.match(sql,/jsonb_array_length\(programas\)<>1/);
 assert.match(sql,/pendientes<>1/);
 assert.match(sql,/incluso archivada/);
 assert.doesNotMatch(sql,/where alumno_id=f\.alumno_id and es_vigente/);
});
test('solo asocia y audita, sin cambiar estados, pagos o cerrar programas',()=>{
 const escritura=sql.split('create function public.certificacion_asociar_lote_v1')[1];
 assert.match(escritura,/update public\.ficha_certificacion set alumno_programa_id=/);
 assert.match(escritura,/insert into public\.certificacion_auditoria/);
 assert.doesNotMatch(escritura,/public\.certificacion_guardar_v1|update public\.(alumnos|alumno_programas|recibos|planes_pago)\b|delete from/i);
});
test('se revalida el lote con límite, huella, destino y bloqueos antes de confirmar',()=>{
 assert.match(sql,/not between 1 and 50/);assert.match(sql,/for update/);
 assert.match(sql,/r->>'huella' is distinct from x->>'huella'/);
 assert.match(sql,/r->>'programaId' is distinct from x->>'programaId'/);
 assert.match(sql,/count\(distinct v->>'id'\)/);
 assert.match(sql,/rol='ADMINISTRADOR'/);
 assert.match(sql,/from public,anon/);
});
