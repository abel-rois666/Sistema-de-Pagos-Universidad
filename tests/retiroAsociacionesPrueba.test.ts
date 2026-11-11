import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20261109220000_retirar_asociaciones_de_prueba.sql','utf8');
const materia=sql.split('create function public._ap_materia_prueba_v1')[1].split('$$;')[0];
const certificado=sql.split('create function public._ap_certificado_prueba_v1')[1].split('$$;')[0];
const operacion=sql.split('create function public.ap_retirar_prueba_v1')[1].split('end $$;')[0];
// Contratos del SQL preparado. No ejecutan PostgreSQL ni acreditan permisos instalados.
test('las notas, observaciones, bloqueos y solicitudes se protegen sin considerar cero como vacío',()=>{
 for(const campo of ['parcial_1','parcial_2','parcial_3','calificacion_final','promedio_calculado','id_observacion_certificacion',
 'modificada_manualmente','observaciones','ciclo_legado','bloqueo_p1','bloqueo_p2','bloqueo_p3','bloqueo_final','solicitud_p1','solicitud_p2','solicitud_p3','solicitud_final'])assert.ok(materia.includes(`'${campo}'`),campo);
 assert.match(materia,/x\.value<>'null'::jsonb/);
 assert.match(materia,/'SIN_EVALUAR'/);
 assert.match(materia,/'CARGA INICIAL'/);
 assert.match(materia,/'IMPORTADO DE GES 4'/);
 assert.doesNotMatch(materia,/coalesce\([^)]*(?:parcial|calificacion)[^)]*,\s*0\)/i);
 assert.match(materia,/'\{\}'::jsonb/); // Campos desconocidos también bloquean.
});
test('la certificación con evidencia no se descarta como prueba',()=>{
 for(const campo of ['tramite_completado','fecha_inicio_tramite','fecha_termino_tramite','fecha_completado','enlace_drive'])assert.ok(certificado.includes(`'${campo}'`));
 assert.match(certificado,/doc%nota/);
 assert.match(certificado,/'\{\}'::jsonb/);
});
test('se exige una revisión actual y se conserva el respaldo antes de retirar materias',()=>{
 assert.match(operacion,/p_confirmacion is distinct from 'RETIRAR PRUEBA'/);
 assert.match(operacion,/r->>'huella' is distinct from p_huella/);
 assert.match(operacion,/for update/);
 assert.ok(operacion.indexOf('insert into public.asociaciones_programa_pruebas_auditoria')<operacion.indexOf('delete from public.inscripciones_academicas'));
 assert.match(operacion,/public\.ap_retirar_asociacion_v1/); // Conserva la protección existente del principal y del DELETE.
 assert.doesNotMatch(operacion,/(?:update|delete from)\s+public\.(?:planes_pago|recibos|planes_estudio)\b/i);
});
test('las fichas se conservan y solo una instantánea auditada puede dejar de bloquear',()=>{
 assert.match(operacion,/update public\.ficha_certificacion set alumno_programa_id=null,archivado_en=coalesce/);
 assert.doesNotMatch(operacion,/delete from public\.ficha_certificacion/);
 assert.match(sql,/jsonb_array_elements\(a\.certificados_despues\) c where c=j/);
 assert.match(sql,/strpos\(cuerpo,anterior\)=0/);
 assert.match(sql,/referencias=referencias\+n/);
 assert.match(sql,/public\.operaciones_academicas_auditoria/);
 assert.match(sql,/jsonb_build_array\(a\.antes,a\.despues\)/);
 assert.match(sql,/revoke all on function public\.ap_revisar_prueba_v1/);
 assert.match(sql,/enable row level security/);
});
