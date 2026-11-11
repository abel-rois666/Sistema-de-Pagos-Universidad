-- SOLO LECTURA. Ejecutar DESPUÉS de instalar 20261109220000.
select p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') acceso_anonimo,
 has_function_privilege('authenticated',p.oid,'EXECUTE') acceso_autenticado
from pg_proc p where p.oid in(to_regprocedure('public.ap_revisar_prueba_v1(uuid,uuid)'),
 to_regprocedure('public.ap_retirar_prueba_v1(uuid,uuid,text,text,text)')) order by p.proname;
-- Dos RPC: definer=true, anónimo=false, autenticado=true; search_path fijado.

-- Clasificación con datos ficticios; no consulta ni modifica alumnos.
with casos(nombre,j,esperado) as(values
 ('Materia vacía','{"parcial_1":null,"estatus":"Cursando","tipo_evaluacion":"Ordinario"}'::jsonb,true),
 ('Carga inicial sin evaluar','{"parcial_1":null,"estatus":"SIN_EVALUAR","observaciones":"Carga inicial","tipo_evaluacion":"Ordinario"}'::jsonb,true),
 ('Plantilla GES sin evaluar ni notas','{"parcial_1":null,"estatus":"SIN_EVALUAR","observaciones":"Importado de GES 4","tipo_evaluacion":"Ordinario"}'::jsonb,true),
 ('Cero es una nota','{"parcial_1":0}'::jsonb,false),
 ('NP es una nota','{"calificacion_final":-555}'::jsonb,false),
 ('Promedio sin final','{"promedio_calculado":8}'::jsonb,false),
 ('Bloqueo','{"bloqueo_p2":true}'::jsonb,false),
 ('Solicitud','{"solicitud_final":true}'::jsonb,false),
 ('Observación','{"observaciones":"Antecedente revisado"}'::jsonb,false),
 ('Estado concluido','{"estatus":"ACREDITADA"}'::jsonb,false),
 ('Campo desconocido','{"evidencia_nueva":null}'::jsonb,false)
) select nombre,public._ap_materia_prueba_v1(j)=esperado criterio_correcto from casos order by nombre;

with casos(nombre,j,esperado) as(values
 ('Captura declarable de prueba','{"pago_certificado":"COMPLETADO","doc_curp":"APROBADO"}'::jsonb,true),
 ('Trámite iniciado','{"fecha_inicio_tramite":"2026-01-01"}'::jsonb,false),
 ('Trámite completado','{"tramite_completado":true}'::jsonb,false),
 ('Documento enlazado','{"enlace_drive":"https://example.test/documento"}'::jsonb,false),
 ('Nota documental','{"doc_curp_nota":"Ver documento"}'::jsonb,false)
) select nombre,public._ap_certificado_prueba_v1(j)=esperado criterio_correcto from casos order by nombre;
-- Todos los criterios deben devolver true. No prueba la transacción ni los permisos por sesión.
