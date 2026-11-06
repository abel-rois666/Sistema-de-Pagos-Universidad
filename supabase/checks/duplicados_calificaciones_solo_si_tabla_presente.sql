-- Solo lectura. Ejecutar únicamente si el preflight confirmó public.inscripciones_academicas.
select count(*) claves_con_multiples_inscripciones from (
  select alumno_id,ciclo_id,asignatura_id from public.inscripciones_academicas
  group by alumno_id,ciclo_id,asignatura_id having count(*)>1
) d;
